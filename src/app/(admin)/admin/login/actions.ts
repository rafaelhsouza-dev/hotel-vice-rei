"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, getActor } from "@/lib/auth/session";
import { findAdminCredentials, recordLoginFailure, recordLoginSuccess } from "@/lib/repo/users";
import { audit } from "@/lib/repo/audit";
import { ensureDatabase } from "@/lib/migrate";

export type LoginState = { error?: string };

/**
 * Two throttles: per account in the database (survives restarts, locks for
 * 15 min after 5 failures) and per address in memory (slows down someone
 * cycling through many accounts from one place).
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_PER_IP = 20;
const WINDOW_MS = 10 * 60 * 1000;

function ipThrottled(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_PER_IP;
}

function recordIpFailure(ip: string) {
  const entry = attempts.get(ip) ?? { count: 0, until: Date.now() + WINDOW_MS };
  entry.count += 1;
  attempts.set(ip, entry);
}

/** Only same-site admin paths; "//evil.com" and "/admin.evil" are refused. */
function safeNext(next: string): string {
  return /^\/admin(\/[\w\-./?=&%]*)?$/.test(next) && !next.startsWith("//") ? next : "/admin";
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const ip = (await clientIp()) || "unknown";

  if (!email || !password) {
    return { error: "Preencha o email e a palavra-passe." };
  }
  if (ipThrottled(ip)) {
    return { error: "Demasiadas tentativas. Tente novamente dentro de 10 minutos." };
  }

  // A cold container may serve the login page before the schema exists.
  await ensureDatabase();

  let user: Awaited<ReturnType<typeof findAdminCredentials>> = null;
  try {
    user = await findAdminCredentials(email);
  } catch {
    return { error: "Base de dados indisponível. Tente novamente em instantes." };
  }

  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { error: "Conta bloqueada temporariamente por tentativas falhadas. Tente dentro de 15 minutos." };
  }

  // Always run the hash comparison so a missing account and a wrong password
  // take a similar amount of time.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$00$00");

  if (!user || !ok || !user.active) {
    recordIpFailure(ip);
    if (user) {
      await recordLoginFailure(user.id).catch(() => {});
      await audit(null, "auth.login_failed", { entity: "user", id: user.id, summary: email });
    }
    return { error: user && ok && !user.active ? "Esta conta está desativada." : "Credenciais inválidas." };
  }

  await recordLoginSuccess(user.id).catch(() => {});
  await createSession(user);
  await audit({ id: user.id, email: user.email, name: user.name, role: user.role }, "auth.login", {
    entity: "user",
    id: user.id,
  });

  redirect(safeNext(next));
}

export async function logout() {
  const actor = await getActor();
  if (actor) await audit(actor, "auth.logout", { entity: "user", id: actor.id });
  await destroySession();
  redirect("/admin/login");
}
