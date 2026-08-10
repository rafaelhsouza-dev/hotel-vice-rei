import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getSession()) redirect("/admin");

  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo-hotel-vice-rei.webp"
            alt="Hotel Vice-Rei"
            width={2016}
            height={512}
            sizes="200px"
            className="h-10 w-auto"
            priority
          />
        </div>
        <div className="rounded-3xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-2xl tracking-tight">Backoffice</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Aceda com as suas credenciais de gestão.
          </p>
          <LoginForm next={next && next.startsWith("/admin") ? next : "/admin"} />
        </div>
      </div>
    </main>
  );
}
