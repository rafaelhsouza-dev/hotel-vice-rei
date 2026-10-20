import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildExportFile } from "@/lib/siba/service";
import { audit } from "@/lib/repo/audit";

export const dynamic = "force-dynamic";

/** Manual fallback: the bulletins file for the SIBA portal (.DAT) or the XML. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "guests.manage")) return new Response("Forbidden", { status: 403 });
  const format = new URL(request.url).searchParams.get("formato") === "xml" ? "xml" : "dat";
  const { file, guestIds } = await buildExportFile(format);
  if (guestIds.length === 0) {
    return new Response("Não há boletins completos para exportar.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  await audit(actor, "siba.exported", { entity: "siba", summary: `${file.fileName} · ${guestIds.length} boletim(ns)` });
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
