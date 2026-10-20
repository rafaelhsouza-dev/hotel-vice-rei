/**
 * Transactional e-mails in the four site languages.
 *
 * Plain, table-based HTML that renders in Outlook and Gmail alike, always
 * with a text alternative. Every value interpolated into HTML goes through
 * `esc` — guest names and notes are user input.
 */

export type Lang = "pt" | "en" | "es" | "fr";

export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n: number, lang: Lang) =>
  new Intl.NumberFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[lang], {
    style: "currency",
    currency: "EUR",
  }).format(n);

const date = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[lang], {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const T = {
  pt: {
    hello: "Olá",
    reference: "Referência",
    arrival: "Chegada",
    departure: "Partida",
    room: "Quarto",
    plan: "Tarifa",
    guests: "Hóspedes",
    total: "Total da estadia",
    tax: "Taxa municipal turística (paga no hotel)",
    paid: "Já pago",
    manage: "Ver a minha reserva",
    checkinCta: "Fazer o check-in online",
    from: "a partir das",
    until: "até às",
    policy: "Condições",
    freeCancel: (d: string) => `Cancelamento gratuito até ${d}.`,
    nonRefundable: "Tarifa não reembolsável.",
    payHotel: "Pagamento no hotel.",
    contact: "Precisa de ajuda? Responda a este e-mail ou ligue",
    confirmedSubject: (r: string) => `Reserva confirmada · ${r}`,
    confirmedIntro: "A sua reserva no Hotel Vice-Rei está confirmada. Até breve no Porto!",
    pendingSubject: (r: string) => `Reserva recebida · ${r}`,
    pendingIntro: "Recebemos a sua reserva. Fica confirmada assim que o pagamento for recebido.",
    mbTitle: "Pagamento por Multibanco",
    mbEntity: "Entidade",
    mbRef: "Referência",
    mbAmount: "Valor",
    mbExpires: "Válida até",
    payLink: "Pagar agora",
    paidSubject: (r: string) => `Pagamento recebido · ${r}`,
    paidIntro: "Recebemos o seu pagamento. Obrigado!",
    cancelSubject: (r: string) => `Reserva cancelada · ${r}`,
    cancelIntro: "A sua reserva foi cancelada.",
    cancelFee: "Penalização de cancelamento",
    cancelExpired: "O prazo de pagamento terminou e o quarto foi libertado. Se ainda quiser ficar connosco, faça uma nova reserva.",
    reminderSubject: (r: string) => `A sua estadia aproxima-se · ${r}`,
    reminderIntro: "Faltam poucos dias para a sua chegada. Poupe tempo à chegada fazendo o check-in online.",
    checkinDoneSubject: (r: string) => `Check-in online concluído · ${r}`,
    checkinDoneIntro: "Obrigado, recebemos os dados dos hóspedes. Na chegada só precisa de levantar a chave.",
    footer: "Hotel Vice-Rei · Rua Júlio Dinis, 779 · 4050-326 Porto · Portugal",
  },
  en: {
    hello: "Hello",
    reference: "Reference",
    arrival: "Arrival",
    departure: "Departure",
    room: "Room",
    plan: "Rate",
    guests: "Guests",
    total: "Stay total",
    tax: "Municipal tourist tax (paid at the hotel)",
    paid: "Paid",
    manage: "View my booking",
    checkinCta: "Check in online",
    from: "from",
    until: "until",
    policy: "Conditions",
    freeCancel: (d: string) => `Free cancellation until ${d}.`,
    nonRefundable: "Non-refundable rate.",
    payHotel: "Payment at the hotel.",
    contact: "Need help? Reply to this e-mail or call",
    confirmedSubject: (r: string) => `Booking confirmed · ${r}`,
    confirmedIntro: "Your booking at Hotel Vice-Rei is confirmed. See you soon in Porto!",
    pendingSubject: (r: string) => `Booking received · ${r}`,
    pendingIntro: "We have received your booking. It will be confirmed as soon as the payment arrives.",
    mbTitle: "Multibanco payment",
    mbEntity: "Entity",
    mbRef: "Reference",
    mbAmount: "Amount",
    mbExpires: "Valid until",
    payLink: "Pay now",
    paidSubject: (r: string) => `Payment received · ${r}`,
    paidIntro: "We have received your payment. Thank you!",
    cancelSubject: (r: string) => `Booking cancelled · ${r}`,
    cancelIntro: "Your booking has been cancelled.",
    cancelFee: "Cancellation fee",
    cancelExpired: "The payment deadline passed and the room was released. If you would still like to stay with us, please make a new booking.",
    reminderSubject: (r: string) => `Your stay is coming up · ${r}`,
    reminderIntro: "Your arrival is only a few days away. Save time at the desk by checking in online.",
    checkinDoneSubject: (r: string) => `Online check-in completed · ${r}`,
    checkinDoneIntro: "Thank you, we have received your guests' details. On arrival you only need to collect your key.",
    footer: "Hotel Vice-Rei · Rua Júlio Dinis, 779 · 4050-326 Porto · Portugal",
  },
  es: {
    hello: "Hola",
    reference: "Referencia",
    arrival: "Llegada",
    departure: "Salida",
    room: "Habitación",
    plan: "Tarifa",
    guests: "Huéspedes",
    total: "Total de la estancia",
    tax: "Tasa turística municipal (se paga en el hotel)",
    paid: "Pagado",
    manage: "Ver mi reserva",
    checkinCta: "Hacer el check-in online",
    from: "desde las",
    until: "hasta las",
    policy: "Condiciones",
    freeCancel: (d: string) => `Cancelación gratuita hasta el ${d}.`,
    nonRefundable: "Tarifa no reembolsable.",
    payHotel: "Pago en el hotel.",
    contact: "¿Necesita ayuda? Responda a este correo o llame al",
    confirmedSubject: (r: string) => `Reserva confirmada · ${r}`,
    confirmedIntro: "Su reserva en el Hotel Vice-Rei está confirmada. ¡Hasta pronto en Oporto!",
    pendingSubject: (r: string) => `Reserva recibida · ${r}`,
    pendingIntro: "Hemos recibido su reserva. Quedará confirmada en cuanto recibamos el pago.",
    mbTitle: "Pago por Multibanco",
    mbEntity: "Entidad",
    mbRef: "Referencia",
    mbAmount: "Importe",
    mbExpires: "Válida hasta",
    payLink: "Pagar ahora",
    paidSubject: (r: string) => `Pago recibido · ${r}`,
    paidIntro: "Hemos recibido su pago. ¡Gracias!",
    cancelSubject: (r: string) => `Reserva cancelada · ${r}`,
    cancelIntro: "Su reserva ha sido cancelada.",
    cancelFee: "Penalización por cancelación",
    cancelExpired: "El plazo de pago ha terminado y la habitación se ha liberado. Si aún desea alojarse con nosotros, haga una nueva reserva.",
    reminderSubject: (r: string) => `Su estancia se acerca · ${r}`,
    reminderIntro: "Faltan pocos días para su llegada. Ahorre tiempo haciendo el check-in online.",
    checkinDoneSubject: (r: string) => `Check-in online completado · ${r}`,
    checkinDoneIntro: "Gracias, hemos recibido los datos de los huéspedes. A la llegada solo tendrá que recoger la llave.",
    footer: "Hotel Vice-Rei · Rua Júlio Dinis, 779 · 4050-326 Oporto · Portugal",
  },
  fr: {
    hello: "Bonjour",
    reference: "Référence",
    arrival: "Arrivée",
    departure: "Départ",
    room: "Chambre",
    plan: "Tarif",
    guests: "Voyageurs",
    total: "Total du séjour",
    tax: "Taxe de séjour municipale (payée à l'hôtel)",
    paid: "Déjà payé",
    manage: "Voir ma réservation",
    checkinCta: "Faire l'enregistrement en ligne",
    from: "à partir de",
    until: "jusqu'à",
    policy: "Conditions",
    freeCancel: (d: string) => `Annulation gratuite jusqu'au ${d}.`,
    nonRefundable: "Tarif non remboursable.",
    payHotel: "Paiement à l'hôtel.",
    contact: "Besoin d'aide ? Répondez à cet e-mail ou appelez le",
    confirmedSubject: (r: string) => `Réservation confirmée · ${r}`,
    confirmedIntro: "Votre réservation à l'Hotel Vice-Rei est confirmée. À bientôt à Porto !",
    pendingSubject: (r: string) => `Réservation reçue · ${r}`,
    pendingIntro: "Nous avons reçu votre réservation. Elle sera confirmée dès réception du paiement.",
    mbTitle: "Paiement Multibanco",
    mbEntity: "Entité",
    mbRef: "Référence",
    mbAmount: "Montant",
    mbExpires: "Valable jusqu'au",
    payLink: "Payer maintenant",
    paidSubject: (r: string) => `Paiement reçu · ${r}`,
    paidIntro: "Nous avons bien reçu votre paiement. Merci !",
    cancelSubject: (r: string) => `Réservation annulée · ${r}`,
    cancelIntro: "Votre réservation a été annulée.",
    cancelFee: "Frais d'annulation",
    cancelExpired: "Le délai de paiement est écoulé et la chambre a été libérée. Si vous souhaitez toujours séjourner chez nous, merci d'effectuer une nouvelle réservation.",
    reminderSubject: (r: string) => `Votre séjour approche · ${r}`,
    reminderIntro: "Votre arrivée approche. Gagnez du temps en faisant l'enregistrement en ligne.",
    checkinDoneSubject: (r: string) => `Enregistrement en ligne terminé · ${r}`,
    checkinDoneIntro: "Merci, nous avons bien reçu les informations des voyageurs. À votre arrivée, il vous suffira de récupérer votre clé.",
    footer: "Hotel Vice-Rei · Rua Júlio Dinis, 779 · 4050-326 Porto · Portugal",
  },
} satisfies Record<Lang, Record<string, unknown>>;

export function strings(lang: string) {
  return T[(["pt", "en", "es", "fr"].includes(lang) ? lang : "pt") as Lang];
}

export type StaySummary = {
  lang: Lang;
  firstName: string;
  reference: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomName: string;
  planName: string;
  adults: number;
  children: number;
  total: number;
  touristTax: number;
  paid: number;
  refundable: boolean;
  /** Hotel-local date from which the penalty applies, or null. */
  penaltyFrom: string | null;
  payAtHotel: boolean;
  manageUrl: string;
  checkInFrom: string;
  checkInUntil: string;
  checkOutUntil: string;
  phone: string;
};

export type Block = { html: string; text: string };

function layout(title: string, intro: string, blocks: Block[], cta: { label: string; url: string } | null, s: StaySummary): Block {
  const t = strings(s.lang);
  const html = `<!doctype html><html lang="${s.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f5f1ea;font-family:Georgia,'Times New Roman',serif;color:#1c1916">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 28px 8px;font-size:22px;letter-spacing:.02em">Hotel Vice-Rei</td></tr>
<tr><td style="padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">
<p style="margin:16px 0 8px">${esc(t.hello)} ${esc(s.firstName)},</p>
<p style="margin:0 0 16px">${esc(intro)}</p>
${blocks.map((b) => b.html).join("\n")}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#1c1916;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${esc(cta.label)}</a></p>` : ""}
<p style="margin:24px 0 8px;color:#6b635a;font-size:13px">${esc(t.contact)} ${esc(s.phone)}.</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8178;border-top:1px solid #eee5d8">${esc(t.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `${t.hello} ${s.firstName},`,
    "",
    intro,
    "",
    ...blocks.map((b) => b.text),
    cta ? `\n${cta.label}: ${cta.url}` : "",
    "",
    `${t.contact} ${s.phone}.`,
    t.footer,
  ].join("\n");
  return { html, text };
}

