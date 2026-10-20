import { requireSession } from "@/lib/auth/session";
import { can, permissionForPath } from "@/lib/auth/permissions";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { logout } from "../login/actions";
import { safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

async function counts() {
  const rows = await safeQuery<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM bookings WHERE status = 'pending')::text AS pending,
       (SELECT count(*) FROM bookings WHERE status IN ('confirmed','pending')
          AND check_in = (now() AT TIME ZONE 'Europe/Lisbon')::date)::text AS arrivals,
       (SELECT count(*) FROM messages WHERE read = false)::text AS unread,
       (SELECT count(*) FROM tasks WHERE status <> 'done')::text AS tasks,
       (SELECT count(*) FROM issues WHERE status <> 'resolved')::text AS issues,
       (SELECT count(*) FROM inventory_items WHERE active AND quantity <= min_quantity)::text AS low_stock,
       (SELECT count(*) FROM booking_guests g JOIN bookings b ON b.id = g.booking_id
          WHERE g.siba_status IN ('pending','error') AND b.status IN ('checked_in','checked_out')
            AND g.nationality NOT IN ('', 'PRT'))::text AS siba`,
  );
  const r = rows?.[0];
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    pending: n("pending"),
    arrivals: n("arrivals"),
    unread: n("unread"),
    tasks: n("tasks"),
    issues: n("issues"),
    lowStock: n("low_stock"),
    siba: n("siba"),
  };
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireSession();
  const c = await counts();

  const all: NavGroup[] = [
    {
      title: "Receção",
      items: [
        { href: "/admin", label: "Painel", icon: "dashboard" },
        { href: "/admin/chegadas", label: "Hoje", icon: "door", badge: c.arrivals },
        { href: "/admin/reservas", label: "Reservas", icon: "calendar", badge: c.pending },
        { href: "/admin/ocupacao", label: "Mapa de ocupação", icon: "grid" },
        { href: "/admin/siba", label: "SIBA", icon: "shield", badge: c.siba },
        { href: "/admin/pagamentos", label: "Pagamentos", icon: "card" },
        { href: "/admin/faturas", label: "Faturas", icon: "receipt" },
        { href: "/admin/mensagens", label: "Mensagens", icon: "inbox", badge: c.unread },
      ],
    },
    {
      title: "Vendas",
      items: [
        { href: "/admin/disponibilidade", label: "Disponibilidade e preços", icon: "calendar" },
        { href: "/admin/planos", label: "Planos de tarifa", icon: "tag" },
        { href: "/admin/tarifas", label: "Extras e códigos", icon: "sparkle" },
        { href: "/admin/relatorios", label: "Relatórios", icon: "chart" },
        { href: "/admin/newsletter", label: "Newsletter", icon: "users" },
      ],
    },
    {
      title: "Hotel",
      items: [
        { href: "/admin/acomodacoes", label: "Quartos (unidades)", icon: "bed" },
        { href: "/admin/tarefas", label: "Tarefas", icon: "check", badge: c.tasks },
        { href: "/admin/avarias", label: "Avarias e reparações", icon: "wrench", badge: c.issues },
        { href: "/admin/inspecoes", label: "Inspeções", icon: "clipboard" },
        { href: "/admin/equipa", label: "Equipa", icon: "users" },
        { href: "/admin/insumos", label: "Insumos", icon: "safe", badge: c.lowStock },
        { href: "/admin/fornecedores", label: "Fornecedores", icon: "concierge" },
        { href: "/admin/refeicoes", label: "Refeições", icon: "breakfast" },
      ],
    },
    {
      title: "Site",
      items: [
        { href: "/admin/quartos", label: "Tipologias", icon: "tag" },
        { href: "/admin/promocoes", label: "Promoções", icon: "sparkle" },
        { href: "/admin/servicos", label: "Serviços", icon: "concierge" },
        { href: "/admin/pontos", label: "Mapa e pontos de interesse", icon: "map" },
        { href: "/admin/blog", label: "Blog", icon: "tours" },
        { href: "/admin/testemunhos", label: "Testemunhos", icon: "star" },
        { href: "/admin/galeria", label: "Galeria", icon: "image" },
        { href: "/admin/media", label: "Ficheiros", icon: "upload" },
      ],
    },
    {
      title: "Configuração",
      items: [
        { href: "/admin/ligacoes", label: "Ligações e acessos", icon: "key" },
        { href: "/admin/integracoes", label: "Canais (OTAs)", icon: "plug" },
        { href: "/admin/seo", label: "SEO e monitorização", icon: "activity" },
        { href: "/admin/definicoes", label: "Definições", icon: "shield" },
        { href: "/admin/utilizadores", label: "Utilizadores", icon: "users" },
        { href: "/admin/auditoria", label: "Auditoria", icon: "eye" },
        { href: "/admin/sistema", label: "Estado do sistema", icon: "sync" },
      ],
    },
  ];

  // Only what this role may open; empty groups disappear.
  const groups = all
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        const perm = permissionForPath(i.href);
        return !perm || can(actor.role, perm);
      }),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav groups={groups} user={{ name: actor.name, email: actor.email }} logout={logout} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
