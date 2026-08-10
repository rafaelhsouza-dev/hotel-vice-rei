import { query, queryOne, transaction } from "../db";
import type { Locale } from "@/i18n/config";

/**
 * Day-to-day hotel operations: accommodation units and their state,
 * housekeeping and maintenance work, the team, stock and the menu.
 *
 * None of this is cached — the backoffice must always see the current row.
 */

type Trio<T> = Record<Locale, T>;
const num = (v: unknown) => Number(v ?? 0);
const isoDate = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : (v as string | null);
const isoStamp = (v: unknown) =>
  v instanceof Date ? v.toISOString() : (v as string | null);

// --- units -----------------------------------------------------------------

export const UNIT_STATUSES = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
  "blocked",
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type Unit = {
  id: number;
  code: string;
  floor: number;
  roomId: string | null;
  roomName: string | null;
  status: UnitStatus;
  notes: string;
  active: boolean;
  openTasks: number;
  /** Reference of the booking currently staying in this unit, if any. */
  guest: string | null;
};

export async function listUnits(): Promise<Unit[]> {
  const rows = await query(
    `SELECT u.id, u.code, u.floor, u.room_id, u.status, u.notes, u.active,
            r.name->>'pt' AS room_name,
            (SELECT count(*) FROM tasks t
              WHERE t.unit_id = u.id AND t.status <> 'done')::int AS open_tasks,
            (SELECT b.first_name || ' ' || b.last_name FROM bookings b
              WHERE b.unit_id = u.id AND b.status <> 'cancelled'
                AND b.check_in <= CURRENT_DATE AND b.check_out > CURRENT_DATE
              LIMIT 1) AS guest
     FROM units u
     LEFT JOIN rooms r ON r.id = u.room_id
     ORDER BY u.floor, u.code`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    code: r.code as string,
    floor: r.floor as number,
    roomId: (r.room_id as string) ?? null,
    roomName: (r.room_name as string) ?? null,
    status: r.status as UnitStatus,
    notes: r.notes as string,
    active: r.active as boolean,
    openTasks: r.open_tasks as number,
    guest: (r.guest as string) ?? null,
  }));
}

export async function upsertUnit(u: {
  id?: number;
  code: string;
  floor: number;
  roomId: string | null;
  status: UnitStatus;
  notes: string;
  active: boolean;
}): Promise<void> {
  if (u.id) {
    await query(
      `UPDATE units SET code=$2, floor=$3, room_id=$4, status=$5, notes=$6,
                        active=$7, updated_at=now()
       WHERE id=$1`,
      [u.id, u.code, u.floor, u.roomId, u.status, u.notes, u.active],
    );
    return;
  }
  await query(
    `INSERT INTO units (code, floor, room_id, status, notes, active)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (code) DO UPDATE SET
       floor=EXCLUDED.floor, room_id=EXCLUDED.room_id, status=EXCLUDED.status,
       notes=EXCLUDED.notes, active=EXCLUDED.active, updated_at=now()`,
    [u.code, u.floor, u.roomId, u.status, u.notes, u.active],
  );
}

export async function setUnitStatus(id: number, status: UnitStatus): Promise<void> {
  await query(`UPDATE units SET status=$2, updated_at=now() WHERE id=$1`, [id, status]);
}

export async function deleteUnit(id: number): Promise<void> {
  await query(`DELETE FROM units WHERE id=$1`, [id]);
}

export type UnitSummary = Record<UnitStatus | "total", number>;

export async function unitSummary(): Promise<UnitSummary> {
  const rows = await query<{ status: string; n: string }>(
    `SELECT status, count(*)::text AS n FROM units WHERE active = true GROUP BY status`,
  );
  const out = {
    available: 0, occupied: 0, cleaning: 0, maintenance: 0, blocked: 0, total: 0,
  } as UnitSummary;
  for (const r of rows) {
    out[r.status as UnitStatus] = Number(r.n);
    out.total += Number(r.n);
  }
  return out;
}

