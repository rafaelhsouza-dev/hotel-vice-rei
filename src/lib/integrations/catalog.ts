import { PAYMENT_PROVIDERS } from "../payments/providers";
import { INVOICE_PROVIDERS } from "../invoicing/providers";

/**
 * Everything the hotel connects from Ligações e acessos, described once so
 * the page, the save action and the test button agree on which fields exist
 * and which are secret.
 */

export type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  secret?: boolean;
  required?: boolean;
  /** Stored in `settings` (plain) instead of `credentials` (encrypted). */
  setting?: boolean;
  type?: "text" | "email" | "number" | "checkbox" | "select" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type IntegrationDef = {
  id: string;
  group: "Pagamentos" | "E-mail" | "Faturação" | "Autoridades";
  name: string;
  summary: string;
  docsUrl: string;
  fields: FieldDef[];
  /** Steps shown to whoever sets it up, in order. */
  steps: string[];
  /** Absolute path of the callback the provider must call, if any. */
  callbackPath?: string;
  hasModes: boolean;
};

const stripe = PAYMENT_PROVIDERS.find((p) => p.id === "stripe")!;
const ifthenpay = PAYMENT_PROVIDERS.find((p) => p.id === "ifthenpay")!;

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "stripe",
    group: "Pagamentos",
    name: "Stripe",
    summary: "Cartões com 3-D Secure e, se ativados na conta, MB WAY e Multibanco. Pagamento em página segura alojada pela Stripe.",
    docsUrl: stripe.docsUrl,
    hasModes: true,
    callbackPath: "/api/payments/stripe",
    fields: [
      ...stripe.credentialFields,
      { key: "enableMbway", label: "Oferecer MB WAY pela Stripe", type: "checkbox", setting: true, hint: "Só se a ifthenpay não estiver ativa; tem de estar ligado também no Dashboard da Stripe." },
      { key: "enableMultibanco", label: "Oferecer Multibanco pela Stripe", type: "checkbox", setting: true, hint: "Idem. A confirmação pode demorar até 4 dias." },
    ],
    steps: [
      "Crie a conta em dashboard.stripe.com em nome do hotel e complete a verificação.",
      "Em Programadores → Chaves de API, crie uma chave restrita com escrita em «Checkout Sessions» e «Refunds» e leitura em «Balance».",
      "Em Programadores → Webhooks, adicione o endereço abaixo e escolha os eventos checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed e checkout.session.expired. Copie o «Signing secret» (whsec_…).",
      "Em Definições → Métodos de pagamento, ative Cartões (e MB WAY / Multibanco, se os quiser pela Stripe).",
      "Grave aqui em modo teste, carregue em «Testar ligação», faça uma reserva de teste e só depois passe a produção com as chaves live.",
    ],
  },
  {
    id: "ifthenpay",
    group: "Pagamentos",
    name: "ifthenpay",
    summary: "MB WAY e referências Multibanco com as comissões mais baixas em Portugal. Tem prioridade sobre a Stripe para estes métodos.",
    docsUrl: ifthenpay.docsUrl,
    hasModes: true,
    callbackPath: "/api/payments/ifthenpay",
    fields: ifthenpay.credentialFields,
    steps: [
      "Abra o contrato em ifthenpay.com e peça as chaves MB WAY e Multibanco (referências dinâmicas).",
      "Escolha uma chave anti-phishing (texto aleatório até 50 caracteres) e guarde-a aqui.",
      "Peça à ifthenpay a ativação do callback com o endereço abaixo, seguido de ?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&entity=[ENTITY]&reference=[REFERENCE]&payment_datetime=[PAYMENT_DATETIME].",
      "Em modo teste as referências Multibanco são geradas na sandbox; o MB WAY não tem sandbox — teste com um valor baixo.",
    ],
  },
  {
    id: "email",
    group: "E-mail",
    name: "Envio de e-mail (SMTP)",
    summary: "Confirmações, pagamentos, cancelamentos e lembretes com o link de check-in online, nas quatro línguas.",
    docsUrl: "https://nodemailer.com/smtp/",
    hasModes: false,
    fields: [
      { key: "host", label: "Servidor SMTP", setting: true, required: true, placeholder: "smtp.gmail.com / smtp-relay.brevo.com" },
      { key: "port", label: "Porta", setting: true, type: "number", placeholder: "587", hint: "587 (STARTTLS) ou 465 (SSL)." },
      { key: "secure", label: "Ligação SSL direta (porta 465)", setting: true, type: "checkbox" },
      { key: "user", label: "Utilizador", setting: true, placeholder: "reservas@hotelvicerei.com" },
      { key: "password", label: "Palavra-passe / chave SMTP", secret: true, hint: "No Google Workspace use uma «palavra-passe de app»." },
      { key: "fromName", label: "Nome do remetente", setting: true, placeholder: "Hotel Vice-Rei" },
      { key: "fromEmail", label: "E-mail do remetente", setting: true, type: "email", required: true, placeholder: "reservas@hotelvicerei.com" },
      { key: "replyTo", label: "Responder para", setting: true, type: "email", placeholder: "geral@hotelvicerei.com" },
      { key: "notifyEmail", label: "Cópia de cada reserva para", setting: true, type: "email", hint: "Caixa da receção que deve saber de cada reserva nova, pagamento ou cancelamento." },
    ],
    steps: [
      "Use a conta de e-mail do domínio do hotel (Google Workspace, Microsoft 365) ou um serviço transacional (Brevo, Mailgun, Amazon SES).",
      "Configure SPF, DKIM e DMARC no DNS do domínio — sem isto as confirmações caem no spam.",
      "Grave, ative e carregue em «Testar ligação»; depois envie um e-mail de teste para si.",
    ],
  },
  ...INVOICE_PROVIDERS.map<IntegrationDef>((p) => ({
    id: p.id,
    group: "Faturação",
    name: p.name,
    summary: "Emissão de faturas e faturas-recibo no programa certificado pela AT que o hotel usa. Ative apenas um.",
    docsUrl: p.docsUrl,
    hasModes: true,
    fields: [
      ...p.credentialFields,
      ...(p.id === "moloni"
        ? [
            {
              key: "products",
              label: "Artigos por taxa de IVA (JSON)",
              setting: true,
              type: "textarea" as const,
              placeholder: '{"6": 123, "13": 124, "23": 125, "0": 126}',
              hint: "IDs dos artigos genéricos criados no Moloni para cada taxa (0 = taxa turística).",
            },
          ]
        : []),
    ],
    steps: [
      "Confirme com o contabilista qual o programa e a série de documentos a usar.",
      "Obtenha as credenciais da API no próprio programa (ver ajuda de cada campo).",
      "Em modo teste os documentos ficam em rascunho ou na série de testes; só em produção recebem número.",
      "A taxa municipal turística é emitida como não sujeita a IVA (M99) — confirme com o contabilista.",
    ],
  })),
  {
    id: "siba",
    group: "Autoridades",
    name: "SIBA — boletins de alojamento",
    summary: "Comunicação obrigatória dos hóspedes estrangeiros ao Sistema de Segurança Interna, no prazo de 3 dias úteis.",
    docsUrl: "https://siba.ssi.gov.pt/ajuda/modos-de-envio/",
    hasModes: true,
    fields: [
      { key: "nipc", label: "NIPC do estabelecimento", required: true, hint: "9 dígitos." },
      { key: "establishment", label: "Número do estabelecimento", required: true, placeholder: "00", hint: "Atribuído pelo SIBA; «00» para o primeiro." },
      { key: "accessKey", label: "Chave de acesso", secret: true, required: true, hint: "Enviada pelo SIBA por ofício após a inscrição em modo webservice." },
      { key: "abbreviation", label: "Abreviatura do estabelecimento", setting: true, placeholder: "VICE-REI" },
      { key: "contactName", label: "Nome do contacto", setting: true, placeholder: "Receção" },
      { key: "autoSend", label: "Enviar automaticamente de hora a hora", type: "checkbox", setting: true, hint: "Os boletins dos hóspedes já chegados seguem sem intervenção. Os incompletos ficam na lista do SIBA." },
    ],
    steps: [
      "Inscreva o hotel em siba.ssi.gov.pt (Inscrição) escolhendo o modo «Webservice».",
      "A chave de acesso chega por ofício, normalmente até 48 horas depois.",
      "Grave em modo teste e faça um envio de teste; o ambiente de testes do SIBA não regista nada oficialmente.",
      "Passe a produção quando o teste for aceite.",
    ],
  },
];

export function getIntegrationDef(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}