export function stayBlock(s: StaySummary): Block {
  const t = strings(s.lang);
  const rows: [string, string][] = [
    [t.reference, s.reference],
    [t.arrival, `${date(s.checkIn, s.lang)} · ${t.from} ${s.checkInFrom}`],
    [t.departure, `${date(s.checkOut, s.lang)} · ${t.until} ${s.checkOutUntil}`],
    [t.room, s.roomName],
    [t.plan, s.planName],
    [t.guests, `${s.adults}${s.children ? ` + ${s.children}` : ""}`],
    [t.total, money(s.total, s.lang)],
  ];
  if (s.touristTax > 0) rows.push([t.tax, money(s.touristTax, s.lang)]);
  if (s.paid > 0) rows.push([t.paid, money(s.paid, s.lang)]);
  const policy = [
    s.refundable && s.penaltyFrom
      ? s.penaltyFrom > new Date().toISOString().slice(0, 10)
        ? t.freeCancel(date(addDay(s.penaltyFrom, -1), s.lang))
        : ""
      : !s.refundable
        ? t.nonRefundable
        : "",
    s.payAtHotel ? t.payHotel : "",
  ]
    .filter(Boolean)
    .join(" ");
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5d8;border-radius:12px;font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 12px;color:#6b635a;border-bottom:1px solid #f3ece1">${esc(k)}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f3ece1"><strong>${esc(v)}</strong></td></tr>`,
  )
  .join("\n")}
