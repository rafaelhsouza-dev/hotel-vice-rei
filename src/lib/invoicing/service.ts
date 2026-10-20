import { query, queryOne } from "../db";
import { getIntegrationSafe } from "../repo/integrations";
import { buildFolio, getBooking, listCharges } from "../repo/bookings";
import { readBookingRules } from "../repo/rate-plans";
import { hotelNow } from "../booking/pricing";
import { INVOICE_PROVIDERS, getInvoiceProvider } from "./providers";
import { InvoiceError, type InvoiceLine, type InvoiceProviderId, type InvoiceRequest } from "./types";

/**
 * Issuing invoices through the hotel's certified program. Exactly one
 * provider is active at a time — the first enabled one in Ligações.
 */

export async function activeInvoiceProvider() {
  for (const p of INVOICE_PROVIDERS) {
    const r = await getIntegrationSafe(p.id);
    if (r.enabled) return { provider: p, config: { mode: r.mode, credentials: r.credentials, settings: r.settings } };
  }
  return null;
}

export type InvoiceRow = {
  id: string;
  bookingId: string | null;
  provider: string;
  number: string;
  status: string;
  total: number;
  pdfUrl: string;
  message: string;
  customerName: string;
  createdAt: string;
  reference?: string;
};

function toRow(r: Record<string, unknown>): InvoiceRow {
  const customer = (r.customer as Record<string, string>) ?? {};
  return {
    id: String(r.id),
    bookingId: (r.booking_id as string) ?? null,
    provider: String(r.provider),
    number: String(r.number ?? ""),
    status: String(r.status),
    total: Number(r.total),
    pdfUrl: String(r.pdf_url ?? ""),
    message: String(r.message ?? ""),
    customerName: customer.name ?? "",
    createdAt: (r.created_at as Date).toISOString(),
    reference: r.reference ? String(r.reference) : undefined,
  };
}

export async function listInvoices(bookingId?: string, limit = 200): Promise<InvoiceRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT i.*, b.reference FROM invoices i LEFT JOIN bookings b ON b.id = i.booking_id
     WHERE ($1::uuid IS NULL OR i.booking_id = $1::uuid)
     ORDER BY i.created_at DESC LIMIT $2`,
    [bookingId ?? null, limit],
  );
  return rows.map(toRow);
}

/**
 * Builds the invoice lines from the folio. Discounts are folded into the
 * accommodation line (certified programs reject negative lines), and the
 * municipal tourist tax goes out of VAT scope.
 */
export function linesFromFolio(folio: ReturnType<typeof buildFolio>, nights: number, vatAccommodation: number): InvoiceLine[] {
  const room = folio.lines.filter((l) => l.category === "room").reduce((s, l) => s + l.amount, 0);
  const lines: InvoiceLine[] = [];
  if (room > 0.004) {
    lines.push({ description: `Alojamento (${nights} noite${nights === 1 ? "" : "s"})`, quantity: 1, unitPriceGross: Math.round(room * 100) / 100, vatRate: vatAccommodation });
  }
  for (const l of folio.lines) {
    if (l.category === "room" || l.amount <= 0) continue;
    lines.push({
      description: l.label,
      quantity: 1,
      unitPriceGross: Math.round(l.amount * 100) / 100,
      vatRate: l.vatRate,
      exemptionCode: l.vatRate === 0 ? "M99" : undefined,
    });
  }
  return lines;
}

export async function issueBookingInvoice(input: {
  bookingId: string;
  customer: InvoiceRequest["customer"];
  sendByEmail: boolean;
  notes: string;
}): Promise<InvoiceRow> {
  const active = await activeInvoiceProvider();
  if (!active) throw new InvoiceError("Nenhum programa de faturação está ativo em Ligações.", "not_configured");
  const booking = await getBooking(input.bookingId);
  if (!booking) throw new InvoiceError("Reserva não encontrada.", "not_found");
  const rules = await readBookingRules();
  const folio = buildFolio(booking, await listCharges(booking.id));
  const lines = linesFromFolio(folio, booking.nights, rules.vatAccommodation);
  if (lines.length === 0) throw new InvoiceError("A conta não tem valores a faturar.", "empty");

  const total = Math.round(lines.reduce((s, l) => s + l.unitPriceGross * l.quantity, 0) * 100) / 100;
  const kind: InvoiceRequest["kind"] = booking.paidTotal >= total - 0.005 ? "FR" : "FT";
  const lastPayment = await queryOne<{ method: string }>(
    `SELECT method FROM payments WHERE booking_id = $1 AND kind = 'payment' AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1`,
    [booking.id],
  );

  const row = await queryOne<{ id: string }>(
    `INSERT INTO invoices (booking_id, provider, status, total, customer) VALUES ($1,$2,'draft',$3,$4::jsonb) RETURNING id`,
    [booking.id, active.provider.id, total, JSON.stringify(input.customer)],
  );
  const invoiceId = row!.id;
  try {
    const result = await active.provider.issue(active.config, {
      reference: booking.reference,
      date: hotelNow().date,
      customer: input.customer,
      lines,
      kind,
      paymentMethod: (lastPayment?.method as InvoiceRequest["paymentMethod"]) ?? (kind === "FR" ? "other" : undefined),
      notes: input.notes || `Reserva ${booking.reference} · ${booking.checkIn} a ${booking.checkOut}`,
      sendByEmail: input.sendByEmail,
    });
    await query(
      `UPDATE invoices SET provider_id=$2, number=$3, status=$4, total=$5, pdf_url=$6, message='', updated_at=now() WHERE id=$1`,
      [invoiceId, result.providerId, result.number, result.status, result.total, result.pdfUrl],
    );
  } catch (err) {
    await query(`UPDATE invoices SET status='error', message=$2, updated_at=now() WHERE id=$1`, [
      invoiceId,
      (err as Error).message.slice(0, 500),
    ]);
    throw err instanceof InvoiceError ? err : new InvoiceError((err as Error).message);
  }
  return toRow((await queryOne<Record<string, unknown>>(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]))!);
}

export async function testInvoiceProvider(id: InvoiceProviderId): Promise<string> {
  const r = await getIntegrationSafe(id);
  return getInvoiceProvider(id).test({ mode: r.mode, credentials: r.credentials, settings: r.settings });
}
