/**
 * Roles and what each may do in the backoffice.
 *
 * Pure data with no runtime dependencies, so the Edge proxy, server
 * components and server actions all read the same table. The proxy uses it to
 * redirect early; every page and action re-checks it against the database,
 * because a cookie alone must never be what grants access.
 */

export const ROLES = [
  "owner",
  "admin",
  "reception",
  "housekeeping",
  "maintenance",
  "accounting",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Proprietário",
  admin: "Administração",
  reception: "Receção",
  housekeeping: "Governanta",
  maintenance: "Manutenção",
  accounting: "Contabilidade",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Acesso total, incluindo utilizadores, acessos e integrações.",
  admin: "Acesso total, incluindo utilizadores, acessos e integrações.",
  reception: "Reservas, ocupação, check-in, conta do quarto, hóspedes e mensagens.",
  housekeeping: "Ocupação, tarefas de limpeza, inspeções, insumos e avarias.",
  maintenance: "Avarias, ordens de reparação, tarefas de manutenção e insumos.",
  accounting: "Reservas e pagamentos em leitura, faturas e relatórios.",
};

export const PERMISSIONS = [
  "dashboard",
  "bookings.view",
  "bookings.manage",
  "payments.manage",
  "invoices.manage",
  "guests.manage",
  "availability.manage",
  "rates.manage",
  "pms.view",
  "housekeeping.manage",
  "maintenance.manage",
  "inventory.manage",
  "staff.manage",
  "messages.manage",
  "content.manage",
  "reports.view",
  "integrations.manage",
  "settings.manage",
  "users.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const GRANTS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  admin: ALL,
  reception: [
    "dashboard",
    "bookings.view",
    "bookings.manage",
    "payments.manage",
    "guests.manage",
    "availability.manage",
    "pms.view",
    "housekeeping.manage",
    "messages.manage",
    "reports.view",
  ],
  housekeeping: [
    "dashboard",
    "pms.view",
    "housekeeping.manage",
    "maintenance.manage",
    "inventory.manage",
  ],
  maintenance: ["dashboard", "pms.view", "maintenance.manage", "inventory.manage"],
  accounting: [
    "dashboard",
    "bookings.view",
    "payments.manage",
    "invoices.manage",
    "reports.view",
  ],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return GRANTS[role].includes(permission);
}

export function permissionsFor(role: string): readonly Permission[] {
  return isRole(role) ? GRANTS[role] : [];
}

/**
 * Which permission opens each admin area. Longest prefix wins, so
 * `/admin/reservas/nova` can require more than `/admin/reservas`.
 */
export const ROUTE_PERMISSIONS: [prefix: string, permission: Permission][] = [
  ["/admin/reservas/nova", "bookings.manage"],
  ["/admin/reservas", "bookings.view"],
  ["/admin/ocupacao", "pms.view"],
  ["/admin/chegadas", "pms.view"],
  ["/admin/disponibilidade", "availability.manage"],
  ["/admin/planos", "rates.manage"],
  ["/admin/tarifas", "rates.manage"],
  ["/admin/pagamentos", "payments.manage"],
  ["/admin/faturas", "invoices.manage"],
  ["/admin/siba", "guests.manage"],
  ["/admin/mensagens", "messages.manage"],
  ["/admin/newsletter", "messages.manage"],
  ["/admin/acomodacoes", "pms.view"],
  ["/admin/tarefas", "housekeeping.manage"],
  ["/admin/avarias", "maintenance.manage"],
  ["/admin/inspecoes", "housekeeping.manage"],
  ["/admin/insumos", "inventory.manage"],
  ["/admin/fornecedores", "inventory.manage"],
  ["/admin/refeicoes", "content.manage"],
  ["/admin/equipa", "staff.manage"],
  ["/admin/relatorios", "reports.view"],
  ["/admin/quartos", "content.manage"],
  ["/admin/promocoes", "content.manage"],
  ["/admin/servicos", "content.manage"],
  ["/admin/blog", "content.manage"],
  ["/admin/testemunhos", "content.manage"],
  ["/admin/galeria", "content.manage"],
  ["/admin/pontos", "content.manage"],
  ["/admin/media", "content.manage"],
  ["/admin/integracoes", "integrations.manage"],
  ["/admin/ligacoes", "integrations.manage"],
  ["/admin/seo", "settings.manage"],
  ["/admin/definicoes", "settings.manage"],
  ["/admin/utilizadores", "users.manage"],
  ["/admin/auditoria", "audit.view"],
  ["/admin/sistema", "settings.manage"],
  ["/admin/conta", "dashboard"],
  ["/admin", "dashboard"],
];

export function permissionForPath(pathname: string): Permission | null {
  let best: [string, Permission] | null = null;
  for (const entry of ROUTE_PERMISSIONS) {
    const [prefix] = entry;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best[0].length) best = entry;
    }
  }
  return best ? best[1] : null;
}
