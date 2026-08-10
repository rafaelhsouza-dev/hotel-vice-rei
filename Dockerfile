# syntax=docker/dockerfile:1

# Next.js 16 multi-stage build for EasyPanel.
# Uses `output: "standalone"` (next.config.ts) so the runtime image ships only
# the traced server files instead of the whole node_modules tree.

FROM node:22-alpine AS base
# Alpine is musl-based; libc6-compat keeps the SWC/sharp native binaries happy.
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# deps — install once, cached until the lockfile changes
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — compile the app
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# have to arrive as build args. EasyPanel forwards every env var as --build-arg.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal production image
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

# `standalone` deliberately omits public/ and .next/static — copy them in so the
# bundled server.js can serve them without a separate CDN.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
