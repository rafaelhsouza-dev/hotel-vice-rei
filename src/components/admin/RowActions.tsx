import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "./SubmitButton";
import { togglePublished, deleteRow, moveRow } from "@/app/(admin)/admin/actions";

/**
 * Publish / reorder / delete controls shared by every content list.
 * Plain forms posting to server actions — works without client JS.
 */
export function RowActions({
  table,
  id,
  ids,
  published,
  editHref,
  publishedLabel = "Publicado",
}: {
  table: string;
  id: string;
  ids: string[];
  published: boolean;
  editHref?: string;
  publishedLabel?: string;
}) {
  const index = ids.indexOf(id);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <form action={moveRow}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="ids" value={ids.join(",")} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          disabled={index <= 0}
          title="Mover para cima"
          aria-label="Mover para cima"
          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)] disabled:opacity-30"
        >
          <Icon name="chevron-down" width={13} height={13} className="rotate-180" />
        </button>
      </form>

      <form action={moveRow}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="ids" value={ids.join(",")} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          disabled={index < 0 || index >= ids.length - 1}
          title="Mover para baixo"
          aria-label="Mover para baixo"
          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)] disabled:opacity-30"
        >
          <Icon name="chevron-down" width={13} height={13} />
        </button>
      </form>

      <form action={togglePublished}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="next" value={published ? "false" : "true"} />
        <SubmitButton
          variant="icon"
          icon={published ? "eye" : "eyeOff"}
          title={published ? `${publishedLabel} — clique para ocultar` : "Oculto — clique para publicar"}
        />
      </form>

      {editHref && (
        <Link
          href={editHref}
          title="Editar"
          aria-label="Editar"
          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
        >
          <Icon name="edit" width={15} height={15} />
        </Link>
      )}

      <form action={deleteRow}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <SubmitButton
          variant="icon"
          icon="trash"
          title="Eliminar"
          confirm="Eliminar definitivamente? Esta ação não pode ser anulada."
        />
      </form>
    </div>
  );
}
