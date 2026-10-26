# syntax=docker/dockerfile:1.7

# Multi-stage build for Grove Consult (consult.gatheringatthegrove.com).
# Same toolchain as apps/nursery.
#
# Build context expected: grove-sites/ (the monorepo root), NOT apps/consult:
#   docker build -f apps/consult/Dockerfile .
#
# Output: `node server.js` on port 3001 — production/consult.tf pins
# http_port = 3001 and health-checks GET /healthz (the one path the Access
# middleware serves without a Cf-Access-Jwt-Assertion).

ARG NODE_VERSION=22-alpine

# ── 1. install dependencies (frozen lockfile) ────────────────────────────
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /workspace
RUN corepack enable

# Only the manifests, so this layer caches across source changes. Add a
# packages/<pkg>/package.json line here for every workspace dep the app takes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/consult/package.json apps/consult/

RUN pnpm install --frozen-lockfile

# ── 2. build the standalone Next.js bundle ───────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /workspace
RUN corepack enable

COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/consult/node_modules ./apps/consult/node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @grove/consult build

# ── 3. minimal runtime image ─────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Strip npm/npx/corepack — we only run `node server.js` (bundled-CLI CVEs).
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    && (rm -f /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg || true)

# Current Alpine security patches, so upstream-fixed HIGH CVEs don't block
# the Trivy gate in .github/workflows/docker.yml.
RUN apk upgrade --no-cache

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/consult/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/consult/.next/static ./apps/consult/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/consult/public ./apps/consult/public

USER nextjs
EXPOSE 3001

CMD ["node", "apps/consult/server.js"]
