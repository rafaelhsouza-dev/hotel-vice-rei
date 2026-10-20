"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import * as m from "@/lib/repo/maintenance";
import { saveUpload } from "@/lib/uploads";
import { insertMedia } from "@/lib/repo/ops";
import { bool, date, dec, int, oneOf, str } from "@/lib/form";

/** Faults, repair orders and inspections. */

function back(path: string, kind: "ok" | "erro", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message.slice(0, 400))}`);
}

export async function reportIssueAction(form: FormData) {
  const actor = await requireAnyPermission("maintenance.manage", "housekeeping.manage", "bookings.manage");
  const title = str(form, "title", "", 160);
  if (!title) back("/admin/avarias", "erro", "Descreva a avaria num título curto.");
  let photo = "";
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    try {
      const saved = await saveUpload(file);
      await insertMedia(saved);
      photo = saved.path;
    } catch (err) {
      back("/admin/avarias", "erro", (err as Error).message || "Não foi possível guardar a fotografia.");
    }
  }
  const id = await m.createIssue({
    unitId: int(form, "unitId", 0) || null,
    location: str(form, "location", "", 120),
    title,
    description: str(form, "description", "", 2000),
    severity: oneOf(str(form, "severity"), m.SEVERITIES, "normal"),
    photo,
    reportedBy: actor.name || actor.email,
    blocksUnit: bool(form, "blocksUnit"),
  });
  await audit(actor, "issue.reported", { entity: "issue", id, summary: title });
  revalidatePath("/admin/avarias");
  back("/admin/avarias", "ok", "Avaria registada.");
}

export async function createRepairOrderAction(form: FormData) {
  const actor = await requirePermission("maintenance.manage");
  const issueId = str(form, "issueId");
  try {
    const id = await m.createRepairOrder({
      issueId,
      title: str(form, "title", "", 160),
      assigneeId: str(form, "assigneeId") || null,
      supplierId: str(form, "supplierId") || null,
      cost: Math.max(0, dec(form, "cost", 0)),
      dueDate: date(form, "dueDate"),
      notes: str(form, "notes", "", 2000),
    });
    await audit(actor, "repair.created", { entity: "issue", id: issueId, summary: id });
  } catch (err) {
    back("/admin/avarias", "erro", (err as Error).message);
  }
  revalidatePath("/admin/avarias");
  revalidatePath("/admin/tarefas");
  back("/admin/avarias", "ok", "Ordem de reparação criada e enviada para as tarefas.");
}

export async function updateRepairOrderAction(form: FormData) {
  const actor = await requirePermission("maintenance.manage");
  const id = str(form, "taskId");
  await m.updateRepairOrder(id, {
    cost: Math.max(0, dec(form, "cost", 0)),
    notes: str(form, "notes", "", 2000),
    supplierId: str(form, "supplierId") || null,
  });
  await audit(actor, "repair.updated", { entity: "task", id });
  revalidatePath("/admin/avarias");
  back("/admin/avarias", "ok", "Ordem de reparação atualizada.");
}

export async function usePartsAction(form: FormData) {
  const actor = await requirePermission("maintenance.manage");
  const taskId = str(form, "taskId");
  const quantity = dec(form, "quantity", 0);
  if (!(quantity > 0)) back("/admin/avarias", "erro", "Quantidade inválida.");
  try {
    await m.useParts(taskId, str(form, "itemId"), quantity, null);
    await audit(actor, "repair.parts_used", { entity: "task", id: taskId, summary: `${quantity}` });
  } catch (err) {
    back("/admin/avarias", "erro", (err as Error).message);
  }
  revalidatePath("/admin/avarias");
  revalidatePath("/admin/insumos");
  back("/admin/avarias", "ok", "Peças descontadas do stock.");
}

export async function resolveIssueAction(form: FormData) {
  const actor = await requirePermission("maintenance.manage");
  const id = str(form, "id");
  if (str(form, "action") === "reopen") {
    await m.reopenIssue(id);
    await audit(actor, "issue.reopened", { entity: "issue", id });
    revalidatePath("/admin/avarias");
    back("/admin/avarias", "ok", "Avaria reaberta.");
  }
  await m.resolveIssue(id);
  await audit(actor, "issue.resolved", { entity: "issue", id });
  revalidatePath("/admin/avarias");
  revalidatePath("/admin/acomodacoes");
  back("/admin/avarias", "ok", "Avaria resolvida. O quarto voltou ao serviço se não tiver mais nada pendente.");
}

// --- inspections --------------------------------------------------------------

export async function saveChecklistAction(form: FormData) {
  const actor = await requirePermission("housekeeping.manage");
  const name = str(form, "name", "", 120);
  const items = str(form, "items", "", 5000)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60);
  if (!name || items.length === 0) back("/admin/inspecoes", "erro", "Indique o nome e pelo menos um ponto a verificar.");
  await m.saveChecklist({ id: str(form, "id") || null, name, items, active: bool(form, "active") });
  await audit(actor, "checklist.saved", { entity: "checklist", summary: name });
  revalidatePath("/admin/inspecoes");
  back("/admin/inspecoes", "ok", "Lista de verificação guardada.");
}

export async function recordInspectionAction(form: FormData) {
  const actor = await requirePermission("housekeeping.manage");
  const unitId = int(form, "unitId", 0);
  const checklistId = str(form, "checklistId");
  const lists = await m.listChecklists();
  const list = lists.find((l) => l.id === checklistId);
  if (!unitId || !list) back("/admin/inspecoes", "erro", "Escolha o quarto e a lista.");
  const results = list.items.map((item, i) => ({ item, ok: bool(form, `ok${i}`) }));
  await m.recordInspection({ unitId, checklistId, inspector: actor.name || actor.email, results, notes: str(form, "notes", "", 2000) });
  const failed = results.filter((r) => !r.ok);
  if (failed.length && bool(form, "createIssue")) {
    await m.createIssue({
      unitId,
      location: "",
      title: `Inspeção: ${failed.length} ponto(s) falhado(s)`,
      description: failed.map((f) => `• ${f.item}`).join("\n"),
      severity: "normal",
      photo: "",
      reportedBy: actor.name || actor.email,
      blocksUnit: false,
    });
  }
  await audit(actor, "inspection.recorded", { entity: "unit", id: unitId, summary: `${results.length - failed.length}/${results.length}` });
  revalidatePath("/admin/inspecoes");
  back("/admin/inspecoes", "ok", failed.length ? `Inspeção registada com ${failed.length} ponto(s) a corrigir.` : "Inspeção registada: tudo conforme.");
}
