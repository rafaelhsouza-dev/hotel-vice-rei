import Link from "next/link";
import { notFound } from "next/navigation";
import { listInventory, listSuppliers, listMovements, CATEGORIES } from "@/lib/repo/operations";
import { saveInventoryItem } from "@/app/(admin)/admin/actions-ops";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CATEGORY_LABEL, REASON_LABEL } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

const stamp = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });
const qty = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "novo";

  const [items, suppliers] = await Promise.all([listInventory(), listSuppliers()]);
  const item = isNew ? null : items.find((i) => i.id === id);
  if (!isNew && !item) notFound();

  const history = item ? await listMovements(item.id) : [];

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo artigo" : item!.name}
        subtitle={isNew ? "Registar um insumo em stock." : "Editar artigo de stock."}
      />
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          <form action={saveInventoryItem} className="lg:col-span-2">
            {!isNew && <input type="hidden" name="id" value={item!.id} />}
            <Card className="p-6">
              <div className="grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="name">
                    Designação
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    defaultValue={item?.name ?? ""}
                    placeholder="Ex.: Toalhas de banho"
                    className={fieldClass}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className={labelClass} htmlFor="category">
                      Categoria
                    </label>
                    <select
                      id="category"
                      name="category"
                      defaultValue={item?.category ?? "other"}
                      className={fieldClass}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="unit">
                      Unidade
                    </label>
                    <input
                      id="unit"
                      name="unit"
                      defaultValue={item?.unit ?? "un"}
                      placeholder="un, kg, L, rolo"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="cost">
                      Custo unitário (€)
                    </label>
                    <input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={item?.cost ?? 0}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="quantity">
                      Quantidade {isNew ? "inicial" : "atual"}
                    </label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={item?.quantity ?? 0}
                      readOnly={!isNew}
                      className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                    />
                    {!isNew && (
                      <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                        A quantidade só muda por movimentos de stock.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="minQuantity">
                      Nível mínimo
                    </label>
                    <input
                      id="minQuantity"
                      name="minQuantity"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={item?.minQuantity ?? 0}
                      className={fieldClass}
                    />
                    <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                      Abaixo deste valor o artigo entra em alerta de rutura.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="supplierId">
                    Fornecedor
                  </label>
                  <select
                    id="supplierId"
                    name="supplierId"
                    defaultValue={item?.supplierId ?? ""}
                    className={fieldClass}
                  >
                    <option value="">Sem fornecedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={item?.active ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Artigo ativo
                </label>

                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/insumos"
                    className="inline-flex items-center rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                  >
                    Cancelar
                  </Link>
                </div>
              </div>
            </Card>
          </form>

          {!isNew && (
            <div>
              <h2 className="font-display text-lg tracking-tight">Histórico</h2>
              <div className="mt-4">
                {history.length === 0 ? (
                  <EmptyState message="Sem movimentos registados." />
                ) : (
                  <TableWrap>
                    <table className="w-full text-sm">
                      <thead className="border-b border-[var(--color-line)]">
                        <tr>
                          <Th>Quando</Th>
                          <Th>Motivo</Th>
                          <Th className="text-right">Qt.</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((m) => (
                          <tr key={m.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                            <Td className="whitespace-nowrap text-xs text-[var(--color-ink-muted)]">
                              {m.createdAt ? stamp.format(new Date(m.createdAt)) : "—"}
                            </Td>
                            <Td className="text-[var(--color-ink-soft)]">
                              {REASON_LABEL[m.reason]}
                              {m.staffName && (
                                <p className="text-xs text-[var(--color-ink-muted)]">{m.staffName}</p>
                              )}
                            </Td>
                            <Td
                              className={`text-right font-medium ${
                                m.delta >= 0 ? "text-[var(--color-success)]" : ""
                              }`}
                            >
                              {m.delta >= 0 ? "+" : ""}
                              {qty.format(m.delta)}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
