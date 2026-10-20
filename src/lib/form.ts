import { locales, type Locale } from "@/i18n/config";

/** FormData readers shared by the admin server actions. Never throw. */

export function str(form: FormData, key: string, fallback = "", max = 5000): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

export function int(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key));
  return str(form, key) !== "" && Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Empty → null, so optional numeric fields can mean "no limit". */
export function intOrNull(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function dec(form: FormData, key: string, fallback = 0): number {
  const raw = str(form, key).replace(/\s/g, "").replace(",", ".");
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) ? n : fallback;
}

export function decOrNull(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(/\s/g, "").replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Tri-state select: "" keeps the stored value, "1"/"0" set it. */
export function triState(form: FormData, key: string): boolean | undefined {
  const v = str(form, key);
  return v === "1" ? true : v === "0" ? false : undefined;
}

export function date(form: FormData, key: string): string | null {
  const v = str(form, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null;
}

export function oneOf<T extends readonly string[]>(value: string, allowed: T, fallback: T[number] = allowed[0]): T[number] {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

export function trio(form: FormData, name: string): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, str(form, `${name}.${l}`)])) as Record<Locale, string>;
}

export function isEmail(v: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

/** Lower-case slug for ids typed by the operator. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Appends ?ok= / ?erro= to a redirect target, keeping any #fragment at the
 * end where browsers expect it (`/x#conta?ok=` would lose the message).
 */
export function withFlash(path: string, kind: "ok" | "erro", message: string): string {
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${kind}=${encodeURIComponent(message.slice(0, 600))}${hash ? `#${hash}` : ""}`;
}
