import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  CHARGE_CATEGORIES,
  CHARGE_LABEL,
  DEFAULT_VAT,
  PAYMENT_STATUS_LABEL,
  SOURCE_LABEL,
  buildFolio,
  getBooking,
  listCharges,
  listGuests,
} from "@/lib/repo/bookings";
import { listBookingPayments, getPaymentSetup, type PaymentSetup } from "@/lib/payments/service";
import { activeInvoiceProvider, listInvoices } from "@/lib/invoicing/service";
import { listEmailLog } from "@/lib/email/send";
import { listRatePlans } from "@/lib/repo/rate-plans";
import { listRooms } from "@/lib/repo/admin";
import { availableUnitsFor } from "@/lib/repo/operations";
import { feeIfCancelledToday, canTransition } from "@/lib/booking/lifecycle";
import { penaltyFrom, hotelNow, addDays, type PolicySnapshot } from "@/lib/booking/pricing";
import { ISO_COUNTRIES, requiresBulletin } from "@/lib/siba/countries";
import { guestUrl } from "@/lib/email/notify";
import {
  addChargeAction,
  assignUnitAction,
  bookingStatusAction,
  cancelBookingAction,
  issueInvoiceAction,
  manualPaymentAction,
  modifyStayAction,
  refundAction,
  resendConfirmationAction,
  saveGuestsAction,
  sendBookingSibaAction,
  sendPaymentLinkAction,
  updateGuestAction,
  voidChargeAction,
} from "@/app/(admin)/admin/actions-pms";
import { AdminHeader, Section, Card, Badge, Field, Flash, TableWrap, Th, Td, fieldClass, euro, formatDate } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/BookingBadges";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CopyField } from "@/components/admin/CopyField";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  card: "Cartão",
  mbway: "MB WAY",
  multibanco: "Multibanco",
  cash: "Numerário",
  transfer: "Transferência",
  other: "Outro",
};
const PAY_STATUS: Record<string, string> = {
  pending: "Pendente",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  expired: "Expirado",
};

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 font-display text-lg tracking-tight">
      {children}
    </h2>
  );
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const actor = await requirePagePermission("/admin/reservas/x");
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const booking = await getBooking(id);
  if (!booking) notFound();
  const b = booking;

  const [charges, payments, guests, invoices, emails, plans, rooms, freeUnits, setup, invoicing] = await Promise.all([
    listCharges(b.id),
    listBookingPayments(b.id),
    listGuests(b.id),
    listInvoices(b.id).catch(() => []),
    listEmailLog({ bookingId: b.id, limit: 20 }).catch(() => []),
    listRatePlans().catch(() => []),
    listRooms().catch(() => []),
    availableUnitsFor(b.roomId, b.checkIn, b.checkOut, b.id).catch(() => []),
    getPaymentSetup().catch((): PaymentSetup => ({ methods: {}, any: false })),
    activeInvoiceProvider().catch(() => null),
  ]);
  const folio = buildFolio(b, charges);
  const canManage = can(actor.role, "bookings.manage");
  const canPay = can(actor.role, "payments.manage");
  const canGuests = can(actor.role, "guests.manage");
  const canInvoice = can(actor.role, "invoices.manage");
  const live = !["cancelled", "no_show", "checked_out"].includes(b.status);
  const today = hotelNow().date;
  const policy = b.policy as Partial<PolicySnapshot>;
  const fee = feeIfCancelledToday(b);
  const penaltyDate = policy.refundable !== undefined ? penaltyFrom(policy as PolicySnapshot, b.checkIn) : null;
  const guestRows = Math.min(10, Math.max(guests.length, b.adults + b.children, 1));
  const countryOptions = ISO_COUNTRIES.map((c) => (
    <option key={c.alpha3} value={c.alpha3}>
      {c.namePt}
    </option>
  ));

  return (
    <>
      <AdminHeader
        title={`${b.firstName} ${b.lastName}`}
        subtitle={`${b.reference} · ${SOURCE_LABEL[b.source]}${b.channelName ? ` (${b.channelName})` : ""}${b.externalRef ? ` · ref. ${b.externalRef}` : ""} · criada ${formatDate(b.createdAt, true)}${b.createdBy ? ` por ${b.createdBy}` : ""}`}
      />
      <Section>
        <Flash ok={ok} error={erro} />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <StatusBadge status={b.status} />
          <Badge tone={b.paymentStatus === "paid" ? "success" : b.paymentStatus === "unpaid" ? "neutral" : "warning"}>
            {PAYMENT_STATUS_LABEL[b.paymentStatus] ?? b.paymentStatus}
          </Badge>
          {b.cancelReason === "paid_after_release" && (
            <Badge tone="danger">Pago depois de libertada — contacte o hóspede</Badge>
          )}
          {b.checkinDoneAt && <Badge tone="info">Check-in online feito</Badge>}
          <Link href="/admin/reservas" className="ml-auto text-sm text-[var(--color-ink-muted)] hover:underline">
            ← Todas as reservas
          </Link>
        </div>

        {/* --- actions ---------------------------------------------------------- */}
        {canManage && (
          <Card className="mb-6 p-5">
            <div className="flex flex-wrap items-end gap-3">
              {canTransition(b.status, "confirmed") && b.status === "pending" && (
                <form action={bookingStatusAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="confirm" />
                  <SubmitButton icon="check">Confirmar</SubmitButton>
                </form>
              )}
              {(b.status === "confirmed" || b.status === "pending") && b.checkIn <= today && (
                <form action={bookingStatusAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="checkin" />
                  <label className="text-xs">
                    <span className="mb-1 block text-[var(--color-ink-muted)]">Quarto</span>
                    <select name="unitId" defaultValue={b.unitId ?? ""} className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-2 text-sm">
                      <option value="">Automático</option>
                      {b.unitId && !freeUnits.some((u) => u.id === b.unitId) && <option value={b.unitId}>{b.unitCode}</option>}
                      {freeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} {u.status !== "available" ? `(${u.status})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" name="force" className="h-4 w-4" /> mesmo por limpar
                  </label>
                  <SubmitButton icon="key">Fazer check-in</SubmitButton>
                </form>
              )}
              {b.status === "checked_in" && (
                <form action={bookingStatusAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="checkout" />
                  {folio.balance > 0.009 && (
                    <label className="flex items-center gap-1.5 pb-2 text-xs text-red-700">
                      <input type="checkbox" name="force" className="h-4 w-4" /> saldo em dívida: {euro.format(folio.balance)}
                    </label>
                  )}
                  <SubmitButton icon="door">Fazer check-out</SubmitButton>
                </form>
              )}
              {b.status === "confirmed" && b.checkIn <= today && (
                <form action={bookingStatusAction} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="noshow" />
                  <SubmitButton variant="ghost" confirm="Marcar como não comparência?">
                    Não compareceu
                  </SubmitButton>
                </form>
              )}
              {b.status === "checked_in" && (
                <form action={bookingStatusAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="undo_checkin" />
                  <SubmitButton variant="ghost" confirm="Anular o check-in?">
                    Anular check-in
                  </SubmitButton>
                </form>
              )}
              {b.status === "checked_out" && (
                <form action={bookingStatusAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="action" value="undo_checkout" />
                  <SubmitButton variant="ghost" confirm="Anular o check-out?">
                    Anular check-out
                  </SubmitButton>
                </form>
              )}
              {b.email && (
                <form action={resendConfirmationAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton variant="ghost" icon="mail">
                    Reenviar confirmação
                  </SubmitButton>
                </form>
              )}
            </div>
            {b.guestToken && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CopyField label="Página da reserva do hóspede" value={guestUrl(b)} />
                <CopyField label="Check-in online" value={guestUrl(b, "/checkin")} />
              </div>
            )}
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {/* --- stay ----------------------------------------------------------- */}
          <Card className="p-6">
            <H2>Estadia</H2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Chegada</dt>
                <dd className="font-medium">{formatDate(b.checkIn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Partida</dt>
                <dd className="font-medium">{formatDate(b.checkOut)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Noites · hóspedes</dt>
                <dd className="font-medium">
                  {b.nights} · {b.adults}
                  {b.children ? ` + ${b.children}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Tipologia</dt>
                <dd className="font-medium">{b.roomName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Tarifa</dt>
                <dd className="font-medium">{policy.planName?.pt ?? b.ratePlanId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-ink-muted)]">Cancelamento</dt>
                <dd className="font-medium">
                  {policy.refundable === false
                    ? "Não reembolsável"
                    : penaltyDate
                      ? penaltyDate <= today
                        ? `Com penalização desde ${formatDate(penaltyDate)} (hoje: ${euro.format(fee)})`
                        : `Grátis até ${formatDate(addDays(penaltyDate, -1))}, inclusive`
                      : "—"}
                </dd>
              </div>
              {b.eta && (
                <div>
                  <dt className="text-xs text-[var(--color-ink-muted)]">Chegada prevista</dt>
                  <dd className="font-medium">{b.eta}</dd>
                </div>
              )}
            </dl>
            {b.notes && <p className="mt-4 rounded-xl bg-[var(--color-line-soft)] p-3 text-sm italic">“{b.notes}”</p>}

            {canManage && live && (
              <form action={assignUnitAction} className="mt-5 flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] pt-4">
                <input type="hidden" name="id" value={b.id} />
                <Field label="Quarto atribuído" htmlFor="unitId" className="min-w-[10rem]">
                  <select id="unitId" name="unitId" defaultValue={b.unitId ?? ""} className={fieldClass}>
                    <option value="">Sem quarto</option>
                    {b.unitId && !freeUnits.some((u) => u.id === b.unitId) && <option value={b.unitId}>{b.unitCode}</option>}
                    {freeUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} · piso {u.floor}
                      </option>
                    ))}
                  </select>
                </Field>
                <SubmitButton variant="ghost" icon="check">
                  Atribuir
                </SubmitButton>
              </form>
            )}

            {canManage && live && (
              <details className="mt-5 border-t border-[var(--color-line)] pt-4">
                <summary className="cursor-pointer text-sm text-[var(--color-accent-deep)]">Alterar datas, tipologia, hóspedes ou tarifa</summary>
                <form action={modifyStayAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Field label="Chegada" htmlFor="m-in">
                    <input id="m-in" name="checkIn" type="date" defaultValue={b.checkIn} required className={fieldClass} />
                  </Field>
                  <Field label="Partida" htmlFor="m-out">
                    <input id="m-out" name="checkOut" type="date" defaultValue={b.checkOut} required className={fieldClass} />
                  </Field>
                  <Field label="Tipologia" htmlFor="m-room">
                    <select id="m-room" name="roomId" defaultValue={b.roomId ?? ""} className={fieldClass}>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name.pt}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tarifa" htmlFor="m-plan">
                    <select id="m-plan" name="ratePlanId" defaultValue={b.ratePlanId ?? ""} className={fieldClass}>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.pt}
                          {p.active ? "" : " (inativa)"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Adultos" htmlFor="m-ad">
                    <input id="m-ad" name="adults" type="number" min={1} max={8} defaultValue={b.adults} className={fieldClass} />
                  </Field>
                  <Field label="Crianças" htmlFor="m-ch">
                    <input id="m-ch" name="children" type="number" min={0} max={6} defaultValue={b.children} className={fieldClass} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="reprice" className="h-4 w-4" /> Recalcular o preço com as tarifas atuais
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="override" className="h-4 w-4" /> Ignorar estadia mínima e fechos de chegada/partida
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton icon="check" pendingLabel="A verificar…">
                      Alterar estadia
                    </SubmitButton>
                  </div>
                </form>
              </details>
            )}

            {canManage && (b.status === "pending" || b.status === "confirmed") && (
              <details className="mt-5 border-t border-[var(--color-line)] pt-4">
                <summary className="cursor-pointer text-sm text-red-700">Cancelar reserva</summary>
                <form action={cancelBookingAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Field label="Penalização (€)" htmlFor="c-fee" hint={`Pela tarifa, hoje: ${euro.format(fee)}. Pode ajustar.`}>
                    <input id="c-fee" name="fee" inputMode="decimal" defaultValue={fee.toFixed(2)} className={fieldClass} />
                  </Field>
                  <Field label="Motivo" htmlFor="c-reason">
                    <input id="c-reason" name="reason" placeholder="Pedido do hóspede" className={fieldClass} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notify" defaultChecked={Boolean(b.email)} className="h-4 w-4" /> Avisar o hóspede por e-mail
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="confirm" required className="h-4 w-4" /> Confirmo o cancelamento
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton variant="danger" icon="close" pendingLabel="A cancelar…">
                      Cancelar reserva
                    </SubmitButton>
                  </div>
                </form>
              </details>
            )}
          </Card>

          {/* --- guest contact ------------------------------------------------- */}
          <Card className="p-6">
            <H2>Contacto do hóspede</H2>
            <form action={updateGuestAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Nome" htmlFor="g-first">
                <input id="g-first" name="firstName" defaultValue={b.firstName} required disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="Apelido" htmlFor="g-last">
                <input id="g-last" name="lastName" defaultValue={b.lastName} required disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="Email" htmlFor="g-email">
                <input id="g-email" name="email" type="email" defaultValue={b.email} disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="Telefone" htmlFor="g-phone">
                <input id="g-phone" name="phone" type="tel" defaultValue={b.phone} disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="País" htmlFor="g-country">
                <input id="g-country" name="country" defaultValue={b.country} disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="Hora prevista de chegada" htmlFor="g-eta">
                <input id="g-eta" name="eta" defaultValue={b.eta} placeholder="18:30" disabled={!canManage} className={fieldClass} />
              </Field>
              <Field label="Notas internas e pedidos" htmlFor="g-notes" className="sm:col-span-2">
                <textarea id="g-notes" name="notes" rows={3} defaultValue={b.notes} disabled={!canManage} className={fieldClass} />
              </Field>
              {canManage && (
                <div className="sm:col-span-2">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar contacto
                  </SubmitButton>
                </div>
              )}
            </form>
          </Card>
        </div>

        {/* --- folio --------------------------------------------------------------- */}
        <Card className="mt-6 p-6">
          <H2 id="conta">Conta do quarto</H2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                {folio.lines.map((l, i) => (
                  <tr key={l.chargeId ?? `l${i}`} className="border-b border-[var(--color-line-soft)]">
                    <td className="py-2">
                      {l.label}
                      <span className="ml-2 text-xs text-[var(--color-ink-muted)]">IVA {l.vatRate}%</span>
                    </td>
                    <td className="py-2 text-right font-medium">{euro.format(l.amount)}</td>
                    <td className="w-10 py-2 text-right">
                      {l.chargeId && (canManage || canPay) && (
                        <form action={voidChargeAction}>
                          <input type="hidden" name="chargeId" value={l.chargeId} />
                          <SubmitButton variant="icon" icon="trash" title="Anular lançamento" confirm="Anular este lançamento?" />
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 font-medium">Total da conta</td>
                  <td className="pt-3 text-right font-display text-lg">{euro.format(folio.grandTotal)}</td>
                  <td />
                </tr>
                <tr>
                  <td className="text-[var(--color-ink-muted)]">Pago</td>
                  <td className="text-right">{euro.format(folio.paid)}</td>
                  <td />
                </tr>
                <tr>
                  <td className="font-medium">Saldo</td>
                  <td className={`text-right font-medium ${folio.balance > 0.009 ? "text-red-700" : "text-[var(--color-success)]"}`}>{euro.format(folio.balance)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          {(canManage || canPay) && b.status !== "cancelled" && (
            <form action={addChargeAction} className="mt-5 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Categoria" htmlFor="ch-cat">
                <select id="ch-cat" name="category" className={fieldClass} defaultValue="breakfast">
                  {CHARGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CHARGE_LABEL[c]} (IVA {DEFAULT_VAT[c]}%)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Descrição" htmlFor="ch-desc" className="lg:col-span-2">
                <input id="ch-desc" name="description" placeholder="Pequeno-almoço · 2 pessoas" className={fieldClass} />
              </Field>
              <Field label="Qtd." htmlFor="ch-qty">
                <input id="ch-qty" name="quantity" inputMode="decimal" defaultValue="1" className={fieldClass} />
              </Field>
              <Field label="Preço unit. (€)" htmlFor="ch-price">
                <input id="ch-price" name="unitPrice" inputMode="decimal" required className={fieldClass} />
              </Field>
              <div>
                <SubmitButton icon="plus" pendingLabel="…">
                  Lançar
                </SubmitButton>
              </div>
            </form>
          )}
        </Card>

        {/* --- payments ------------------------------------------------------------ */}
        <Card className="mt-6 p-6">
          <H2 id="pagamentos">Pagamentos</H2>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Ainda não há pagamentos registados.</p>
          ) : (
            <div className="mt-4">
              <TableWrap>
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-[var(--color-line)]">
                    <tr>
                      <Th>Data</Th>
                      <Th>Tipo</Th>
                      <Th>Meio</Th>
                      <Th>Valor</Th>
                      <Th>Estado</Th>
                      <Th>Detalhe</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--color-line-soft)] align-top last:border-0">
                        <Td className="whitespace-nowrap text-xs">{formatDate(p.createdAt, true)}</Td>
                        <Td className="text-xs">{p.kind === "refund" ? "Devolução" : "Pagamento"} · {p.provider === "manual" ? "balcão" : p.provider}</Td>
                        <Td className="text-xs">{METHOD_LABEL[p.method] ?? p.method}</Td>
                        <Td className="font-medium">{p.kind === "refund" ? "−" : ""}{euro.format(p.amount)}</Td>
                        <Td>
                          <Badge tone={p.status === "succeeded" ? "success" : p.status === "pending" ? "warning" : "neutral"}>{PAY_STATUS[p.status] ?? p.status}</Badge>
                        </Td>
                        <Td className="text-xs text-[var(--color-ink-soft)]">
                          {p.mbReference && (
                            <span className="block font-mono">
                              Ent. {p.mbEntity} · Ref. {p.mbReference}
                            </span>
                          )}
                          {p.checkoutUrl && p.status === "pending" && (
                            <a href={p.checkoutUrl} className="block underline" target="_blank" rel="noopener noreferrer">
                              Link de pagamento
                            </a>
                          )}
                          {p.note && <span className="block">{p.note}</span>}
                          {p.createdBy && <span className="block text-[var(--color-ink-muted)]">{p.createdBy}</span>}
                          {canPay && p.kind === "payment" && p.status === "succeeded" && p.provider !== "manual" && (
                            <form action={refundAction} className="mt-2 flex items-center gap-1.5">
                              <input type="hidden" name="id" value={b.id} />
                              <input type="hidden" name="paymentId" value={p.id} />
                              <label className="sr-only" htmlFor={`rf-${p.id}`}>Valor a reembolsar</label>
                              <input id={`rf-${p.id}`} name="amount" inputMode="decimal" defaultValue={p.amount.toFixed(2)} className="w-20 rounded-lg border border-[var(--color-line)] px-2 py-1" />
                              <SubmitButton variant="ghost" confirm="Reembolsar este valor ao hóspede?">Reembolsar</SubmitButton>
                            </form>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}
          {canPay && b.status !== "cancelled" && (
            <div className="mt-5 grid gap-6 border-t border-[var(--color-line)] pt-4 lg:grid-cols-2">
              <form action={manualPaymentAction} className="grid gap-3 sm:grid-cols-2">
                <p className="text-sm font-medium sm:col-span-2">Registar pagamento no balcão</p>
                <input type="hidden" name="id" value={b.id} />
                <Field label="Valor (€)" htmlFor="mp-amount">
                  <input id="mp-amount" name="amount" inputMode="decimal" defaultValue={folio.balance > 0 ? folio.balance.toFixed(2) : ""} required className={fieldClass} />
                </Field>
                <Field label="Meio" htmlFor="mp-method">
                  <select id="mp-method" name="method" className={fieldClass}>
                    {["card", "cash", "mbway", "multibanco", "transfer", "other"].map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nota" htmlFor="mp-note" className="sm:col-span-2">
                  <input id="mp-note" name="note" placeholder="TPA, n.º de talão…" className={fieldClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="refund" className="h-4 w-4" /> É uma devolução
                </label>
                <div>
                  <SubmitButton icon="check" pendingLabel="…">
                    Registar
                  </SubmitButton>
                </div>
              </form>
              {setup.any ? (
                <form action={sendPaymentLinkAction} className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm font-medium sm:col-span-2">Pedir pagamento online</p>
                  <input type="hidden" name="id" value={b.id} />
                  <Field label="Valor (€)" htmlFor="pl-amount">
                    <input id="pl-amount" name="amount" inputMode="decimal" defaultValue={folio.balance > 0 ? folio.balance.toFixed(2) : ""} required className={fieldClass} />
                  </Field>
                  <Field label="Meio" htmlFor="pl-method">
                    <select id="pl-method" name="method" className={fieldClass}>
                      {(["card", "multibanco", "mbway"] as const)
                        .filter((m) => setup.methods[m])
                        .map((m) => (
                          <option key={m} value={m}>
                            {METHOD_LABEL[m]}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Telemóvel MB WAY" htmlFor="pl-phone" hint="Só para MB WAY.">
                    <input id="pl-phone" name="phone" type="tel" defaultValue={b.phone} className={fieldClass} />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm">
                    <input type="checkbox" name="email" defaultChecked={Boolean(b.email)} className="h-4 w-4" /> Enviar ao hóspede por e-mail
                  </label>
                  <div>
                    <SubmitButton icon="card" pendingLabel="…">
                      Criar pedido
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Para pedir pagamentos online, ative a Stripe ou a ifthenpay em <Link href="/admin/ligacoes" className="underline">Ligações</Link>.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* --- guests / SIBA ------------------------------------------------------ */}
        <Card className="mt-6 p-6">
          <H2 id="hospedes">Hóspedes e SIBA</H2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Hóspedes estrangeiros têm de ser comunicados ao SIBA até 3 dias úteis após a chegada. Os portugueses não são comunicados.
          </p>
          <form action={saveGuestsAction} className="mt-4 grid gap-5">
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="guestCount" value={guestRows} />
            {Array.from({ length: guestRows }).map((_, i) => {
              const g = guests[i];
              const p = `g${i}`;
              return (
                <fieldset key={i} className="rounded-2xl border border-[var(--color-line)] p-4" disabled={!canGuests}>
                  <legend className="px-1 text-sm font-medium">
                    Hóspede {i + 1}
                    {g && requiresBulletin(g.nationality) && (
                      <span className="ml-2">
                        <Badge tone={g.sibaStatus === "sent" ? "success" : g.sibaStatus === "error" ? "danger" : "warning"}>
                          SIBA: {g.sibaStatus === "sent" ? `enviado ${formatDate(g.sibaSentAt, true)}` : g.sibaStatus === "error" ? "erro" : "por enviar"}
                        </Badge>
                      </span>
                    )}
                  </legend>
                  {g?.sibaMessage && g.sibaStatus !== "sent" && <p className="mb-3 text-xs text-red-700">{g.sibaMessage}</p>}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Nome(s)" htmlFor={`${p}-fn`}>
                      <input id={`${p}-fn`} name={`${p}.firstName`} defaultValue={g?.firstName ?? (i === 0 ? b.firstName : "")} className={fieldClass} />
                    </Field>
                    <Field label="Apelido(s)" htmlFor={`${p}-ln`}>
                      <input id={`${p}-ln`} name={`${p}.lastName`} defaultValue={g?.lastName ?? (i === 0 ? b.lastName : "")} className={fieldClass} />
                    </Field>
                    <Field label="Nacionalidade" htmlFor={`${p}-nat`}>
                      <select id={`${p}-nat`} name={`${p}.nationality`} defaultValue={g?.nationality ?? ""} className={fieldClass}>
                        <option value="">—</option>
                        {countryOptions}
                      </select>
                    </Field>
                    <Field label="Data de nascimento" htmlFor={`${p}-bd`}>
                      <input id={`${p}-bd`} name={`${p}.birthDate`} type="date" defaultValue={g?.birthDate ?? ""} className={fieldClass} />
                    </Field>
                    <Field label="Local de nascimento" htmlFor={`${p}-bp`}>
                      <input id={`${p}-bp`} name={`${p}.birthPlace`} defaultValue={g?.birthPlace ?? ""} className={fieldClass} />
                    </Field>
                    <Field label="Documento" htmlFor={`${p}-dt`}>
                      <select id={`${p}-dt`} name={`${p}.documentType`} defaultValue={g?.documentType || "P"} className={fieldClass}>
                        <option value="P">Passaporte</option>
                        <option value="B">Bilhete / cartão de identidade</option>
                        <option value="O">Outro</option>
                      </select>
                    </Field>
                    <Field label="N.º do documento" htmlFor={`${p}-dn`}>
                      <input id={`${p}-dn`} name={`${p}.documentNumber`} defaultValue={g?.documentNumber ?? ""} className={`${fieldClass} font-mono`} />
                    </Field>
                    <Field label="País emissor" htmlFor={`${p}-dc`}>
                      <select id={`${p}-dc`} name={`${p}.documentCountry`} defaultValue={g?.documentCountry ?? ""} className={fieldClass}>
                        <option value="">—</option>
                        {countryOptions}
                      </select>
                    </Field>
                    <Field label="País de residência" htmlFor={`${p}-rc`}>
                      <select id={`${p}-rc`} name={`${p}.residenceCountry`} defaultValue={g?.residenceCountry ?? ""} className={fieldClass}>
                        <option value="">—</option>
                        {countryOptions}
                      </select>
                    </Field>
                    <Field label="Cidade de residência" htmlFor={`${p}-rcity`}>
                      <input id={`${p}-rcity`} name={`${p}.residenceCity`} defaultValue={g?.residenceCity ?? ""} className={fieldClass} />
                    </Field>
                  </div>
                </fieldset>
              );
            })}
            {canGuests && (
              <div className="flex flex-wrap gap-3">
                <SubmitButton icon="check" pendingLabel="A guardar…">
                  Guardar hóspedes
                </SubmitButton>
              </div>
            )}
          </form>
          {canGuests && guests.some((g) => g.sibaStatus === "pending" || g.sibaStatus === "error") && ["checked_in", "checked_out"].includes(b.status) && (
            <form action={sendBookingSibaAction} className="mt-4">
              <input type="hidden" name="id" value={b.id} />
              <SubmitButton variant="ghost" icon="shield" pendingLabel="A enviar…">
                Enviar ao SIBA agora
              </SubmitButton>
            </form>
          )}
        </Card>

        {/* --- invoices --------------------------------------------------------- */}
        <Card className="mt-6 p-6">
          <H2 id="faturas">Faturas</H2>
          {invoices.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2">
                  <span>
                    <strong>{inv.number || "Rascunho"}</strong> · {inv.provider} · {euro.format(inv.total)} · {formatDate(inv.createdAt, true)}
                    {inv.message && <span className="block text-xs text-red-700">{inv.message}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={inv.status === "issued" ? "success" : inv.status === "error" ? "danger" : "neutral"}>
                      {inv.status === "issued" ? "Emitida" : inv.status === "error" ? "Erro" : "Rascunho"}
                    </Badge>
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-deep)] underline">
                        PDF
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canInvoice ? (
            invoicing ? (
              <form action={issueInvoiceAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="id" value={b.id} />
                <Field label="Nome na fatura" htmlFor="iv-name">
                  <input id="iv-name" name="name" defaultValue={`${b.firstName} ${b.lastName}`} className={fieldClass} />
                </Field>
                <Field label="NIF (vazio = consumidor final)" htmlFor="iv-vat">
                  <input id="iv-vat" name="vat" inputMode="numeric" className={`${fieldClass} font-mono`} />
                </Field>
                <Field label="País (código ISO de 2 letras)" htmlFor="iv-cc">
                  <input id="iv-cc" name="countryCode" defaultValue="PT" maxLength={2} className={`${fieldClass} uppercase`} />
                </Field>
                <Field label="Email" htmlFor="iv-email">
                  <input id="iv-email" name="email" type="email" defaultValue={b.email} className={fieldClass} />
                </Field>
                <Field label="Morada" htmlFor="iv-addr">
                  <input id="iv-addr" name="address" className={fieldClass} />
                </Field>
                <Field label="Código postal" htmlFor="iv-pc">
                  <input id="iv-pc" name="postalCode" className={fieldClass} />
                </Field>
                <Field label="Localidade" htmlFor="iv-city">
                  <input id="iv-city" name="city" className={fieldClass} />
                </Field>
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" name="sendByEmail" className="h-4 w-4" /> Enviar por e-mail
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
                    Emite {folio.paid >= folio.grandTotal - 0.005 ? "fatura-recibo" : "fatura"} de {euro.format(folio.grandTotal)} em {invoicing.provider.name}
                    {invoicing.config.mode === "test" ? " (modo teste)" : ""}, com as linhas da conta do quarto.
                  </p>
                  <SubmitButton icon="receipt" pendingLabel="A emitir…" confirm="Emitir o documento no programa de faturação?">
                    Emitir fatura
                  </SubmitButton>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                Ative o programa de faturação certificado em <Link href="/admin/ligacoes" className="underline">Ligações</Link> para emitir a fatura daqui.
              </p>
            )
          ) : null}
        </Card>

        {/* --- e-mails ------------------------------------------------------------ */}
        <Card className="mt-6 p-6">
          <H2>E-mails enviados</H2>
          {emails.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Nenhum e-mail registado para esta reserva.</p>
          ) : (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {emails.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {formatDate(e.createdAt, true)} · {e.subject}
                  </span>
                  <Badge tone={e.status === "sent" ? "success" : e.status === "failed" ? "danger" : "neutral"}>
                    {e.status === "sent" ? "Enviado" : e.status === "failed" ? `Falhou: ${e.message.slice(0, 60)}` : e.message}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {can(actor.role, "audit.view") && (
            <Link href={`/admin/auditoria?entity=booking&id=${b.id}`} className="mt-4 inline-block text-sm text-[var(--color-accent-deep)] underline">
              Histórico de alterações desta reserva
            </Link>
          )}
        </Card>
      </Section>
    </>
  );
}
