"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/repo/audit";
import * as users from "@/lib/repo/users";
import { getIntegrationDef } from "@/lib/integrations/catalog";
import { getIntegration, recordIntegrationTest, saveIntegration } from "@/lib/repo/integrations";
import { getPaymentProvider } from "@/lib/payments/providers";
import { testInvoiceProvider } from "@/lib/invoicing/service";
import { testSiba } from "@/lib/siba/service";
import { verifySmtp } from "@/lib/email/send";
import { sendTestEmail } from "@/lib/email/notify";
import { RATE_TAGS, saveBookingRules } from "@/lib/repo/rate-plans";
import { normaliseRules } from "@/lib/booking/rules";
import { query } from "@/lib/db";
import { TAGS } from "@/lib/repo/content";
import { runJob, type JobName } from "@/lib/jobs";
import { bool, dec, int, isEmail, str } from "@/lib/form";
import { withFlash } from "@/lib/form";

/** Configuration: users, external services, booking rules, SEO, jobs. */

function back(path: string, kind: "ok" | "erro", message: string): never {
  redirect(withFlash(path, kind, message));
}

// --- account ----------------------------------------------------------------

export async function changeOwnPassword(form: FormData) {
  const actor = await requireSession();
  const current = str(form, "current", "", 200);
  const next = str(form, "next", "", 200);
  const repeat = str(form, "repeat", "", 200);
  const me = await users.findAdminById(actor.id);
  if (!me || !(await verifyPassword(current, me.passwordHash))) back("/admin/conta", "erro", "A palavra-passe atual não está correta.");
  if (next !== repeat) back("/admin/conta", "erro", "As duas palavras-passe novas não coincidem.");
  const problem = users.passwordProblem(next, actor.email);
  if (problem) back("/admin/conta", "erro", problem);
  await users.setAdminPassword(actor.id, next);
  await audit(actor, "user.password_changed", { entity: "user", id: actor.id });
  // The session version moved on; sign in again with the new password.
  redirect("/admin/login?ok=" + encodeURIComponent("Palavra-passe alterada. Entre de novo."));
}

// --- users ------------------------------------------------------------------

export async function saveUser(form: FormData) {
  const actor = await requirePermission("users.manage");
  const id = str(form, "id");
  const name = str(form, "name", "", 120);
  const role = str(form, "role");
  const active = bool(form, "active");
  const staffId = str(form, "staffId") || null;
  if (!name) back("/admin/utilizadores", "erro", "Indique o nome.");
  if (!isRole(role)) back("/admin/utilizadores", "erro", "Função inválida.");
  // Only an owner can create or promote owners.
  if (role === "owner" && actor.role !== "owner") back("/admin/utilizadores", "erro", "Só um proprietário pode atribuir a função de proprietário.");

  if (!id) {
    const email = str(form, "email", "", 160).toLowerCase();
    const password = str(form, "password", "", 200);
    if (!isEmail(email)) back("/admin/utilizadores", "erro", "Email inválido.");
    const problem = users.passwordProblem(password, email);
    if (problem) back("/admin/utilizadores", "erro", problem);
    try {
      const newId = await users.createAdminUser({ email, name, role, password, staffId });
      await audit(actor, "user.created", { entity: "user", id: newId, summary: `${email} (${role})` });
    } catch (err) {
      back("/admin/utilizadores", "erro", (err as Error).message.includes("admin_users_email_key") ? "Já existe um utilizador com esse email." : "Não foi possível criar o utilizador.");
    }
    revalidatePath("/admin/utilizadores");
    back("/admin/utilizadores", "ok", "Utilizador criado. Comunique-lhe a palavra-passe por um canal seguro.");
  }

  const target = await users.findAdminById(id);
  if (!target) back("/admin/utilizadores", "erro", "Utilizador não encontrado.");
  if (target.role === "owner" && actor.role !== "owner") back("/admin/utilizadores", "erro", "Só um proprietário pode alterar outro proprietário.");
  const losingAdmin = (target.role === "owner" || target.role === "admin") && (!active || (role !== "owner" && role !== "admin"));
  if (losingAdmin && target.active && (await users.countActiveOwners()) <= 1) {
    back("/admin/utilizadores", "erro", "Tem de existir sempre pelo menos um administrador ativo.");
  }
  if (target.id === actor.id && !active) back("/admin/utilizadores", "erro", "Não pode desativar a sua própria conta.");
  await users.updateAdminUser(id, { name, role, active, staffId });
  await audit(actor, "user.updated", { entity: "user", id, summary: `${target.email}: ${target.role}→${role}, ${active ? "ativo" : "inativo"}` });
  revalidatePath("/admin/utilizadores");
  back("/admin/utilizadores", "ok", "Utilizador atualizado.");
}

