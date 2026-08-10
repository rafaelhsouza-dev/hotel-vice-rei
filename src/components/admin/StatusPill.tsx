import type { UnitStatus, TaskStatus, Priority } from "@/lib/repo/operations";

/**
 * Shared vocabulary for operational state, so a unit reads the same colour on
 * the floor map, in a table and on the dashboard.
 */

export const UNIT_LABEL: Record<UnitStatus, string> = {
  available: "Livre",
  occupied: "Ocupado",
  cleaning: "Limpeza",
  maintenance: "Manutenção",
  blocked: "Bloqueado",
};

/** Colours read as: green free, ink occupied, gold in progress, red blocked. */
export const UNIT_STYLE: Record<UnitStatus, string> = {
  available: "bg-[var(--color-success)]/12 text-[var(--color-success)] border-[var(--color-success)]/30",
  occupied: "bg-[var(--color-ink)] text-white border-[var(--color-ink)]",
  cleaning: "bg-[var(--color-accent)]/15 text-[var(--color-accent-deep)] border-[var(--color-accent)]/40",
  maintenance: "bg-orange-50 text-orange-800 border-orange-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
};

export const UNIT_DOT: Record<UnitStatus, string> = {
  available: "bg-[var(--color-success)]",
  occupied: "bg-[var(--color-ink)]",
  cleaning: "bg-[var(--color-accent)]",
  maintenance: "bg-orange-500",
  blocked: "bg-red-500",
};

export const TASK_LABEL: Record<TaskStatus, string> = {
  pending: "Por fazer",
  in_progress: "Em curso",
  done: "Concluída",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-[var(--color-line-soft)] text-[var(--color-ink-muted)]",
  normal: "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
  high: "bg-[var(--color-accent)]/15 text-[var(--color-accent-deep)]",
  urgent: "bg-red-50 text-red-700",
};

export const KIND_LABEL = {
  cleaning: "Limpeza",
  maintenance: "Manutenção",
  inspection: "Inspeção",
} as const;

export const DEPARTMENT_LABEL = {
  reception: "Receção",
  housekeeping: "Andares",
  maintenance: "Manutenção",
  kitchen: "Cozinha",
  management: "Direção",
} as const;

export const SHIFT_LABEL = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
  flexible: "Flexível",
} as const;

export const CATEGORY_LABEL = {
  amenities: "Amenities",
  cleaning: "Limpeza",
  linen: "Roupa de casa",
  food: "Alimentar",
  beverage: "Bebidas",
  maintenance: "Manutenção",
  office: "Escritório",
  other: "Outros",
} as const;

export const REASON_LABEL = {
  purchase: "Entrada",
  consumption: "Consumo",
  loss: "Quebra",
  adjustment: "Ajuste",
} as const;

export const MEAL_SERVICE_LABEL = {
  breakfast: "Pequeno-almoço",
  lunch: "Almoço",
  dinner: "Jantar",
  room_service: "Room service",
  bar: "Bar",
} as const;

export function UnitPill({ status }: { status: UnitStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${UNIT_STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${UNIT_DOT[status]}`} aria-hidden />
      {UNIT_LABEL[status]}
    </span>
  );
}
