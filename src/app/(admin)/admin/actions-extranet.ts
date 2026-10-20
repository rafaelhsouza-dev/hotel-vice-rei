"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import { deleteChannel, getChannel, upsertChannel } from "@/lib/repo/channels";
import { listRooms } from "@/lib/repo/admin";
import { getInventoryTotals } from "@/lib/repo/availability";
import { query } from "@/lib/db";
import { bool, dec, slugify, str } from "@/lib/form";

const BASE = "/admin/integracoes/extranets";

function back(kind: "ok" | "erro", message: string): never {
  redirect(`${BASE}?${kind}=${encodeURIComponent(message.slice(0, 300))}`);
}

export async function saveExtranet(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  const name = str(form, "name", "", 80);
  if (!name) back("erro", "Indique o nome da plataforma.");
  const existingId = str(form, "id");
  const id = existingId || `extranet-${slugify(name)}`;
  if (!existingId && (await getChannel(id))) back("erro", "Já existe uma plataforma com esse nome.");
  if (existingId) {
    const current = await getChannel(existingId);
    if (!current || current.provider !== "extranet") back("erro", "Plataforma não encontrada.");
  }

  const [rooms, totals] = await Promise.all([listRooms(), getInventoryTotals()]);
  const allotments: Record<string, number> = {};
  for (const r of rooms) {
    const n = Math.trunc(Number(str(form, `allot.${r.id}`) || 0));
    if (!Number.isFinite(n) || n < 0) back("erro", "Contingente inválido.");
    if (n > (totals[r.id] ?? 0)) back("erro", `O contingente de ${r.name.pt} excede os ${totals[r.id] ?? 0} quartos existentes.`);
    if (n > 0) allotments[r.id] = n;
  }
  const commission = dec(form, "commissionPct", 0);
  const url = str(form, "extranetUrl", "", 300);
  if (url && !/^https:\/\//.test(url)) back("erro", "O endereço da extranet deve começar por https://.");

  await upsertChannel({
    id,
    provider: "extranet",
    name,
    enabled: bool(form, "enabled"),
    settings: {
      allotments,
      commissionPct: Math.min(50, Math.max(0, commission)),
      extranetUrl: url,
      contact: str(form, "contact", "", 200),
      notes: str(form, "notes", "", 2000),
    },
  });
  await audit(actor, "extranet.saved", { entity: "channel", id, summary: `${name}: ${JSON.stringify(allotments)}` });
  revalidatePath(BASE);
  revalidatePath("/admin/disponibilidade");
  back("ok", `${name} guardada.`);
}

export async function removeExtranet(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  const id = str(form, "id");
  const channel = await getChannel(id);
  if (!channel || channel.provider !== "extranet") back("erro", "Plataforma não encontrada.");
  // Bookings keep their history; the channel link is cleared by ON DELETE SET NULL.
  await query(`UPDATE bookings SET external_ref = CASE WHEN external_ref = '' THEN $2 ELSE external_ref END WHERE channel_id = $1`, [
    id,
    channel.name,
  ]);
  await deleteChannel(id);
  await audit(actor, "extranet.removed", { entity: "channel", id, summary: channel.name });
  back("ok", `${channel.name} removida.`);
}
