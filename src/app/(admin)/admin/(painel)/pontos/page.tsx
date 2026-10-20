import { requirePagePermission } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { deletePoi, importPois, savePoi } from "@/app/(admin)/admin/actions-pois";
import { AdminHeader, Section, Card, Badge, Field, Flash, fieldClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  sight: "Monumento / miradouro",
  museum: "Museu / cultura",
  food: "Restaurante / café",
  shopping: "Compras",
  transport: "Transporte",
  nature: "Jardim / natureza",
  nightlife: "Vida noturna",
  other: "Outro",
};

type Row = {
  id: string;
  category: string;
  name: Record<"pt" | "en" | "es" | "fr", string>;
  description: Record<"pt" | "en" | "es" | "fr", string>;
  lat: number;
  lng: number;
  walk_minutes: number | null;
  url: string;
  published: boolean;
  position: number;
};

function PoiForm({ p, position }: { p?: Row; position: number }) {
  return (
    <form action={savePoi} className="grid gap-4">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <LocaleFields name="name" label="Nome" values={p?.name} required />
      <LocaleFields name="description" label="Descrição curta" values={p?.description} variant="textarea" rows={2} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Categoria" htmlFor={`cat-${p?.id ?? "new"}`}>
          <select id={`cat-${p?.id ?? "new"}`} name="category" defaultValue={p?.category ?? "sight"} className={fieldClass}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Coordenadas (lat, lng)" htmlFor={`co-${p?.id ?? "new"}`} hint="Cole do Google Maps: 41.15790, -8.62912">
          <input
            id={`co-${p?.id ?? "new"}`}
            name="coords"
            defaultValue={p ? `${p.lat}, ${p.lng}` : ""}
            required
            className={`${fieldClass} font-mono`}
          />
        </Field>
        <Field label="Minutos a pé desde o hotel" htmlFor={`w-${p?.id ?? "new"}`}>
          <input id={`w-${p?.id ?? "new"}`} name="walkMinutes" type="number" min={0} defaultValue={p?.walk_minutes ?? ""} className={fieldClass} />
        </Field>
        <Field label="Link (site oficial)" htmlFor={`u-${p?.id ?? "new"}`}>
          <input id={`u-${p?.id ?? "new"}`} name="url" type="url" defaultValue={p?.url ?? ""} className={fieldClass} />
        </Field>
        <Field label="Ordem" htmlFor={`o-${p?.id ?? "new"}`}>
          <input id={`o-${p?.id ?? "new"}`} name="position" type="number" defaultValue={p?.position ?? position} className={fieldClass} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" name="published" defaultChecked={p?.published ?? true} className="h-4 w-4" /> Visível no mapa
        </label>
      </div>
      <div>
        <SubmitButton icon="check" pendingLabel="A guardar…">
          Guardar
        </SubmitButton>
      </div>
    </form>
  );
}

export default async function PoisPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/pontos");
  const { ok, erro } = await searchParams;
  const rows = await query<Row>(`SELECT * FROM pois ORDER BY position, created_at`);

  return (
    <>
      <AdminHeader
        title="Mapa e pontos de interesse"
        subtitle="Os pontos aparecem no mapa interativo da página de contactos e da apresentação, nas quatro línguas, e nos dados estruturados do site."
      />
      <Section>
        <Flash ok={ok} error={erro} />
        <div className="grid gap-4">
          {rows.map((p) => (
            <Card key={p.id} className="p-0">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                  <span>
                    <span className="font-medium">{p.name.pt}</span>
                    <span className="ml-2 text-xs text-[var(--color-ink-muted)]">
                      {CATEGORY_LABEL[p.category]} {p.walk_minutes ? `· ${p.walk_minutes} min a pé` : ""}
                    </span>
                  </span>
                  <Badge tone={p.published ? "success" : "neutral"}>{p.published ? "Visível" : "Oculto"}</Badge>
                </summary>
                <div className="border-t border-[var(--color-line)] p-4">
                  <PoiForm p={p} position={p.position} />
                  <form action={deletePoi} className="mt-3">
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton variant="danger" icon="trash" confirm={`Remover ${p.name.pt}?`}>
                      Remover
                    </SubmitButton>
                  </form>
                </div>
              </details>
            </Card>
          ))}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg tracking-tight">Novo ponto</h2>
            <PoiForm position={rows.length} />
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-lg tracking-tight">Importar lista</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Cole as linhas da folha de cálculo enviada pelo hotel, uma por ponto: <code>Nome; latitude; longitude; categoria; minutos a pé</code>. Categoria: sight, museum, food, shopping,
              transport, nature, nightlife ou other.
            </p>
            <form action={importPois} className="mt-3 grid gap-3">
              <label className="sr-only" htmlFor="csv">
                Linhas a importar
              </label>
              <textarea id="csv" name="csv" rows={6} placeholder={"Torre dos Clérigos; 41.14575; -8.61463; sight; 18\nCasa da Música; 41.15885; -8.63076; museum; 6"} className={`${fieldClass} font-mono`} />
              <div>
                <SubmitButton variant="ghost" icon="upload" pendingLabel="A importar…">
                  Importar
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      </Section>
    </>
  );
}
