import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { contentTypeFor, resolveUploadPath } from "@/lib/uploads";

/**
 * Serves files from the uploads volume. `resolveUploadPath` rejects anything
 * that escapes the directory or has an extension we do not allow, so a crafted
 * path cannot read arbitrary files.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const target = resolveUploadPath(segments);
  if (!target) return new NextResponse("Not found", { status: 404 });

  try {
    const info = await stat(target);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const file = await readFile(target);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypeFor(target),
        "Content-Length": String(info.size),
        // Filenames carry a random suffix, so a served file never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
