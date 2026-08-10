# Hotel Vice-Rei · Porto

Site institucional e motor de reservas do Hotel Vice-Rei, com backoffice próprio.

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

---

## Desenvolvimento

```bash
npm install

# Postgres descartável para desenvolvimento
docker run -d --name vicerei-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=vicereidb -e POSTGRES_USER=postgres \
  -p 5440:5432 postgres:16-alpine

npm run dev
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
| `NEXT_PUBLIC_GA_ID` | Opcional. GA4 só carrega com consentimento de cookies |

`NEXT_PUBLIC_*` são inlined no bundle durante o build, por isso têm de existir
como *build args* — o EasyPanel encaminha todas as variáveis automaticamente.

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
