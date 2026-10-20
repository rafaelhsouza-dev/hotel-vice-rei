"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import { query } from "@/lib/db";
import { TAGS } from "@/lib/repo/content";
import { bool, dec, intOrNull, oneOf, str, trio } from "@/lib/form";

const BASE = "/admin/pontos";
const CATEGORIES = ["sight", "museum", "food", "shopping", "transport", "nature", "nightlife", "other"] as const;

function back(kind: "ok" | "erro", message: string): never {
  redirect(`${BASE}?${kind}=${encodeURIComponent(message)}`);
}

/** Accepts "41.158, -8.628" pasted from Google Maps into either field. */
function coords(form: FormData): { lat: number; lng: number } | null {
  const pasted = str(form, "coords");
  if (pasted) {
    const m = pasted.match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/);
    if (m) return { lat: Number(m[1].replace(",", ".")), lng: Number(m[2].replace(",", ".")) };
  }
  const lat = dec(form, "lat", NaN);
  const lng = dec(form, "lng", NaN);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function savePoi(form: FormData) {
  const actor = await requirePermission("content.manage");
  const id = str(form, "id");
  const name = trio(form, "name");
  if (!name.pt) back("erro", "O nome em português é obrigatório.");
  const c = coords(form);
  if (!c || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) back("erro", "Coordenadas inválidas. Cole-as do Google Maps (botão direito → copiar coordenadas).");
  const url = str(form, "url", "", 300);
  if (url && !/^https?:\/\//.test(url)) back("erro", "O link deve começar por https://.");
  const values = [
    oneOf(str(form, "category"), CATEGORIES),
    JSON.stringify(name),
    JSON.stringify(trio(form, "description")),
    c.lat,
    c.lng,
    intOrNull(form, "walkMinutes"),
    url,
    bool(form, "published"),
    intOrNull(form, "position") ?? 0,
  ];
  if (id) {
    await query(
      `UPDATE pois SET category=$2, name=$3, description=$4, lat=$5, lng=$6, walk_minutes=$7, url=$8, published=$9, position=$10, updated_at=now() WHERE id=$1`,
      [id, ...values],
    );
  } else {
    await query(
      `INSERT INTO pois (category, name, description, lat, lng, walk_minutes, url, published, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      values,
    );
  }
  updateTag(TAGS.pois);
  revalidatePath("/", "layout");
  await audit(actor, id ? "poi.updated" : "poi.created", { entity: "poi", id, summary: name.pt });
  back("ok", `«${name.pt}» guardado.`);
}

export async function deletePoi(form: FormData) {
  const actor = await requirePermission("content.manage");
  const id = str(form, "id");
  await query(`DELETE FROM pois WHERE id = $1`, [id]);
  updateTag(TAGS.pois);
  revalidatePath("/", "layout");
  await audit(actor, "poi.deleted", { entity: "poi", id });
  back("ok", "Ponto removido.");
}

/**
 * Bulk import from the hotel's spreadsheet: one per line,
 * "Nome; latitude; longitude; categoria; minutos a pé".
 */
export async function importPois(form: FormData) {
  const actor = await requirePermission("content.manage");
  const lines = str(form, "csv", "", 50_000).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let added = 0;
  const errors: string[] = [];
  for (const [i, line] of lines.entries()) {
    const parts = line.split(/[;\t]/).map((p) => p.trim());
    const [nameRaw, latRaw, lngRaw, catRaw, walkRaw] = parts;
    const lat = Number((latRaw ?? "").replace(",", "."));
    const lng = Number((lngRaw ?? "").replace(",", "."));
    if (!nameRaw || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      if (i === 0 && /nome|name/i.test(line)) continue; // header row
      errors.push(`linha ${i + 1}`);
      continue;
    }
    const cat = oneOf((catRaw ?? "").toLowerCase(), CATEGORIES, "sight");
    const walk = Number(walkRaw);
    const name = { pt: nameRaw, en: nameRaw, es: nameRaw, fr: nameRaw };
    await query(
      `INSERT INTO pois (category, name, description, lat, lng, walk_minutes, position) VALUES ($1,$2,'{}'::jsonb,$3,$4,$5,$6)`,
      [cat, JSON.stringify(name), lat, lng, Number.isFinite(walk) && walk > 0 ? Math.round(walk) : null, i],
    );
    added++;
  }
  updateTag(TAGS.pois);
  revalidatePath("/", "layout");
  await audit(actor, "poi.imported", { entity: "poi", summary: `${added} importados` });
  back(errors.length ? "erro" : "ok", `${added} ponto(s) importado(s).${errors.length ? ` Ignoradas: ${errors.join(", ")}.` : " Traduza nomes e descrições em cada ponto."}`);
}
