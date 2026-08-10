import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./jwt";

/** Session helpers for the Node runtime (server components and actions). */

const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Guards every admin surface. The proxy already redirects unauthenticated
 * requests, but this second check is what actually protects the data — a
 * proxy alone must never be the only barrier.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): Promise<void> {
  const token = await signSession(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
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
