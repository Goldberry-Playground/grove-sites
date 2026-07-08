# Grove QA Portal — Slice 1: Component-Harness Walking Skeleton

**Status:** Approved design (brainstorming) — ready for implementation plan
**Date:** 2026-06-29
**Repo:** `grove-sites` (implementation on its own feature branch)
**Part of:** the 5-subsystem Grove QA Portal platform — **this spec is slice 1 of 5**

---

## 1. Context

Some Grove stakeholders are distrustful of AI but their feedback is still wanted. The design-system review currently happens in **claude.ai/design**, which reads as "an AI thing." Separately, the **Design→Release Flow** has a fragile manual step: design-system fixes don't reach prod without hand-mirroring.

This platform gives Grove a **self-hosted, white-labeled QA surface** that collects human feedback on a Grove-branded tool and turns it — via an **invisible (backstage) AI pass** — into approved, Paperclip-ready GitHub issues. "White-label" is a **presentation boundary** (no AI-branded surface shown to testers), not an AI ban: AI does the heavy lifting behind the submit button.

The kit bundle is already **Next-free and esbuild-bundled with React vendored in** (the decoupling done for `/design-sync`), so the exact same artifact that feeds claude.ai/design can be self-hosted with no dependency on it. We pay the hard cost once; the portal is a shell + feedback layer on top of bytes we already produce.

## 2. The platform decomposition (context for this slice)

| | Subsystem | Depends on |
|---|---|---|
| **A** | White-label render shell (gallery + a11y/responsive rail) | the kit bundle (exists) |
| **B** | In-qa-app feedback widget (live qa sites, ties to RUM session) | qa apps + RUM/session-replay (designed, **not built**) |
| **C** | Guided UAT / scenarios | B + qa apps |
| **D** | AI-backstage triage (dedup, severity, route, synthesize, draft fixes) | A/B/C |
| **E** | Portal backend/shell (hosting, white-label, auth, DB, dashboard) | — |

**This spec = Slice 1 = A + E-min + feedback capture + a single AI-triage pass that files issues.** It deliberately starts on the *component* surface (depends only on the kit bundle, which exists) rather than the live-app surface (B/C depend on the unbuilt RUM stack).

## 3. Scope

**In scope (the walking skeleton):**
- A new Next app `apps/qa-portal` in the monorepo, deployed to DO.
- Builds all 4 brand bundles at deploy (requires productionizing the design-sync converter into a committed build step).
- One portal, brand-in-route (`/goldberry`, `/ggg`, `/nursery`, `/hub`), brand switcher.
- Component gallery (iframe-per-preview) + **viewport switching** (mobile/tablet/desktop).
- A **pluggable checks registry** shipping exactly one check (viewport); axe/contrast/vision-sim register here later.
- Feedback capture per `(brand, component)` with viewport auto-tagged; gated invite link + self-reported name.
- Persistence in a dedicated `qa_portal` Postgres (DO Managed cluster) via Drizzle.
- Backstage (admin-only) triage: "Synthesize" → server-side Claude API → `IMPLEMENTATION.md`-shaped findings → one-click "File" → labeled GitHub issues on `Goldberry-Playground/grove-sites` in the **un-approved** state.

**Explicitly OUT of scope (later slices):**
- In-qa-app feedback widget (B), guided UAT scenarios (C), RUM/session-replay integration.
- Paperclip *consuming* the issue queue; the "approve-to-fix" action (gate 2) and PR review (gate 3) — the skeleton only files issues in a state that *supports* those gates.
- The full a11y rail (axe-core, contrast table, vision-sim, touch-flags) — registers into the checks surface later.
- Magic-link / real identity; pixel-pin feedback; per-viewport threads.

## 4. Architecture

