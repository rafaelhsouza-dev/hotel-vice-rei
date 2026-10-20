"use server";

import { updateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { auditForm } from "@/lib/repo/audit";
import { locales, type Locale } from "@/i18n/config";
import { TAGS } from "@/lib/repo/content";
import * as repo from "@/lib/repo/admin";
import * as ops from "@/lib/repo/ops";

/**
 * Every mutation the backoffice performs.
 *
 * All of them assert a session first — server actions are publicly reachable
 * endpoints, so the proxy redirect is not a substitute for this check.
 */

type Trio<T> = Record<Locale, T>;

function str(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

function int(form: FormData, key: string, fallback = 0): number {
  const parsed = Number(str(form, key));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function dec(form: FormData, key: string, fallback = 0): number {
  const parsed = Number(str(form, key).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

/** Rebuilds `{pt,en,es,fr}` from the `field.locale` inputs LocaleFields posts. */
function parseTrio(form: FormData, name: string): Trio<string> {
  return Object.fromEntries(
    locales.map((l) => [l, str(form, `${name}.${l}`)]),
  ) as Trio<string>;
}

/** Same, but each non-empty line becomes an array entry. */
function parseTrioList(form: FormData, name: string): Trio<string[]> {
  return Object.fromEntries(
    locales.map((l) => [
      l,
      str(form, `${name}.${l}`)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ]),
  ) as Trio<string[]>;
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Refreshes the cached public reads plus the rendered pages.
 * `updateTag` (rather than `revalidateTag`) expires immediately, so an editor
 * sees their own change on the very next request instead of one stale render.
 */
function refresh(...tags: string[]) {
  for (const tag of tags) {
    if (tag) updateTag(tag);
  }
  revalidatePath("/", "layout");
}

// --- rooms -----------------------------------------------------------------

export async function saveRoom(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "saveRoom", formData);

  const name = parseTrio(formData, "name");
  const id = str(formData, "id") || toSlug(name.pt || "quarto");
  const slug = toSlug(str(formData, "slug") || name.pt || id);

  await repo.upsertRoom({
    id,
    slug,
    image: str(formData, "image"),
    gallery: str(formData, "gallery")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    capacity: int(formData, "capacity", 2),
    size: int(formData, "size", 0),
    bed: parseTrio(formData, "bed"),
    bathroom: parseTrio(formData, "bathroom"),
    priceFrom: dec(formData, "priceFrom"),
    name,
    shortDescription: parseTrio(formData, "shortDescription"),
    longDescription: parseTrioList(formData, "longDescription"),
    amenities: parseTrioList(formData, "amenities"),
    romantic: bool(formData, "romantic"),
    panorama360: str(formData, "panorama360") || null,
    position: int(formData, "position", 0),
    published: bool(formData, "published"),
  });

  refresh(TAGS.rooms);
  redirect("/admin/quartos");
}

// --- offers ----------------------------------------------------------------

export async function saveOffer(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "saveOffer", formData);

  const title = parseTrio(formData, "title");
  const id = str(formData, "id") || toSlug(title.pt || "promocao");

  await repo.upsertOffer({
    id,
    slug: toSlug(str(formData, "slug") || title.pt || id),
    image: str(formData, "image"),
    badge: parseTrio(formData, "badge"),
    title,
    description: parseTrio(formData, "description"),
    priceFrom: dec(formData, "priceFrom"),
    priceLabel: parseTrio(formData, "priceLabel"),
    includes: parseTrioList(formData, "includes"),
    conditions: parseTrioList(formData, "conditions"),
    position: int(formData, "position", 0),
    published: bool(formData, "published"),
  });

  refresh(TAGS.offers);
  redirect("/admin/promocoes");
}

// --- services --------------------------------------------------------------

export async function saveService(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "saveService", formData);

  const title = parseTrio(formData, "title");
  await repo.upsertService({
    id: str(formData, "id") || toSlug(title.pt || "servico"),
    icon: str(formData, "icon", "sparkle"),
    title,
    description: parseTrio(formData, "description"),
    position: int(formData, "position", 0),
    published: bool(formData, "published"),
  });

  refresh(TAGS.services);
  redirect("/admin/servicos");
}

// --- testimonials ----------------------------------------------------------

export async function saveTestimonial(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "saveTestimonial", formData);

  const author = str(formData, "author");
  await repo.upsertTestimonial({
    id: str(formData, "id") || toSlug(author || "testemunho"),
    author,
    origin: parseTrio(formData, "origin"),
    quote: parseTrio(formData, "quote"),
    rating: Math.min(5, Math.max(1, int(formData, "rating", 5))),
    position: int(formData, "position", 0),
    published: bool(formData, "published"),
  });

  refresh(TAGS.testimonials);
  redirect("/admin/testemunhos");
}

// --- blog ------------------------------------------------------------------

export async function savePost(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "savePost", formData);

  const title = parseTrio(formData, "title");
  const previousSlug = str(formData, "previousSlug") || undefined;
  const slug = toSlug(str(formData, "slug") || title.pt || "artigo");

  await repo.upsertPost(
    {
      slug,
      image: str(formData, "image"),
      date: str(formData, "date") || new Date().toISOString().slice(0, 10),
      readingMinutes: int(formData, "readingMinutes", 3),
      category: parseTrio(formData, "category"),
      title,
      excerpt: parseTrio(formData, "excerpt"),
      body: parseTrioList(formData, "body"),
      published: bool(formData, "published"),
    },
    previousSlug,
  );

  refresh(TAGS.posts);
  redirect("/admin/blog");
}

// --- gallery ---------------------------------------------------------------

export async function addGalleryImage(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "addGalleryImage", formData);
  const src = str(formData, "src");
  if (src) await repo.addGalleryImage(src, str(formData, "alt", "Hotel Vice-Rei · Porto"));
  refresh(TAGS.gallery);
}

