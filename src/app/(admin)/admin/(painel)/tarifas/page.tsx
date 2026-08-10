import Link from "next/link";
import { listExtras, listPromoCodes } from "@/lib/repo/admin";
import { savePromoCode, removePromoCode } from "@/app/(admin)/admin/actions";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, Badge,
  fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export default async function RatesAdminPage() {
  const extras = await listExtras();
  const codes = await listPromoCodes();
  const extraIds = extras.map((e) => e.id);

  return (
    <>
      <AdminHeader
        title="Extras e códigos"
        subtitle="Serviços adicionais e descontos aplicáveis no motor de reservas."
        action={{ href: "/admin/tarifas/novo", label: "Novo extra" }}
      />

      <Section>
        <h2 className="font-display text-xl tracking-tight">Extras da estadia</h2>
        <div className="mt-4">
          {extras.length === 0 ? (
            <EmptyState message="Ainda não há extras configurados." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Extra</Th>
                    <Th>Preço</Th>
                    <Th>Cobrança</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {extras.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                      <Td>
                        <p className="font-medium">{e.label.pt}</p>
                        <p className="text-xs text-[var(--color-ink-muted)]">{e.description.pt}</p>
                      </Td>
                      <Td className="font-medium">{euro.format(e.price)}</Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {e.perNight ? "por noite" : "por estadia"}
                      </Td>
                      <Td>
                        <Badge tone={e.active ? "success" : "neutral"}>
                          {e.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </Td>
                      <Td>
                        <RowActions
                          table="extras"
                          id={e.id}
                          ids={extraIds}
                          published={e.active}
                          publishedLabel="Ativo"
                          editHref={`/admin/tarifas/${e.id}`}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl tracking-tight">Códigos promocionais</h2>

        <Card className="mt-4 p-6">
          <form action={savePromoCode} className="grid gap-4 sm:grid-cols-[1fr_140px_180px_auto] sm:items-end">
            <div>
              <label className={labelClass} htmlFor="code">
                Código
              </label>
              <input
                id="code"
                name="code"
                required
                placeholder="VERAO25"
                className={`${fieldClass} uppercase`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="percent">
                Desconto (%)
              </label>
              <input
                id="percent"
                name="percent"
                type="number"
                min={1}
                max={90}
                defaultValue={10}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="expiresAt">
                Validade (opcional)
              </label>
              <input id="expiresAt" name="expiresAt" type="date" className={fieldClass} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked
                  className="h-4 w-4 accent-[var(--color-accent-deep)]"
                />
                Ativo
              </label>
              <SubmitButton icon="plus" pendingLabel="A guardar…">
                Guardar
              </SubmitButton>
            </div>
          </form>
        </Card>

        <div className="mt-4">
          {codes.length === 0 ? (
            <EmptyState message="Ainda não há códigos promocionais." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Código</Th>
                    <Th>Desconto</Th>
                    <Th>Validade</Th>
                    <Th>Utilizações</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.code} className="border-b border-[var(--color-line-soft)] last:border-0">
                      <Td className="font-mono font-medium">{c.code}</Td>
                      <Td>{Math.round(c.percent * 100)}%</Td>
                      <Td className="text-[var(--color-ink-soft)]">{c.expiresAt ?? "sem limite"}</Td>
                      <Td className="text-[var(--color-ink-soft)]">{c.uses}</Td>
                      <Td>
                        <Badge tone={c.active ? "success" : "neutral"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <form action={removePromoCode}>
                            <input type="hidden" name="code" value={c.code} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar código"
                              confirm={`Eliminar o código ${c.code}?`}
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

        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
          Precisa de editar um extra?{" "}
          <Link href="/admin/tarifas/novo" className="text-[var(--color-accent-deep)] hover:underline">
            Criar um novo
          </Link>{" "}
          ou use o botão de edição na tabela acima.
        </p>
      </Section>
    </>
  );
}
