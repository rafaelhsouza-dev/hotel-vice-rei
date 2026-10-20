import { query, queryOne, transaction } from "../db";

/**
 * Faults, repair orders and inspections.
 *
 * A repair order is a `tasks` row of kind 'maintenance' linked to the issue,
 * so it shows up in the team's task list and drives the unit's status the
 * same way any other task does (see setTaskStatus). Parts used are stock
 * movements tagged with the task, so the stock ledger stays the one source
 * of truth for quantities.
 */

export const SEVERITIES = ["low", "normal", "high", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABEL: Record<Severity, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };

export type Issue = {
  id: string;
  unitId: number | null;
  unitCode: string | null;
  location: string;
  title: string;
  description: string;
  severity: Severity;
  photo: string;
  status: "open" | "in_progress" | "resolved";
  reportedBy: string;
  blocksUnit: boolean;
  createdAt: string;
  resolvedAt: string | null;
  orders: RepairOrder[];
};

export type RepairOrder = {
  id: string;
  title: string;
  status: string;
  assigneeName: string | null;
  supplierName: string | null;
  cost: number;
  partsCost: number;
  dueDate: string | null;
  notes: string;
  parts: { item: string; quantity: number; unit: string; cost: number }[];
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

export async function listIssues(status: "open" | "all" = "open"): Promise<Issue[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT i.*, u.code AS unit_code FROM issues i LEFT JOIN units u ON u.id = i.unit_id
     WHERE ($1 = 'all' OR i.status <> 'resolved')
     ORDER BY i.status = 'resolved', array_position(ARRAY['urgent','high','normal','low'], i.severity), i.created_at DESC
     LIMIT 300`,
    [status],
  );
  const ids = rows.map((r) => String(r.id));
  const orders = ids.length
    ? await query<Record<string, unknown>>(
        `SELECT t.id, t.issue_id, t.title, t.status, t.cost, t.due_date, t.notes, s.name AS assignee_name, sp.name AS supplier_name,
           COALESCE((SELECT sum(-m.delta * ii.cost) FROM inventory_movements m JOIN inventory_items ii ON ii.id = m.item_id WHERE m.task_id = t.id), 0) AS parts_cost,
           COALESCE((SELECT json_agg(json_build_object('item', ii.name, 'quantity', -m.delta, 'unit', ii.unit, 'cost', -m.delta * ii.cost))
                       FROM inventory_movements m JOIN inventory_items ii ON ii.id = m.item_id WHERE m.task_id = t.id), '[]') AS parts
         FROM tasks t LEFT JOIN staff s ON s.id = t.assignee_id LEFT JOIN suppliers sp ON sp.id = t.supplier_id
         WHERE t.issue_id = ANY($1::uuid[]) ORDER BY t.created_at`,
        [ids],
      )
    : [];
  return rows.map((r) => ({
    id: String(r.id),
    unitId: (r.unit_id as number) ?? null,
    unitCode: (r.unit_code as string) ?? null,
    location: String(r.location ?? ""),
    title: String(r.title),
    description: String(r.description ?? ""),
    severity: r.severity as Severity,
    photo: String(r.photo ?? ""),
    status: r.status as Issue["status"],
    reportedBy: String(r.reported_by ?? ""),
    blocksUnit: Boolean(r.blocks_unit),
    createdAt: iso(r.created_at) ?? "",
    resolvedAt: iso(r.resolved_at),
    orders: orders
      .filter((o) => o.issue_id === r.id)
      .map((o) => ({
        id: String(o.id),
        title: String(o.title),
        status: String(o.status),
        assigneeName: (o.assignee_name as string) ?? null,
        supplierName: (o.supplier_name as string) ?? null,
        cost: Number(o.cost ?? 0),
        partsCost: Number(o.parts_cost ?? 0),
        dueDate: o.due_date ? String(o.due_date).slice(0, 10) : null,
        notes: String(o.notes ?? ""),
        parts: (o.parts as RepairOrder["parts"]) ?? [],
      })),
  }));
}

/**
 * Reports a fault. When it blocks the unit, the unit goes to maintenance in
 * the same transaction so it stops being offered at check-in.
 */
export async function createIssue(input: {
  unitId: number | null;
  location: string;
  title: string;
  description: string;
  severity: Severity;
  photo: string;
  reportedBy: string;
  blocksUnit: boolean;
}): Promise<string> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO issues (unit_id, location, title, description, severity, photo, reported_by, blocks_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.unitId, input.location, input.title, input.description, input.severity, input.photo, input.reportedBy, input.blocksUnit],
    );
    if (input.unitId && input.blocksUnit) {
      await client.query(`UPDATE units SET status='maintenance', updated_at=now() WHERE id=$1 AND status <> 'occupied'`, [input.unitId]);
    }
    return rows[0].id;
  });
}

export async function createRepairOrder(input: {
  issueId: string;
  title: string;
  assigneeId: string | null;
  supplierId: string | null;
  cost: number;
  dueDate: string | null;
  notes: string;
}): Promise<string> {
  return transaction(async (client) => {
    const { rows: issue } = await client.query<{ unit_id: number | null; severity: string; title: string }>(
      `SELECT unit_id, severity, title FROM issues WHERE id = $1`,
      [input.issueId],
    );
    if (!issue[0]) throw new Error("Avaria não encontrada.");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO tasks (unit_id, kind, title, description, assignee_id, priority, due_date, issue_id, supplier_id, cost, notes)
       VALUES ($1,'maintenance',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        issue[0].unit_id,
        input.title || `Reparação: ${issue[0].title}`,
        input.notes,
        input.assigneeId,
        issue[0].severity,
        input.dueDate,
        input.issueId,
        input.supplierId,
        input.cost,
        input.notes,
      ],
    );
    await client.query(`UPDATE issues SET status='in_progress' WHERE id=$1 AND status='open'`, [input.issueId]);
    return rows[0].id;
  });
}

export async function updateRepairOrder(id: string, input: { cost: number; notes: string; supplierId: string | null }): Promise<void> {
  await query(`UPDATE tasks SET cost=$2, notes=$3, supplier_id=$4 WHERE id=$1`, [id, input.cost, input.notes, input.supplierId]);
}

/** Parts taken from stock for a repair: one ledger entry per part. */
export async function useParts(taskId: string, itemId: string, quantity: number, staffId: string | null): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<{ quantity: string; name: string }>(
      `SELECT quantity, name FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [itemId],
    );
    if (!rows[0]) throw new Error("Artigo inexistente.");
    if (Number(rows[0].quantity) < quantity) throw new Error(`Só há ${Number(rows[0].quantity)} de ${rows[0].name} em stock.`);
    await client.query(
      `INSERT INTO inventory_movements (item_id, delta, reason, note, staff_id, task_id)
       VALUES ($1, $2, 'consumption', 'Reparação', $3, $4)`,
      [itemId, -quantity, staffId, taskId],
    );
    await client.query(`UPDATE inventory_items SET quantity = quantity - $2, updated_at = now() WHERE id = $1`, [itemId, quantity]);
  });
}