/** Units free for the whole of a stay — used when assigning a booking. */
export async function availableUnitsFor(
  roomId: string | null,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): Promise<Unit[]> {
  const rows = await query(
    `SELECT u.id, u.code, u.floor, u.room_id, u.status, u.notes, u.active,
            r.name->>'pt' AS room_name
     FROM units u
     LEFT JOIN rooms r ON r.id = u.room_id
     WHERE u.active = true
       AND u.status <> 'blocked'
       AND ($1::text IS NULL OR u.room_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.unit_id = u.id
           AND b.status <> 'cancelled'
           AND ($4::uuid IS NULL OR b.id <> $4)
           AND b.check_in < $3::date AND b.check_out > $2::date
       )
     ORDER BY u.floor, u.code`,
    [roomId, checkIn, checkOut, excludeBookingId ?? null],
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    code: r.code as string,
    floor: r.floor as number,
    roomId: (r.room_id as string) ?? null,
    roomName: (r.room_name as string) ?? null,
    status: r.status as UnitStatus,
    notes: r.notes as string,
    active: r.active as boolean,
    openTasks: 0,
    guest: null,
  }));
}

export async function assignBookingUnit(
  bookingId: string,
  unitId: number | null,
): Promise<void> {
  await query(`UPDATE bookings SET unit_id=$2, updated_at=now() WHERE id=$1`, [
    bookingId,
    unitId,
  ]);
}

// --- staff -----------------------------------------------------------------

export const DEPARTMENTS = [
  "reception",
  "housekeeping",
  "maintenance",
  "kitchen",
  "management",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const SHIFTS = ["morning", "afternoon", "night", "flexible"] as const;
export type Shift = (typeof SHIFTS)[number];

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  department: Department;
  email: string;
  phone: string;
  shift: Shift;
  active: boolean;
  hiredAt: string | null;
  openTasks: number;
};

export async function listStaff(): Promise<StaffMember[]> {
  const rows = await query(
    `SELECT s.*, (SELECT count(*) FROM tasks t
                   WHERE t.assignee_id = s.id AND t.status <> 'done')::int AS open_tasks
     FROM staff s ORDER BY s.active DESC, s.department, s.name`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    role: r.role as string,
    department: r.department as Department,
    email: r.email as string,
    phone: r.phone as string,
    shift: r.shift as Shift,
    active: r.active as boolean,
    hiredAt: isoDate(r.hired_at),
    openTasks: r.open_tasks as number,
  }));
}

