# Grove Sites — Frontend Monorepo

Next.js 15 App Router monorepo (pnpm + Turborepo) for the Gather at the Grove ecosystem.

## Architecture

| App | Domain | Company |
|-----|--------|---------|
| `apps/hub` | gatheringatthegrove.com | Shared hub |
| `apps/goldberry` | goldberrygrove.farm | Goldberry Grove Farm |
| `apps/ggg` | woodworkingeorge.com | George George George Woodworking, LLC |
| `apps/nursery` | atthegrovenursery.com | At The Grove Nursery, LLC |

| Package | Purpose |
|---------|---------|
| `packages/odoo-client` | Typed Odoo 19 API client (products, cart, orders) |
| `packages/ghost-client` | Typed Ghost Content API client (posts, pages) |
| `packages/ui` | Shared React components |
| `packages/config` | Shared config (ESLint, TypeScript) |
| `packages/analytics` | Shared analytics helpers |

## Backend Integration

- **Odoo** (`grove_headless` module) — REST API at `/grove/api/v1/*` for e-commerce, inventory, CRM
- **Ghost CMS** — Content API for `/blog` pages, one instance per tenant
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
- All API responses cached in KeyDB via BFF (see TTL strategy in implementation plan)

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
