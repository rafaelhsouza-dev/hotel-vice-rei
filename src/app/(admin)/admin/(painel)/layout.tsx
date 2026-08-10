import { requireSession } from "@/lib/auth/session";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { logout } from "../login/actions";
import { safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

async function counts() {
  const rows = await safeQuery<{ pending: string; unread: string }>(
    `SELECT
       (SELECT count(*) FROM bookings WHERE status = 'pending')::text AS pending,
       (SELECT count(*) FROM messages WHERE read = false)::text AS unread`,
  );
  return {
    pending: Number(rows?.[0]?.pending ?? 0),
    unread: Number(rows?.[0]?.unread ?? 0),
  };
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const { pending, unread } = await counts();

  const groups: NavGroup[] = [
    {
      title: "Operação",
      items: [
        { href: "/admin", label: "Painel", icon: "dashboard" },
        { href: "/admin/reservas", label: "Reservas", icon: "calendar", badge: pending },
        { href: "/admin/mensagens", label: "Mensagens", icon: "inbox", badge: unread },
        { href: "/admin/newsletter", label: "Newsletter", icon: "users" },
      ],
    },
    {
      title: "Conteúdo",
      items: [
        { href: "/admin/quartos", label: "Quartos", icon: "bed" },
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