export async function upsertStaff(s: {
  id?: string;
  name: string;
  role: string;
  department: Department;
  email: string;
  phone: string;
  shift: Shift;
  active: boolean;
  hiredAt: string | null;
}): Promise<void> {
  if (s.id) {
    await query(
      `UPDATE staff SET name=$2, role=$3, department=$4, email=$5, phone=$6,
                        shift=$7, active=$8, hired_at=$9, updated_at=now()
       WHERE id=$1`,
      [s.id, s.name, s.role, s.department, s.email, s.phone, s.shift, s.active, s.hiredAt],
    );
    return;
  }
  await query(
    `INSERT INTO staff (name, role, department, email, phone, shift, active, hired_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [s.name, s.role, s.department, s.email, s.phone, s.shift, s.active, s.hiredAt],
  );
}

export async function deleteStaff(id: string): Promise<void> {
  await query(`DELETE FROM staff WHERE id=$1`, [id]);
}

// --- tasks -----------------------------------------------------------------

export const TASK_KINDS = ["cleaning", "maintenance", "inspection"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STATUSES = ["pending", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  unitId: number | null;
  unitCode: string | null;
  kind: TaskKind;
  title: string;
  description: string;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string | null;
  completedAt: string | null;
};

function toTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    unitId: (r.unit_id as number) ?? null,
    unitCode: (r.unit_code as string) ?? null,
    kind: r.kind as TaskKind,
    title: r.title as string,
    description: r.description as string,
    assigneeId: (r.assignee_id as string) ?? null,
    assigneeName: (r.assignee_name as string) ?? null,
    priority: r.priority as Priority,
    status: r.status as TaskStatus,
    dueDate: isoDate(r.due_date),
    createdAt: isoStamp(r.created_at),
    completedAt: isoStamp(r.completed_at),
  };
}

export async function listTasks(opts: {
  status?: TaskStatus | "open" | "all";
  kind?: TaskKind | "all";
  unitId?: number;
} = {}): Promise<Task[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.status === "open") where.push(`t.status <> 'done'`);
  else if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where.push(`t.status = $${params.length}`);
  }
  if (opts.kind && opts.kind !== "all") {
    params.push(opts.kind);
    where.push(`t.kind = $${params.length}`);
  }
  if (opts.unitId) {
    params.push(opts.unitId);
    where.push(`t.unit_id = $${params.length}`);
  }

  const rows = await query(
    `SELECT t.*, u.code AS unit_code, s.name AS assignee_name
     FROM tasks t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN staff s ON s.id = t.assignee_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY t.status <> 'done' DESC,
              array_position(ARRAY['urgent','high','normal','low'], t.priority),
              t.due_date NULLS LAST, t.created_at DESC
     LIMIT 300`,
    params,
  );
  return rows.map(toTask);
}

export async function createTask(t: {
  unitId: number | null;
  kind: TaskKind;
  title: string;
  description: string;
  assigneeId: string | null;
  priority: Priority;
  dueDate: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO tasks (unit_id, kind, title, description, assignee_id, priority, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [t.unitId, t.kind, t.title, t.description, t.assigneeId, t.priority, t.dueDate],
  );
}

/**
 * Moves a task along and keeps the unit in step: starting a cleaning job puts
 * the unit in `cleaning`, finishing one hands it back as `available`.
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<{ unit_id: number | null; kind: string }>(
      `UPDATE tasks
       SET status=$2, completed_at = CASE WHEN $2 = 'done' THEN now() ELSE NULL END
       WHERE id=$1
       RETURNING unit_id, kind`,
      [id, status],
    );
    const task = rows[0];
    if (!task?.unit_id) return;

    if (status === "in_progress") {
      const next = task.kind === "maintenance" ? "maintenance" : "cleaning";
      await client.query(
        `UPDATE units SET status=$2, updated_at=now()
         WHERE id=$1 AND status NOT IN ('occupied','blocked')`,
        [task.unit_id, next],
      );
    }

    if (status === "done") {
      const { rows: remaining } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM tasks
         WHERE unit_id=$1 AND status <> 'done'`,
        [task.unit_id],
      );
      if (remaining[0]?.n === "0") {
        await client.query(
          `UPDATE units SET status='available', updated_at=now()
           WHERE id=$1 AND status IN ('cleaning','maintenance')`,
          [task.unit_id],
        );
      }
    }
  });
}

export async function assignTask(id: string, assigneeId: string | null): Promise<void> {
  await query(`UPDATE tasks SET assignee_id=$2 WHERE id=$1`, [id, assigneeId]);
}

export async function deleteTask(id: string): Promise<void> {
  await query(`DELETE FROM tasks WHERE id=$1`, [id]);
}

// --- suppliers -------------------------------------------------------------

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  itemCount: number;
};

export async function listSuppliers(): Promise<Supplier[]> {
  const rows = await query(
    `SELECT s.*, (SELECT count(*) FROM inventory_items i WHERE i.supplier_id = s.id)::int AS item_count
     FROM suppliers s ORDER BY s.active DESC, s.name`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    contact: r.contact as string,
    email: r.email as string,
    phone: r.phone as string,
    notes: r.notes as string,
    active: r.active as boolean,
    itemCount: r.item_count as number,
  }));
}

export async function upsertSupplier(s: {
  id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
}): Promise<void> {
  if (s.id) {
    await query(
      `UPDATE suppliers SET name=$2, contact=$3, email=$4, phone=$5, notes=$6, active=$7
       WHERE id=$1`,
      [s.id, s.name, s.contact, s.email, s.phone, s.notes, s.active],
    );
    return;
  }
  await query(
    `INSERT INTO suppliers (name, contact, email, phone, notes, active)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (name) DO NOTHING`,
    [s.name, s.contact, s.email, s.phone, s.notes, s.active],
  );
}

