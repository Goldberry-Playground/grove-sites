# grove-sites

[![CI](https://github.com/Goldberry-Playground/grove-sites/actions/workflows/ci.yml/badge.svg)](https://github.com/Goldberry-Playground/grove-sites/actions/workflows/ci.yml)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![React 19](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Turborepo](https://img.shields.io/badge/Turborepo-2-red)

Multi-tenant frontend monorepo for the **Gathering at the Grove** ecosystem — a community of independent businesses sharing a headless Next.js 15 frontend backed by Odoo 19 ERP and Ghost CMS.

| Tenant | Domain | App | Port |
|--------|--------|-----|------|
| Hub Portal | gatheringatthegrove.com | `apps/hub` | 3000 |
| Goldberry Grove Farm | goldberrygrove.farm | `apps/goldberry` | 3001 |
| GGG Woodworking | woodworkingeorge.com | `apps/ggg` | 3002 |
| At The Grove Nursery | atthegrovenursery.com | `apps/nursery` | 3003 |

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Apps](#apps)
- [Packages](#packages)
- [Multi-Tenant Architecture](#multi-tenant-architecture)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Related Repositories](#related-repositories)
- [Contributing](#contributing)
- [Roadmap](#roadmap)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    grove-sites monorepo                          │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  @grove/hub           │  │  @grove/goldberry     │            │
│  │  :3000 — Marketplace  │  │  :3001 — Farm Store   │            │
│  │  /marketplace /journal│  │  /shop  /blog         │            │
│  └──────┬────────────────┘  └──┬──────────┬─────────┘            │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  @grove/ggg           │  │  @grove/nursery       │            │
│  │  :3002 — Woodworking  │  │  :3003 — Nursery      │            │
│  │  /shop  /blog         │  │  /shop  /blog         │            │
│  └──────┬────────────────┘  └──┬──────────┬─────────┘            │
│         │                      │          │                      │
│  ┌──────┴──────────────────────┴──────────┴─────────┐            │
│  │              Shared Packages                      │            │
│  │  @grove/ui          Component library             │            │
│  │  @grove/checkout    Shared cart + checkout flow   │            │
│  │  @grove/odoo-client  Odoo REST API client         │            │
│  │  @grove/ghost-client Ghost Content API client     │            │
│  │  @grove/analytics   RUM dual-writer (OO+Plausible)│            │
│  │  @grove/otel        Server-side OTel tracing      │            │
│  │  @grove/config       ESLint / TS / Tailwind       │            │
│  └──────────┬─────────────────────┬──────────────────┘            │
└─────────────┼─────────────────────┼──────────────────────────────┘
              │                     │
              ▼                     ▼
┌─────────────────────┐  ┌─────────────────────┐
│  Odoo 19 ERP         │  │  Ghost CMS (x3)      │
│  grove_headless API  │  │  Content API v5       │
│  /grove/api/v1/*     │  │  Posts, Pages          │
│  Products, Cart      │  │  One per tenant        │
└─────────────────────┘  └─────────────────────┘
```

Each Next.js app acts as a **BFF (Backend-for-Frontend)** — server-to-server calls to Odoo and Ghost. No direct browser-to-backend traffic.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Monorepo | Turborepo | 2 |
| Package Manager | pnpm | 9.15+ |
| Node Runtime | Node.js | 22+ |
| ERP Backend | Odoo 19 | REST API (`/grove/api/v1/*`) |
| CMS Backend | Ghost | Content API v5 |

## Repository Structure

```
grove-sites/
├── apps/
│   ├── hub/                        # Marketplace hub — gatheringatthegrove.com (:3000)
│   │   ├── app/
│   │   │   ├── marketplace/        # Federated product grid, vendor + product pages
│   │   │   ├── journal/            # Village journal (Ghost editorial)
│   │   │   ├── about/              # About the Grove
│   │   │   └── api/                # BFF: /api/marketplace/products, /api/revalidate
│   │   ├── components/             # BuyAtVendorForm, ProductCard, VendorCard, …
│   │   ├── data/marketplace.ts     # Vendor registry + vendor checkout URL builder
│   │   ├── lib/                    # Federated product fetchers (per-vendor Odoo clients)
│   │   ├── instrumentation.ts      # Registers @grove/otel server tracing
│   │   ├── tenant.config.ts        # Hub tenant identity and colors
│   │   ├── Dockerfile              # Standalone Next.js production image
│   │   ├── .env.local.example      # Env template
│   │   ├── next.config.ts
│   │   └── package.json
│   ├── goldberry/                  # Goldberry Grove Farm — goldberrygrove.farm (:3001)
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout with nav (Shop, Blog, Cart)
│   │   │   ├── page.tsx            # Home page
│   │   │   ├── providers.tsx       # Client-side context providers (CartProvider)
│   │   │   ├── shop/               # Shop listing + product detail (Odoo products)
│   │   │   ├── cart/               # Cart review (qty edit, remove)
│   │   │   ├── checkout/           # Checkout form + token-gated order confirmation
│   │   │   ├── api/                # BFF: cart proxy + order creation against Odoo
│   │   │   ├── blog/               # Blog listing (Ghost posts)
│   │   │   ├── about/ visit/       # Farm story + visiting pages
│   │   │   └── globals.css         # Goldberry color tokens
│   │   ├── instrumentation.ts      # Registers @grove/otel server tracing
│   │   ├── tenant.config.ts        # Goldberry identity, colors, backend URLs
│   │   ├── Dockerfile              # Standalone Next.js production image
│   │   ├── .env.local.example      # Env template
│   │   ├── next.config.ts
│   │   └── package.json
│   ├── ggg/                        # GGG Woodworking — woodworkingeorge.com (:3002)
│   │   └── …                       # Same storefront shape as goldberry (shop, cart, checkout, blog)
│   └── nursery/                    # At The Grove Nursery — atthegrovenursery.com (:3003)
│       └── …                       # Same storefront shape as goldberry (shop, cart, checkout, blog)
├── packages/
│   ├── ui/                         # Shared React component library + assetPath() CDN helper
│   ├── checkout/                   # Shared cart + checkout flow: CartProvider, cart reducer,
│   │                               #   Cart/Checkout components, BFF route factories (./server)
│   ├── odoo-client/                # Typed Odoo 19 REST API client — products, cart, orders
│   ├── ghost-client/               # Typed Ghost Content API client — posts, pages, authors
│   ├── analytics/                  # RUM dual-writer: OpenObserve RUM + Plausible sinks,
│   │                               #   AnalyticsProvider, e-commerce events, web vitals
│   ├── otel/                       # Server-side OpenTelemetry tracing (@vercel/otel),
│   │                               #   wired via each app's instrumentation.ts
│   └── config/                     # Shared tooling: ESLint flat config, base tsconfig,
│                                   #   Tailwind design tokens
├── infra/
│   └── do/                         # DO App Platform specs, one per app — see infra/do/README.md
├── turbo.json                      # Turborepo pipeline configuration
├── pnpm-workspace.yaml             # Workspace: apps/* + packages/*
├── tsconfig.json                   # Root TypeScript config
├── .npmrc                          # shamefully-hoist=false
└── .github/
    └── workflows/                  # CI, docker matrix builds, previews, release, scans
                                    #   (see CI/CD section)
```

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) or `asdf install nodejs 22` |
| pnpm | 9.15+ | Enabled via Corepack (see below) |
| Corepack | (bundled with Node) | `corepack enable` |

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone git@github.com:Goldberry-Playground/grove-sites.git
cd grove-sites

# 2. Enable Corepack (ensures correct pnpm version)
corepack enable

# 3. Install all dependencies
pnpm install

# 4. Set up environment variables for each app you plan to run
cp apps/goldberry/.env.local.example apps/goldberry/.env.local
cp apps/ggg/.env.local.example apps/ggg/.env.local
cp apps/nursery/.env.local.example apps/nursery/.env.local
cp apps/hub/.env.local.example apps/hub/.env.local
# Edit each .env.local with your Odoo and Ghost credentials

# 5. Start all apps in development mode
pnpm dev
```

The apps run at **http://localhost:3000** (hub), **:3001** (goldberry), **:3002** (ggg), and **:3003** (nursery).

### Running Individual Apps

```bash
# Run only the hub
pnpm --filter @grove/hub dev

# Run only goldberry
pnpm --filter @grove/goldberry dev

# Build only goldberry
pnpm --filter @grove/goldberry build

# Type-check a specific package
pnpm --filter @grove/odoo-client type-check
```

## Environment Variables

### Storefront apps (`apps/goldberry`, `apps/ggg`, `apps/nursery`)

Each storefront's `.env.local` follows the same shape (see the per-app `.env.local.example` for tenant-specific values):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TENANT_ID` | No | per app | Tenant identifier sent as `X-Grove-Tenant` header (company scoping in `grove_headless`) |
| `NEXT_PUBLIC_TENANT_ID` | No | per app | Same value, exposed to the client — scopes the localStorage cart key per tenant |
| `ODOO_URL` | Yes | `http://localhost:8069` | Odoo instance URL for the REST API |
| `ODOO_API_KEY` | No | — | Optional — public storefront endpoints (products, cart, orders) use `auth=public`. Only needed for authenticated endpoints |
| `GHOST_URL` | Yes | `http://localhost:2368/2369/2370` | Ghost CMS instance URL (one instance per tenant: goldberry 2368, ggg 2369, nursery 2370) |
| `GHOST_CONTENT_KEY` | Yes | — | Ghost Content API key. Generate via `make ghost-setup-<tenant>` in the odoocker stack |

> **Deployed environments (decided 2026-07-20):** in QA and prod, `GHOST_URL` points at the **prod blogs droplet** (`blog.{domain}`) with a **read-only Content API key** (1Password `Grove Infra`). There is no QA Ghost instance; the values are injected via Terraform (odoocker `qa-app-platform/apps.tf`). The local ports above are for local dev only.

### `apps/hub/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROVE_ODOO_URL` | Yes | `http://localhost:8069` | Where each vendor's `grove_headless` API lives (V0: all three storefronts share one Odoo) |
| `HUB_GHOST_URL` | Yes | `http://localhost:2368` | Ghost instance for the hub's village journal |
| `HUB_GHOST_CONTENT_API_KEY` | Yes | — | Ghost Content API key for the journal |
| `GROVE_REVALIDATE_SECRET` | Yes | — | Shared secret for `/api/revalidate` (generate: `openssl rand -hex 32`) |

### Shared observability vars (all four apps)

Every `.env.local.example` also carries the `@grove/analytics` and `@grove/otel` configuration — off by default in local dev:

| Variable | Side | Description |
|----------|------|-------------|
| `NEXT_PUBLIC_RUM_ENABLED` / `NEXT_PUBLIC_RUM_ENV` | Client | Master switch for the analytics dual-writer (Do-Not-Track always honored) |
| `NEXT_PUBLIC_OO_RUM_*` (`SITE`, `CLIENT_TOKEN`, `APP_ID`, `SERVICE`, `ORG`, `INSECURE`) | Client | OpenObserve RUM sink — enabled only when `SITE` + `CLIENT_TOKEN` are both set |
| `NEXT_PUBLIC_PLAUSIBLE_HOST` / `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Client | Self-hosted Plausible sink — enabled only when both are set |
| `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Server only | `@grove/otel` OTLP export to OpenObserve. Never `NEXT_PUBLIC_*` — the basic-auth header must not reach the browser. Blank endpoint = no-op |

`NEXT_PUBLIC_ASSETS_URL` (unset locally) points `@grove/ui`'s `assetPath()` helper at the CDN in QA/prod; when unset, assets are served from each app's `/public`.

## Available Scripts

### Root (via Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in parallel (hub :3000, goldberry :3001, ggg :3002, nursery :3003) |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm type-check` | Type-check all workspaces |
| `pnpm test` | Run unit tests (Vitest) — also `test:watch`, `test:ui`, `test:coverage` |
| `pnpm clean` | Remove build artifacts (.next, dist) |

### Per App

```bash
# Run any script for a specific app
pnpm --filter @grove/hub dev
pnpm --filter @grove/goldberry build
pnpm --filter @grove/goldberry start    # Start production server
pnpm --filter @grove/goldberry lint
pnpm --filter @grove/goldberry type-check
```

### Per Package

```bash
pnpm --filter @grove/odoo-client type-check
pnpm --filter @grove/ui type-check
```

## Apps

### `@grove/hub` — Marketplace Hub

- **Domain:** gatheringatthegrove.com
- **Port:** 3000
- **Purpose:** Village marketplace for the Gathering at the Grove community. Federates product discovery across the vendor storefronts — server-side fetches against each vendor's `grove_headless` API — and hands purchases off to the vendor: the Buy CTA is a plain form POST (`BuyAtVendorForm`) straight into the vendor's own Odoo checkout, so the hub never touches payment (and stays out of PCI scope). Also hosts the village journal (Ghost editorial).
- **Routes:** `/` (home), `/marketplace`, `/marketplace/vendor/[slug]`, `/marketplace/[vendor]/[productSlug]`, `/journal`, `/about`
- **BFF API routes:** `/api/marketplace/products`, `/api/revalidate`
- **Dependencies:** `@grove/ui`, `@grove/odoo-client`, `@grove/ghost-client`, `@grove/config`, `@grove/analytics`, `@grove/otel`

### `@grove/goldberry` — Goldberry Grove Farm

- **Domain:** goldberrygrove.farm
- **Port:** 3001
- **Purpose:** Farm storefront with shop, cart, checkout, order confirmation, and blog.
- **Routes:** `/` (home), `/shop`, `/shop/[id]`, `/cart`, `/checkout`, `/checkout/success/[id]`, `/blog`, `/about`, `/visit`
- **BFF API routes:** `/api/cart`, `/api/checkout` (server-to-server calls into Odoo)
- **Dependencies:** `@grove/ui`, `@grove/checkout`, `@grove/odoo-client`, `@grove/ghost-client`, `@grove/config`, `@grove/analytics`, `@grove/otel`

### `@grove/ggg` — GGG Woodworking

- **Domain:** woodworkingeorge.com
- **Port:** 3002
- **Purpose:** Woodworking storefront — same shop/cart/checkout/blog shape as goldberry, built on the shared `@grove/checkout` flow.

### `@grove/nursery` — At The Grove Nursery

- **Domain:** atthegrovenursery.com
- **Port:** 3003
- **Purpose:** Nursery storefront — same shop/cart/checkout/blog shape as goldberry, built on the shared `@grove/checkout` flow.

## Packages

### `@grove/ui`

Shared React component library themed via CSS custom properties (`--grove-color-*`). Each tenant applies its own palette without code changes.

```typescript
import { Button } from "@grove/ui";

// Variants: "primary" | "secondary" | "ghost"
// Sizes: "sm" | "md" | "lg"
<Button variant="primary" size="md">Shop Now</Button>
```

Also exports `assetPath(tenant, subpath)` — resolves tenant-scoped assets against `NEXT_PUBLIC_ASSETS_URL` (CDN) in QA/prod, falling back to `/public` locally.

### `@grove/checkout`

Shared cart + checkout flow used by all three storefronts. The client entry exports the cart store (`CartProvider`, `useCart`), pure cart-reducer functions, and the shop UI (`AddToCartButton`, `MiniCartDrawer`, `CartNavLink`, `CartPage`, `CheckoutPage`). Server-only route factories live behind `@grove/checkout/server` so backend credentials can't leak into client bundles:

```typescript
// apps/<tenant>/app/api/cart/route.ts
import { createCartRoute } from "@grove/checkout/server";

// apps/<tenant>/app/api/checkout/route.ts
import { createCheckoutRoute } from "@grove/checkout/server";
```

Carts persist in localStorage, keyed per tenant (`NEXT_PUBLIC_TENANT_ID`) so goldberry/ggg/nursery carts never bleed into each other.

### `@grove/odoo-client`

Typed client for the Odoo 19 REST API at `/grove/api/v1/*` (served by the `grove_headless` module). Provides product catalog browsing, cart management, and order creation.

```typescript
import { createOdooClient } from "@grove/odoo-client";

const odoo = createOdooClient({
  tenantId: "goldberry",
  odooUrl: "http://localhost:8069",
  apiKey: "your-api-key",
});

const products = await odoo.products.list({ limit: 20 });
const cart = await odoo.cart.addItem(productId, 2);
```

### `@grove/ghost-client`

Typed client for the Ghost Content API v5. Fetches posts, pages, and authors.

```typescript
import { createGhostClient } from "@grove/ghost-client";

const ghost = createGhostClient({
  ghostUrl: "http://localhost:2368",
  contentKey: "your-content-key",
});

const posts = await ghost.posts.list({ limit: 10, include: "tags,authors" });
const post = await ghost.posts.get("my-post-slug");
```

### `@grove/config`

Shared tooling configuration:

| Export | Contents |
|--------|----------|
| `@grove/config/eslint` | Flat ESLint config for Next.js + TypeScript |
| `@grove/config/typescript` | Base `tsconfig.json` (ES2022, strict, bundler resolution) |
| `@grove/config/tailwind` | `groveColors`, `groveFontFamily`, `groveCSSTokens()` — design tokens for all tenants |

### `@grove/analytics`

Client-side RUM **dual-writer**: every event fans out to two sinks — OpenObserve RUM and self-hosted Plausible — each independently enabled by its own env vars. Gated behind `NEXT_PUBLIC_RUM_ENABLED` (off in local dev) and always honors Do-Not-Track. Ships an `AnalyticsProvider` that fires page views on route changes, e-commerce events (`trackAddToCart`, `trackBeginCheckout`, `trackPurchase`), and web-vitals reporting.

```typescript
import { usePageView, trackEvent } from "@grove/analytics";

usePageView("/shop");
trackEvent("add_to_cart", { productId: 1 });
```

### `@grove/otel`

Server-side OpenTelemetry tracing built on `@vercel/otel`. Each app's `instrumentation.ts` calls `registerGroveOtel()`; `fetch` auto-instrumentation gives every BFF→Odoo/Ghost call a child span, exported over OTLP to OpenObserve where it correlates with Beyla's Odoo spans. No-op unless `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set, so it's silent in local dev. Configured exclusively through server-side `OTEL_*` env vars — never `NEXT_PUBLIC_*`.

## Multi-Tenant Architecture

Each app defines a `tenant.config.ts` at its root declaring the tenant identity:

```typescript
// apps/goldberry/tenant.config.ts
export const tenantConfig = {
  tenantId: "goldberry",
  name: "Goldberry Grove Farm",
  domain: "goldberrygrove.farm",
  colors: {
    primary: "#b45309",
    primaryForeground: "#ffffff",
    secondary: "#fde68a",
    // ...
  },
  odooUrl: process.env.ODOO_URL ?? "http://localhost:8069",
  ghostUrl: process.env.GHOST_URL ?? "http://localhost:2368",
} as const;
```

The layout reads `tenantConfig` to set metadata, navigation, and a `data-tenant` attribute on `<body>`. Shared `@grove/ui` components pick up tenant colors through CSS custom properties (`--grove-color-primary`, etc.), so the same component renders in each tenant's palette.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | push / PR to `main` | Rejects tracked `.env` files; `pnpm lint` + `pnpm type-check` + `pnpm test` (Vitest); production build with standalone-output verification; `pnpm audit --audit-level=high` (blocking); secret scan via trufflehog (`--only-verified`) |
| `docker.yml` | push / PR to `main` | Matrix build of all 4 frontend images (`grove-hub`, `grove-goldberry`, `grove-ggg`, `grove-nursery`), smoke test each container, Trivy image scan, publish to GHCR on `main` |
| `preview-up.yml` / `preview-down.yml` | PR labeled `qa` / PR closed or unlabeled | Per-PR full-stack preview droplet: builds images at the PR HEAD, terraform-applies the odoocker `preview/` env, comments per-tenant URLs on the PR; teardown on close |
| `do-spec-validate.yml` | push / PR | `doctl apps spec validate` for every `infra/do/*.yaml` |
| `release.yml` | `workflow_dispatch` or `v*.*.*` tag | Deploy Goldberry to sandbox / production |
| `actionlint.yml` | push / PR | Lints the workflow files themselves |
| `dependency-review.yml` | PR | GitHub dependency review |
| `claude.yml` | PR / comments | Claude Code assistant (interactive `@claude` helper) |

## Deployment

### QA / Production — DigitalOcean App Platform

Per ADR-007 ("Level 3", in the odoocker repo's `docs/ADR/`), the QA and production frontends deploy to **DO App Platform** — one App per business, so each site owns its domain, billing line, and rollout cadence. The App Platform spec files live in this repo under [`infra/do/`](infra/do/README.md) (`hub.yaml`, `goldberry.yaml`, `ggg.yaml`, `nursery.yaml`); each wires GitHub → Dockerfile build → App Platform with auto-redeploy on push to `main`. See `infra/do/README.md` for create/update/secrets/DNS runbooks.

### Production Build (manual)

```bash
# Build all apps
pnpm build

# Start production servers
pnpm --filter @grove/hub start
pnpm --filter @grove/goldberry start
```

### Local dev backend

The backend stack the frontends talk to in local dev (Odoo, PostgreSQL, Ghost, Docker Compose) lives in the [odoocker-goldberrygrove](https://github.com/Goldberry-Playground/odoocker-goldberrygrove) repository.

## Troubleshooting

### `next dev` looks frozen — no output, no Ready banner

Next.js 15.5 uses interactive (TTY) output by default. When stdout is a pipe
(IDE process manager, `tee`, CI logger, anything that isn't a real terminal)
the entire bootstrap output gets buffered until exit, so the dev server
appears hung even though it's actually running.

**Fix:** force plain output mode with `CI=1`:

```bash
CI=1 pnpm --filter @grove/goldberry dev
```

The repo-root `make goldberry-dev` target sets this automatically.

### Node version mismatch (silent hang)

If `next dev` accepts a TCP connection on its port but then never responds —
or `pnpm install` errors with `Unsupported engine` — check your active Node
version:

```bash
node -v   # must be v22.x.x
```

The repo pins Node 22 via `.nvmrc` and `engines` in `package.json`. With
`fnm` installed and `eval "$(fnm env --use-on-cd)"` in your shell, `cd`-ing
into this directory auto-switches you to Node 22.

Node 25 in particular causes `next dev` to silently fail mid-compile after
listening on the port.

### pnpm version mismatch

```
ERROR: This project is configured to use pnpm 9.15.x
```

**Fix:** Enable Corepack to auto-use the correct pnpm version:

```bash
corepack enable
corepack prepare
```

### Lockfile out of date

```
ERR_PNPM_OUTDATED_LOCKFILE
```

**Fix:**

```bash
pnpm install --no-frozen-lockfile
```

### Module not found: `@grove/*`

Shared packages are consumed as raw TypeScript via `transpilePackages` in `next.config.ts`. If a package isn't resolving:

```bash
# Verify workspace linking
pnpm ls --filter @grove/goldberry --depth 1

# Re-install
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Port already in use

```
Error: listen EADDRINUSE :::3001
```

**Fix:** Kill the process on that port:

```bash
lsof -ti :3001 | xargs kill -9
```

### Backend connection errors (Odoo / Ghost)

If the shop or blog pages show errors, verify:

1. The backend is running (check the [odoocker stack](https://github.com/Goldberry-Playground/odoocker-goldberrygrove))
2. Your `.env.local` has correct URLs and API keys
3. The `grove_headless` Odoo module is installed
4. Ghost has an active integration with a Content API key

### Stale Turbo cache

If builds behave unexpectedly after changing env vars:

```bash
# Clear Turbo cache
rm -rf .turbo node_modules/.cache

# Rebuild
pnpm build
```

### TypeScript errors in packages

```bash
# Type-check a specific package to isolate the error
pnpm --filter @grove/odoo-client type-check
```

## Related Repositories

| Repo | Purpose |
|------|---------|
| [odoocker-goldberrygrove](https://github.com/Goldberry-Playground/odoocker-goldberrygrove) | Docker Compose infrastructure — Odoo, PostgreSQL, nginx, Ghost CMS |
| [grove-odoo-modules](https://github.com/Goldberry-Playground/grove-odoo-modules) | Custom Odoo 19 modules — `grove_headless` REST API |

## Contributing

1. Create a feature branch from `main`
2. Follow conventions: TypeScript strict, Server Components by default, `@grove/*` package imports
3. Run `pnpm lint && pnpm type-check && pnpm test` before pushing
4. Open a PR — CI must pass before merge

## Roadmap

**Phase 1 — Monorepo Foundation (complete)**

- Turborepo + pnpm workspace scaffolding
- Hub portal and Goldberry app with tenant-aware theming
- Shared packages: UI, Odoo client, Ghost client, config, analytics
- CI pipeline (lint + type-check)
- Design token system with per-tenant color palettes

**Phase 2 — Core Integration (complete)**

- Connect `@grove/odoo-client` to live Odoo 19 for product data, cart, and orders
- Connect `@grove/ghost-client` to live Ghost for blog content
- Shop pages: listing, product detail, cart, checkout, order confirmation
- Cart state via React Context with localStorage persistence (`lib/cart-store.tsx`)
- Order creation through `/api/checkout` BFF route, fronted by Odoo's `access_token` for confirmation lookup
- Blog listing page wired to Ghost Content API
- Containerized goldberry deploy (`Dockerfile` + standalone Next.js output)

**Phase 3 — Hardening & Expansion (next)**

- Real payment integration (Stripe / direct invoice via Odoo)
- Blog post detail + tag filtering
- Unit and integration tests (Vitest + Playwright)
- ~~Remaining tenant apps (GGG Woodworking, At The Grove Nursery)~~ — shipped in Sprint 3

## License

Private — Goldberry-Playground
