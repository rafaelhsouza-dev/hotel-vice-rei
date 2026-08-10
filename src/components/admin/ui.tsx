import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

/** Shared server-rendered building blocks for the backoffice. */

export const fieldClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-accent-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15";

export const labelClass =
  "mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]";

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string; icon?: IconName };
}) {
  return (
    <div className="border-b border-[var(--color-line)] bg-white px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
          >
            <Icon name={action.icon ?? "plus"} width={15} height={15} />
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-6 sm:px-8 ${className}`}>{children}</div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-line)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-6 py-14 text-center text-sm text-[var(--color-ink-muted)]">
      {message}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-[var(--color-line-soft)] text-[var(--color-ink-soft)]",
    success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
    warning: "bg-[var(--color-accent)]/15 text-[var(--color-accent-deep)]",
    danger: "bg-red-50 text-red-700",
  } as const;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Scrollable wrapper so wide tables never push the page sideways. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="scroll-bar-thin overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white">
      {children}
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-ink-muted)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
