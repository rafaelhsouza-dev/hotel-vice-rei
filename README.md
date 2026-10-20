# Hotel Vice-Rei · Porto

Site institucional, motor de reservas e PMS do Hotel Vice-Rei, geridos a partir
de um backoffice próprio.

- **Produção:** https://weboost-hotelvicerei.ejf97x.easypanel.host
- **Backoffice:** `/admin`
- **Stack:** Next.js 16 (App Router), React 19, Tailwind v4, PostgreSQL, GSAP

---

## Arquitetura

```
src/
  app/
    (site)/[locale]/     root layout público — <html lang> segue o locale
    (admin)/admin/       root layout do backoffice (noindex)
      login/             autenticação
      (painel)/          páginas protegidas
    actions/public.ts    server actions do site (contacto, newsletter)
    uploads/[...path]/   serve ficheiros do volume persistente
    llms.txt, manifest, sitemap, robots
  lib/
    db.ts                pool Postgres (tolerante a falhas)
    schema.ts            DDL completo
    migrate.ts           schema + seed idempotentes
    auth/                scrypt (Node) + JWT HS256 (Web Crypto, corre em Edge)
    repo/                content.ts (leitura, com cache) · admin.ts · ops.ts
    uploads.ts           escrita e validação de ficheiros
  data/                  dados de seed — a fonte inicial da base de dados
  i18n/                  dicionários pt/en/es/fr
  proxy.ts               redirect de locale + guarda do /admin
```

**Conteúdo traduzível** é guardado em colunas `jsonb` com as chaves `{pt,en,es,fr}`,
espelhando o `Record<Locale, T>` que os componentes já consumiam.

**As leituras públicas fazem fallback** para `src/data/*` quando a base de dados
não responde. É isso que permite ao `next build` pré-renderizar dentro do Docker,
onde o Postgres não é alcançável.

**O schema e o seed correm no arranque** (`src/instrumentation.ts`), de forma
idempotente — um deploy novo sobe já com conteúdo, sem passos manuais.

## O que o backoffice faz

| Área | Módulos |
|---|---|
| **Receção** | Hoje (chegadas, partidas, em casa) · Reservas (site, balcão, telefone, extranets) · ficha da reserva com conta do quarto, pagamentos, hóspedes/SIBA, faturas e e-mails · Mapa de ocupação quarto × dia com arrastar e largar · SIBA · Pagamentos · Faturas |
| **Vendas** | Disponibilidade e preços (alteração em massa, por dia da semana, estadia mín./máx., sem chegadas/partidas, fecho) · Planos de tarifa (regime, ajuste de preço, cancelamento, sinal ou pagamento total) · Extras e códigos · Relatórios (ocupação, ADR, RevPAR, por origem e tipologia, CSV) |
| **Hotel** | Quartos · Tarefas · Avarias e ordens de reparação (fotografia, custo, fornecedor, peças do stock) · Inspeções · Equipa · Insumos · Fornecedores · Refeições |
| **Configuração** | Ligações (Stripe, ifthenpay, SMTP, InvoiceXpress/Moloni/Vendus, SIBA) · Canais e extranets com contingente · SEO e monitorização · Regras de reserva · Utilizadores e funções · Auditoria · Estado do sistema |

**Regras que não se podem quebrar**

- Cada reserva é escrita com um *advisory lock* por tipologia e a disponibilidade
  é relida dentro da transação — dois pedidos simultâneos nunca vendem o último
  quarto duas vezes (`tests/booking.integration.test.ts` prova-o).
- A disponibilidade é derivada (unidades − reservas − importações − bloqueios −
  contingentes de extranet), nunca um contador.
- Alterar o preço de um período não mexe nas restrições, e vice-versa.
- O PMS não emite faturas: entrega as linhas ao programa certificado pela AT.
- As credenciais ficam cifradas (AES-256-GCM) e nunca voltam ao browser.
- Cada página e ação do admin verifica a função do utilizador na base de dados;
  mudar a função ou a palavra-passe termina as sessões abertas.

---

## Desenvolvimento

```bash
npm install

# Postgres descartável para desenvolvimento
docker run -d --name vicerei-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=vicereidb -e POSTGRES_USER=postgres \
  -p 5440:5432 postgres:16-alpine

npm run dev
npm test          # unitários + integração (usa o Postgres do .env.local)
npm run typecheck
```

Crie um `.env.local` (ignorado pelo git):

```env
DATABASE_URL=postgres://postgres:devpass@localhost:5440/vicereidb
DATA_SOURCE=postgres
JWT_SECRET=<pelo menos 32 caracteres>
ADMIN_EMAIL=admin@hotelvicerei.com
ADMIN_PASSWORD=<a sua palavra-passe>
ADMIN_NAME=Administrador
NEXT_PUBLIC_SITE_URL=http://localhost:3000
UPLOADS_DIR=./.uploads
```

O utilizador de administração é criado no primeiro arranque a partir das
variáveis `ADMIN_*`, e só se ainda não existir nenhum.

Sem `DATABASE_URL` o site continua a funcionar: serve os dados de seed.

---

## Variáveis de ambiente

