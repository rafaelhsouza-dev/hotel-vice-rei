import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { listAudit } from "@/lib/repo/audit";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, fieldClass, formatDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; who?: string; page?: string; entity?: string; id?: string }>;
}) {
  await requirePagePermission("/admin/auditoria");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listAudit({
    search: sp.q?.trim(),
    actor: sp.who?.trim(),
    entity: sp.entity,
    entityId: sp.id,
    limit: PAGE,
    offset: (page - 1) * PAGE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sp.q) u.set("q", sp.q);
    if (sp.who) u.set("who", sp.who);
    if (sp.entity) u.set("entity", sp.entity);
    if (sp.id) u.set("id", sp.id);
    u.set("page", String(p));
    return `/admin/auditoria?${u}`;
  };

  return (
    <>
      <AdminHeader title="Auditoria" subtitle={`${total} registo(s). Quem fez o quê e quando — os registos nunca são apagados.`} />
      <Section>
        <form className="mb-6 flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="q">
            Pesquisar
          </label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Ação, resumo ou identificador" className={`${fieldClass} sm:w-72`} />
          <label className="sr-only" htmlFor="who">
            Utilizador
          </label>
          <input id="who" name="who" defaultValue={sp.who} placeholder="email do utilizador" className={`${fieldClass} sm:w-64`} />
          <button className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">Filtrar</button>
          {(sp.entity || sp.q || sp.who) && (
            <Link href="/admin/auditoria" className="self-center text-sm underline">
              Limpar
            </Link>
          )}
        </form>
        {items.length === 0 ? (
          <EmptyState message="Sem registos para este filtro." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Quando</Th>
                  <Th>Quem</Th>
                  <Th>Ação</Th>
                  <Th>Sobre</Th>
                  <Th>Detalhe</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-line-soft)] align-top last:border-0">
                    <Td className="whitespace-nowrap text-xs">{formatDate(e.createdAt, true)}</Td>
                    <Td className="text-xs">
                      {e.actorEmail}
                      {e.ip && <span className="block text-[var(--color-ink-muted)]">{e.ip}</span>}
                    </Td>
                    <Td className="font-mono text-xs">{e.action}</Td>
                    <Td className="text-xs">
                      {e.entity && (
                        <Link
                          href={`/admin/auditoria?entity=${encodeURIComponent(e.entity)}&id=${encodeURIComponent(e.entityId)}`}
                          className="hover:underline"
                        >
                          {e.entity} {e.entityId && <span className="font-mono">{e.entityId.slice(0, 36)}</span>}
                        </Link>
                      )}
                    </Td>
                    <Td className="max-w-md text-xs text-[var(--color-ink-soft)]">
                      {e.summary}
                      {Object.keys(e.details).length > 0 && (
                        <code className="mt-1 block break-all text-[11px] text-[var(--color-ink-muted)]">
                          {JSON.stringify(e.details).slice(0, 300)}
                        </code>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {pages > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação">
            {page > 1 && (
              <Link href={qs(page - 1)} className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm">
                Anterior
              </Link>
            )}
            <span className="px-3 py-1.5 text-sm">
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link href={qs(page + 1)} className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm">
                Seguinte
              </Link>
            )}
          </nav>
        )}
      </Section>
    </>
  );
}
