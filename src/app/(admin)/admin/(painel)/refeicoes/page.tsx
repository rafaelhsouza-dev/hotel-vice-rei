import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { listMeals, MEAL_SERVICES } from "@/lib/repo/operations";
import { removeMeal } from "@/app/(admin)/admin/actions-ops";
import { AdminHeader, Section, Card, EmptyState, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { MEAL_SERVICE_LABEL } from "@/components/admin/StatusPill";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export default async function MealsPage() {
  await requirePagePermission("/admin/refeicoes");
  let meals: Awaited<ReturnType<typeof listMeals>> = [];
  try {
    meals = await listMeals();
  } catch {
    /* handled by the empty state */
  }

  const byService = MEAL_SERVICES.map((service) => ({
    service,
    items: meals.filter((m) => m.service === service),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <AdminHeader
        title="Refeições"
        subtitle={`${meals.length} itens de ementa · ${meals.filter((m) => m.available).length} disponíveis`}
        action={{ href: "/admin/refeicoes/novo", label: "Novo item" }}
      />

      <Section>
        {byService.length === 0 ? (
          <EmptyState message="A ementa está vazia." />
        ) : (
          <div className="space-y-10">
            {byService.map((group) => (
              <div key={group.service}>
                <h2 className="mb-4 flex items-baseline gap-3">
                  <span className="font-display text-xl tracking-tight">
                    {MEAL_SERVICE_LABEL[group.service]}
                  </span>
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {group.items.length} item{group.items.length === 1 ? "" : "s"}
                  </span>
                </h2>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((meal) => (
                    <Card
                      key={meal.id}
                      className={`flex flex-col p-5 ${meal.available ? "" : "opacity-55"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-lg leading-tight tracking-tight">
                            {meal.name.pt}
                          </p>
                          {meal.description.pt && (
                            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                              {meal.description.pt}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 font-display text-lg">{euro.format(meal.price)}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {meal.vegetarian && <Badge tone="success">vegetariano</Badge>}
                        {!meal.available && <Badge>indisponível</Badge>}
                        {meal.allergens.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-[var(--color-line-soft)] px-2 py-0.5 text-[11px] text-[var(--color-ink-muted)]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--color-line-soft)] pt-3">
                        <Link
                          href={`/admin/refeicoes/${meal.id}`}
                          title="Editar item"
                          aria-label={`Editar ${meal.name.pt}`}
                          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                        >
                          <Icon name="edit" width={14} height={14} />
                        </Link>
                        <form action={removeMeal}>
                          <input type="hidden" name="id" value={meal.id} />
                          <SubmitButton
                            variant="icon"
                            icon="trash"
                            title="Eliminar item"
                            confirm={`Eliminar "${meal.name.pt}" da ementa?`}
                          />
                        </form>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
