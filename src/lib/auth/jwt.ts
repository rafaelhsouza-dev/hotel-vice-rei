/**
 * Minimal HS256 JWT built on Web Crypto so it runs in both the Node runtime
 * (server actions, route handlers) and the Edge runtime (proxy.ts).
 * Avoids pulling a JWT dependency for what is a ~60-line primitive.
 */

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
  /** admin_users.session_version at issue time; a bump revokes the cookie. */
  ver?: number;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns a view over a plain ArrayBuffer so it satisfies BufferSource, which
// SharedArrayBuffer-backed views do not.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short (need >= 32 chars)");
  }
  return secret;
}

export async function signSession(
  payload: Omit<SessionPayload, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 8,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const claims = toBase64Url(encoder.encode(JSON.stringify(body)));
  const data = `${header}.${claims}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    await importKey(getJwtSecret()),
    encoder.encode(data),
  );
  return `${data}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the payload when the signature and expiry check out, else null. */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, claims, signature] = parts;

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    return null;
  }

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importKey(secret),
      fromBase64Url(signature),
      encoder.encode(`${header}.${claims}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(claims)),
    ) as SessionPayload;

    if (typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "vicerei_session";
