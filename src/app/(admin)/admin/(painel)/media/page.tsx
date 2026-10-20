import { requirePagePermission } from "@/lib/auth/session";
import Image from "next/image";
import { listMedia } from "@/lib/repo/ops";
import { uploadsDir, uploadsWritable } from "@/lib/uploads";
import { removeMedia } from "./actions";
import { AdminHeader, Section, Card, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { UploadForm } from "./UploadForm";
import { CopyPath } from "./CopyPath";

export const dynamic = "force-dynamic";

const kb = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

export default async function MediaAdminPage() {
  await requirePagePermission("/admin/media");
  const items = await listMedia().catch(() => []);
  const writable = await uploadsWritable();

  return (
    <>
      <AdminHeader
        title="Ficheiros"
        subtitle="Imagens carregadas para o volume persistente do servidor."
      />
      <Section>
        {!writable && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            A pasta de uploads (<code>{uploadsDir()}</code>) não está acessível para
            escrita. Verifique o volume montado no servidor.
          </div>
        )}

        <Card className="p-6">
          <h2 className="font-display text-lg tracking-tight">Carregar</h2>
          <div className="mt-4">
            <UploadForm />
          </div>
        </Card>

        <div className="mt-6">
          {items.length === 0 ? (
            <EmptyState message="Ainda não há ficheiros carregados." />
          ) : (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <li key={m.id}>
                  <Card className="overflow-hidden">
                    <div className="relative aspect-[4/3] bg-[var(--color-line-soft)]">
                      <Image
                        src={m.path}
                        alt={m.alt || m.filename}
                        fill
                        sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 45vw"
                        className="object-cover"
                        unoptimized={m.mime === "image/svg+xml"}
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs font-medium" title={m.filename}>
                        {m.filename}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                        {kb(m.size)}
                        {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <CopyPath path={m.path} />
                        <form action={removeMedia}>
                          <input type="hidden" name="id" value={m.id} />
                          <SubmitButton
                            variant="icon"
                            icon="trash"
                            title="Eliminar ficheiro"
                            confirm={`Eliminar ${m.filename}? Páginas que o usem ficarão sem imagem.`}
                          />
                        </form>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </>
  );
}
