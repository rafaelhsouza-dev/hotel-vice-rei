import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { BOOKING_SOURCES, BOOKING_STATUSES, PAYMENT_STATUS_LABEL, SOURCE_LABEL, STATUS_LABEL, listBookings, type BookingSourceId, type BookingStatus } from "@/lib/repo/bookings";
import { csvResponse, toCsv } from "@/lib/csv";
import { audit } from "@/lib/repo/audit";

export const dynamic = "force-dynamic";

/** CSV of the bookings list with the same filters as the screen. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "bookings.view")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const status = ([...BOOKING_STATUSES, "active"] as string[]).includes(sp.get("status") ?? "") ? (sp.get("status") as BookingStatus | "active") : "all";
  const source = (BOOKING_SOURCES as readonly string[]).includes(sp.get("source") ?? "") ? (sp.get("source") as BookingSourceId) : "all";
  const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

  const { items } = await listBookings({
    status,
    source,
    search: sp.get("q")?.slice(0, 80) || undefined,
    from: dateOk(sp.get("from")),
    to: dateOk(sp.get("to")),
    sort: sp.get("sort") === "arrival" ? "arrival" : "created",
    limit: 500,
  });
  const rows = [
    ["Referência", "Ref. externa", "Estado", "Origem", "Canal", "Hóspede", "Email", "Telefone", "País", "Chegada", "Partida", "Noites", "Adultos", "Crianças", "Tipologia", "Quarto", "Alojamento", "Extras", "Desconto", "Total", "Taxa turística", "Pago", "Pagamento", "Comissão", "Criada em"],
    ...items.map((b) => [
      b.reference,
      b.externalRef,
      STATUS_LABEL[b.status],
      SOURCE_LABEL[b.source],
      b.channelName ?? "",
      `${b.firstName} ${b.lastName}`,
      b.email,
      b.phone,
      b.country,
      b.checkIn,
      b.checkOut,
      b.nights,
      b.adults,
      b.children,
      b.roomName,
      b.unitCode ?? "",
      b.base,
      b.extrasTotal,
      b.discount,
      b.total,
      b.touristTax,
      b.paidTotal,
      PAYMENT_STATUS_LABEL[b.paymentStatus] ?? b.paymentStatus,
      b.commission,
      b.createdAt.slice(0, 16).replace("T", " "),
    ]),
  ];
  await audit(actor, "bookings.exported", { entity: "booking", summary: `${items.length} linha(s)` });
  return csvResponse(`reservas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}
