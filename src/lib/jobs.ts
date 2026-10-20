import { getPool, isDbConfigured, query } from "./db";

/**
 * Background work: releasing unpaid holds, arrival reminders, SIBA, channel
 * sync and log housekeeping.
 *
 * Runs inside the app process on a timer (started from instrumentation.ts),
 * so a single EasyPanel container needs no external cron. Each job takes a
 * Postgres advisory lock first, which keeps two replicas — or a timer tick
 * and a manual run from the admin — from doing the same work twice. The same
 * jobs can be triggered from outside through /api/cron.
 */

export type JobName = "payments" | "reminders" | "siba" | "channels" | "housekeeping";

export const JOB_LABEL: Record<JobName, string> = {
  payments: "Expirar pagamentos e libertar quartos",
  reminders: "Lembretes de chegada e check-in online",
  siba: "Envio automático ao SIBA",
  channels: "Sincronização de canais (iCal / API)",
  housekeeping: "Limpeza de registos antigos",
};

/** Minimum minutes between runs. */
const EVERY: Record<JobName, number> = {
  payments: 5,
  reminders: 60,
  siba: 60,
  channels: 30,
  housekeeping: 24 * 60,
};

async function runners(): Promise<Record<JobName, () => Promise<string>>> {
  return {
    async payments() {
      const { expireStalePayments } = await import("./payments/service");
      const { readBookingRules } = await import("./repo/rate-plans");
      const { notifyCancelled } = await import("./email/notify");
      const rules = await readBookingRules();
      const { expired, released } = await expireStalePayments(rules.paymentHoldHours);
      for (const id of released) await notifyCancelled(id, "expired");
      return `${expired} pagamento(s) expirado(s), ${released.length} reserva(s) libertada(s).`;
    },
    async reminders() {
      const { sendArrivalReminders } = await import("./email/notify");
      return `${await sendArrivalReminders()} lembrete(s) enviado(s).`;
    },
    async siba() {
      const { getSibaConfig, sendPendingBulletins } = await import("./siba/service");
      const { enabled, autoSend } = await getSibaConfig();
      if (!enabled || !autoSend) return "Envio automático desligado.";
      const run = await sendPendingBulletins();
      if (run.result && !run.result.ok) throw new Error(run.result.message);
      return `${run.sent} boletim(ns) enviado(s), ${run.skipped} com dados em falta.`;
    },
    async channels() {
      const { syncAllChannels } = await import("./channels/engine");
      const outcomes = await syncAllChannels();
      const failed = outcomes.filter((o) => !o.ok).length;
      if (failed) throw new Error(`${failed} de ${outcomes.length} canal(is) com erro.`);
      return `${outcomes.length} canal(is) sincronizado(s).`;
    },
    async housekeeping() {
      const { pruneSyncLog } = await import("./repo/channels");
      await pruneSyncLog();
      await query(`DELETE FROM email_log WHERE created_at < now() - interval '18 months'`);
      // Guest identity data is kept only as long as the law requires
      // (registration bulletins: 1 year after the stay), then anonymised.
      await query(
        `UPDATE booking_guests g SET document_number = '', birth_date = NULL, birth_place = ''
         FROM bookings b WHERE b.id = g.booking_id AND g.document_number <> ''
           AND b.check_out < CURRENT_DATE - interval '1 year'`,
      );
      return "Registos antigos removidos.";
    },
  };
}

export async function runJob(name: JobName, opts: { force?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
  if (!isDbConfigured()) return { ok: false, message: "Base de dados não configurada." };
  const client = await getPool().connect();
  const started = Date.now();
  try {
    const { rows } = await client.query<{ got: boolean }>(`SELECT pg_try_advisory_lock(hashtext($1)) AS got`, [`vicerei:job:${name}`]);
    if (!rows[0]?.got) return { ok: true, message: "Já está a correr noutra instância." };
    try {
      if (!opts.force) {
        const last = await client.query<{ last_run_at: Date | null }>(`SELECT last_run_at FROM job_runs WHERE name = $1`, [name]);
        const at = last.rows[0]?.last_run_at;
        if (at && Date.now() - at.getTime() < EVERY[name] * 60_000 - 10_000) {
          return { ok: true, message: "Ainda não é altura." };
        }
      }
      let ok = true;
      let message: string;
      try {
        message = await (await runners())[name]();
      } catch (err) {
        ok = false;
        message = (err as Error).message;
        console.error(`[jobs] ${name} failed:`, message);
      }
      await client.query(
        `INSERT INTO job_runs (name, last_run_at, last_ok, message, duration_ms) VALUES ($1, now(), $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET last_run_at = now(), last_ok = $2, message = $3, duration_ms = $4`,
        [name, ok, message.slice(0, 500), Date.now() - started],
      );
      return { ok, message };
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [`vicerei:job:${name}`]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

export async function runDueJobs(): Promise<void> {
  for (const name of Object.keys(EVERY) as JobName[]) {
    await runJob(name).catch((err) => console.error(`[jobs] ${name}:`, (err as Error).message));
  }
}

export type JobStatus = { name: JobName; label: string; everyMinutes: number; lastRunAt: string | null; lastOk: boolean | null; message: string };

export async function listJobs(): Promise<JobStatus[]> {
  const rows = await query<{ name: JobName; last_run_at: Date | null; last_ok: boolean | null; message: string }>(
    `SELECT name, last_run_at, last_ok, message FROM job_runs`,
  ).catch(() => []);
  return (Object.keys(EVERY) as JobName[]).map((name) => {
    const r = rows.find((x) => x.name === name);
    return {
      name,
      label: JOB_LABEL[name],
      everyMinutes: EVERY[name],
      lastRunAt: r?.last_run_at ? r.last_run_at.toISOString() : null,
      lastOk: r?.last_ok ?? null,
      message: r?.message ?? "",
    };
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __vicereiJobs: NodeJS.Timeout | undefined;
}

/** Starts the in-process scheduler once per server instance. */
export function startScheduler(): void {
  if (globalThis.__vicereiJobs || process.env.DISABLE_JOBS === "1") return;
  // First pass a minute after boot, so start-up and migrations finish first.
  const tick = () => void runDueJobs();
  setTimeout(tick, 60_000).unref?.();
  globalThis.__vicereiJobs = setInterval(tick, 5 * 60_000);
  globalThis.__vicereiJobs.unref?.();
}
