import type { Dictionary } from "@/i18n";

/**
 * Answers the questions guests actually ask, and emits FAQPage structured data
 * for the same content — which is what search and answer engines quote.
 */
export function Faq({ dict }: { dict: Dictionary }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="bg-[var(--color-line-soft)]">
      <div className="container-x py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">{dict.faq.eyebrow}</span>
          <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            {dict.faq.title}
          </h2>

          <dl className="mt-10 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
            {dict.faq.items.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-display text-lg tracking-tight sm:text-xl">
                  {item.q}
                </dt>
                <dd className="mt-2 leading-relaxed text-[var(--color-ink-soft)]">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
