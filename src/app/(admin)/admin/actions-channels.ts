"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { auditForm } from "@/lib/repo/audit";
import * as channels from "@/lib/repo/channels";
import { syncChannel, testChannel } from "@/lib/channels/engine";
import { redeemInviteCode } from "@/lib/channels/providers/beds24";
import { getAdapter, isProviderId } from "@/lib/channels/registry";
import { rotateIcalToken } from "@/lib/repo/ical-token";

/**
 * Mutations for the integrations module. Every one asserts a session, and
 * results are passed back through the query string so the page can report
 * what happened without a client-side store.
 */

function str(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}
function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}
function int(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const BASE = "/admin/integracoes";

/** Sends the operator back with a message, never leaking secrets into the URL. */
function back(path: string, kind: "ok" | "erro", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message.slice(0, 300))}`);
}

export async function saveChannel(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "saveChannel", form);
  const id = str(form, "id");
  const provider = str(form, "provider");
  if (!id || !isProviderId(provider)) back(BASE, "erro", "Canal inválido.");

  await channels.upsertChannel({
    id,
    provider,
    name: str(form, "name") || id,
    enabled: bool(form, "enabled"),
  });

  revalidatePath(BASE);
  back(`${BASE}/${id}`, "ok", "Canal guardado.");
}

export async function saveChannelCredentials(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "saveChannelCredentials", form);
  const id = str(form, "id");
  const channel = await channels.getChannel(id);
  if (!channel) back(BASE, "erro", "Canal não encontrado.");

  const adapter = getAdapter(channel.provider);
  const patch: Record<string, string> = {};
  for (const field of adapter.credentialFields) {
    patch[field.key] = str(form, `cred.${field.key}`);
  }

  // Beds24 hands out a single-use invite code; exchange it now so the
  // long-lived refresh token is what actually gets stored.
  if (channel.provider === "beds24" && patch.inviteCode && !patch.inviteCode.includes("••••")) {
    try {
      patch.refreshToken = await redeemInviteCode(patch.inviteCode);
      patch.inviteCode = "";
    } catch (error) {
      back(
        `${BASE}/${id}`,
        "erro",
        error instanceof Error ? error.message : "Código de convite recusado.",
      );
    }
  }

  await channels.saveCredentials(id, patch);
  revalidatePath(`${BASE}/${id}`);
  back(`${BASE}/${id}`, "ok", "Credenciais guardadas.");
}

export async function saveRoomMapping(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "saveRoomMapping", form);
  const channelId = str(form, "channelId");
  const roomId = str(form, "roomId");
  if (!channelId || !roomId) back(BASE, "erro", "Mapeamento inválido.");

  await channels.setRoomMapping(channelId, roomId, {
    externalRoomId: str(form, "externalRoomId"),
    externalRateId: str(form, "externalRateId"),
    icalUrl: str(form, "icalUrl"),
  });

  revalidatePath(`${BASE}/${channelId}`);
  back(`${BASE}/${channelId}`, "ok", "Mapeamento guardado.");
}

export async function testChannelAction(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "testChannelAction", form);
  const id = str(form, "id");
  const result = await testChannel(id);
  revalidatePath(`${BASE}/${id}`);
  back(`${BASE}/${id}`, result.ok ? "ok" : "erro", result.message);
}

export async function syncChannelAction(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "syncChannelAction", form);
  const id = str(form, "id");
  const outcome = await syncChannel(id);
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  back(`${BASE}/${id}`, outcome.ok ? "ok" : "erro", outcome.message || "Sincronização concluída.");
}

export async function removeChannel(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "removeChannel", form);
  await channels.deleteChannel(str(form, "id"));
  revalidatePath(BASE);
  back(BASE, "ok", "Canal removido.");
}

export async function rotateIcalTokenAction() {
  const actor = await requirePermission("integrations.manage");
  void auditForm(actor, "rotateIcalTokenAction", null);
  await rotateIcalToken();
  revalidatePath(BASE);
  back(
    BASE,
    "ok",
    "Novo endereço gerado. Atualize os URLs em todas as plataformas — os anteriores deixaram de funcionar.",
  );
}
