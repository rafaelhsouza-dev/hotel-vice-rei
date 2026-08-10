import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * File uploads land on a persistent volume (UPLOADS_DIR) rather than in the
 * image, so they survive redeploys. They are served back through
 * /uploads/[...path], since Next only serves `public/` statically.
 */

export const UPLOAD_PREFIX = "/uploads";

const MAX_BYTES = 8 * 1024 * 1024;

/** Extensions we are willing to write and serve, mapped to their content type. */
const ALLOWED: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR || "./.uploads");
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(uploadsDir(), { recursive: true });
}

function safeExtension(filename: string): string | null {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext in ALLOWED ? ext : null;
}

export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ALLOWED[ext] ?? "application/octet-stream";
}

/**
 * Resolves a request path inside the uploads directory, refusing anything that
 * escapes it (`..`, absolute paths, symlink-ish tricks).
 */
export function resolveUploadPath(segments: string[]): string | null {
  const dir = uploadsDir();
  const target = path.resolve(dir, ...segments);
  const withSep = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (target !== dir && !target.startsWith(withSep)) return null;
  if (!safeExtension(target)) return null;
  return target;
}

export type SavedUpload = {
  filename: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
};

export async function saveUpload(file: File): Promise<SavedUpload> {
  const ext = safeExtension(file.name);
  if (!ext) {
    throw new Error("Formato não suportado. Use JPG, PNG, WebP, AVIF, GIF ou SVG.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Ficheiro demasiado grande (máximo 8 MB).");
  }

  const base = path
    .basename(file.name, path.extname(file.name))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "ficheiro";

  // Random suffix keeps uploads with the same name from overwriting each other.
  const filename = `${base}-${randomBytes(4).toString("hex")}.${ext}`;

  await ensureUploadsDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir(), filename), buffer);

  const { width, height } = await imageSize(buffer);

  return {
    filename,
    path: `${UPLOAD_PREFIX}/${filename}`,
    mime: ALLOWED[ext],
    size: buffer.byteLength,
    width,
    height,
  };
}

/** Reads intrinsic dimensions via sharp when it is available (it ships with Next). */
async function imageSize(
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export async function deleteUpload(publicPath: string): Promise<void> {
  if (!publicPath.startsWith(`${UPLOAD_PREFIX}/`)) return;
  const target = resolveUploadPath([publicPath.slice(UPLOAD_PREFIX.length + 1)]);
  if (!target) return;
  await unlink(target).catch(() => {});
}

export async function uploadsWritable(): Promise<boolean> {
  try {
    await ensureUploadsDir();
    await stat(uploadsDir());
    return true;
  } catch {
    return false;
  }
}
