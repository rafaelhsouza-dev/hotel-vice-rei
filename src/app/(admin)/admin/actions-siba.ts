"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import { markGuestsSent, sendPendingBulletins } from "@/lib/siba/service";

function back(kind: "ok" | "erro", message: string): never {
  redirect(`/admin/siba?${kind}=${encodeURIComponent(message.slice(0, 600))}`);
}

export async function sendSibaPending() {
  const actor = await requirePermission("guests.manage");
  const run = await sendPendingBulletins();
  await audit(actor, "siba.sent", { entity: "siba", summary: run.result ? `${run.result.ok ? "OK" : "Erro"}: ${run.result.message.slice(0, 200)}` : `${run.skipped} com dados em falta` });
  revalidatePath("/admin/siba");
  if (!run.result) back("erro", run.skipped ? "Nenhum boletim está completo. Corrija os dados assinalados." : "Não há boletins por enviar.");
  if (run.result.ok) back("ok", `${run.result.message}${run.skipped ? ` ${run.skipped} ficaram por completar.` : ""}`);
  back("erro", run.result.message);
}

export async function markSibaSent(form: FormData) {
  const actor = await requirePermission("guests.manage");
  const ids = form.getAll("guestIds").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  await markGuestsSent(ids, `Carregado manualmente no portal por ${actor.email}`);
  await audit(actor, "siba.marked_sent", { entity: "siba", summary: `${ids.length} boletim(ns)` });
  revalidatePath("/admin/siba");
  back("ok", `${ids.length} boletim(ns) marcados como enviados.`);
}