export async function deleteSupplier(id: string): Promise<void> {
  await query(`DELETE FROM suppliers WHERE id=$1`, [id]);
}

// --- inventory -------------------------------------------------------------

export const CATEGORIES = [
  "amenities",
  "cleaning",
  "linen",
  "food",
  "beverage",
  "maintenance",
  "office",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const MOVEMENT_REASONS = [
  "purchase",
  "consumption",
  "loss",
  "adjustment",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  quantity: number;
  minQuantity: number;
  cost: number;
  supplierId: string | null;
  supplierName: string | null;
  active: boolean;
  /** True when stock has fallen to or below the reorder threshold. */
  low: boolean;
};

export async function listInventory(): Promise<InventoryItem[]> {
  const rows = await query(
    `SELECT i.*, s.name AS supplier_name
     FROM inventory_items i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     ORDER BY i.active DESC, (i.quantity <= i.min_quantity) DESC, i.category, i.name`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as Category,
    unit: r.unit as string,
    quantity: num(r.quantity),
    minQuantity: num(r.min_quantity),
    cost: num(r.cost),
    supplierId: (r.supplier_id as string) ?? null,
    supplierName: (r.supplier_name as string) ?? null,
    active: r.active as boolean,
    low: num(r.quantity) <= num(r.min_quantity),
  }));
}

export async function upsertInventoryItem(i: {
  id?: string;
  name: string;
  category: Category;
  unit: string;
  quantity: number;
  minQuantity: number;
  cost: number;
  supplierId: string | null;
  active: boolean;
}): Promise<void> {
  if (i.id) {
    // Quantity is owned by the movement ledger, so it is not updated here.
    await query(
      `UPDATE inventory_items SET name=$2, category=$3, unit=$4, min_quantity=$5,
                                  cost=$6, supplier_id=$7, active=$8, updated_at=now()
       WHERE id=$1`,
      [i.id, i.name, i.category, i.unit, i.minQuantity, i.cost, i.supplierId, i.active],
    );
    return;
  }
  await query(
    `INSERT INTO inventory_items (name, category, unit, quantity, min_quantity, cost, supplier_id, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [i.name, i.category, i.unit, i.quantity, i.minQuantity, i.cost, i.supplierId, i.active],
  );
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await query(`DELETE FROM inventory_items WHERE id=$1`, [id]);
}

/** Records a stock movement and applies it to the running quantity atomically. */
export async function recordMovement(m: {
  itemId: string;
  delta: number;
  reason: MovementReason;
  note: string;
  staffId: string | null;
}): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO inventory_movements (item_id, delta, reason, note, staff_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [m.itemId, m.delta, m.reason, m.note, m.staffId],
    );
    await client.query(
      `UPDATE inventory_items
       SET quantity = GREATEST(0, quantity + $2), updated_at = now()
       WHERE id = $1`,
      [m.itemId, m.delta],
    );
  });
}

export type Movement = {
  id: string;
  itemId: string;
  itemName: string;
  delta: number;
  reason: MovementReason;
  note: string;
  staffName: string | null;
  createdAt: string | null;
};

export async function listMovements(itemId?: string): Promise<Movement[]> {
  const rows = await query(
    `SELECT m.*, i.name AS item_name, s.name AS staff_name
     FROM inventory_movements m
     JOIN inventory_items i ON i.id = m.item_id
     LEFT JOIN staff s ON s.id = m.staff_id
     ${itemId ? "WHERE m.item_id = $1" : ""}
     ORDER BY m.created_at DESC LIMIT 100`,
    itemId ? [itemId] : [],
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    itemId: r.item_id as string,
    itemName: r.item_name as string,
    delta: num(r.delta),
    reason: r.reason as MovementReason,
    note: r.note as string,
    staffName: (r.staff_name as string) ?? null,
    createdAt: isoStamp(r.created_at),
  }));
}

// --- meals -----------------------------------------------------------------

export const MEAL_SERVICES = [
  "breakfast",
  "lunch",
  "dinner",
  "room_service",
  "bar",
] as const;
export type MealService = (typeof MEAL_SERVICES)[number];

export type Meal = {
  id: string;
  service: MealService;
  name: Trio<string>;
  description: Trio<string>;
  price: number;
  allergens: string[];
  vegetarian: boolean;
  available: boolean;
  position: number;
};

export async function listMeals(): Promise<Meal[]> {
  const rows = await query(
    `SELECT * FROM meals
     ORDER BY array_position(ARRAY['breakfast','lunch','dinner','room_service','bar'], service),
              position, created_at`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    service: r.service as MealService,
    name: r.name as Trio<string>,
    description: r.description as Trio<string>,
    price: num(r.price),
    allergens: (r.allergens as string[]) ?? [],
    vegetarian: r.vegetarian as boolean,
    available: r.available as boolean,
    position: r.position as number,
  }));
}

export async function upsertMeal(m: {
  id?: string;
  service: MealService;
  name: Trio<string>;
  description: Trio<string>;
  price: number;
  allergens: string[];
  vegetarian: boolean;
  available: boolean;
  position: number;
}): Promise<void> {
  if (m.id) {
    await query(
      `UPDATE meals SET service=$2, name=$3, description=$4, price=$5, allergens=$6,
                        vegetarian=$7, available=$8, position=$9, updated_at=now()
       WHERE id=$1`,
      [
        m.id, m.service, JSON.stringify(m.name), JSON.stringify(m.description),
        m.price, JSON.stringify(m.allergens), m.vegetarian, m.available, m.position,
      ],
    );
    return;
  }
  await query(
    `INSERT INTO meals (service, name, description, price, allergens, vegetarian, available, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      m.service, JSON.stringify(m.name), JSON.stringify(m.description),
      m.price, JSON.stringify(m.allergens), m.vegetarian, m.available, m.position,
    ],
  );
}

