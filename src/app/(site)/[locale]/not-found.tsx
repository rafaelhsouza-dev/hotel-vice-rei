import Image from "next/image";
import Link from "next/link";

/**
 * Rendered inside the locale segment, but `notFound()` can fire before the
 * locale is known — so this page stays in Portuguese with a neutral link home.
 */
export default function NotFound() {
  return (
    <div className="container-x grid flex-1 place-items-center py-32">
      <div className="max-w-md text-center">
        <Image
          src="/logo-hotel-vice-rei.webp"
          alt="Hotel Vice-Rei"
          width={2016}
          height={512}
          sizes="240px"
          className="mx-auto mb-10 h-9 w-auto sm:h-11"
          priority
        />
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-ink-muted)]">
          404
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          A página que procura não existe ou foi movida.
        </p>
        <Link
          href="/pt"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
        >
          Voltar à página inicial
        </Link>
      </div>
    </div>
  );
}