/** Closes the issue. Puts a blocked unit back to service only if nothing else is open on it. */
export async function resolveIssue(id: string): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<{ unit_id: number | null }>(
      `UPDATE issues SET status='resolved', resolved_at=now() WHERE id=$1 RETURNING unit_id`,
      [id],
    );
    await client.query(`UPDATE tasks SET status='done', completed_at=now() WHERE issue_id=$1 AND status <> 'done'`, [id]);
    const unitId = rows[0]?.unit_id;
    if (unitId) {
      const { rows: open } = await client.query<{ n: string }>(
        `SELECT (SELECT count(*) FROM issues WHERE unit_id=$1 AND status <> 'resolved' AND blocks_unit)
              + (SELECT count(*) FROM tasks WHERE unit_id=$1 AND status <> 'done') AS n`,
        [unitId],
      );
      if (Number(open[0]?.n ?? 0) === 0) {
        await client.query(`UPDATE units SET status='available', updated_at=now() WHERE id=$1 AND status='maintenance'`, [unitId]);
      }
    }
  });
}

export async function reopenIssue(id: string): Promise<void> {
  await query(`UPDATE issues SET status='open', resolved_at=NULL WHERE id=$1`, [id]);
}

// --- inspections ----------------------------------------------------------------

export type Checklist = { id: string; name: string; items: string[]; active: boolean };

export async function listChecklists(): Promise<Checklist[]> {
  const rows = await query<{ id: string; name: string; items: string[]; active: boolean }>(
    `SELECT id, name, items, active FROM checklists ORDER BY active DESC, name`,
  );
  return rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items : [] }));
}

export async function saveChecklist(input: { id: string | null; name: string; items: string[]; active: boolean }): Promise<void> {
  if (input.id) {
    await query(`UPDATE checklists SET name=$2, items=$3::jsonb, active=$4 WHERE id=$1`, [input.id, input.name, JSON.stringify(input.items), input.active]);
  } else {
    await query(`INSERT INTO checklists (name, items, active) VALUES ($1,$2::jsonb,$3)`, [input.name, JSON.stringify(input.items), input.active]);
  }
}

export type Inspection = {
  id: string;
  unitCode: string | null;
  checklistName: string;
  inspector: string;
  passed: number;
  failed: number;
  results: { item: string; ok: boolean }[];
  notes: string;
  createdAt: string;
};

export async function recordInspection(input: {
  unitId: number;
  checklistId: string;
  inspector: string;
  results: { item: string; ok: boolean }[];
  notes: string;
}): Promise<void> {
  const passed = input.results.filter((r) => r.ok).length;
  await query(
    `INSERT INTO inspections (unit_id, checklist_id, inspector, results, passed, failed, notes)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [input.unitId, input.checklistId, input.inspector, JSON.stringify(input.results), passed, input.results.length - passed, input.notes],
  );
}

export async function listInspections(limit = 60): Promise<Inspection[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT i.*, u.code AS unit_code, c.name AS checklist_name
     FROM inspections i LEFT JOIN units u ON u.id = i.unit_id LEFT JOIN checklists c ON c.id = i.checklist_id
     ORDER BY i.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    unitCode: (r.unit_code as string) ?? null,
    checklistName: String(r.checklist_name ?? "—"),
    inspector: String(r.inspector ?? ""),
    passed: Number(r.passed),
    failed: Number(r.failed),
    results: (r.results as Inspection["results"]) ?? [],
    notes: String(r.notes ?? ""),
    createdAt: iso(r.created_at) ?? "",
  }));
}

export async function issueSummary(): Promise<{ open: number; urgent: number; blocked: number }> {
  const r = await queryOne<Record<string, string>>(
    `SELECT count(*) FILTER (WHERE status <> 'resolved')::text AS open,
            count(*) FILTER (WHERE status <> 'resolved' AND severity = 'urgent')::text AS urgent,
            count(*) FILTER (WHERE status <> 'resolved' AND blocks_unit)::text AS blocked
     FROM issues`,
  );
  return { open: Number(r?.open ?? 0), urgent: Number(r?.urgent ?? 0), blocked: Number(r?.blocked ?? 0) };
}
