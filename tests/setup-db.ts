import { readFileSync } from "node:fs";

/**
 * Integration tests run against the throwaway Postgres in .env.local
 * (DATABASE_URL). They are skipped when it is not set, so `npm test` stays
 * green on a machine without Docker. Never point this at production: the
 * tests create and delete bookings.
 */
export function loadTestDatabase(): boolean {
  if (!process.env.DATABASE_URL) {
    try {
      for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
      }
    } catch {
      /* no local env */
    }
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) return false;
  process.env.DATA_SOURCE = "postgres";
  return true;
}
