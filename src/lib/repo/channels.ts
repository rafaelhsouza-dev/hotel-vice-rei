import { query, queryOne, transaction } from "../db";
import { decryptJson, encryptJson, maskSecret } from "../crypto";
import { getAdapter } from "../channels/registry";
import type { ChannelContext, ImportedReservation } from "../channels/types";

/** Persistence for connected channels, their room mapping and the sync log. */

export type Channel = {
  id: string;
  provider: string;
  kind: "ical" | "api";
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  status: "never" | "ok" | "error" | "disabled";
  lastSyncAt: string | null;
  lastError: string;
};

export type ChannelWithSecrets = Channel & {
  credentials: Record<string, string>;
  roomMap: ChannelContext["roomMap"];
};

type ChannelRow = {
  id: string;
  provider: string;
  kind: "ical" | "api";
  name: string;
  enabled: boolean;
  credentials: string;
  settings: Record<string, unknown>;
  status: Channel["status"];
  last_sync_at: Date | string | null;
  last_error: string;
};

const iso = (v: Date | string | null) =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    name: row.name,
    enabled: row.enabled,
    settings: row.settings ?? {},
    status: row.status,
    lastSyncAt: iso(row.last_sync_at),
    lastError: row.last_error ?? "",
  };
}

export async function listChannels(): Promise<Channel[]> {
  const rows = await query<ChannelRow>(
    `SELECT id, provider, kind, name, enabled, credentials, settings, status,
            last_sync_at, last_error
     FROM channels ORDER BY name`,
  );
  return rows.map(toChannel);
}

/** Loads a channel with decrypted credentials — server-side callers only. */
export async function getChannel(id: string): Promise<ChannelWithSecrets | null> {
  const row = await queryOne<ChannelRow>(
    `SELECT id, provider, kind, name, enabled, credentials, settings, status,
            last_sync_at, last_error
     FROM channels WHERE id = $1`,
    [id],
  );
  if (!row) return null;

  const maps = await query<{
    room_id: string;
    external_room_id: string;
    external_rate_id: string;
    ical_url: string;
  }>(
    `SELECT room_id, external_room_id, external_rate_id, ical_url
     FROM channel_room_map WHERE channel_id = $1`,
    [id],
  );

  return {
    ...toChannel(row),
    credentials: decryptJson(row.credentials),
    roomMap: Object.fromEntries(
      maps.map((m) => [
        m.room_id,
        {
          externalRoomId: m.external_room_id,
          externalRateId: m.external_rate_id,
          icalUrl: m.ical_url,
        },
      ]),
    ),
  };
}

/**
 * Credentials for the admin form: secret fields come back masked so the page
 * can show that something is stored without ever shipping the value.
 */
export async function getMaskedCredentials(id: string): Promise<Record<string, string>> {
  const channel = await getChannel(id);
  if (!channel) return {};
  const adapter = getAdapter(channel.provider);
  const secretKeys = new Set(adapter.credentialFields.filter((f) => f.secret).map((f) => f.key));
  return Object.fromEntries(
    Object.entries(channel.credentials).map(([key, value]) => [
      key,
      secretKeys.has(key) ? maskSecret(value) : value,
    ]),
  );
}

export type ChannelInput = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
};

export async function upsertChannel(input: ChannelInput): Promise<void> {
  const adapter = getAdapter(input.provider);
  await query(
    `INSERT INTO channels (id, provider, kind, name, enabled, settings)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       enabled = EXCLUDED.enabled,
       settings = EXCLUDED.settings,
       status = CASE WHEN EXCLUDED.enabled THEN channels.status ELSE 'disabled' END,
       updated_at = now()`,
    [
      input.id,
      input.provider,
      adapter.id === "ical" ? "ical" : "api",
      input.name,
      input.enabled,
      JSON.stringify(input.settings ?? {}),
    ],
  );
}

/**
 * Merges new credential values over the stored ones. Blank fields are left
 * untouched so re-saving the form does not erase a secret the operator could
 * only ever see masked.
 */
