# syntax=docker/dockerfile:1.7

# Multi-stage build for the Hub (gatheringatthegrove.com) Next.js portal.
#
# Build context expected: grove-sites/ (the monorepo root), NOT apps/hub.
# This is so we can install workspace dependencies and trace the Next standalone
# output against the full monorepo:
#   docker build -f apps/hub/Dockerfile grove-sites/
#
# Output: a ~250MB image running `node server.js` on port 3000.

ARG NODE_VERSION=22-alpine

# ── 1. install dependencies (with pnpm fetch + frozen-lockfile) ───────────
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /workspace
RUN corepack enable

# Copy only the manifests so this layer caches across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/hub/package.json apps/hub/
COPY packages/ui/package.json packages/ui/
COPY packages/odoo-client/package.json packages/odoo-client/
COPY packages/ghost-client/package.json packages/ghost-client/
COPY packages/config/package.json packages/config/
COPY packages/analytics/package.json packages/analytics/

RUN pnpm install --frozen-lockfile

# ── 2. build the standalone Next.js bundle ───────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /workspace
RUN corepack enable

# Bring forward the resolved node_modules (top-level + each workspace's).
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/hub/node_modules ./apps/hub/node_modules
COPY --from=deps /workspace/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /workspace/packages/odoo-client/node_modules ./packages/odoo-client/node_modules
COPY --from=deps /workspace/packages/ghost-client/node_modules ./packages/ghost-client/node_modules
COPY --from=deps /workspace/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /workspace/packages/analytics/node_modules ./packages/analytics/node_modules

# Then copy the rest of the source.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be present at build time — Next inlines them into
# the client bundle. Unset defaults to empty so assetPath() falls back to
# /public/ paths (local dev + tests). QA/prod builds pass this via compose.
ARG NEXT_PUBLIC_ASSETS_URL=""
ENV NEXT_PUBLIC_ASSETS_URL=$NEXT_PUBLIC_ASSETS_URL

RUN pnpm --filter @grove/hub build

# ── 3. minimal runtime image ─────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# Strip npm/npx/corepack from the runtime image — we run `node server.js` only.
# Mirrors the goldberry/ggg/nursery Dockerfiles; removes the bundled vulnerable
# picomatch (CVE-2026-33671) and similar future bundled-CLI CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    && (rm -f /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg || true)

# Pull current Alpine security patches on top of node:22-alpine, so HIGH CVEs
# fixed upstream (e.g. CVE-2026-45447 in libcrypto3/libssl3) stop blocking the
# Trivy gate in .github/workflows/docker.yml.
RUN apk upgrade --no-cache

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root runtime user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server + static assets. The hub has no /public dir today, but
# Next still generates a (possibly empty) static tree.
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/hub/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/hub/.next/static ./apps/hub/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/hub/server.js"]
