import { listMessages } from "@/lib/repo/ops";
import { setMessageRead, removeMessage } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, EmptyState, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" });

export default async function MessagesAdminPage() {
  let messages: Awaited<ReturnType<typeof listMessages>> = [];
  let dbDown = false;
  try {
    messages = await listMessages();
  } catch {
    dbDown = true;
  }

  const unread = messages.filter((m) => !m.read).length;

  return (
    <>
      <AdminHeader
        title="Mensagens"
        subtitle={
          dbDown
            ? "Base de dados indisponível."
            : `${messages.length} mensagem${messages.length === 1 ? "" : "s"} · ${unread} por ler.`
        }
      />
      <Section>
        {messages.length === 0 ? (
          <EmptyState message="Ainda não há mensagens do formulário de contacto." />
        ) : (
          <ul className="grid gap-4">
            {messages.map((m) => (
              <li key={m.id}>
                <Card className={`p-5 ${m.read ? "" : "border-[var(--color-accent)]/40"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{m.name || "Sem nome"}</p>
                        {!m.read && <Badge tone="warning">Nova</Badge>}
                        <Badge>{m.locale.toUpperCase()}</Badge>
                      </div>
                      <a
                        href={`mailto:${m.email}?subject=${encodeURIComponent(
                          `Re: ${m.subject || "Contacto"}`,
                        )}`}
                        className="text-sm text-[var(--color-accent-deep)] hover:underline"
                      >
                        {m.email}
                      </a>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                        {fmt.format(new Date(m.createdAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={setMessageRead}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="next" value={m.read ? "false" : "true"} />
                        <SubmitButton
                          variant="ghost"
                          icon={m.read ? "eyeOff" : "check"}
                        >
                          {m.read ? "Marcar por ler" : "Marcar como lida"}
                        </SubmitButton>
                      </form>
                      <form action={removeMessage}>
                        <input type="hidden" name="id" value={m.id} />
                        <SubmitButton
                          variant="icon"
                          icon="trash"
                          title="Eliminar mensagem"
                          confirm="Eliminar esta mensagem?"
                        />
                      </form>
                    </div>
                  </div>

                  {m.subject && (
                    <p className="mt-4 font-display text-lg tracking-tight">{m.subject}</p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {m.message}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