export async function saveCredentials(
  channelId: string,
  patch: Record<string, string>,
): Promise<void> {
  const channel = await getChannel(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const merged = { ...channel.credentials };
  for (const [key, value] of Object.entries(patch)) {
    const trimmed = value.trim();
    if (trimmed && !trimmed.includes("••••")) merged[key] = trimmed;
  }

  await query(`UPDATE channels SET credentials = $2, updated_at = now() WHERE id = $1`, [
    channelId,
    encryptJson(merged),
  ]);
}

export async function deleteChannel(id: string): Promise<void> {
  await query(`DELETE FROM channels WHERE id = $1`, [id]);
}

export async function setRoomMapping(
  channelId: string,
  roomId: string,
  mapping: { externalRoomId?: string; externalRateId?: string; icalUrl?: string },
): Promise<void> {
  await query(
    `INSERT INTO channel_room_map (channel_id, room_id, external_room_id, external_rate_id, ical_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (channel_id, room_id) DO UPDATE SET
       external_room_id = EXCLUDED.external_room_id,
       external_rate_id = EXCLUDED.external_rate_id,
       ical_url = EXCLUDED.ical_url`,
    [
      channelId,
      roomId,
      mapping.externalRoomId?.trim() ?? "",
      mapping.externalRateId?.trim() ?? "",
      mapping.icalUrl?.trim() ?? "",
    ],
  );
}

export async function setChannelStatus(
  id: string,
  status: Channel["status"],
  error = "",
): Promise<void> {
  await query(
    `UPDATE channels
     SET status = $2,
         last_error = $3,
         last_sync_at = CASE WHEN $2 = 'ok' THEN now() ELSE last_sync_at END,
         updated_at = now()
     WHERE id = $1`,
    [id, status, error.slice(0, 1000)],
  );
}

// --- imported reservations -------------------------------------------------

/**
 * Upserts a batch of imported reservations inside one transaction, so a
 * partial failure never leaves half a channel's calendar applied.
 *
 * Returns counts the sync log can report: how many were new, how many changed
 * and how many disappeared from the feed and were therefore cancelled.
 */
export async function applyImportedReservations(
  channelId: string,
  reservations: ImportedReservation[],
): Promise<{ created: number; updated: number; cancelled: number }> {
  return transaction(async (client) => {
    let created = 0;
    let updated = 0;

    for (const reservation of reservations) {
      const result = await client.query<{ inserted: boolean }>(
        `INSERT INTO channel_reservations
           (channel_id, external_id, room_id, guest_name, check_in, check_out, status, raw)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8::jsonb)
         ON CONFLICT (channel_id, external_id) DO UPDATE SET
           room_id    = EXCLUDED.room_id,
           guest_name = EXCLUDED.guest_name,
           check_in   = EXCLUDED.check_in,
           check_out  = EXCLUDED.check_out,
           status     = EXCLUDED.status,
           raw        = EXCLUDED.raw,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          channelId,
          reservation.externalId,
          reservation.roomId,
          reservation.guestName,
          reservation.checkIn,
          reservation.checkOut,
          reservation.status,
          JSON.stringify(reservation.raw ?? {}),
        ],
      );
      if (result.rows[0]?.inserted) created++;
      else updated++;
    }

    // A reservation that vanished from the feed was cancelled upstream: iCal
    // has no delete event, absence is the signal. Only future stays are
    // touched, so history is never rewritten.
    const seen = reservations.map((r) => r.externalId);
    const cancelled = await client.query(
      `UPDATE channel_reservations
       SET status = 'cancelled', updated_at = now()
       WHERE channel_id = $1
         AND status = 'confirmed'
         AND check_out >= CURRENT_DATE
         AND NOT (external_id = ANY($2::text[]))`,
      [channelId, seen],
    );

    return { created, updated, cancelled: cancelled.rowCount ?? 0 };
  });
}

export type ChannelReservation = {
  id: string;
  channelId: string;
  channelName: string;
  externalId: string;
  roomId: string | null;
  roomName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  bookingId: string | null;
};

export async function listChannelReservations(limit = 100): Promise<ChannelReservation[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT cr.id, cr.channel_id, c.name AS channel_name, cr.external_id, cr.room_id,
            COALESCE(r.name->>'pt', '—') AS room_name, cr.guest_name,
            cr.check_in, cr.check_out, cr.status, cr.booking_id
     FROM channel_reservations cr
     JOIN channels c ON c.id = cr.channel_id
     LEFT JOIN rooms r ON r.id = cr.room_id
     ORDER BY cr.check_in DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    channelId: String(r.channel_id),
    channelName: String(r.channel_name),
    externalId: String(r.external_id),
    roomId: (r.room_id as string) ?? null,
    roomName: String(r.room_name),
    guestName: String(r.guest_name ?? ""),
    checkIn: String(r.check_in).slice(0, 10),
    checkOut: String(r.check_out).slice(0, 10),
    status: String(r.status),
    bookingId: (r.booking_id as string) ?? null,
  }));
}

// --- sync log --------------------------------------------------------------

export type SyncLogEntry = {
  id: string;
  channelId: string | null;
  channelName: string;
  direction: "in" | "out";
  action: string;
  status: "ok" | "error" | "skipped";
  items: number;
  message: string;
  durationMs: number;
  createdAt: string;
};

export async function recordSync(entry: {
  channelId: string | null;
  direction: "in" | "out";
  action: string;
  status: "ok" | "error" | "skipped";
  items?: number;
  message?: string;
  durationMs?: number;
}): Promise<void> {
  await query(
    `INSERT INTO sync_log (channel_id, direction, action, status, items, message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.channelId,
      entry.direction,
      entry.action,
      entry.status,
      entry.items ?? 0,
      (entry.message ?? "").slice(0, 2000),
      entry.durationMs ?? 0,
    ],
  );
}

export async function listSyncLog(limit = 50): Promise<SyncLogEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.id, s.channel_id, COALESCE(c.name, 'Sistema') AS channel_name, s.direction,
            s.action, s.status, s.items, s.message, s.duration_ms, s.created_at
     FROM sync_log s
     LEFT JOIN channels c ON c.id = s.channel_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    channelId: (r.channel_id as string) ?? null,
    channelName: String(r.channel_name),
    direction: r.direction as "in" | "out",
    action: String(r.action),
    status: r.status as SyncLogEntry["status"],
    items: Number(r.items ?? 0),
    message: String(r.message ?? ""),
    durationMs: Number(r.duration_ms ?? 0),
    createdAt: iso(r.created_at as Date) ?? "",
  }));
}

/** Trims the log so it stays useful rather than unbounded. */
export async function pruneSyncLog(keepDays = 30): Promise<void> {
  await query(`DELETE FROM sync_log WHERE created_at < now() - ($1 || ' days')::interval`, [
    String(keepDays),
  ]);
}