export async function resetUserPassword(form: FormData) {
  const actor = await requirePermission("users.manage");
  const id = str(form, "id");
  const password = str(form, "password", "", 200);
  const target = await users.findAdminById(id);
  if (!target) back("/admin/utilizadores", "erro", "Utilizador não encontrado.");
  if (target.role === "owner" && actor.role !== "owner") back("/admin/utilizadores", "erro", "Só um proprietário pode alterar outro proprietário.");
  const problem = users.passwordProblem(password, target.email);
  if (problem) back("/admin/utilizadores", "erro", problem);
  await users.setAdminPassword(id, password);
  await audit(actor, "user.password_reset", { entity: "user", id, summary: target.email });
  back("/admin/utilizadores", "ok", `Palavra-passe de ${target.email} redefinida; as sessões abertas foram terminadas.`);
}

export async function unlockUser(form: FormData) {
  const actor = await requirePermission("users.manage");
  const id = str(form, "id");
  await users.unlockAdminUser(id);
  await audit(actor, "user.unlocked", { entity: "user", id });
  back("/admin/utilizadores", "ok", "Conta desbloqueada.");
}

export async function revokeUserSessions(form: FormData) {
  const actor = await requirePermission("users.manage");
  const id = str(form, "id");
  await users.revokeSessions(id);
  await audit(actor, "user.sessions_revoked", { entity: "user", id });
  back("/admin/utilizadores", "ok", "Sessões terminadas.");
}

// --- integrations ----------------------------------------------------------

const LINKS = "/admin/ligacoes";

export async function saveIntegrationForm(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  const id = str(form, "id");
  const def = getIntegrationDef(id);
  if (!def) back(LINKS, "erro", "Serviço desconhecido.");
  const current = await getIntegration(id);
  const credentials: Record<string, string> = {};
  const settings: Record<string, unknown> = { ...current.settings };
  for (const f of def.fields) {
    const name = `f.${f.key}`;
    if (f.setting) {
      if (f.type === "checkbox") settings[f.key] = bool(form, name);
      else if (f.type === "number") settings[f.key] = int(form, name, 0) || "";
      else if (f.key === "products") {
        const raw = str(form, name);
        if (!raw) settings.products = {};
        else {
          try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
            settings.products = parsed;
          } catch {
            back(`${LINKS}#${id}`, "erro", "Os artigos por taxa de IVA têm de ser um objeto JSON, p. ex. {\"6\": 123}.");
          }
        }
      } else settings[f.key] = str(form, name, "", 300);
    } else {
      credentials[f.key] = str(form, name, "", 2000);
    }
  }
  const mode = str(form, "mode") === "live" ? "live" : "test";
  const enabled = bool(form, "enabled");

  // Only one invoicing program may be active.
  if (enabled && def.group === "Faturação") {
    await query(
      `UPDATE integrations SET enabled = false WHERE id = ANY($1::text[]) AND id <> $2`,
      [["invoicexpress", "moloni", "vendus"], id],
    );
  }
  const { changedFields } = await saveIntegration(id, { enabled, mode, credentials, settings });
  await audit(actor, "integration.saved", {
    entity: "integration",
    id,
    summary: `${def.name}: ${enabled ? "ativo" : "inativo"}, ${mode === "live" ? "produção" : "teste"}`,
    details: { changedCredentials: changedFields },
  });
  revalidatePath(LINKS);
  back(`${LINKS}?s=${id}`, "ok", `${def.name}: configuração guardada.`);
}

export async function testIntegration(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  const id = str(form, "id");
  const def = getIntegrationDef(id);
  if (!def) back(LINKS, "erro", "Serviço desconhecido.");
  let ok = false;
  let message = "";
  try {
    if (id === "stripe" || id === "ifthenpay") {
      const r = await getIntegration(id);
      message = await getPaymentProvider(id).test({ mode: r.mode, credentials: r.credentials, settings: r.settings });
      ok = true;
    } else if (id === "email") {
      message = await verifySmtp();
      ok = true;
    } else if (id === "siba") {
      const r = await testSiba();
      ok = r.ok;
      message = r.message;
    } else {
      message = await testInvoiceProvider(id as "invoicexpress" | "moloni" | "vendus");
      ok = true;
    }
  } catch (err) {
    message = (err as Error).message || "Falhou.";
  }
  await recordIntegrationTest(id, ok, message);
  await audit(actor, "integration.tested", { entity: "integration", id, summary: `${ok ? "OK" : "Falhou"}: ${message.slice(0, 200)}` });
  revalidatePath(LINKS);
  back(`${LINKS}?s=${id}`, ok ? "ok" : "erro", `${def.name}: ${message}`);
}

export async function sendTestEmailAction(form: FormData) {
  const actor = await requirePermission("integrations.manage");
  const to = str(form, "to", "", 160) || actor.email;
  if (!isEmail(to)) back(`${LINKS}?s=email`, "erro", "Email de destino inválido.");
  const r = await sendTestEmail(to);
  back(`${LINKS}?s=email`, r.ok ? "ok" : "erro", r.ok ? `E-mail de teste enviado para ${to}.` : `Falhou: ${r.message}`);
}

