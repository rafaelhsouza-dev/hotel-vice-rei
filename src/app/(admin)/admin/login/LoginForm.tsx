"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:opacity-60"
    >
      {pending ? "A entrar…" : "Entrar"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  const field =
    "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:border-[var(--color-accent-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15";
  const label =
    "mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]";

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-4">
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="password">
            Palavra-passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={field}
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
