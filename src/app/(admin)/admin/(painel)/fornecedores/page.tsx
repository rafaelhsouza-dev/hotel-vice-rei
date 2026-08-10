import { listSuppliers } from "@/lib/repo/operations";
import { saveSupplier, removeSupplier } from "@/app/(admin)/admin/actions-ops";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, Badge, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
  try {
    suppliers = await listSuppliers();
  } catch {
    /* handled by the empty state */
  }

  return (
    <>
      <AdminHeader
        title="Fornecedores"
        subtitle={`${suppliers.filter((s) => s.active).length} ativos de ${suppliers.length}.`}
      />
      <Section>
        <Card className="p-6">
          <h2 className="font-display text-lg tracking-tight">Novo fornecedor</h2>
          <form action={saveSupplier} className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="name">
                Nome
              </label>
              <input id="name" name="name" required className={fieldClass} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="contact">
                Pessoa de contacto
              </label>
              <input id="contact" name="contact" className={fieldClass} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className={fieldClass} />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="phone">
                Telefone
              </label>
              <input id="phone" name="phone" className={fieldClass} />
            </div>
            <input type="hidden" name="active" value="on" />
            <div className="flex items-end lg:col-span-1">
              <SubmitButton icon="plus" pendingLabel="A guardar…">
                Adicionar
              </SubmitButton>
            </div>
          </form>
        </Card>

        <div className="mt-6">
          {suppliers.length === 0 ? (
            <EmptyState message="Ainda não há fornecedores." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Fornecedor</Th>
                    <Th>Contacto</Th>
                    <Th>Artigos</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                      <Td>
                        <p className="font-medium">{s.name}</p>
                        {s.contact && (
                          <p className="text-xs text-[var(--color-ink-muted)]">{s.contact}</p>
                        )}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="hover:text-[var(--color-accent-deep)]">
                            {s.email}
                          </a>
                        ) : (
                          "—"
                        )}
                        {s.phone && <p className="text-xs text-[var(--color-ink-muted)]">{s.phone}</p>}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">{s.itemCount}</Td>
                      <Td>
                        <Badge tone={s.active ? "success" : "neutral"}>
                          {s.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <form action={removeSupplier}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar fornecedor"
                              confirm={`Eliminar ${s.name}? Os artigos ficam sem fornecedor.`}
                            />
                          </form>
                        </div>
                      </Td>
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