// --- extras & promo codes --------------------------------------------------

export async function saveExtra(formData: FormData) {
  const actor = await requirePermission("rates.manage");
  void auditForm(actor, "saveExtra", formData);

  const label = parseTrio(formData, "label");
  await repo.upsertExtra({
    id: str(formData, "id") || toSlug(label.pt || "extra"),
    label,
    description: parseTrio(formData, "description"),
    price: dec(formData, "price"),
    perNight: bool(formData, "perNight"),
    position: int(formData, "position", 0),
    active: bool(formData, "active"),
  });

  refresh(TAGS.extras);
  redirect("/admin/tarifas");
}

export async function savePromoCode(formData: FormData) {
  const actor = await requirePermission("rates.manage");
  void auditForm(actor, "savePromoCode", formData);
  const code = str(formData, "code");
  if (!code) return;

  await repo.upsertPromoCode({
    code,
    // Stored as a fraction; the form collects whole percent points.
    percent: Math.min(0.9, Math.max(0.01, dec(formData, "percent", 10) / 100)),
    active: bool(formData, "active"),
    expiresAt: str(formData, "expiresAt") || null,
  });

  revalidatePath("/admin/tarifas");
}

export async function removePromoCode(formData: FormData) {
  const actor = await requirePermission("rates.manage");
  void auditForm(actor, "removePromoCode", formData);
  await repo.deletePromoCode(str(formData, "code"));
  revalidatePath("/admin/tarifas");
}

// --- generic row operations ------------------------------------------------

const TABLE_TAGS: Record<string, string> = {
  rooms: TAGS.rooms,
  services: TAGS.services,
  offers: TAGS.offers,
  testimonials: TAGS.testimonials,
  posts: TAGS.posts,
  gallery_images: TAGS.gallery,
  extras: TAGS.extras,
};

export async function togglePublished(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "togglePublished", formData);
  const table = str(formData, "table");
  await repo.setPublished(table, str(formData, "id"), bool(formData, "next"));
  refresh(TABLE_TAGS[table] ?? "");
}

export async function deleteRow(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "deleteRow", formData);
  const table = str(formData, "table");
  await repo.deleteRow(table, str(formData, "id"));
  refresh(TABLE_TAGS[table] ?? "");
}

export async function moveRow(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "moveRow", formData);
  const table = str(formData, "table");
  const ids = str(formData, "ids").split(",").filter(Boolean);
  const id = str(formData, "id");
  const direction = str(formData, "direction") === "up" ? -1 : 1;

  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];

  await repo.reorder(table, ids);
  refresh(TABLE_TAGS[table] ?? "");
}

// --- bookings, inbox, subscribers -----------------------------------------

export async function setMessageRead(formData: FormData) {
  const actor = await requirePermission("messages.manage");
  void auditForm(actor, "setMessageRead", formData);
  await ops.setMessageRead(str(formData, "id"), bool(formData, "next"));
  revalidatePath("/admin/mensagens");
  revalidatePath("/admin");
}

export async function removeMessage(formData: FormData) {
  const actor = await requirePermission("messages.manage");
  void auditForm(actor, "removeMessage", formData);
  await ops.deleteMessage(str(formData, "id"));
  revalidatePath("/admin/mensagens");
  revalidatePath("/admin");
}

export async function removeSubscriber(formData: FormData) {
  const actor = await requirePermission("messages.manage");
  void auditForm(actor, "removeSubscriber", formData);
  await ops.deleteSubscriber(str(formData, "id"));
  revalidatePath("/admin/newsletter");
}

export async function saveSettings(formData: FormData) {
  const actor = await requirePermission("settings.manage");
  void auditForm(actor, "saveSettings", formData);

  await repo.updateSettings({
    name: str(formData, "name"),
    totalRooms: int(formData, "totalRooms", 0),
    brandTagline: parseTrio(formData, "brandTagline"),
    street: str(formData, "street"),
    postalCode: str(formData, "postalCode"),
    city: str(formData, "city"),
    email: str(formData, "email"),
    phones: str(formData, "phones")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    social: {
      facebook: str(formData, "facebook"),
      instagram: str(formData, "instagram"),
      tripadvisor: str(formData, "tripadvisor"),
    },
    coords: { lat: dec(formData, "lat"), lng: dec(formData, "lng") },
    rating: { score: dec(formData, "ratingScore"), count: int(formData, "ratingCount") },
    paymentMethods: str(formData, "paymentMethods")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  refresh(TAGS.settings);
  redirect("/admin/definicoes?ok=" + encodeURIComponent("Definições guardadas."));
}
