# @grove/planner

The order-builder planning engine. `plan()` is a pure function: it takes the
quiz answers (ZIP or state, site, track, size, timing) and the planner catalog
feed from Odoo, and returns a planned order with lines, substitutions, a
bundle offer and a status. It does no I/O, so the same inputs always give the
same plan.

Used by the nursery `/plan` page (`apps/nursery/app/plan`). The spec is the
order-builder spec (grove-odoo-modules#354, §C).

## Modules

| File | What it does |
|------|--------------|
| `plan.ts` | `plan`, `score`, `eligible`, `explain`. Filters the catalog, scores candidates and fills slots. Only `bareroot` and `potted` tiers ship (`SHIPPABLE_TIERS`). Sets the `consult` flag (shows the "Talk it through first" link) when the subtotal is at least `CONSULT_SUBTOTAL` ($500), the track is agro, or the plan is partial. |
| `zone.ts` | `zoneFit`: safe, marginal (one zone out) or excluded. Plants with no zone facts are never recommended. |
| `slots.ts` | Slot templates per track (`FOOD_FOREST_SLOTS`, `AGRO_SLOTS`, `DEER_SLOTS`) and deer-season logic. |
| `suggested.ts` | The suggested list, grouped by stratum, plus the manual lines a shopper adds. |
| `bundle.ts` | Matches a plan to a catalog bundle and applies it. |
| `rules.ts` | Tunable scoring rules (`DEFAULT_RULES`, `resolveRules`). |
| `url.ts` | Reads and writes the `/plan?zip=…&site=…&track=…` query params. Every answer lives in the URL so a result can be shared. |
| `handoff.ts` | `buildPlanHandoff`: the `plan` object a cart line carries to Odoo (`grove_planner_plan`). |
| `fixtures.ts` | Test catalog, exported as `@grove/planner/fixtures`. |

## Tests

Tests sit next to the code (`*.test.ts`) and run with the root Vitest config:

```bash
pnpm test packages/planner
```
