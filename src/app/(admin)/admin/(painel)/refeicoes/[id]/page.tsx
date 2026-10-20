import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listMeals, MEAL_SERVICES } from "@/lib/repo/operations";
import { saveMeal } from "@/app/(admin)/admin/actions-ops";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { MEAL_SERVICE_LABEL } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

export default async function MealEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("/admin/refeicoes/x");
  const { id } = await params;
  const isNew = id === "novo";
  const meals = await listMeals();
  const meal = isNew ? null : meals.find((m) => m.id === id);
  if (!isNew && !meal) notFound();

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo item de ementa" : meal!.name.pt}
        subtitle="Prato ou bebida servido no hotel."
      />
      <Section>
        <form action={saveMeal} className="grid gap-6 lg:grid-cols-3">
          {!isNew && <input type="hidden" name="id" value={meal!.id} />}

          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="grid gap-5">
                <LocaleFields name="name" label="Designação" values={meal?.name} required />
                <LocaleFields
                  name="description"
                  label="Descrição"
                  values={meal?.description}
                  variant="textarea"
                  rows={3}
                />
              </div>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6 p-6">
              <div className="grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="service">
                    Serviço
                  </label>
                  <select
                    id="service"
                    name="service"
                    defaultValue={meal?.service ?? "breakfast"}
                    className={fieldClass}
                  >
                    {MEAL_SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {MEAL_SERVICE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="price">
                    Preço (€)
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={meal?.price ?? 0}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="allergens">
                    Alergénios
                  </label>
                  <input
                    id="allergens"
                    name="allergens"
                    defaultValue={meal?.allergens.join(", ") ?? ""}
                    placeholder="glúten, lactose, ovo"
                    className={fieldClass}
                  />
                  <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                    Separados por vírgulas.
                  </p>
                </div>

                <div>
                  <label className={labelClass} htmlFor="position">
                    Ordem
                  </label>
                  <input
                    id="position"
                    name="position"
                    type="number"
                    defaultValue={meal?.position ?? meals.length}
                    className={fieldClass}
                  />
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="vegetarian"
                    defaultChecked={meal?.vegetarian ?? false}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Vegetariano
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="available"
                    defaultChecked={meal?.available ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Disponível
                </label>

                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/refeicoes"
                    className="inline-flex items-center rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                  >
                    Cancelar
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </form>
      </Section>
    </>
  );
}
