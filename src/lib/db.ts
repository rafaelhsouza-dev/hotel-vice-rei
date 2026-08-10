import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

/**
 * Return `date` columns as the plain 'YYYY-MM-DD' string Postgres stores.
 *
 * By default node-postgres builds a JS Date at local midnight; converting that
 * back through toISOString() shifts the day whenever the offset is positive,
 * which silently moved every check-in date back by one.
 */
types.setTypeParser(1082, (value: string) => value);

/**
 * Postgres access layer.
 *
 * The site must keep building and rendering even when no database is reachable
 * — the Docker image is built on a host that cannot see the Swarm overlay
 * network where Postgres lives. Every helper here therefore reports failure
 * instead of throwing, and callers fall back to the seed data.
 */

declare global {
  // eslint-disable-next-line no-var
  var __vicereiPool: Pool | undefined;
}

export function isDbConfigured(): boolean {
  if (process.env.DATA_SOURCE === "mock") return false;
  return Boolean(
    process.env.DATABASE_URL ||
      (process.env.POSTGRES_HOST &&
        process.env.POSTGRES_DB &&
        process.env.POSTGRES_USER),
  );
}

export function getPool(): Pool {
  if (!globalThis.__vicereiPool) {
    const connectionString = process.env.DATABASE_URL;
    globalThis.__vicereiPool = connectionString
      ? new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 })
      : new Pool({
          host: process.env.POSTGRES_HOST,
          port: Number(process.env.POSTGRES_PORT ?? 5432),
          database: process.env.POSTGRES_DB,
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASS,
          max: 8,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });

    // A pool-level error would otherwise crash the process on a dropped
    // backend connection.
    globalThis.__vicereiPool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
  }
  return globalThis.__vicereiPool;
}

/** Runs a query, returning rows. Throws — use `safeQuery` for render paths. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** Runs a query, returning `null` when the database is absent or failing. */
export async function safeQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[] | null> {
  if (!isDbConfigured()) return null;
  try {
    return await query<T>(text, params);
  } catch (err) {
    console.error("[db] query failed:", (err as Error).message);
    return null;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction, rolling back on any error. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
