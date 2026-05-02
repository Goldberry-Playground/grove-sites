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
| GGG Woodworking (planned) | woodworkingeorge.com | `apps/ggg` | 3002 |
| At The Grove Nursery (planned) | atthegrovenursery.com | `apps/nursery` | 3003 |

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
│  │  :3000 — Hub Portal   │  │  :3001 — Farm Store   │            │
│  │                       │  │  /shop  /blog         │            │
│  └──────┬────────────────┘  └──┬──────────┬─────────┘            │
│         │                      │          │                      │
│  ┌──────┴──────────────────────┴──────────┴─────────┐            │
│  │              Shared Packages                      │            │
│  │  @grove/ui          Component library             │            │
│  │  @grove/odoo-client  Odoo REST API client         │            │
│  │  @grove/ghost-client Ghost Content API client     │            │
│  │  @grove/config       ESLint / TS / Tailwind       │            │
│  │  @grove/analytics    Event tracking               │            │
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
│   ├── hub/                        # Hub portal — gatheringatthegrove.com
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout with tenant theming
│   │   │   ├── page.tsx            # Landing page linking to tenant sites
│   │   │   └── globals.css         # Hub color tokens
│   │   ├── tenant.config.ts        # Hub tenant identity and colors
│   │   ├── .env.local.example      # Env template
│   │   ├── next.config.ts
│   │   └── package.json
│   └── goldberry/                  # Goldberry Grove Farm — goldberrygrove.farm
│       ├── app/
│       │   ├── layout.tsx          # Root layout with nav (Shop, Blog, Cart)
│       │   ├── page.tsx            # Home page
│       │   ├── providers.tsx       # Client-side context providers (CartProvider)
│       │   ├── cart-nav-link.tsx   # Cart link with live item count badge
│       │   ├── shop/page.tsx       # Shop listing (Odoo products)
│       │   ├── shop/[id]/          # Product detail + Add-to-Cart button
│       │   ├── cart/page.tsx       # Cart review (qty edit, remove)
│       │   ├── checkout/page.tsx   # Checkout form (contact, shipping, payment)
│       │   ├── checkout/success/[id]/page.tsx  # Order confirmation (token-gated)
│       │   ├── api/cart/route.ts   # BFF: server-side cart proxy
│       │   ├── api/checkout/route.ts # BFF: order creation against Odoo
│       │   ├── blog/page.tsx       # Blog listing (Ghost posts)
│       │   └── globals.css         # Goldberry color tokens
│       ├── lib/
│       │   ├── clients.ts          # Odoo + Ghost client instances
│       │   └── cart-store.tsx      # React Context cart with localStorage persistence
│       ├── tenant.config.ts        # Goldberry identity, colors, backend URLs
│       ├── Dockerfile              # Standalone Next.js production image
│       ├── .env.local.example      # Env template
│       ├── next.config.ts
│       └── package.json
├── packages/
│   ├── ui/                         # Shared React component library
│   │   └── src/
│   │       ├── index.ts            # Exports: Button, ButtonProps
│   │       └── button.tsx          # Themeable button (CSS custom properties)
│   ├── odoo-client/                # Typed Odoo 19 REST API client
│   │   └── src/
│   │       ├── index.ts            # Exports: createOdooClient, types
│   │       ├── client.ts           # REST client — products, cart, orders
│   │       └── types.ts            # TenantConfig, Product, Cart, Order
│   ├── ghost-client/               # Typed Ghost Content API client
│   │   └── src/
│   │       ├── index.ts            # Exports: createGhostClient, types
│   │       ├── client.ts           # REST client — posts, pages, authors
│   │       └── types.ts            # GhostConfig, Post, Page, Author, Tag
│   ├── config/                     # Shared tooling configuration
│   │   └── src/
│   │       ├── eslint.ts           # Flat ESLint config for Next.js + TS
│   │       ├── tailwind.ts         # Design tokens: color palettes, fonts
│   │       └── typescript.json     # Base tsconfig
│   └── analytics/                  # Analytics hooks (placeholder)
│       └── src/
│           └── index.ts            # usePageView, trackEvent
├── turbo.json                      # Turborepo pipeline configuration
├── pnpm-workspace.yaml             # Workspace: apps/* + packages/*
├── tsconfig.json                   # Root TypeScript config
├── .npmrc                          # shamefully-hoist=false
└── .github/
    └── workflows/
        └── ci.yml                  # Lint + type-check on push/PR to main
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