// --- booking rules -----------------------------------------------------------

export async function saveRules(form: FormData) {
  const actor = await requirePermission("settings.manage");
  const rules = normaliseRules({
    touristTax: {
      enabled: bool(form, "taxEnabled"),
      amount: dec(form, "taxAmount", 3),
      maxNights: int(form, "taxMaxNights", 7),
      exemptUnderAge: int(form, "taxExemptUnder", 13),
    },
    childMaxAge: int(form, "childMaxAge", 12),
    checkInFrom: str(form, "checkInFrom"),
    checkInUntil: str(form, "checkInUntil"),
    checkOutUntil: str(form, "checkOutUntil"),
    sameDayCutoff: str(form, "sameDayCutoff"),
    maxNights: int(form, "maxNights", 30),
    maxAdvanceDays: int(form, "maxAdvanceDays", 500),
    autoConfirm: bool(form, "autoConfirm"),
    vatAccommodation: dec(form, "vatAccommodation", 6),
    paymentHoldHours: int(form, "paymentHoldHours", 48),
    reminderDaysBefore: int(form, "reminderDaysBefore", 3),
  });
  await saveBookingRules(rules);
  updateTag(RATE_TAGS.rules);
  await audit(actor, "settings.booking_rules", { entity: "settings", id: "booking_rules", details: rules as unknown as Record<string, unknown> });
  back("/admin/definicoes", "ok", "Regras de reserva guardadas.");
}

// --- SEO & monitoring --------------------------------------------------------

const SEO_FIELDS = [
  "bing",
  "yandex",
  "facebookDomain",
  "pinterest",
  "clarity",
  "metaPixel",
  "googleAdsId",
  "googleAdsLabel",
  "hotjar",
  "googleBusinessUrl",
  "googleHotelCenterId",
  "bookingUrl",
  "tripadvisorUrl",
  "tripadvisorScore",
  "tripadvisorCount",
  "bookingScore",
  "bookingCount",
  "googleScore",
  "googleCount",
] as const;

export async function saveSeo(form: FormData) {
  const actor = await requirePermission("settings.manage");
  const seo: Record<string, string> = {};
  for (const key of SEO_FIELDS) seo[key] = str(form, key, "", 300);
  // IDs are pasted from many places; strip what people usually paste around them.
  seo.bing = seo.bing.replace(/.*content="([^"]+)".*/, "$1");
  seo.facebookDomain = seo.facebookDomain.replace(/.*content="([^"]+)".*/, "$1");
  for (const url of ["googleBusinessUrl", "bookingUrl", "tripadvisorUrl"] as const) {
    if (seo[url] && !/^https:\/\//.test(seo[url])) back("/admin/seo", "erro", "Os endereços têm de começar por https://.");
  }
  const ga4 = str(form, "ga4", "", 40);
  const gtm = str(form, "gtm", "", 40);
  const searchConsole = str(form, "searchConsole", "", 200).replace(/.*content="([^"]+)".*/, "$1");
  if (ga4 && !/^G-[A-Z0-9]{4,}$/.test(ga4)) back("/admin/seo", "erro", "O ID do GA4 tem o formato G-XXXXXXX.");
  if (gtm && !/^GTM-[A-Z0-9]{4,}$/.test(gtm)) back("/admin/seo", "erro", "O ID do Tag Manager tem o formato GTM-XXXXXX.");
  if (seo.metaPixel && !/^\d{6,20}$/.test(seo.metaPixel)) back("/admin/seo", "erro", "O ID do pixel da Meta só tem dígitos.");
  if (seo.clarity && !/^[a-z0-9]{6,20}$/i.test(seo.clarity)) back("/admin/seo", "erro", "O ID do Microsoft Clarity tem 6 a 20 letras e números.");
  if (seo.googleAdsId && !/^AW-\d{6,15}$/.test(seo.googleAdsId)) back("/admin/seo", "erro", "O ID do Google Ads tem o formato AW-123456789.");

  await query(
    `UPDATE settings SET seo = $1::jsonb, analytics = $2::jsonb, updated_at = now() WHERE id = 1`,
    [JSON.stringify(seo), JSON.stringify({ ga4, gtm, searchConsole })],
  );
  updateTag(TAGS.analytics);
  updateTag("seo");
  updateTag(TAGS.settings);
  revalidatePath("/", "layout");
  await audit(actor, "settings.seo", { entity: "settings", id: "seo", details: { fields: Object.keys(seo).filter((k) => seo[k]) } });
  back("/admin/seo", "ok", "SEO e monitorização guardados. As alterações já estão no site.");
}

// --- jobs -----------------------------------------------------------------------

export async function runJobNow(form: FormData) {
  const actor = await requirePermission("settings.manage");
  const name = str(form, "job") as JobName;
  const r = await runJob(name, { force: true });
  await audit(actor, "job.run", { entity: "job", id: name, summary: r.message });
  back("/admin/sistema", r.ok ? "ok" : "erro", r.message);
}
