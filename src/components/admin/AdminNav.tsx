"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
};

export type NavGroup = { title: string; items: NavItem[] };

export function AdminNav({
  groups,
  user,
  logout,
}: {
  groups: NavGroup[];
  user: { name: string; email: string };
  logout: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
            {group.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[var(--color-ink)] text-white"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
                    }`}
                  >
                    <Icon name={item.icon} width={16} height={16} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-[var(--color-accent)]/15 text-[var(--color-accent-deep)]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-white px-4 py-3 lg:hidden">
        <span className="font-display text-lg tracking-tight">Backoffice</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu de navegação"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line)]"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>

      {open && (
        <div className="border-b border-[var(--color-line)] bg-white p-4 lg:hidden">
          {nav}
          <form action={logout} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
            >
              Terminar sessão
            </button>
          </form>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--color-line)] bg-white lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-line)] px-5 py-5">
          <p className="font-display text-xl tracking-tight">Vice-Rei</p>
          <p className="text-xs text-[var(--color-ink-muted)]">Backoffice</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
        <div className="border-t border-[var(--color-line)] px-5 py-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-[var(--color-ink-muted)]">{user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-3 w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-xs text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
            >
              Terminar sessão
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
