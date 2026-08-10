"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { locales, type Locale } from "@/i18n/config";
import * as ops from "@/lib/repo/operations";

/** Mutations for the operational side of the hotel. Every one asserts a session. */

type Trio<T> = Record<Locale, T>;

function str(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}
function int(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function dec(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}
function parseTrio(form: FormData, name: string): Trio<string> {
  return Object.fromEntries(
    locales.map((l) => [l, str(form, `${name}.${l}`)]),
  ) as Trio<string>;
}
/** Keeps a value inside a known set, falling back to the first option. */
function oneOf<T extends readonly string[]>(
  value: string,
  allowed: T,
  fallback: T[number] = allowed[0],
): T[number] {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

// --- units -----------------------------------------------------------------

export async function saveUnit(formData: FormData) {
  await requireSession();
  const code = str(formData, "code");
  if (!code) return;

  await ops.upsertUnit({
    id: formData.get("id") ? int(formData, "id") : undefined,
    code,
    floor: int(formData, "floor"),
    roomId: str(formData, "roomId") || null,
    status: oneOf(str(formData, "status"), ops.UNIT_STATUSES, "available"),
    notes: str(formData, "notes"),
    active: bool(formData, "active"),
  });

  revalidatePath("/admin/acomodacoes");
  redirect("/admin/acomodacoes");
}

export async function changeUnitStatus(formData: FormData) {
  await requireSession();
  await ops.setUnitStatus(
    int(formData, "id"),
    oneOf(str(formData, "status"), ops.UNIT_STATUSES, "available"),
  );
  revalidatePath("/admin/acomodacoes");
  revalidatePath("/admin");
}

export async function removeUnit(formData: FormData) {
  await requireSession();
  await ops.deleteUnit(int(formData, "id"));
  revalidatePath("/admin/acomodacoes");
}

export async function assignUnit(formData: FormData) {
  await requireSession();
  const unitId = str(formData, "unitId");
  await ops.assignBookingUnit(str(formData, "bookingId"), unitId ? Number(unitId) : null);
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/acomodacoes");
}

// --- staff -----------------------------------------------------------------

export async function saveStaff(formData: FormData) {
  await requireSession();
  const name = str(formData, "name");
  if (!name) return;

  await ops.upsertStaff({
    id: str(formData, "id") || undefined,
    name,
    role: str(formData, "role"),
    department: oneOf(str(formData, "department"), ops.DEPARTMENTS, "housekeeping"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    shift: oneOf(str(formData, "shift"), ops.SHIFTS, "morning"),
    active: bool(formData, "active"),
    hiredAt: str(formData, "hiredAt") || null,
  });

  revalidatePath("/admin/equipa");
  redirect("/admin/equipa");
}

export async function removeStaff(formData: FormData) {
  await requireSession();
  await ops.deleteStaff(str(formData, "id"));
  revalidatePath("/admin/equipa");
}

// --- tasks -----------------------------------------------------------------

export async function createTask(formData: FormData) {
  await requireSession();
  const title = str(formData, "title");
  if (!title) return;

  const unitId = str(formData, "unitId");
  await ops.createTask({
    unitId: unitId ? Number(unitId) : null,
    kind: oneOf(str(formData, "kind"), ops.TASK_KINDS, "cleaning"),
    title,
    description: str(formData, "description"),
    assigneeId: str(formData, "assigneeId") || null,
    priority: oneOf(str(formData, "priority"), ops.PRIORITIES, "normal"),
    dueDate: str(formData, "dueDate") || null,
  });

  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/acomodacoes");
  revalidatePath("/admin");
}

export async function changeTaskStatus(formData: FormData) {
  await requireSession();
  await ops.setTaskStatus(
    str(formData, "id"),
    oneOf(str(formData, "status"), ops.TASK_STATUSES, "pending"),
  );
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/acomodacoes");
  revalidatePath("/admin");
}

export async function changeTaskAssignee(formData: FormData) {
  await requireSession();
  await ops.assignTask(str(formData, "id"), str(formData, "assigneeId") || null);
  revalidatePath("/admin/tarefas");
}

export async function removeTask(formData: FormData) {
  await requireSession();
  await ops.deleteTask(str(formData, "id"));
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin");
}

// --- suppliers & inventory -------------------------------------------------

export async function saveSupplier(formData: FormData) {
  await requireSession();
  const name = str(formData, "name");
  if (!name) return;

  await ops.upsertSupplier({
    id: str(formData, "id") || undefined,
    name,
    contact: str(formData, "contact"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    notes: str(formData, "notes"),
    active: bool(formData, "active"),
  });
  revalidatePath("/admin/fornecedores");
}

export async function removeSupplier(formData: FormData) {
  await requireSession();
  await ops.deleteSupplier(str(formData, "id"));
  revalidatePath("/admin/fornecedores");
  revalidatePath("/admin/insumos");
}

export async function saveInventoryItem(formData: FormData) {
  await requireSession();
  const name = str(formData, "name");
  if (!name) return;

  await ops.upsertInventoryItem({
    id: str(formData, "id") || undefined,
    name,
    category: oneOf(str(formData, "category"), ops.CATEGORIES, "other"),
    unit: str(formData, "unit", "un") || "un",
    quantity: dec(formData, "quantity"),
    minQuantity: dec(formData, "minQuantity"),
    cost: dec(formData, "cost"),
    supplierId: str(formData, "supplierId") || null,
    active: bool(formData, "active"),
  });

  revalidatePath("/admin/insumos");
  redirect("/admin/insumos");
}

export async function removeInventoryItem(formData: FormData) {
  await requireSession();
  await ops.deleteInventoryItem(str(formData, "id"));
  revalidatePath("/admin/insumos");
}

export async function recordMovement(formData: FormData) {
  await requireSession();

  const reason = oneOf(str(formData, "reason"), ops.MOVEMENT_REASONS, "adjustment");
  const amount = Math.abs(dec(formData, "amount"));
  if (!amount) return;

  // Purchases add stock; consumption and losses remove it. An adjustment takes
  // the sign the operator typed.
  const delta =
    reason === "purchase" ? amount
    : reason === "adjustment" ? dec(formData, "amount")
    : -amount;

  await ops.recordMovement({
    itemId: str(formData, "itemId"),
    delta,
    reason,
    note: str(formData, "note"),
    staffId: str(formData, "staffId") || null,
  });

  revalidatePath("/admin/insumos");
  revalidatePath("/admin");
}

// --- meals -----------------------------------------------------------------

export async function saveMeal(formData: FormData) {
  await requireSession();
  const name = parseTrio(formData, "name");
  if (!name.pt) return;

  await ops.upsertMeal({
    id: str(formData, "id") || undefined,
    service: oneOf(str(formData, "service"), ops.MEAL_SERVICES, "breakfast"),
    name,
    description: parseTrio(formData, "description"),
    price: dec(formData, "price"),
    allergens: str(formData, "allergens")
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
    vegetarian: bool(formData, "vegetarian"),
    available: bool(formData, "available"),
    position: int(formData, "position"),
  });

  revalidatePath("/admin/refeicoes");
  redirect("/admin/refeicoes");
}

export async function removeMeal(formData: FormData) {
  await requireSession();
  await ops.deleteMeal(str(formData, "id"));
  revalidatePath("/admin/refeicoes");
}
