import { query, queryOne } from "../db";
import { decryptJson, encryptJson, maskSecret } from "../crypto";

/**
 * Storage for the external services the hotel connects from the admin:
 * payments, invoicing, e-mail and SIBA. Channel managers live in `channels`.
 *
 * Contract shared with the channel credentials: secret values are encrypted
 * at rest, come back to the form masked, and a blank or still-masked field on
 * save keeps whatever was stored — so re-saving a form never erases a key.
 */

export type IntegrationRecord = {
  id: string;
  enabled: boolean;
  mode: "test" | "live";
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastMessage: string;
  updatedAt: string | null;
};

type Row = {
  id: string;
  enabled: boolean;
  mode: "test" | "live";
  credentials: string;
  settings: Record<string, unknown>;
  last_test_at: Date | null;
  last_test_ok: boolean | null;
  last_message: string;
  updated_at: Date | null;
};

function toRecord(row: Row | null, id: string): IntegrationRecord {
  if (!row) {
    return {
      id,
      enabled: false,
      mode: "test",
      credentials: {},
      settings: {},
      lastTestAt: null,
      lastTestOk: null,
      lastMessage: "",
      updatedAt: null,
    };
  }
  return {
    id: row.id,
    enabled: row.enabled,
    mode: row.mode,
    credentials: decryptJson(row.credentials),
    settings: row.settings ?? {},
    lastTestAt: row.last_test_at ? row.last_test_at.toISOString() : null,
    lastTestOk: row.last_test_ok,
    lastMessage: row.last_message ?? "",
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

/** Decrypted — server-side callers only, never pass to a client component. */
export async function getIntegration(id: string): Promise<IntegrationRecord> {
  const row = await queryOne<Row>(`SELECT * FROM integrations WHERE id = $1`, [id]);
  return toRecord(row, id);
}

/** Never throws: a missing database simply means "not configured". */
export async function getIntegrationSafe(id: string): Promise<IntegrationRecord> {
  try {
    return await getIntegration(id);
  } catch {
    return toRecord(null, id);
  }
}

export async function listIntegrations(): Promise<IntegrationRecord[]> {
  const rows = await query<Row>(`SELECT * FROM integrations ORDER BY id`);
  return rows.map((r) => toRecord(r, r.id));
}

/** For the admin form: secrets replaced by a recognisable mask. */
export function maskCredentials(
  credentials: Record<string, string>,
  secretKeys: Iterable<string>,
): Record<string, string> {
  const secrets = new Set(secretKeys);
  return Object.fromEntries(
    Object.entries(credentials).map(([k, v]) => [k, secrets.has(k) ? maskSecret(v) : v]),
  );
}

const isMasked = (value: string) => value.includes("••••");

export async function saveIntegration(
  id: string,
  input: {
    enabled: boolean;
    mode: "test" | "live";
    credentials: Record<string, string>;
    settings: Record<string, unknown>;
  },
): Promise<{ changedFields: string[] }> {
  const current = await getIntegration(id);
  const merged: Record<string, string> = { ...current.credentials };
  const changedFields: string[] = [];
  for (const [key, value] of Object.entries(input.credentials)) {
    if (!value || isMasked(value)) continue;
    if (merged[key] !== value) changedFields.push(key);
    merged[key] = value;
  }

  await query(
    `INSERT INTO integrations (id, enabled, mode, credentials, settings, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       mode = EXCLUDED.mode,
       credentials = EXCLUDED.credentials,
       settings = EXCLUDED.settings,
       updated_at = now()`,
    [id, input.enabled, input.mode, encryptJson(merged), JSON.stringify(input.settings)],
  );
  return { changedFields };
}

/** Explicitly forgets one stored credential (the "remover" button). */
export async function clearIntegrationCredential(id: string, key: string): Promise<void> {
  const current = await getIntegration(id);
  delete current.credentials[key];
  await query(
    `UPDATE integrations SET credentials = $2, updated_at = now() WHERE id = $1`,
    [id, encryptJson(current.credentials)],
  );
}

export async function recordIntegrationTest(
  id: string,
  ok: boolean,
  message: string,
): Promise<void> {
  await query(
    `INSERT INTO integrations (id, last_test_at, last_test_ok, last_message)
     VALUES ($1, now(), $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       last_test_at = now(), last_test_ok = $2, last_message = $3`,
    [id, ok, message.slice(0, 500)],
  );
}

/** Stores provider-side state (e.g. a webhook secret Stripe hands back). */
export async function patchIntegrationSettings(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO integrations (id, settings) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET settings = integrations.settings || $2::jsonb, updated_at = now()`,
    [id, JSON.stringify(patch)],
  );
}