# 4. Set up environment variables for Goldberry
cp apps/goldberry/.env.local.example apps/goldberry/.env.local
# Edit apps/goldberry/.env.local with your Odoo and Ghost credentials

# 5. Set up environment variables for Hub (optional)
cp apps/hub/.env.local.example apps/hub/.env.local

# 6. Start all apps in development mode
pnpm dev
```

The hub runs at **http://localhost:3000** and Goldberry at **http://localhost:3001**.

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

### `apps/goldberry/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ODOO_URL` | Yes | `http://localhost:8069` | Odoo instance URL for the REST API |
| `ODOO_API_KEY` | Yes | — | Odoo API key for `Authorization: Bearer` header. Generate in Odoo: **Settings > Users > [user] > API Keys** |
| `TENANT_ID` | No | `goldberry` | Tenant identifier sent as `X-Grove-Tenant` header |
| `GHOST_URL` | Yes | `http://localhost:2368` | Ghost CMS instance URL |
| `GHOST_CONTENT_KEY` | Yes | — | Ghost Content API key. Find in Ghost Admin: **Settings > Integrations > [integration] > Content API Key** |

### `apps/hub/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TENANT_ID` | No | `hub` | Tenant identifier |

The hub app has no backend integrations — it's a static directory page.

## Available Scripts

### Root (via Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in parallel (hub :3000, goldberry :3001) |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm type-check` | Type-check all workspaces |
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

### `@grove/hub` — Hub Portal

- **Domain:** gatheringatthegrove.com
- **Port:** 3000
- **Purpose:** Central landing page for the Gathering at the Grove community. Links visitors to each tenant's website.
- **Dependencies:** `@grove/ui`, `@grove/config`, `@grove/analytics`

### `@grove/goldberry` — Goldberry Grove Farm

- **Domain:** goldberrygrove.farm
- **Port:** 3001
- **Purpose:** Farm storefront with shop, cart, checkout, order confirmation, and blog.
- **Routes:** `/` (home), `/shop`, `/shop/[id]`, `/cart`, `/checkout`, `/checkout/success/[id]`, `/blog`
- **BFF API routes:** `/api/cart`, `/api/checkout` (server-to-server calls into Odoo)
- **Dependencies:** `@grove/ui`, `@grove/odoo-client`, `@grove/ghost-client`, `@grove/config`, `@grove/analytics`

## Packages

### `@grove/ui`

Shared React component library themed via CSS custom properties (`--grove-color-*`). Each tenant applies its own palette without code changes.

```typescript
import { Button } from "@grove/ui";

// Variants: "primary" | "secondary" | "ghost"
// Sizes: "sm" | "md" | "lg"
<Button variant="primary" size="md">Shop Now</Button>
```

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

Client-side analytics hooks. Currently a placeholder that logs to console in development.

```typescript
import { usePageView, trackEvent } from "@grove/analytics";

usePageView("/shop");
trackEvent("add_to_cart", { productId: 1 });
```

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

GitHub Actions workflow runs on every push and PR to `main`:

1. Checkout
2. Setup pnpm (via `pnpm/action-setup@v4`)
3. Setup Node.js 22 with pnpm cache
4. `pnpm install --frozen-lockfile`
5. `pnpm lint` across all workspaces
6. `pnpm type-check` across all workspaces

## Deployment

### Production Build

```bash
# Build all apps
pnpm build

# Start production servers
pnpm --filter @grove/hub start
pnpm --filter @grove/goldberry start
```

### Infrastructure

The production infrastructure (nginx reverse proxy, Docker Compose) lives in the [odoocker-goldberrygrove](https://github.com/Goldberry-Playground/odoocker-goldberrygrove) repository.

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
3. Run `pnpm lint && pnpm type-check` before pushing
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
- Remaining tenant apps (GGG Woodworking, At The Grove Nursery)

## License

Private — Goldberry-Playground
