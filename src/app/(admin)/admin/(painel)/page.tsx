import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getHotel, getRooms } from "@/lib/repo/content";
import { getDashboardStats, type DashboardStats } from "@/lib/repo/ops";
import { opsSnapshot, type OpsSnapshot } from "@/lib/repo/operations";
import { UNIT_LABEL, UNIT_DOT } from "@/components/admin/StatusPill";
import { Icon, type IconName } from "@/components/Icon";
import { AdminHeader, Section, Badge, TableWrap, Th, Td, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  checked_in: "Check-in",
  cancelled: "Cancelada",
};

const STATUS_TONE = {
  pending: "warning",
  confirmed: "success",
  checked_in: "neutral",
  cancelled: "danger",
} as const;

const euro = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dayMonth = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const EMPTY: DashboardStats = {
  bookingsThisMonth: 0,
  revenueThisMonth: 0,
  arrivalsToday: 0,
  occupancy: 0,
  pending: 0,
  unreadMessages: 0,
  subscribers: 0,
  upcoming: [],
};

export default async function DashboardPage() {
  const session = await requireSession();
  const hotel = await getHotel();
  const rooms = await getRooms();

  let stats = EMPTY;
  let ops: OpsSnapshot | null = null;
  let dbDown = false;
  try {
    [stats, ops] = await Promise.all([
      getDashboardStats(hotel.totalRooms),
      opsSnapshot(),
    ]);
  } catch {
    dbDown = true;
  }

  const roomName = (id: string | null) =>
    rooms.find((r) => r.id === id)?.name.pt ?? "—";

  const kpis: { label: string; value: string; icon: IconName; href?: string }[] = [
    { label: "Reservas este mês", value: String(stats.bookingsThisMonth), icon: "calendar", href: "/admin/reservas" },
    { label: "Receita este mês", value: euro.format(stats.revenueThisMonth), icon: "tag" },
    { label: "Ocupação hoje", value: `${stats.occupancy}%`, icon: "bed" },
    { label: "Chegadas hoje", value: String(stats.arrivalsToday), icon: "users" },
  ];

  const secondary = [
    { label: "Reservas por confirmar", value: stats.pending, href: "/admin/reservas?status=pending" },
    { label: "Mensagens por ler", value: stats.unreadMessages, href: "/admin/mensagens" },
    { label: "Subscritores", value: stats.subscribers, href: "/admin/newsletter" },
  ];

  return (
    <>
      <AdminHeader
        title={`Olá, ${session.name.split(" ")[0]}`}
        subtitle="Visão geral da operação do hotel."
      />

      <Section>
        {dbDown && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não foi possível ligar à base de dados. Os valores abaixo estão a zero.
          </div>
        )}

        {ops && (
          <div className="mb-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 lg:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg tracking-tight">Estado das acomodações</h2>
                <Link
                  href="/admin/acomodacoes"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)]"
                >
                  Ver mapa
                  <Icon name="arrow-right" width={13} height={13} />
                </Link>
              </div>

              {/* Proportional bar: one segment per state, widths sum to 100%. */}
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-line-soft)]">
                {(["available", "occupied", "cleaning", "maintenance", "blocked"] as const).map(
                  (s) =>
                    ops!.units[s] > 0 ? (
                      <span
                        key={s}
                        className={UNIT_DOT[s]}
                        style={{ width: `${(ops!.units[s] / Math.max(1, ops!.units.total)) * 100}%` }}
                        title={`${UNIT_LABEL[s]}: ${ops!.units[s]}`}
                      />
                    ) : null,
                )}
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {(["available", "occupied", "cleaning", "maintenance", "blocked"] as const).map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${UNIT_DOT[s]}`} aria-hidden />
                    <span className="text-[var(--color-ink-soft)]">{UNIT_LABEL[s]}</span>
                    <span className="ml-auto font-medium">{ops!.units[s]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5">
              <h2 className="font-display text-lg tracking-tight">Hoje</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-ink-soft)]">Chegadas</span>
                  <span className="font-medium">{ops.arrivalsToday}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-ink-soft)]">Saídas</span>
                  <span className="font-medium">{ops.departuresToday}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link href="/admin/tarefas" className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent-deep)]">
                    Tarefas em aberto
                  </Link>
                  <span className="font-medium">
                    {ops.openTasks}
                    {ops.urgentTasks > 0 && (
                      <span className="ml-1.5 text-xs text-red-700">({ops.urgentTasks} urgentes)</span>
                    )}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link href="/admin/insumos?rutura=1" className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent-deep)]">
                    Insumos em rutura
                  </Link>
                  <span className="font-medium">{ops.lowStock}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link href="/admin/reservas" className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent-deep)]">
                    Reservas sem quarto
                  </Link>
                  <span className="font-medium">{ops.unassignedArrivals}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link href="/admin/equipa" className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent-deep)]">
                    Equipa ativa
                  </Link>
                  <span className="font-medium">{ops.staffOnDuty}</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-[var(--color-line)] bg-white p-5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                <Icon name={k.icon} width={16} height={16} />
              </span>
              <p className="mt-4 font-display text-3xl tracking-tight">{k.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                {k.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {secondary.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-white px-5 py-4 transition-colors hover:bg-[var(--color-line-soft)]"
            >
              <span className="text-sm text-[var(--color-ink-soft)]">{s.label}</span>
              <span className="font-display text-xl">{s.value}</span>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-xl tracking-tight">Próximas estadias</h2>
            <Link
              href="/admin/reservas"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)]"
            >
              Ver todas
              <Icon name="arrow-right" width={13} height={13} />
            </Link>
          </div>

          {stats.upcoming.length === 0 ? (
            <EmptyState message="Ainda não há reservas registadas." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Referência</Th>
                    <Th>Hóspede</Th>
                    <Th>Quarto</Th>
                    <Th>Entrada</Th>
                    <Th>Saída</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcoming.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--color-line-soft)] last:border-0"
                    >
                      <Td className="font-mono text-xs">{b.reference}</Td>
                      <Td className="font-medium">
                        {b.firstName} {b.lastName}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">{roomName(b.roomId)}</Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {dayMonth.format(new Date(b.checkIn))}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {dayMonth.format(new Date(b.checkOut))}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                      </Td>
                      <Td className="text-right font-medium">{euro.format(b.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Section>
    </>
  );
}
