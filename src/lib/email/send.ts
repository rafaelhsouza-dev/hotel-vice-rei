import nodemailer from "nodemailer";
import { query } from "../db";
import { getIntegrationSafe } from "../repo/integrations";

/**
 * Outgoing e-mail over the hotel's own SMTP account (or any transactional
 * provider that speaks SMTP: Brevo, Mailgun, Amazon SES, Google Workspace…).
 *
 * Configured in Integrações → E-mail. When it is not configured, sending is a
 * logged no-op: the booking still succeeds, and the e-mail log shows the
 * guest was not notified so the desk can follow up.
 */

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** Internal copy of every booking notification (reception inbox). */
  notifyEmail: string;
};

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const record = await getIntegrationSafe("email");
  if (!record.enabled) return null;
  const c = record.credentials;
  const s = record.settings as Record<string, unknown>;
  const host = String(s.host ?? "").trim();
  const fromEmail = String(s.fromEmail ?? "").trim();
  if (!host || !fromEmail) return null;
  return {
    host,
    port: Number(s.port ?? 587) || 587,
    secure: s.secure === true || Number(s.port) === 465,
    user: String(s.user ?? "").trim(),
    pass: c.password ?? "",
    fromName: String(s.fromName ?? "Hotel Vice-Rei").trim(),
    fromEmail,
    replyTo: String(s.replyTo ?? "").trim(),
    notifyEmail: String(s.notifyEmail ?? "").trim(),
  };
}

function transport(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  bookingId?: string | null;
  /** Also send a copy to the reception notification address. */
  copyReception?: boolean;
};

export async function sendEmail(email: OutgoingEmail): Promise<{ ok: boolean; message: string }> {
  const settings = await getSmtpSettings();
  const log = (status: "sent" | "failed" | "skipped", message: string) =>
    query(
      `INSERT INTO email_log (booking_id, template, to_email, subject, status, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [email.bookingId ?? null, email.template, email.to, email.subject.slice(0, 300), status, message.slice(0, 500)],
    ).catch(() => {});

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.to)) {
    await log("skipped", "Endereço inválido.");
    return { ok: false, message: "Endereço inválido." };
  }
  if (!settings) {
    await log("skipped", "E-mail não configurado.");
    return { ok: false, message: "E-mail não configurado." };
  }

  try {
    const info = await transport(settings).sendMail({
      from: { name: settings.fromName, address: settings.fromEmail },
      to: email.to,
      bcc: email.copyReception && settings.notifyEmail ? settings.notifyEmail : undefined,
      replyTo: settings.replyTo || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    await log("sent", String(info.messageId ?? ""));
    return { ok: true, message: "Enviado." };
  } catch (err) {
    const message = (err as Error).message;
    await log("failed", message);
    console.error("[email] send failed:", message);
    return { ok: false, message };
  }
}

/** Opens a connection and authenticates, without sending anything. */
export async function verifySmtp(): Promise<string> {
  const settings = await getSmtpSettings();
  if (!settings) throw new Error("Preencha o servidor e o remetente, ative e grave antes de testar.");
  await transport(settings).verify();
  return `Servidor ${settings.host}:${settings.port} aceitou a ligação${settings.user ? " e a autenticação" : ""}.`;
}

export type EmailLogEntry = {
  id: string;
  bookingId: string | null;
  template: string;
  to: string;
  subject: string;
  status: string;
  message: string;
  createdAt: string;
};

export async function listEmailLog(opts: { bookingId?: string; limit?: number } = {}): Promise<EmailLogEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_log WHERE ($1::uuid IS NULL OR booking_id = $1::uuid)
     ORDER BY created_at DESC LIMIT $2`,
    [opts.bookingId ?? null, Math.min(500, opts.limit ?? 100)],
  );
  return rows.map((r) => ({
    id: String(r.id),
    bookingId: (r.booking_id as string) ?? null,
    template: String(r.template),
    to: String(r.to_email),
    subject: String(r.subject ?? ""),
    status: String(r.status),
    message: String(r.message ?? ""),
    createdAt: (r.created_at as Date).toISOString(),
  }));
}
