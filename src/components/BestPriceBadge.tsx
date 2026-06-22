import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

export function BestPriceBadge({
  dict,
  className,
}: {
  dict: Dictionary;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 shadow-[var(--shadow-card)] ${
        className ?? ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-ink)]">
        <Icon name="shield" width={16} height={16} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-medium text-[var(--color-ink)]">
          {dict.bestPrice.title}
        </span>
        <span className="block text-xs text-[var(--color-ink-muted)]">
          {dict.bestPrice.subtitle}
        </span>
      </span>
    </div>
  );
}