export async function deleteMeal(id: string): Promise<void> {
  await query(`DELETE FROM meals WHERE id=$1`, [id]);
}

// --- operations overview ---------------------------------------------------

export type OpsSnapshot = {
  units: UnitSummary;
  openTasks: number;
  urgentTasks: number;
  lowStock: number;
  staffOnDuty: number;
  arrivalsToday: number;
  departuresToday: number;
  unassignedArrivals: number;
};

export async function opsSnapshot(): Promise<OpsSnapshot> {
  const units = await unitSummary();
  const row = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM tasks WHERE status <> 'done')::text AS open_tasks,
       (SELECT count(*) FROM tasks WHERE status <> 'done' AND priority = 'urgent')::text AS urgent_tasks,
       (SELECT count(*) FROM inventory_items WHERE active AND quantity <= min_quantity)::text AS low_stock,
       (SELECT count(*) FROM staff WHERE active)::text AS staff_on_duty,
       (SELECT count(*) FROM bookings WHERE status <> 'cancelled' AND check_in = CURRENT_DATE)::text AS arrivals,
       (SELECT count(*) FROM bookings WHERE status <> 'cancelled' AND check_out = CURRENT_DATE)::text AS departures,
       (SELECT count(*) FROM bookings WHERE status <> 'cancelled' AND unit_id IS NULL
          AND check_out >= CURRENT_DATE)::text AS unassigned`,
  );
  return {
    units,
    openTasks: Number(row?.open_tasks ?? 0),
    urgentTasks: Number(row?.urgent_tasks ?? 0),
    lowStock: Number(row?.low_stock ?? 0),
    staffOnDuty: Number(row?.staff_on_duty ?? 0),
    arrivalsToday: Number(row?.arrivals ?? 0),
    departuresToday: Number(row?.departures ?? 0),
    unassignedArrivals: Number(row?.unassigned ?? 0),
  };
}
