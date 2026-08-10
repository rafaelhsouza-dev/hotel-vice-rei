"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadMedia, type UploadState } from "./actions";
import { Icon } from "@/components/Icon";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:opacity-60"
    >
      <Icon name="upload" width={15} height={15} />
      {pending ? "A enviar…" : "Enviar ficheiros"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useActionState<UploadState, FormData>(uploadMedia, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label
          htmlFor="files"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]"
        >
          Imagens
        </label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
          className="block w-full cursor-pointer rounded-xl border border-dashed border-[var(--color-line)] bg-white px-4 py-6 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-line-soft)] file:px-4 file:py-2 file:text-sm file:text-[var(--color-ink)]"
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
          JPG, PNG, WebP, AVIF, GIF ou SVG. Máximo 8 MB por ficheiro.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {!state.error && state.uploaded ? (
        <p role="status" className="rounded-xl bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          {state.uploaded} ficheiro{state.uploaded === 1 ? "" : "s"} enviado
          {state.uploaded === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div>
        <Submit />
      </div>
    </form>
  );
}
