import { query, queryOne } from "../db";
import { getIntegrationSafe } from "../repo/integrations";
import { exportBulletinsFile, submitBulletins, testConnection } from "./client";
import { validateBulletin, lisbonToday } from "./xml";
import { requiresBulletin } from "./countries";
import type { SibaBulletin, SibaConfig, SibaEstablishment, SibaSubmitResult } from "./types";

/**
 * SIBA from the PMS side: which guests still need a bulletin, sending them,
 * and the manual fallback file. Guests are reported once they have arrived
 * (status checked-in or checked-out); SIBA rejects entry dates in the future.
 */

export async function getSibaConfig(): Promise<{ enabled: boolean; config: SibaConfig; autoSend: boolean }> {
  const r = await getIntegrationSafe("siba");
  return {
    enabled: r.enabled,
    autoSend: r.settings.autoSend === true,
    config: {
      mode: r.mode,
      credentials: {
        nipc: r.credentials.nipc ?? "",
        establishment: r.credentials.establishment ?? "00",
        accessKey: r.credentials.accessKey ?? "",
      },
      settings: r.settings,
    },
  };
}

export async function getEstablishment(config: SibaConfig): Promise<SibaEstablishment> {
  const s = await queryOne<{ name: string; street: string; city: string; postal_code: string; phones: string[]; email: string }>(
    `SELECT name, street, city, postal_code, phones, email FROM settings WHERE id = 1`,
  );
  const set = config.settings as Record<string, unknown>;
  return {
    name: String(set.establishmentName || s?.name || "Hotel Vice-Rei"),
    address: String(set.address || s?.street || ""),
    city: String(set.city || s?.city || ""),
    postalCode: String(set.postalCode || s?.postal_code || ""),
    contactName: String(set.contactName || "Receção"),
    phone: String(set.phone || s?.phones?.[0] || ""),
    email: String(set.email || s?.email || ""),
  };
}

export type PendingGuest = {
  guestId: string;
  bookingId: string;
  reference: string;
  name: string;
  checkIn: string;
  checkOut: string;
  status: string;
  message: string;
  bulletin: SibaBulletin;
  problems: string[];
};

const day = (v: unknown) => String(v ?? "").slice(0, 10);