- **App:** `apps/qa-portal` — Next 15 App Router, same Dockerfile/Turbo/DO-deploy pattern as the brand apps. Internal tool app (no multi-tenant routing); one app that can load any brand's bundle.
- **Bundle source:** built **at deploy** from the monorepo kit source. Requires **productionizing the `/design-sync` converter** (currently gitignored/skill-staged in `.ds-sync/`) into a committed, dependency-pinned build step the Docker build runs for all 4 brands. (This also de-fragilizes the whole design-sync flow — a clean CI can't reproduce a bundle today.)
- **Database:** first real DB in grove-sites — a dedicated **`qa_portal`** database on the existing DO Managed Postgres cluster, accessed via **Drizzle** (TS-first, typed schema + migrations), connection string via **Infisical**.
- **AI:** server-side **Claude API** (Anthropic SDK) from a backstage API route, key via Infisical. Never invoked from tester-facing code.
- **Issues:** **GitHub Issues API** against `Goldberry-Playground/grove-sites` — **fork-verified** before any write (apply the odoocker→upstream lesson: never file to a public upstream).

## 5. Modules

Each module is independently understandable (what it does / its interface / its deps):

- **Render shell** — *Renders a brand's component gallery.* Iframe-per-preview (adopted from the emitted `.review.html`), brand switcher, viewport toggle. Input: a brand's built bundle (`components/<group>/<Name>/<Name>.html`). No AI, no network beyond loading the static bundle.
- **Checks registry** — *Pluggable rail of inspection checks.* A registry where each check declares a label + a render/measure hook. Ships one check (viewport). Interface designed so axe/contrast/vision-sim register without shell changes.
- **Feedback capture** — *Collects a comment on `(brand, component)`.* Comment box; viewport auto-captured; identity = self-reported name (stored locally, attached to each comment). POSTs to the feedback API.
- **Feedback store** — *Durable feedback.* Drizzle schema + one `feedback` table; read/write via the portal's API routes.
- **Backstage triage** — *Turns raw feedback into structured findings.* Admin-only. On "Synthesize", reads accumulated feedback for a brand/round, calls the Claude API with feedback + component context, returns `IMPLEMENTATION.md`-shaped findings (deduped, severity-scored, categorized, routed kit|app, component-mapped). Stores findings; renders the batch for review.
- **Issue filer** — *Files approved findings as GitHub issues.* On one-click "File", creates labeled issues (fork-verified target) in the un-approved state. Idempotent enough to avoid dupes on re-run.

## 6. Data model

**`feedback` table (Drizzle/Postgres):**
- `id` (uuid, pk), `created_at` (timestamptz)
- `reviewer_name` (text — self-reported)
- `brand` (enum: goldberry|ggg|nursery|hub)
- `component` (text — e.g. "SiblingStrip")
- `viewport` (enum: mobile|tablet|desktop — auto-captured)
- `text` (text — the comment)
- (no manual severity/category — AI infers in triage)

**`findings` (stored triage output):** the `IMPLEMENTATION.md` shape — per finding: `title`, `severity`, `category`, `route` (kit|app), `component`, `brand`, `summary`, `source_feedback_ids` (provenance), `status` (draft|filed), `issue_url` (once filed).

**GitHub issue label taxonomy (un-approved state):** `design-qa`, `severity:{p0|p1|p2|p3}`, `brand:<brand>`, `component:<Name>`, `route:{kit|app}`. **Absence of `approved:fix` is the gate** — Paperclip's later queue filter is `open AND design-qa AND approved:fix`.

## 7. Data flow & the gate chain

```
tester (gated link, name)
   → comment on (brand, component) [+viewport]      → qa_portal.feedback (Postgres)
design lead (backstage, admin-only)
   → "Synthesize"  → Claude API  → findings (deduped, severity, kit|app, component-mapped)
   → [GATE 1] eyeball batch → "File"
        → GitHub issues  labels {design-qa, severity, brand, component, route}  — NOT approved:fix
   ───────────────────────────── later slices ─────────────────────────────
   → [GATE 2] approve:fix (label)  → Paperclip codes → opens PR (never merges)
   → [GATE 3] your PR review + qa→main promotion
```
**Three human gates, zero unattended agentic writes.** The skeleton owns everything down to the filed un-approved issue.

## 8. Key decisions (resolved in grill) + rationale

| # | Decision | Why |
|---|---|---|
| Ownership | **Hybrid** — kit owns shared cohesion layer (SiblingStrip/NavLink/CartNavLink/Button); apps own brand-distinctive | bugs map to the split; small migration; lower blast radius (platform-level, informs later slices) |
| Stack/repo | **`apps/qa-portal` in the monorepo** | same stack/deploy, consumes bundle directly, API routes cover feedback+triage |
| Bundle source | **Build at deploy + productionize the converter** | self-sufficient portal; de-fragilizes the whole design-sync flow |
| Brands | **One portal, brand-in-route** | mirrors "one kit, 4 themes"; one URL/deploy |
| Shell/rail | **Build fresh (adopt iframe-per-preview); MVP rail = viewport only; rail is a pluggable registry** | prove the loop fast; full a11y rail (b) registers later with no rework |
| Feedback model | **`(brand, component)` + viewport metadata; minimal fields; AI-inferred severity** | lowest friction; rich triage context |
| Identity | **Gated invite link + self-reported name** | not public, low-friction, no AI smell; magic-link later |
| Storage | **DO Managed Postgres + Drizzle, dedicated `qa_portal` DB** | durable on App Platform, on-path, isolated; SQLite dies on ephemeral fs; no new vendor |
| Triage | **On-demand, portal→Claude API server-side, `IMPLEMENTATION.md`-shaped output** | first-party backstage feature, reproducible, invisible to testers |
| Issues | **Auto-file labeled issues (gate 1 thin approval); un-approved state = Paperclip gate 2** | complete loop; clean queue; human authorizes before file/code/merge |

## 9. Error handling & the white-label boundary

- **Hard rule:** zero AI-branded surface in the tester UI. The Claude call is server-side, admin-only.
- Triage failure (LLM error/timeout) surfaces only in backstage; **feedback is never lost** (persisted before triage runs).
- **Bundle build failure fails the deploy** — the portal never serves a stale/broken brand silently.
- Issue-filing is **fork-checked** so the queue can't leak to a public upstream.
- Issue filing is idempotent enough that a re-run of "File" doesn't duplicate already-filed findings.

## 10. Testing

- **Vitest:** feedback API (write/read), the triage-output **schema validation** (findings shape validated like the kit's structured outputs), the issue-label mapping.
- **Playwright smoke:** load a brand gallery → switch viewport → submit a comment → it persists.
- Triage *quality* is human-judged (gate 1), not unit-tested.

## 11. MVP done-line (acceptance)

`apps/qa-portal` deploys to DO · builds all 4 brand bundles at deploy · renders each brand's 11-component gallery with viewport switching · gated link + name · comments persist to `qa_portal` Postgres with viewport metadata · backstage "Synthesize" produces `IMPLEMENTATION.md`-shaped findings via the Claude API · one-click "File" creates labeled, **un-approved** GitHub issues on grove-sites · **zero AI-branded surface for testers.**

## 12. Prerequisites / dependencies

- Productionize the `/design-sync` converter into a committed build step (blocks the deploy-time bundle build).
- Provision the `qa_portal` DB on the DO Managed cluster + connection secret in Infisical.
- A Claude API key in Infisical for the backstage triage.
- A GitHub token (scoped to grove-sites issues) in Infisical for the issue filer.
- Confirm `Goldberry-Playground/grove-sites` is the correct (non-upstream) issue target.
- Create the GitHub label taxonomy (`design-qa`, `severity:*`, `brand:*`, `component:*`, `route:*`).
- The gated invite-link mechanism (unguessable URL or shared passphrase).

## 13. Extension points (so later slices drop in cleanly)

- **Checks registry** → axe/contrast/vision-sim/touch-flags (slice "full a11y rail").
- **Issue state model** (un-approved) → the `approved:fix` gate + Paperclip consumption (Paperclip fix-loop slice).
- **Feedback ingestion** → the in-qa-app widget (B) and scenarios (C) write into the same `feedback`/triage path, later tied to RUM sessions.
- **Identity** → magic-link real identity.

## 14. Open questions / risks

- Productionizing the converter is its own non-trivial task — scope it explicitly in the plan (it may warrant being step 1 / a sub-task).
- Backstage admin auth for the design lead (distinct from tester gated-link) — keep simple (single admin), but define it.
- Claude API cost/latency on "Synthesize" — on-demand keeps it bounded; confirm model + token budget in the plan.
