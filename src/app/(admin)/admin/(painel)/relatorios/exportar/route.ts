import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getBreakdown, getDaily } from "@/lib/repo/reports";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "reports.view")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const from = day(sp.get("from"));
  const to = day(sp.get("to"));
  if (!from || !to || to < from) return new Response("Datas inválidas", { status: 400 });
  const range = { from, to };
  const kind = sp.get("kind");

  if (kind === "daily") {
    const rows = await getDaily(range);
    return csvResponse(
      `ocupacao-${from}-${to}.csv`,
      toCsv([
        ["Dia", "Quartos vendidos", "Quartos disponíveis", "Ocupação %", "Receita de quartos", "ADR", "RevPAR", "Chegadas", "Partidas"],
        ...rows.map((d) => [
          d.date,
          d.sold,
          d.available,
          d.available ? Math.round((d.sold / d.available) * 1000) / 10 : 0,
          Math.round(d.revenue * 100) / 100,
          d.sold ? Math.round((d.revenue / d.sold) * 100) / 100 : 0,
          d.available ? Math.round((d.revenue / d.available) * 100) / 100 : 0,
          d.arrivals,
          d.departures,
        ]),
      ]),
    );
  }
  const by = kind === "room" ? "room" : "source";
  const rows = await getBreakdown(range, by);
  return csvResponse(
    `receita-por-${by === "room" ? "tipologia" : "origem"}-${from}-${to}.csv`,
    toCsv([
      [by === "room" ? "Tipologia" : "Origem", "Reservas", "Noites", "Receita", "ADR", "Comissões"],
      ...rows.map((r) => [r.label, r.bookings, r.nights, Math.round(r.revenue * 100) / 100, r.nights ? Math.round((r.revenue / r.nights) * 100) / 100 : 0, r.commission]),
    ]),
  );
}