/** Guests that need (or failed) a bulletin, for stays that have started. */
export async function listPendingGuests(): Promise<PendingGuest[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT g.*, b.reference, b.check_in, b.check_out, b.status AS booking_status
     FROM booking_guests g JOIN bookings b ON b.id = g.booking_id
     WHERE g.siba_status IN ('pending','error')
       AND b.status IN ('checked_in','checked_out')
     ORDER BY b.check_in, b.reference`,
  );
  const today = lisbonToday();
  return rows
    .filter((r) => requiresBulletin(String(r.nationality ?? "")))
    .map((r) => {
      const bulletin: SibaBulletin = {
        guestId: String(r.id),
        lastName: String(r.last_name ?? ""),
        firstNames: String(r.first_name ?? ""),
        nationality: String(r.nationality ?? ""),
        birthDate: r.birth_date ? day(r.birth_date) : "",
        birthPlace: String(r.birth_place ?? ""),
        documentType: String(r.document_type ?? ""),
        documentNumber: String(r.document_number ?? ""),
        documentCountry: String(r.document_country ?? ""),
        residenceCountry: String(r.residence_country ?? ""),
        residenceCity: String(r.residence_city ?? ""),
        checkIn: day(r.check_in),
        checkOut: day(r.check_out),
      };
      return {
        guestId: String(r.id),
        bookingId: String(r.booking_id),
        reference: String(r.reference),
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        checkIn: day(r.check_in),
        checkOut: day(r.check_out),
        status: String(r.siba_status),
        message: String(r.siba_message ?? ""),
        bulletin,
        problems: validateBulletin(bulletin, today),
      };
    });
}

/** Reserves the next file number atomically (SIBA's Numero_Ficheiro). */
async function nextFileNumber(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `INSERT INTO integrations (id, settings) VALUES ('siba', '{"fileNumber":1}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET settings = jsonb_set(
       integrations.settings, '{fileNumber}',
       to_jsonb(CASE WHEN COALESCE((integrations.settings->>'fileNumber')::int, 0) >= 99999 THEN 1
                     ELSE COALESCE((integrations.settings->>'fileNumber')::int, 0) + 1 END))
     RETURNING settings->>'fileNumber' AS n`,
  );
  return Number(row?.n ?? 1);
}

export type SibaRun = { sent: number; skipped: number; result: SibaSubmitResult | null };

/**
 * Sends every valid pending bulletin in one file. Guests with incomplete data
 * are left pending with the reason, so one missing passport number never
 * blocks the rest of the hotel's bulletins.
 */
export async function sendPendingBulletins(onlyGuestIds?: string[]): Promise<SibaRun> {
  const { enabled, config } = await getSibaConfig();
  if (!enabled) return { sent: 0, skipped: 0, result: { ok: false, code: "DISABLED", message: "SIBA não está ativo em Ligações." } };
  const all = await listPendingGuests();
  const pending = onlyGuestIds ? all.filter((g) => onlyGuestIds.includes(g.guestId)) : all;
  const ready = pending.filter((g) => g.problems.length === 0);
  for (const g of pending.filter((x) => x.problems.length > 0)) {
    await query(`UPDATE booking_guests SET siba_message = $2, updated_at = now() WHERE id = $1`, [
      g.guestId,
      g.problems.join(" ").slice(0, 500),
    ]);
  }
  if (ready.length === 0) return { sent: 0, skipped: pending.length, result: null };

  const establishment = await getEstablishment(config);
  const fileNumber = await nextFileNumber();
  const result = await submitBulletins(config, establishment, ready.map((g) => g.bulletin), fileNumber);
  const ids = ready.map((g) => g.guestId);
  if (result.ok) {
    await query(
      `UPDATE booking_guests SET siba_status = 'sent', siba_sent_at = now(), siba_message = $2, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids, `Ficheiro ${fileNumber} (${config.mode === "live" ? "produção" : "testes"})`],
    );
  } else {
    await query(
      `UPDATE booking_guests SET siba_status = 'error', siba_message = $2, updated_at = now() WHERE id = ANY($1::uuid[])`,
      [ids, `${result.code}: ${result.message}`.slice(0, 500)],
    );
  }
  return { sent: result.ok ? ready.length : 0, skipped: pending.length - ready.length, result };
}

/** Manual fallback: the file to upload in the SIBA portal (.DAT) or XML. */
export async function buildExportFile(format: "dat" | "xml") {
  const { config } = await getSibaConfig();
  const pending = (await listPendingGuests()).filter((g) => g.problems.length === 0);
  const establishment = await getEstablishment(config);
  const fileNumber = await nextFileNumber();
  return {
    file: exportBulletinsFile(config, establishment, pending.map((g) => g.bulletin), fileNumber, { format }),
    guestIds: pending.map((g) => g.guestId),
  };
}

/** After a manual upload succeeded in the portal. */
export async function markGuestsSent(guestIds: string[], note: string): Promise<void> {
  if (guestIds.length === 0) return;
  await query(
    `UPDATE booking_guests SET siba_status = 'sent', siba_sent_at = now(), siba_message = $2, updated_at = now()
     WHERE id = ANY($1::uuid[])`,
    [guestIds, note.slice(0, 300)],
  );
}

export async function testSiba(): Promise<SibaSubmitResult> {
  const { config } = await getSibaConfig();
  return testConnection(config);
}

/** Bulletins are due within 3 working days; anything older is flagged. */
export async function overdueCount(): Promise<number> {
  const rows = await listPendingGuests().catch(() => []);
  const today = lisbonToday();
  return rows.filter((g) => {
    const d = new Date(`${g.checkIn}T00:00:00Z`);
    let workdays = 0;
    while (d.toISOString().slice(0, 10) < today) {
      d.setUTCDate(d.getUTCDate() + 1);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) workdays++;
    }
    return workdays >= 3;
  }).length;
}