| Variável | Papel |
|---|---|
| `POSTGRES_HOST` / `_DB` / `_USER` / `_PASS` / `_PORT` | Ligação à base de dados (ou use `DATABASE_URL`) |
| `DATA_SOURCE` | `postgres`; qualquer outro valor força os dados de seed |
| `JWT_SECRET` | Assina a sessão do backoffice. Mínimo 32 caracteres |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Primeiro utilizador do backoffice |
| `NEXT_PUBLIC_SITE_URL` | Origem canónica (metadata, sitemap, JSON-LD) |
| `UPLOADS_DIR` | Pasta dos ficheiros carregados; em produção é o volume |
| `CREDENTIALS_KEY` | **Recomendada.** Chave própria (32+ caracteres) para cifrar as credenciais guardadas no admin. Ao defini-la, as existentes são cifradas de novo no arranque |
| `SYNC_SECRET` | Autoriza `POST /api/cron` e `POST /api/channels/sync`. Mínimo 16 caracteres; sem ela respondem 401 |
| `DISABLE_JOBS` | `1` desliga as tarefas automáticas no processo (use então `/api/cron`) |

`NEXT_PUBLIC_*` são inlined no bundle durante o build, por isso têm de existir
como *build args* — o EasyPanel encaminha todas as variáveis automaticamente.

---

## Integrações com plataformas

O módulo em **/admin/integracoes** é agnóstico ao canal: um adaptador por
plataforma, um motor de sincronização comum e um registo auditável.

| Canal | Situação | O que faz |
|---|---|---|
| **iCal** (Airbnb, Vrbo, Google) | Ligar já, sem contrato | Importa datas ocupadas; exporta o nosso calendário |
| **Beds24** | Ligar já, com conta Beds24 | API REST v2: reservas, disponibilidade, preços e restrições |
| **Expedia QuickConnect** | Exige certificação da Expedia | XML sobre HTTPS: reservas e *availability & rates* |
| **Extranet (manual)** | Ligar já | Contingente por tipologia retido para a plataforma |
| **Booking.com direto** | Indisponível | API só para parceiros certificados, com registo encerrado |

O Booking.com merece uma nota, porque é a plataforma que mais importa a este
hotel. A API de conectividade exige certificação como parceiro e o registo está
fechado; o calendário iCal gratuito exige **uma unidade por tipologia** e o
Vice-Rei tem 55 unidades em 6 tipologias. O caminho realista é um channel
manager certificado, que fica para a fase 2 (Zodomus ou Channex; o Beds24 foi
descartado por custo). Até lá, as OTAs geram-se nas extranets com um
**contingente de quartos** definido em /admin/integracoes/extranets, que o motor
desconta à venda no site e no balcão.

O TripAdvisor não está na lista: o *Instant Book* deixou de aceitar novas
propriedades em 11 de novembro de 2025.

### Como corre

Os nossos calendários são publicados em `/api/ical/<tipologia>?token=…` (e
`/api/ical/todos`). O segredo vive no URL porque é o único sítio onde uma
plataforma que sonda um calendário o consegue transportar; pode ser rodado no
painel, o que invalida todas as subscrições.

A sincronização periódica é um POST autenticado:

```bash
curl -X POST https://hotelvicerei.com/api/channels/sync   -H "x-sync-secret: $SYNC_SECRET"
```

De 15 em 15 ou 30 em 30 minutos é suficiente — os feeds iCal do lado das
plataformas atualizam devagar (no Booking.com até 12 horas) e sondar mais vezes
só gasta limite de pedidos.

Duas invariantes protegem contra *overbooking*: a disponibilidade é **derivada**
das unidades, das reservas próprias e das importadas, nunca de um contador
guardado; e se a importação de um canal falhar, o envio da disponibilidade
desse canal é ignorado em vez de publicar números que sabemos estar velhos.

### Tarefas automáticas

Correm dentro da aplicação, de 5 em 5 minutos, com um *advisory lock* por tarefa
(seguro com várias réplicas): expirar pagamentos e libertar quartos não pagos,
lembretes com o link de check-in online, envio ao SIBA, sincronização de canais
e limpeza de registos. O estado de cada uma está em **/admin/sistema**.

Pagamentos: Stripe chama `/api/payments/stripe` (webhook assinado) e a
ifthenpay `/api/payments/ifthenpay` (callback com chave anti-phishing).
Monitorização: `/api/health`.

---

## Deploy

Push para `main` dispara o build no EasyPanel (`weboost/hotelvicerei`) através do
`Dockerfile`.

- Imagem multi-stage sobre `node:22-alpine`, com `output: "standalone"`.
- Corre como utilizador sem privilégios na porta **3000**.
- O entrypoint arranca como root apenas para corrigir a propriedade do volume de
  uploads e depois desce para `nextjs`.
- Volume `uploads` montado em `/app/hotelvicerei/uploads`.

> Depois de uma série de deploys falhados, o serviço pode ficar parado. Um build
> verde não o levanta sozinho — carregue em **Iniciar** na Visão Geral.

---

## SEO e GEO

- `canonical` + `hreflang` (com `x-default`) em todas as páginas e no sitemap.
- schema.org como `@graph`: `Hotel`/`LodgingBusiness`/`LocalBusiness` com geo e o
  catálogo de quartos como `Offer`; mais `FAQPage`, `BreadcrumbList` e `Article`.
- `/llms.txt` descreve o hotel em texto simples para motores generativos.
- Mapas e o visor 360º só carregam depois de o visitante os pedir — melhor
  desempenho e nada sai para terceiros sem ação explícita.

Lighthouse em produção (desktop): **Acessibilidade 100 · Boas práticas 100 ·
SEO 100**, desempenho 96–98.
