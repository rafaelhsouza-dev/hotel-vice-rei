import { query } from "../db";
import { clientIp, type AdminActor } from "../auth/session";

/**
 * Append-only record of who changed what in the backoffice.
 *
 * Writing the audit entry never blocks or fails the change it describes: if
 * the insert fails the error is logged and the operator's action stands.
 * Secrets never reach `details` — callers pass field names, not values.
 */

export type AuditEntry = {
  id: number;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  details: Record<string, unknown>;
  ip: string;
  createdAt: string;
};

export async function audit(
  actor: AdminActor | null,
  action: string,
  target: { entity?: string; id?: string | number | null; summary?: string; details?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, summary, details, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [
        actor?.id ?? null,
        actor?.email ?? "sistema",
        action,
        target.entity ?? "",
        target.id == null ? "" : String(target.id),
        (target.summary ?? "").slice(0, 500),
        JSON.stringify(target.details ?? {}),
        await clientIp(),
      ],
    );
  } catch (err) {
    console.error("[audit] could not record", action, (err as Error).message);
  }
}

export async function listAudit(opts: {
  entity?: string;
  entityId?: string;
  actor?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: AuditEntry[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.entity) {
    params.push(opts.entity);
    where.push(`entity = $${params.length}`);
  }
  if (opts.entityId) {
    params.push(opts.entityId);
    where.push(`entity_id = $${params.length}`);
  }
  if (opts.actor) {
    params.push(opts.actor.toLowerCase());
    where.push(`lower(actor_email) = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(lower(summary) LIKE $${params.length} OR lower(action) LIKE $${params.length} OR entity_id ILIKE $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);

  const [rows, count] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT * FROM audit_log ${clause} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM audit_log ${clause}`, params),
  ]);
  return {
    total: Number(count[0]?.n ?? 0),
    items: rows.map((r) => ({
      id: Number(r.id),
      actorEmail: String(r.actor_email ?? ""),
      action: String(r.action),
      entity: String(r.entity ?? ""),
      entityId: String(r.entity_id ?? ""),
      summary: String(r.summary ?? ""),
      details: (r.details as Record<string, unknown>) ?? {},
      ip: String(r.ip ?? ""),
      createdAt: (r.created_at as Date).toISOString(),
    })),
  };
}

/** Field names that identify what was changed; values of anything else are never logged. */
const IDENTIFYING = ["id", "slug", "code", "table", "roomId", "unitId", "bookingId", "channelId", "itemId", "status", "from", "to"];
const SECRET = /pass|secret|token|key|cred|invite/i;

/**
 * Audit entry for a form-driven action: records the identifying fields and
 * the *names* of the other fields submitted — enough to answer "who changed
 * this room on Tuesday" without copying content or secrets into the log.
 */
export async function auditForm(actor: AdminActor, action: string, form: FormData | null): Promise<void> {
  const details: Record<string, unknown> = {};
  const fields: string[] = [];
  if (form) {
    for (const [key, value] of form.entries()) {
      if (key.startsWith("$ACTION")) continue;
      if (IDENTIFYING.includes(key) && typeof value === "string" && !SECRET.test(key)) {
        details[key] = value.slice(0, 120);
      } else if (!fields.includes(key)) {
        fields.push(key);
      }
    }
  }
  if (fields.length) details.fields = fields.slice(0, 40);
  const id = (details.id ?? details.slug ?? details.code ?? details.bookingId ?? details.roomId ?? "") as string;
  await audit(actor, action, { entity: action.replace(/^(save|remove|delete|set|change|create|add|toggle|move|record)/, "").toLowerCase(), id, details });
}
