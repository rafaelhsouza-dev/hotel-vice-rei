"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { findAdminByEmail, touchLastLogin } from "@/lib/repo/ops";
import { ensureDatabase } from "@/lib/migrate";

export type LoginState = { error?: string };

/** Rejects everything if the same failure appears repeatedly from one process. */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;

function throttled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: Date.now() + LOCKOUT_MS };
  entry.count += 1;
  entry.until = Date.now() + LOCKOUT_MS;
  attempts.set(key, entry);
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    return { error: "Preencha o email e a palavra-passe." };
  }
  if (throttled(email)) {
    return { error: "Demasiadas tentativas. Tente novamente dentro de 10 minutos." };
  }

  // A cold container may serve the login page before the schema exists.
  await ensureDatabase();

  let user: Awaited<ReturnType<typeof findAdminByEmail>> = null;
  try {
    user = await findAdminByEmail(email);
  } catch {
    return { error: "Base de dados indisponível. Tente novamente em instantes." };
  }

  // Always run the hash comparison so a missing account and a wrong password
  // take a similar amount of time.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$00$00");

  if (!user || !ok) {
    recordFailure(email);
    return { error: "Credenciais inválidas." };
  }

  attempts.delete(email);
  await createSession(user);
  await touchLastLogin(user.id).catch(() => {});

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
