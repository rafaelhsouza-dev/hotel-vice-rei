import { listSubscribers } from "@/lib/repo/ops";
import { removeSubscriber } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" });

export default async function NewsletterAdminPage() {
  let subscribers: Awaited<ReturnType<typeof listSubscribers>> = [];
  try {
    subscribers = await listSubscribers();
  } catch {
    /* handled by the empty state */
  }

  return (
    <>
      <AdminHeader
        title="Newsletter"
        subtitle={`${subscribers.length} subscritor${subscribers.length === 1 ? "" : "es"}.`}
      />
      <Section>
        {subscribers.length === 0 ? (
          <EmptyState message="Ainda não há subscritores." />
        ) : (
          <>
            <details className="mb-4 rounded-2xl border border-[var(--color-line)] bg-white p-5">
              <summary className="cursor-pointer text-sm font-medium">
                Exportar lista de emails
              </summary>
              <textarea
                readOnly
                rows={6}
                aria-label="Emails separados por vírgula"
                className="mt-3 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-line-soft)] px-4 py-3 font-mono text-xs"
                value={subscribers.filter((s) => s.active).map((s) => s.email).join(", ")}
              />
            </details>

            <TableWrap>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Email</Th>
                    <Th>Idioma</Th>
                    <Th>Subscrição</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                      <Td className="font-medium">{s.email}</Td>
                      <Td className="text-[var(--color-ink-soft)]">{s.locale.toUpperCase()}</Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {fmt.format(new Date(s.createdAt))}
                      </Td>
                      <Td>
                        <Badge tone={s.active ? "success" : "neutral"}>
                          {s.active ? "Ativa" : "Cancelada"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <form action={removeSubscriber}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Remover subscritor"
                              confirm={`Remover ${s.email} da lista?`}
                            />
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Section>
    </>
  );
}
