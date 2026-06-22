import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-x flex-1 grid place-items-center py-32">
      <div className="text-center max-w-md">
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
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
        >
          Voltar à página inicial
        </Link>
      </div>
    </main>
  );
}