</table>${policy ? `<p style="margin:12px 0 0;font-size:13px;color:#6b635a"><strong>${esc(t.policy)}:</strong> ${esc(policy)}</p>` : ""}`;
  const text = [...rows.map(([k, v]) => `${k}: ${v}`), policy ? `${t.policy}: ${policy}` : ""].join("\n");
  return { html, text };
}

function addDay(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function multibancoBlock(lang: Lang, mb: { entity: string; reference: string; amount: number; expiresAt: string | null }): Block {
  const t = strings(lang);
  const ref = mb.reference.replace(/(\d{3})(?=\d)/g, "$1 ");
  const rows: [string, string][] = [
    [t.mbEntity, mb.entity],
    [t.mbRef, ref],
    [t.mbAmount, money(mb.amount, lang)],
  ];
  if (mb.expiresAt) rows.push([t.mbExpires, new Date(mb.expiresAt).toLocaleString({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[lang], { timeZone: "Europe/Lisbon" })]);
  const html = `<h3 style="font-size:16px;margin:20px 0 8px">${esc(t.mbTitle)}</h3><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b635a">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>`;
  return { html, text: [`${t.mbTitle}`, ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n") };
}

export function bookingEmail(
  kind: "confirmed" | "pending" | "paid" | "cancelled" | "expired" | "reminder" | "checkin_done",
  s: StaySummary,
  extra: { blocks?: Block[]; payUrl?: string; checkinUrl?: string; cancelFee?: number } = {},
): { subject: string; html: string; text: string } {
  const t = strings(s.lang);
  const blocks = [...(extra.blocks ?? [])];
  let subject: string;
  let intro: string;
  let cta: { label: string; url: string } | null = { label: t.manage, url: s.manageUrl };

  switch (kind) {
    case "confirmed":
      subject = t.confirmedSubject(s.reference);
      intro = t.confirmedIntro;
      blocks.unshift(stayBlock(s));
      break;
    case "pending":
      subject = t.pendingSubject(s.reference);
      intro = t.pendingIntro;
      blocks.push(stayBlock(s));
      if (extra.payUrl) cta = { label: t.payLink, url: extra.payUrl };
      break;
    case "paid":
      subject = t.paidSubject(s.reference);
      intro = t.paidIntro;
      blocks.unshift(stayBlock(s));
      break;
    case "cancelled":
    case "expired":
      subject = t.cancelSubject(s.reference);
      intro = kind === "expired" ? t.cancelExpired : t.cancelIntro;
      if (extra.cancelFee && extra.cancelFee > 0) {
        blocks.push({
          html: `<p style="margin:12px 0"><strong>${esc(t.cancelFee)}:</strong> ${esc(money(extra.cancelFee, s.lang))}</p>`,
          text: `${t.cancelFee}: ${money(extra.cancelFee, s.lang)}`,
        });
      }
      blocks.unshift({
        html: `<p style="margin:0 0 12px">${esc(t.reference)}: <strong>${esc(s.reference)}</strong></p>`,
        text: `${t.reference}: ${s.reference}`,
      });
      cta = null;
      break;
    case "reminder":
      subject = t.reminderSubject(s.reference);
      intro = t.reminderIntro;
      blocks.unshift(stayBlock(s));
      cta = extra.checkinUrl ? { label: t.checkinCta, url: extra.checkinUrl } : cta;
      break;
    case "checkin_done":
      subject = t.checkinDoneSubject(s.reference);
      intro = t.checkinDoneIntro;
      blocks.unshift(stayBlock(s));
      break;
  }
  const { html, text } = layout(subject, intro, blocks, cta, s);
  return { subject, html, text };
}
