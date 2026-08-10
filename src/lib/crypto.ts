import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for third-party channel credentials.
 *
 * OTA and channel-manager tokens are bearer secrets: whoever holds them can
 * read and change the hotel's inventory. Storing them as plain jsonb would
 * mean a database dump — or a stray `SELECT * FROM channels` in a log — leaks
 * live credentials. AES-256-GCM also authenticates, so a tampered ciphertext
 * fails loudly instead of decrypting to garbage.
 *
 * The key is derived from JWT_SECRET, which already has to exist and be long.
 * Rotating JWT_SECRET therefore invalidates stored credentials, which is the
 * safe direction to fail: the admin re-enters them.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const SALT = "vicerei-channel-credentials-v1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short (need >= 32 chars)");
  }
  cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

/** Returns `iv.tag.ciphertext`, all base64url. Empty input stays empty. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64url"))
    .join(".");
}

/** Inverse of {@link encryptSecret}. Returns "" if the payload is unreadable. */
export function decryptSecret(payload: string): string {
  if (!payload) return "";
  try {
    const [iv, tag, data] = payload.split(".");
    if (!iv || !tag || !data) return "";
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return ""; // wrong key or tampered payload — treat as "no credential"
  }
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
