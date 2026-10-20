import { query, queryOne } from "../db";
import { hashPassword } from "../auth/password";
import { isRole, type Role } from "../auth/permissions";

/** Backoffice accounts. Passwords are scrypt hashes; see lib/auth/password.ts. */

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  staffId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lockedUntil: string | null;
};

export type AdminCredentials = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  passwordHash: string;
  sessionVersion: number;
  failedLogins: number;
  lockedUntil: Date | null;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, email, name, role, active, staff_id, created_at, last_login_at, locked_until
     FROM admin_users ORDER BY active DESC, name, email`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: String(r.name ?? ""),
    role: (isRole(String(r.role)) ? r.role : "reception") as Role,
    active: Boolean(r.active),
    staffId: (r.staff_id as string) ?? null,
    createdAt: iso(r.created_at) ?? "",
    lastLoginAt: iso(r.last_login_at),
    lockedUntil: iso(r.locked_until),
  }));
}

export async function findAdminCredentials(email: string): Promise<AdminCredentials | null> {
  const r = await queryOne<Record<string, unknown>>(
    `SELECT id, email, name, role, active, password_hash, session_version, failed_logins, locked_until
     FROM admin_users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  if (!r) return null;
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name ?? ""),
    role: (isRole(String(r.role)) ? r.role : "reception") as Role,
    active: Boolean(r.active),
    passwordHash: String(r.password_hash),
    sessionVersion: Number(r.session_version ?? 1),
    failedLogins: Number(r.failed_logins ?? 0),
    lockedUntil: (r.locked_until as Date) ?? null,
  };
}

export async function findAdminById(id: string): Promise<AdminCredentials | null> {
  const r = await queryOne<{ email: string }>(`SELECT email FROM admin_users WHERE id = $1`, [id]);
  return r ? findAdminCredentials(r.email) : null;
}

/** After 5 consecutive failures the account locks for 15 minutes. */
export async function recordLoginFailure(id: string): Promise<void> {
  await query(
    `UPDATE admin_users SET
       failed_logins = failed_logins + 1,
       locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = $1`,
    [id],
  );
}

export async function recordLoginSuccess(id: string): Promise<void> {
  await query(
    `UPDATE admin_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
    [id],
  );
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
  staffId: string | null;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO admin_users (email, name, role, password_hash, staff_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [input.email.toLowerCase().trim(), input.name.trim(), input.role, await hashPassword(input.password), input.staffId],
  );
  return row!.id;
}

/**
 * Role or status changes bump session_version so the person's open sessions
 * end immediately rather than keeping the old rights for hours.
 */
export async function updateAdminUser(
  id: string,
  input: { name: string; role: Role; active: boolean; staffId: string | null },
): Promise<void> {
  await query(
    `UPDATE admin_users SET
       name = $2, staff_id = $5,
       session_version = session_version + CASE WHEN role <> $3 OR active <> $4 THEN 1 ELSE 0 END,
       role = $3, active = $4, updated_at = now()
     WHERE id = $1`,
    [id, input.name.trim(), input.role, input.active, input.staffId],
  );
}

export async function setAdminPassword(id: string, password: string): Promise<void> {
  await query(
    `UPDATE admin_users SET password_hash = $2, session_version = session_version + 1,
       failed_logins = 0, locked_until = NULL, updated_at = now()
     WHERE id = $1`,
    [id, await hashPassword(password)],
  );
}

export async function unlockAdminUser(id: string): Promise<void> {
  await query(`UPDATE admin_users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [id]);
}

/** Ends every open session of the account without changing anything else. */
export async function revokeSessions(id: string): Promise<void> {
  await query(`UPDATE admin_users SET session_version = session_version + 1 WHERE id = $1`, [id]);
}

/** Owners that can still sign in — the last one must never be removed. */
export async function countActiveOwners(): Promise<number> {
  const r = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM admin_users WHERE active AND role IN ('owner','admin')`,
  );
  return Number(r?.n ?? 0);
}

/** Minimum bar for a staff password; returns a reason or null. */
export function passwordProblem(password: string, email = ""): string | null {
  if (password.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (password.length > 200) return "A palavra-passe é demasiado longa.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Use letras e números na palavra-passe.";
  }
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "A palavra-passe não pode conter o seu email.";
  }
  return null;
}
