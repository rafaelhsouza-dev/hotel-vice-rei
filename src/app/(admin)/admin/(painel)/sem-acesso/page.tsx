import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { AdminHeader, Section, Card } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const actor = await requireSession();
  return (
    <>
      <AdminHeader title="Sem acesso" subtitle={`A sua função (${ROLE_LABEL[actor.role]}) não inclui esta área.`} />
      <Section>
        <Card className="max-w-xl p-6 text-sm">
          <p>Se precisa de aceder a esta área, peça a um administrador que ajuste a sua função em Utilizadores.</p>
          <Link href="/admin" className="mt-4 inline-block text-[var(--color-accent-deep)] underline underline-offset-2">
            Voltar ao painel
          </Link>
        </Card>
      </Section>
    </>
  );
}
