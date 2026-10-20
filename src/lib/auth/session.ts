import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./jwt";
import { can, permissionForPath, type Permission, type Role } from "./permissions";
import { queryOne } from "../db";

/** Session helpers for the Node runtime (server components and actions). */

const MAX_AGE = 60 * 60 * 8; // 8 hours

export type AdminActor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed cookie proves who logged in; the database says whether that
 * person may still act. Re-reading the row means a deactivated account, a
 * changed password or a downgraded role takes effect on the next request
 * instead of when the cookie expires. Cached per request.
 */
export const getActor = cache(async (): Promise<AdminActor | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    const row = await queryOne<{
      id: string;
      email: string;
      name: string;
      role: Role;
      active: boolean;
      session_version: number;
    }>(
      `SELECT id, email, name, role, active, session_version
       FROM admin_users WHERE id = $1`,
      [session.sub],
    );
    if (!row || !row.active) return null;
    if ((session.ver ?? 1) !== row.session_version) return null;
    return { id: row.id, email: row.email, name: row.name, role: row.role };
  } catch {
    return null;
  }
});

/**
 * Guards every admin surface. The proxy already redirects unauthenticated
 * requests, but this second check is what actually protects the data — a
 * proxy alone must never be the only barrier.
 */
export async function requireSession(): Promise<AdminActor> {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

/** Same as requireSession, plus the role must grant `permission`. */
export async function requirePermission(permission: Permission): Promise<AdminActor> {
  const actor = await requireSession();
  if (!can(actor.role, permission)) redirect("/admin/sem-acesso");
  return actor;
}

/** Passes when the role grants any one of `permissions`. */
export async function requireAnyPermission(...permissions: Permission[]): Promise<AdminActor> {
  const actor = await requireSession();
  if (!permissions.some((p) => can(actor.role, p))) redirect("/admin/sem-acesso");
  return actor;
}

/** Page guard: the permission mapped to this admin path (see ROUTE_PERMISSIONS). */
export async function requirePagePermission(path: string): Promise<AdminActor> {
  const needed = permissionForPath(path);
  return needed ? requirePermission(needed) : requireSession();
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const actor = await getActor();
  return Boolean(actor && can(actor.role, permission));
}

export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  sessionVersion: number;
}): Promise<void> {
  const token = await signSession(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ver: user.sessionVersion,
    },
    MAX_AGE,
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Best-effort client address for the audit log, behind EasyPanel's proxy. */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return (forwarded || h.get("x-real-ip") || "").slice(0, 64);
  } catch {
    return "";
  }
}
