import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import type { Rating } from "@/lib/facts";
import { BCP47 } from "@/lib/seo";
import { Icon } from "../Icon";

/**
 * Real public scores (Tripadvisor, Booking.com, Google) as set in the admin.
 * A source without a score is not shown; each links to its profile if known.
 */
export function PublicRatings({
  ratings,
  dict,
  locale,
}: {
  ratings: Rating[];
  dict: Dictionary;
  locale: Locale;
}) {
  if (!ratings.length) return null;
  const num = new Intl.NumberFormat(BCP47[locale], { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const int = new Intl.NumberFormat(BCP47[locale]);

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
        {dict.reviews.publicRatings}
      </p>
      <ul className="flex flex-wrap gap-3">
        {ratings.map((r) => {
          const body = (
            <>
              <span className="font-display text-xl text-[var(--color-ink)]">
                {num.format(r.score)}
                <span className="text-sm text-[var(--color-ink-muted)]">/{r.scale}</span>
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">{r.name}</span>
                {r.count != null && (
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    {int.format(r.count)} {dict.reviews.reviewsWord}
                  </span>
                )}
              </span>
              {r.url && (
                <Icon name="arrow-right" width={12} height={12} className="text-[var(--color-accent-deep)]" />
              )}
            </>
          );
          const cls =
            "inline-flex min-h-11 items-center gap-3 rounded-2xl bg-white hairline px-4 py-3 shadow-[var(--shadow-card)]";
          return (
            <li key={r.id}>
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${dict.reviews.viewProfile} ${r.name}: ${num.format(r.score)}/${r.scale}${
                    r.count != null ? ` (${int.format(r.count)} ${dict.reviews.reviewsWord})` : ""
                  }`}
                  className={`${cls} transition-shadow hover:shadow-[var(--shadow-floating)]`}
                >
                  {body}
                </a>
              ) : (
                <span className={cls}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
