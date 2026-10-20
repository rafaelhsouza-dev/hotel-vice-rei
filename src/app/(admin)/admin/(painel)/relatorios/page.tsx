import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { getBreakdown, getDaily, getKpis } from "@/lib/repo/reports";
import { addDays, today } from "@/lib/repo/availability";
import { AdminHeader, Section, Card, Field, Stat, TableWrap, Th, Td, fieldClass, euro, formatDate } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

function monthStart(d: string) {
  return `${d.slice(0, 7)}-01`;
}
function monthEnd(d: string) {
  const x = new Date(`${d.slice(0, 7)}-01T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + 1);
  x.setUTCDate(0);
  return x.toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePagePermission("/admin/relatorios");
  const sp = await searchParams;
  const t = today();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : monthStart(t);
  let to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : monthEnd(t);
  if (to < from) to = from;
  // Keep the daily table readable and the queries cheap.
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 400) to = addDays(from, 400);
  const range = { from, to };

  const [k, bySource, byRoom, daily] = await Promise.all([getKpis(range), getBreakdown(range, "source"), getBreakdown(range, "room"), getDaily(range)]);
  const presets: [string, string, string][] = [
    ["Este mês", monthStart(t), monthEnd(t)],
    ["Mês passado", monthStart(addDays(monthStart(t), -1)), addDays(monthStart(t), -1)],
    ["Próximos 30 dias", t, addDays(t, 29)],
    ["Este ano", `${t.slice(0, 4)}-01-01`, `${t.slice(0, 4)}-12-31`],
  ];
  const csv = (kind: string) => `/admin/relatorios/exportar?kind=${kind}&from=${from}&to=${to}`;

  return (
    <>
      <AdminHeader title="Relatórios" subtitle={`Estadias de ${formatDate(from)} a ${formatDate(to)}. A receita de quartos conta só as noites dentro do período.`} />
      <Section>
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3" action="/admin/relatorios">
            <Field label="De" htmlFor="from">
              <input id="from" name="from" type="date" defaultValue={from} className={fieldClass} />
            </Field>
            <Field label="Até" htmlFor="to">
              <input id="to" name="to" type="date" defaultValue={to} className={fieldClass} />
            </Field>
            <button className="h-11 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm">Ver</button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(([label, f, tt]) => (
              <Link
                key={label}
                href={`/admin/relatorios?from=${f}&to=${tt}`}
                className={`rounded-full px-3.5 py-1.5 text-sm ${from === f && to === tt ? "bg-[var(--color-ink)] text-white" : "border border-[var(--color-line)] bg-white"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Ocupação" value={pct(k.occupancy)} hint={`${k.nightsSold} de ${k.nightsAvailable} quartos-noite`} />
          <Stat label="ADR (preço médio)" value={euro.format(k.adr)} hint="receita de quartos ÷ noites vendidas" />
          <Stat label="RevPAR" value={euro.format(k.revpar)} hint="receita de quartos ÷ quartos disponíveis" />
          <Stat label="Receita de quartos" value={euro.format(k.roomRevenue)} />
          <Stat label="Extras e conta do quarto" value={euro.format(k.extrasRevenue + k.folioRevenue)} hint={`${euro.format(k.extrasRevenue)} na reserva · ${euro.format(k.folioRevenue)} lançados`} />
          <Stat label="Taxa turística" value={euro.format(k.touristTax)} hint="a entregar à Câmara" />
          <Stat label="Reservas (chegada no período)" value={k.bookings} hint={`estadia média ${k.avgLengthOfStay.toFixed(1)} noites · antecedência ${Math.round(k.avgLeadDays)} dias`} />
          <Stat
            label="Cancelamentos"
            value={pct(k.cancellationRate)}
            hint={`${k.cancellations} cancelada(s) · ${k.noShows} não compareceu`}
            tone={k.cancellationRate > 0.2 ? "warning" : "neutral"}
          />
        </div>
        {k.commission > 0 && <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Comissões registadas de plataformas: {euro.format(k.commission)}.</p>}

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {[
            ["Por origem", bySource, "source"] as const,
            ["Por tipologia", byRoom, "room"] as const,
          ].map(([title, rows, kind]) => (
            <Card key={kind} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight">{title}</h2>
                <a href={csv(kind)} className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-deep)] underline">
                  <Icon name="download" width={14} height={14} /> CSV
                </a>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                      <th className="py-2 font-medium">{kind === "source" ? "Origem" : "Tipologia"}</th>
                      <th className="py-2 text-right font-medium">Reservas</th>
                      <th className="py-2 text-right font-medium">Noites</th>
                      <th className="py-2 text-right font-medium">Receita</th>
                      <th className="py-2 text-right font-medium">ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-[var(--color-ink-muted)]">
                          Sem estadias no período.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-[var(--color-line-soft)] last:border-0">
                        <td className="py-2">{r.label}</td>
                        <td className="py-2 text-right tabular-nums">{r.bookings}</td>
                        <td className="py-2 text-right tabular-nums">{r.nights}</td>
                        <td className="py-2 text-right tabular-nums">{euro.format(r.revenue)}</td>
                        <td className="py-2 text-right tabular-nums">{r.nights ? euro.format(r.revenue / r.nights) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-3 mt-10 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl tracking-tight">Dia a dia</h2>
          <a href={csv("daily")} className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-deep)] underline">
            <Icon name="download" width={14} height={14} /> CSV
          </a>
        </div>
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-[var(--color-line)]">
              <tr>
                <Th>Dia</Th>
                <Th>Ocupação</Th>
                <Th className="text-right">Quartos</Th>
                <Th className="text-right">Receita</Th>
                <Th className="text-right">ADR</Th>
                <Th className="text-right">Chegadas</Th>
                <Th className="text-right">Partidas</Th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => {
                const occ = d.available ? d.sold / d.available : 0;
                const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
                return (
                  <tr key={d.date} className={`border-b border-[var(--color-line-soft)] last:border-0 ${dow === 0 || dow === 6 ? "bg-[var(--color-line-soft)]/40" : ""}`}>
                    <Td className="whitespace-nowrap">{formatDate(d.date)}</Td>
                    <Td className="w-[34%]">
                      {/* One series, one hue; the number beside it is the value, so the bar never carries it alone. */}
                      <div className="flex items-center gap-3" title={`${pct(occ)} · ${d.sold} de ${d.available}`}>
                        <div className="h-2.5 flex-1 rounded-full bg-[var(--color-line-soft)]">
                          <div className="h-2.5 rounded-full bg-[var(--color-accent-deep)]" style={{ width: `${Math.min(100, occ * 100)}%` }} />
                        </div>
                        <span className="w-14 text-right tabular-nums">{pct(occ)}</span>
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {d.sold}/{d.available}
                    </Td>
                    <Td className="text-right tabular-nums">{euro.format(d.revenue)}</Td>
                    <Td className="text-right tabular-nums">{d.sold ? euro.format(d.revenue / d.sold) : "—"}</Td>
                    <Td className="text-right tabular-nums">{d.arrivals}</Td>
                    <Td className="text-right tabular-nums">{d.departures}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
