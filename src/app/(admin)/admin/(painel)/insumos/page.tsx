import Link from "next/link";
import {
  listInventory, listMovements, listStaff, listSuppliers,
  CATEGORIES, MOVEMENT_REASONS, type Category,
} from "@/lib/repo/operations";
import { recordMovement, removeInventoryItem } from "@/app/(admin)/admin/actions-ops";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, Badge, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CATEGORY_LABEL, REASON_LABEL } from "@/components/admin/StatusPill";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const stamp = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const qty = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; rutura?: string }>;
}) {
  const sp = await searchParams;
  const category = (CATEGORIES as readonly string[]).includes(sp.categoria ?? "")
    ? (sp.categoria as Category)
    : null;
  const onlyLow = sp.rutura === "1";

  let items: Awaited<ReturnType<typeof listInventory>> = [];
  let movements: Awaited<ReturnType<typeof listMovements>> = [];
  let staff: Awaited<ReturnType<typeof listStaff>> = [];
  let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
  try {
    [items, movements, staff, suppliers] = await Promise.all([
      listInventory(),
      listMovements(),
      listStaff(),
      listSuppliers(),
    ]);
  } catch {
    /* handled by the empty state */
  }

  const lowCount = items.filter((i) => i.low && i.active).length;
  const visible = items.filter(
    (i) => (!category || i.category === category) && (!onlyLow || i.low),
  );
  const stockValue = items.reduce((sum, i) => sum + i.quantity * i.cost, 0);

  return (
    <>
      <AdminHeader
        title="Insumos"
        subtitle={`${items.length} artigos · ${lowCount} em rutura · ${euro.format(stockValue)} em stock`}
        action={{ href: "/admin/insumos/novo", label: "Novo artigo" }}
      />

      <Section>
        {lowCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent-deep)]">
            <Icon name="shield" width={16} height={16} />
            <span>
              {lowCount} artigo{lowCount === 1 ? "" : "s"} no nível mínimo ou abaixo.
            </span>
            <Link href="/admin/insumos?rutura=1" className="font-medium underline">
              Ver apenas esses
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/insumos"
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              !category && !onlyLow
                ? "bg-[var(--color-ink)] text-white"
                : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
            }`}
          >
            Todos
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/admin/insumos?categoria=${c}`}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                category === c
                  ? "bg-[var(--color-ink)] text-white"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          {visible.length === 0 ? (
            <EmptyState message="Nenhum artigo neste filtro." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Artigo</Th>
                    <Th>Categoria</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Mínimo</Th>
                    <Th>Fornecedor</Th>
                    <Th>Movimento</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-[var(--color-line-soft)] align-middle last:border-0 ${
                        item.active ? "" : "opacity-55"
                      }`}
                    >
                      <Td>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          {euro.format(item.cost)} / {item.unit}
                        </p>
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {CATEGORY_LABEL[item.category]}
                      </Td>
                      <Td className="text-right">
                        <span className={item.low ? "font-semibold text-[var(--color-accent-deep)]" : "font-medium"}>
                          {qty.format(item.quantity)} {item.unit}
                        </span>
                        {item.low && (
                          <span className="ml-2 align-middle">
                            <Badge tone="warning">rutura</Badge>
                          </span>
                        )}
                      </Td>
                      <Td className="text-right text-[var(--color-ink-soft)]">
                        {qty.format(item.minQuantity)}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {item.supplierName ?? "—"}
                      </Td>
                      <Td>
                        <form action={recordMovement} className="flex items-center gap-1.5">
                          <input type="hidden" name="itemId" value={item.id} />
                          <label className="sr-only" htmlFor={`am-${item.id}`}>
                            Quantidade para {item.name}
                          </label>
                          <input
                            id={`am-${item.id}`}
                            name="amount"
                            type="number"
                            step="0.01"
                            placeholder="0"
                            className="w-20 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                          />
                          <label className="sr-only" htmlFor={`rs-${item.id}`}>
                            Motivo do movimento
                          </label>
                          <select
                            id={`rs-${item.id}`}
                            name="reason"
                            defaultValue="consumption"
                            className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                          >
                            {MOVEMENT_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {REASON_LABEL[r]}
                              </option>
                            ))}
                          </select>
                          <label className="sr-only" htmlFor={`sf-${item.id}`}>
                            Colaborador
                          </label>
                          <select
                            id={`sf-${item.id}`}
                            name="staffId"
                            className="max-w-28 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">—</option>
                            {staff.filter((s) => s.active).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name.split(" ")[0]}
                              </option>
                            ))}
                          </select>
                          <SubmitButton variant="icon" icon="check" title="Registar movimento" />
                        </form>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/insumos/${item.id}`}
                            title="Editar artigo"
                            aria-label={`Editar ${item.name}`}
                            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                          >
                            <Icon name="edit" width={14} height={14} />
                          </Link>
                          <form action={removeInventoryItem}>
                            <input type="hidden" name="id" value={item.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar artigo"
                              confirm={`Eliminar ${item.name} e o seu histórico?`}
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

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl tracking-tight">Últimos movimentos</h2>
            <div className="mt-4">
              {movements.length === 0 ? (
                <EmptyState message="Ainda não há movimentos de stock." />
              ) : (
                <TableWrap>
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b border-[var(--color-line)]">
                      <tr>
                        <Th>Quando</Th>
                        <Th>Artigo</Th>
                        <Th>Motivo</Th>
                        <Th>Quem</Th>
                        <Th className="text-right">Quantidade</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.slice(0, 15).map((m) => (
                        <tr key={m.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                          <Td className="whitespace-nowrap text-xs text-[var(--color-ink-muted)]">
                            {m.createdAt ? stamp.format(new Date(m.createdAt)) : "—"}
                          </Td>
                          <Td className="font-medium">{m.itemName}</Td>
                          <Td className="text-[var(--color-ink-soft)]">{REASON_LABEL[m.reason]}</Td>
                          <Td className="text-[var(--color-ink-soft)]">{m.staffName ?? "—"}</Td>
                          <Td
                            className={`text-right font-medium ${
                              m.delta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-ink)]"
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

          <div>
            <h2 className="font-display text-xl tracking-tight">Fornecedores</h2>
            <Card className="mt-4 p-5">
              {suppliers.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-muted)]">Nenhum fornecedor.</p>
              ) : (
                <ul className="space-y-3">
                  {suppliers.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="truncate text-xs text-[var(--color-ink-muted)]">
                          {s.itemCount} artigo{s.itemCount === 1 ? "" : "s"}
                          {s.phone ? ` · ${s.phone}` : ""}
                        </p>
                      </div>
                      {!s.active && <Badge>inativo</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/admin/fornecedores"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)]"
              >
                Gerir fornecedores
                <Icon name="arrow-right" width={13} height={13} />
              </Link>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
