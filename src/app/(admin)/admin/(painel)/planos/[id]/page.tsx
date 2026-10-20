import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { listRatePlans } from "@/lib/repo/rate-plans";
import { listRooms } from "@/lib/repo/admin";
import { saveRatePlanAction } from "@/app/(admin)/admin/actions-rates";
import { AdminHeader, Section, Card, Field, Flash, fieldClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function RatePlanEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePagePermission("/admin/planos/x");
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const isNew = id === "novo";
  const [plans, rooms] = await Promise.all([listRatePlans(), listRooms()]);
  const p = isNew ? null : plans.find((x) => x.id === id);
  if (!isNew && !p) notFound();

  return (
    <>
      <AdminHeader title={isNew ? "Novo plano de tarifa" : p!.name.pt} subtitle="As reservas já feitas guardam as condições do momento; alterar o plano só afeta reservas novas." />
      <Section>
        <Flash ok={ok} error={erro} />
        <form action={saveRatePlanAction} className="grid max-w-5xl gap-6">
          <input type="hidden" name="existingId" value={p?.id ?? ""} />
          <Card className="p-6">
            <div className="grid gap-5">
              {isNew && (
                <Field label="Identificador" htmlFor="id" hint="Letras minúsculas e hífenes, p. ex. «nao-reembolsavel». Se ficar vazio usa o nome.">
                  <input id="id" name="id" className={`${fieldClass} font-mono`} />
                </Field>
              )}
              <LocaleFields name="name" label="Nome mostrado ao hóspede" values={p?.name as Record<"pt" | "en" | "es" | "fr", string> | undefined} required />
              <LocaleFields name="description" label="Descrição curta" values={p?.description as Record<"pt" | "en" | "es" | "fr", string> | undefined} variant="textarea" rows={2} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Preço e regime</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Preço por noite = tarifa do dia × (1 + ajuste %) + ajuste fixo + suplemento por adulto.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Regime" htmlFor="board">
                <select id="board" name="board" defaultValue={p?.board ?? "room_only"} className={fieldClass}>
                  <option value="room_only">Só alojamento</option>
                  <option value="breakfast">Com pequeno-almoço</option>
                  <option value="half_board">Meia pensão</option>
                </select>
              </Field>
              <Field label="Ajuste (%)" htmlFor="adjustPct" hint="−10 = 10% mais barato.">
                <input id="adjustPct" name="adjustPct" inputMode="decimal" defaultValue={p?.adjustPct ?? 0} className={fieldClass} />
              </Field>
              <Field label="Ajuste fixo por noite (€)" htmlFor="adjustAmount">
                <input id="adjustAmount" name="adjustAmount" inputMode="decimal" defaultValue={p?.adjustAmount ?? 0} className={fieldClass} />
              </Field>
              <Field label="Suplemento por adulto/noite (€)" htmlFor="perGuestAmount" hint="Ex.: pequeno-almoço.">
                <input id="perGuestAmount" name="perGuestAmount" inputMode="decimal" defaultValue={p?.perGuestAmount ?? 0} className={fieldClass} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Cancelamento e pagamento</h2>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" name="refundable" defaultChecked={p?.refundable ?? true} className="h-4 w-4" /> Reembolsável (permite cancelar)
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Cancelamento grátis até (dias antes)" htmlFor="freeCancelDays" hint="2 = até 48 h antes do dia de chegada.">
                <input id="freeCancelDays" name="freeCancelDays" type="number" min={0} defaultValue={p?.freeCancelDays ?? 2} className={fieldClass} />
              </Field>
              <Field label="Depois disso cobra" htmlFor="cancelPenalty">
                <select id="cancelPenalty" name="cancelPenalty" defaultValue={p?.cancelPenalty ?? "first_night"} className={fieldClass}>
                  <option value="first_night">A primeira noite</option>
                  <option value="percent">Uma percentagem</option>
                  <option value="total">O total</option>
                  <option value="none">Nada</option>
                </select>
              </Field>
              <Field label="Percentagem (%)" htmlFor="cancelPenaltyPct">
                <input id="cancelPenaltyPct" name="cancelPenaltyPct" inputMode="decimal" defaultValue={p?.cancelPenaltyPct ?? 0} className={fieldClass} />
              </Field>
              <Field label="Quando paga" htmlFor="paymentPolicy">
                <select id="paymentPolicy" name="paymentPolicy" defaultValue={p?.paymentPolicy ?? "hotel"} className={fieldClass}>
                  <option value="hotel">No hotel</option>
                  <option value="deposit">Sinal ao reservar</option>
                  <option value="full">Tudo ao reservar</option>
                </select>
              </Field>
              <Field label="Sinal (%)" htmlFor="depositPct">
                <input id="depositPct" name="depositPct" inputMode="decimal" defaultValue={p?.depositPct ?? 0} className={fieldClass} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Condições de venda</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Estadia mínima" htmlFor="minStay">
                <input id="minStay" name="minStay" type="number" min={1} defaultValue={p?.minStay ?? 1} className={fieldClass} />
              </Field>
              <Field label="Estadia máxima" htmlFor="maxStay" hint="Vazio = sem limite.">
                <input id="maxStay" name="maxStay" type="number" min={1} defaultValue={p?.maxStay ?? ""} className={fieldClass} />
              </Field>
              <Field label="Reservar com pelo menos (dias)" htmlFor="minAdvanceDays" hint="Ex.: 30 para «reserva antecipada».">
                <input id="minAdvanceDays" name="minAdvanceDays" type="number" min={0} defaultValue={p?.minAdvanceDays ?? 0} className={fieldClass} />
              </Field>
              <Field label="Reservar no máximo (dias antes)" htmlFor="maxAdvanceDays" hint="Ex.: 3 para «última hora».">
                <input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={0} defaultValue={p?.maxAdvanceDays ?? ""} className={fieldClass} />
              </Field>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Tipologias (nenhuma = todas)</legend>
              <div className="flex flex-wrap gap-3">
                {rooms.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm">
                    <input type="checkbox" name="roomIds" value={r.id} defaultChecked={p?.roomIds.includes(r.id)} className="h-4 w-4" /> {r.name.pt}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4" /> Ativo no site
              </label>
              <Field label="Ordem" htmlFor="position">
                <input id="position" name="position" type="number" defaultValue={p?.position ?? plans.length} className={`${fieldClass} w-24`} />
              </Field>
            </div>
          </Card>

          <div className="flex gap-3">
            <SubmitButton icon="check" pendingLabel="A guardar…">
              Guardar plano
            </SubmitButton>
            <Link href="/admin/planos" className="inline-flex items-center rounded-full border border-[var(--color-line)] px-4 py-2 text-sm">
              Cancelar
            </Link>
          </div>
        </form>
      </Section>
    </>
  );
}
