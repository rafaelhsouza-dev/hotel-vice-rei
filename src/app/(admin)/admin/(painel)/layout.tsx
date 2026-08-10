import { requireSession } from "@/lib/auth/session";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { logout } from "../login/actions";
import { safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

async function counts() {
  const rows = await safeQuery<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM bookings WHERE status = 'pending')::text AS pending,
       (SELECT count(*) FROM messages WHERE read = false)::text AS unread,
       (SELECT count(*) FROM tasks WHERE status <> 'done')::text AS tasks,
       (SELECT count(*) FROM inventory_items WHERE active AND quantity <= min_quantity)::text AS low_stock`,
  );
  const r = rows?.[0];
  return {
    pending: Number(r?.pending ?? 0),
    unread: Number(r?.unread ?? 0),
    tasks: Number(r?.tasks ?? 0),
    lowStock: Number(r?.low_stock ?? 0),
  };
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { pending, unread, tasks, lowStock } = await counts();

  const groups: NavGroup[] = [
    {
      title: "Operação",
      items: [
        { href: "/admin", label: "Painel", icon: "dashboard" },
        { href: "/admin/reservas", label: "Reservas", icon: "calendar", badge: pending },
        { href: "/admin/mensagens", label: "Mensagens", icon: "inbox", badge: unread },
        { href: "/admin/newsletter", label: "Newsletter", icon: "users" },
        { href: "/admin/disponibilidade", label: "Disponibilidade", icon: "calendar" },
      ],
    },
    {
      title: "Hotel",
      items: [
        { href: "/admin/acomodacoes", label: "Acomodações", icon: "bed" },
        { href: "/admin/tarefas", label: "Tarefas", icon: "check", badge: tasks },
        { href: "/admin/equipa", label: "Equipa", icon: "users" },
        { href: "/admin/insumos", label: "Insumos", icon: "safe", badge: lowStock },
        { href: "/admin/refeicoes", label: "Refeições", icon: "breakfast" },
        { href: "/admin/fornecedores", label: "Fornecedores", icon: "concierge" },
      ],
    },
    {
      title: "Conteúdo",
      items: [
        { href: "/admin/quartos", label: "Tipologias", icon: "tag" },
        { href: "/admin/promocoes", label: "Promoções", icon: "sparkle" },
        { href: "/admin/servicos", label: "Serviços", icon: "concierge" },
        { href: "/admin/blog", label: "Blog", icon: "tours" },
        { href: "/admin/testemunhos", label: "Testemunhos", icon: "star" },
        { href: "/admin/galeria", label: "Galeria", icon: "image" },
      ],
    },
    {
      title: "Configuração",
      items: [
        { href: "/admin/tarifas", label: "Extras e códigos", icon: "tag" },
        { href: "/admin/media", label: "Ficheiros", icon: "upload" },
        { href: "/admin/integracoes", label: "Integrações", icon: "plug" },
        { href: "/admin/definicoes", label: "Definições", icon: "shield" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav
        groups={groups}
        user={{ name: session.name, email: session.email }}
        logout={logout}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
