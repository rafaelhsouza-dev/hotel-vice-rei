import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for third-party credentials (channels, payments,
 * invoicing, e-mail, SIBA).
 *
 * These are bearer secrets: whoever holds them can move money or change the
 * hotel's inventory. Storing them as plain jsonb would mean a database dump —
 * or a stray `SELECT *` in a log — leaks live credentials. AES-256-GCM also
 * authenticates, so a tampered ciphertext fails loudly instead of decrypting
 * to garbage.
 *
 * The key comes from CREDENTIALS_KEY, kept apart from JWT_SECRET so rotating
 * the session secret no longer wipes every stored credential. Payloads made
 * with it carry a `k2.` prefix. Older payloads were keyed off JWT_SECRET; they
 * still decrypt, and `needsReencryption` lets the boot migration move them to
 * the dedicated key once it is configured.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const LEGACY_SALT = "vicerei-channel-credentials-v1";
const SALT = "vicerei-credentials-v2";
const PREFIX = "k2.";

let legacyKey: Buffer | null = null;
let dedicatedKey: Buffer | null | undefined;

function legacy(): Buffer {
  if (legacyKey) return legacyKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short (need >= 32 chars)");
  }
  legacyKey = scryptSync(secret, LEGACY_SALT, 32);
  return legacyKey;
}

function dedicated(): Buffer | null {
  if (dedicatedKey !== undefined) return dedicatedKey;
  const secret = process.env.CREDENTIALS_KEY;
  dedicatedKey = secret && secret.length >= 32 ? scryptSync(secret, SALT, 32) : null;
  return dedicatedKey;
}

/** True when CREDENTIALS_KEY is set and long enough to be used. */
export function hasDedicatedKey(): boolean {
  return dedicated() !== null;
}

function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64url")).join(".");
}

function open(payload: string, key: Buffer): string {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) return "";
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Returns `[k2.]iv.tag.ciphertext`, all base64url. Empty input stays empty. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = dedicated();
  return key ? PREFIX + seal(plain, key) : seal(plain, legacy());
}

/** Inverse of {@link encryptSecret}. Returns "" if the payload is unreadable. */
export function decryptSecret(payload: string): string {
  if (!payload) return "";
  try {
    if (payload.startsWith(PREFIX)) {
      const key = dedicated();
      return key ? open(payload.slice(PREFIX.length), key) : "";
    }
    return open(payload, legacy());
  } catch {
    return ""; // wrong key or tampered payload — treat as "no credential"
  }
}

/** A legacy payload that should be re-sealed with the dedicated key. */
export function needsReencryption(payload: string): boolean {
  return Boolean(payload) && !payload.startsWith(PREFIX) && hasDedicatedKey();
}

/** JSON convenience wrappers, since every adapter stores an object. */
export function encryptJson(value: Record<string, string>): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson(payload: string): Record<string, string> {
  const plain = decryptSecret(payload);
  if (!plain) return {};
  try {
    const parsed: unknown = JSON.parse(plain);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Shows enough of a secret to recognise it without revealing it. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

/** URL-safe random token, used for the signed public iCal feeds. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
