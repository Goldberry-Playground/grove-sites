# Grove Sites — Frontend Monorepo

Next.js 15 App Router monorepo (pnpm + Turborepo) for the Gather at the Grove ecosystem.

## Architecture

| App | Domain | Company |
|-----|--------|---------|
| `apps/hub` | gatheringatthegrove.com | Shared hub |
| `apps/goldberry` | goldberrygrove.farm | Goldberry Grove Farm |
| `apps/ggg` | woodworkingeorge.com | George George George Woodworking, LLC |
| `apps/nursery` | atthegrovenursery.com | At The Grove Nursery, LLC |
| `apps/discord-bridge` | (internal, DO App Platform) | CMO Discord bridge: Buffer digest, `/insights`, content approvals |
| `apps/qa-portal` | (internal, local only) | Component-QA gallery of per-brand design bundles (:3005) |

`apps/consult` is not listed here. It moves to AgriforestryOS in Train #5.

| Package | Purpose |
|---------|---------|
| `packages/analytics` | Client RUM dual-writer (OpenObserve RUM + Plausible), page views, e-commerce events, web vitals |
| `packages/assets` | Product-photo ingest: sharp → AVIF/WebP variants → grove-assets Spaces CDN (`pnpm upload-asset`) |
| `packages/checkout` | Shared cart + checkout flow and BFF route factories (`@grove/checkout/server`) |
| `packages/config` | Shared tooling: ESLint flat config, base tsconfig, Tailwind tokens |
| `packages/ghost-client` | Typed Ghost Content API client (posts, pages, authors) |
| `packages/grove-brand` | `@grove/brand`: brand-asset manifest (SVG logos in git, rasters on the CDN) |
| `packages/grove-tokens` | `@grove/tokens`: design-system token contract (`--grove-*`) + per-brand themes |
| `packages/grove-ui` | `@grove/ui-kit`: design-system components (cart, checkout, product cards, capture forms) on `@grove/tokens` |
| `packages/next-cache` | `@grove/next-cache`: Valkey-backed Next.js Data Cache handler + catalog warmer (off unless `VALKEY_URL` is set) |
| `packages/newsletter` | Newsletter opt-in capture into Odoo Email Marketing (one list per brand) |
| `packages/odoo-client` | Typed Odoo 19 REST client for `grove_headless` (products, cart, orders) |
| `packages/otel` | Server-side OpenTelemetry tracing (`@vercel/otel`), wired via each app's `instrumentation.ts` |
| `packages/planner` | Order-builder planning engine: pure `plan()` from quiz answers + catalog feed (nursery `/plan`) |
| `packages/ui` | Shared React components + `assetPath()` CDN helper |

## Backend Integration

- **Odoo** (`grove_headless` module) — REST API at `/grove/api/v1/*` for e-commerce, inventory, CRM
- **Ghost CMS** — Content API for `/blog` pages, one instance per tenant. Local dev runs local Ghost containers; **QA and prod frontends both read the PROD blogs droplet at `blog.{domain}` via read-only Content API keys** (decided 2026-07-20 — there is no QA Ghost droplet; QA wiring lands via Terraform in odoocker `qa-app-platform/apps.tf`)
- Each Next.js app's API routes serve as a **BFF** (Backend-for-Frontend) — server-to-server calls to Odoo/Ghost, no direct browser-to-backend traffic

## Related Repos

| Repo | Purpose |
|------|---------|
| `Goldberry-Playground/odoocker-goldberrygrove` | Docker Compose infrastructure (Odoo, PG, Nginx, Ghost) |
| `Goldberry-Playground/grove-odoo-modules` | Custom Odoo modules (deployed via git-sync) |

## Development Workflow — Skill Chain

Every implementation task follows this workflow. Skills are invoked in order:

### 1. Engineering (Architecture)
Before writing code, use the **feature-dev** command (`/feature-dev`) or spawn the `code-architect` agent to:
- Analyze existing patterns in the codebase
- Design the component/feature architecture
- Produce an implementation blueprint with specific files, data flows, and build sequence

### 2. Frontend Design
When building UI components or pages, invoke the **frontend-design** skill:
- Bold, intentional aesthetic direction per brand (farm/organic for Goldberry, craft/workshop for GGG, garden/natural for Nursery)
- Production-grade components with accessibility
- Distinctive typography and visual identity — no generic AI aesthetics

### 3. Implementation
Write code following the architecture blueprint. Conventions:
- TypeScript strict mode, no `any`
- Server Components by default, `'use client'` only when needed
- API routes in `app/api/` serve as BFF — call Odoo/Ghost server-side
- Use `@grove/odoo-client` and `@grove/ghost-client` packages, never raw fetch to backends
- ISR for product/blog pages, revalidate via webhooks
- Cacheable Odoo reads (`next.revalidate` + tags) go to the Next Data Cache. With `VALKEY_URL`
  and `GROVE_CACHE_NAMESPACE` set, `@grove/next-cache` keeps it in one shared Valkey, so entries
  and tag flushes reach every instance; product data is never served older than 600s. Either
  var unset = per-instance file cache (today's behaviour, the off switch). Checkout, cart quote
  and promo reads stay live. Next is pinned to 15.5.28: re-run the cache spike before bumping
  it. See `docs/runbooks/isr-multi-instance.md`.

### 4. Code Review
Before finishing any code, invoke `/code-review` or spawn the `code-reviewer` agent:
- Check against this CLAUDE.md and project conventions
- Bug detection, security review, accessibility audit
- Confidence-scored issues (only report >50 confidence)
- Verify multi-tenant safety (company_id scoping)

### 5. Simplify
After code review passes, invoke `/simplify` to:
- Check for reuse opportunities across apps/packages
- Remove unnecessary abstractions
- Ensure code is as simple as the task requires

### 6. Product Management — Asana Sync
After each task is complete, update the corresponding Asana task:
- Use `mcp__asana-goldberrygrove__asana_update_task` to mark as complete
- Add a comment with `mcp__asana-goldberrygrove__asana_create_task_story` summarizing:
  - What was built (files created/modified)
  - What was tested (verification steps)
  - Any follow-up tasks discovered
- Project GID: `1213867393569940`

### 7. Operations — Documentation & Release Notes
After code is committed:
- Update relevant docs if behavior changed (README, CLAUDE.md, API docs)
- Add JSDoc/TSDoc comments to exported functions and types
- For significant changes, add an entry to `CHANGELOG.md`
- Keep ADRs current in `odoocker/docs/ADR/` for architectural decisions

## Code Conventions

- **Line length:** 100 characters
- **Imports:** Use `@grove/*` aliases for package imports
- **Components:** PascalCase files, co-locate styles
- **API routes:** `route.ts` files in `app/api/` directories
- **Environment vars:** `NEXT_PUBLIC_*` for client-side only, all others server-side
- **Error handling:** Use `notFound()` and `redirect()` from `next/navigation`, not try/catch for expected flows
- **Testing:** Vitest for unit tests, Playwright for E2E

## Commands Reference

| Command | When to Use |
|---------|-------------|
| `/feature-dev` | Start a new feature — gets architecture blueprint |
| `/code-review` | Before finishing code — reviews for bugs, conventions, security |
| `/simplify` | After code review — checks for reuse and unnecessary complexity |
| `/commit` | Stage, commit, and push with conventional commit message |

## Pull requests: Draft vs. Ready

Open WIP as a **Draft** PR; only mark it **Ready** when the change is
self-contained, you ran the smallest local verify, and you expect CI to be
green. Full rule: [`docs/pr-policy.md`](docs/pr-policy.md).
