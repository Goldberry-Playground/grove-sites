# Pickup / Shipped Format Gate + Fall/Spring Pre-order Waves (Train 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every bareroot purchase becomes a $10 pre-order for a customer-chosen Fall or Spring wave (gated by the zone's order deadline), potted stock sells as Potted (pickup) or Peat & bagged (shipped) only through Oct 15, and the backend enforces all of it.

**Architecture:** Backend first (grove-odoo-modules `grove_headless`): a pure `preorder_waves()` calendar function, a stored `sale.order.grove_ship_wave`, checkout validation (wave open for zone, potted only in season), and a new deposit trigger "pre-order line with a wave". Storefront second (grove-sites): odoo-client types, a `wave` on cart lines sent as order-level `ship_wave`, and the PDP pre-order card with the Fall/Spring toggle built on the hotfix's method gate. Odoo keeps the existing Bareroot/Potted Format variants as two SKUs over ONE shared pool (`grove_shared_pool_qty`, GOL-2031), so no variant migration this train.

**Tech Stack:** Odoo 19 Python (pytest pure-module tests + Odoo `--test-tags`), Next.js 15 / TypeScript / vitest / Playwright.

**Spec:** Josh's rulings 2026-10-07 (memory `nursery-format-gate-pickup-vs-shipped`); vault `Software/Grove Peat and Bagged Shipping.md`; vault `Software/Grove Shipping.md` (calendar = Arbor Day tables, already in `WAVE_SCHEDULE`). Prerequisite: hotfix plan `2026-10-07-pdp-pickup-shipped-hotfix.md` merged.

## Global Constraints

- Potted / Peat & bagged sell only inside `LEAFED_WINDOW` (May 1 to Oct 15, inclusive), charged in full, never a deposit.
- Bareroot is always a pre-order: flat $10 deposit per ORDER (`PREORDER_DEPOSIT = 10.00`), balance at ship (ship) or at collection (pickup). Applies before and after Oct 15, in stock or not.
- Pre-order waves open Sep 1 for BOTH Fall and Spring. A wave is selectable until that zone's `order_by` (inclusive); after it, it is shown greyed. Spring stays selectable through the spring `order_by`; after that, nothing bareroot until Sep 1.
- Ship orders use the destination USDA zone; pickup orders use the farm zone from `grove_headless.farm_pickup_zip` (26651, zone 6).
- No late bundling past an order deadline.
- Server never trusts the client: wave/zone/date/potted-season are re-validated in `_create_draft_order` and `checkout_quote`.
- Copy: no em dashes, sentence case. Pickup pre-order subline: "$10 deposit today · pick up, we will call you to schedule".
- Ship via Train 3 (freeze Fri 2026-10-16, up Mon 10-19, promote Wed 10-21). gom and grove-sites PRs promote together; gom first.
- Never `git stash`; ignore " 2" iCloud duplicates; prod applies `-target`ed.

## Open decisions (resolve before Task B2; recommendation in bold)

1. **Wave granularity: one wave per ORDER.** The cart lines carry a wave; checkout sends one `ship_wave`. If lines disagree, checkout asks the shopper to pick one. (Alternative, per-line waves, means split shipments and split settlement; not this train.)
2. **Keep Bareroot + Potted variants as two SKUs on one pool** (no Odoo variant collapse this train). Josh's "Odoo just potted" holds at the stock level via `grove_shared_pool_qty`. Data task D1 fixes the products that break the pairing.
3. **Window Oct 7 to Oct 21:** from Oct 16 until Train 3 promotes, prod runs the hotfix + current GOL-2233 rule (after the cutover every bareroot order takes the deposit and ships in the zone's auto-resolved wave). Acceptable, or pull B1 to B3 into a gom hotfix before Oct 16?

## File map

**grove-odoo-modules** (`grove_headless/`)

| File | Change |
|---|---|
| `models/shipping_calendar.py` | Add `PREORDER_WAVES_OPEN = (9, 1)`, `preorder_waves(zone, today, calendar=None)`; serialize waves in `serialize_resolved` |
| `models/sale_order.py` | Add `grove_ship_wave` Selection (`fall`/`spring`), readonly |
| `controllers/main.py` | `_create_draft_order`: parse/validate `ship_wave`, potted-season gate; `_deposit_reason_for_lines`: `"preorder"` trigger; `checkout_quote` accepts `ship_wave`; `_preorder_ship_season` reads the stored wave |
| `models/sale_order.py` `_grove_pack_for_label` | Hold pre-order lines until the stored wave's ship window |
| `tests/test_preorder_waves.py` | **Create** (pure) |
| `tests/test_checkout_ship_wave.py` | **Create** (Odoo) |
| `tests/test_checkout_quote.py`, `tests/test_stripe_checkout.py` | Update deposit expectations |
| `__manifest__.py` | Version bump (new field) |

**grove-sites**

| File | Change |
|---|---|
| `packages/odoo-client/src/types.ts` | `ShipWave`, `PreorderWave`, `ship_wave` on quote/session/order inputs, `waves` on resolved calendar |
| `packages/odoo-client/src/client.ts` | Pass `ship_wave` through |
| `packages/checkout/src/cart-reducer.ts` | `CartItem.wave?: ShipWave`; validate; merge rule |
| `packages/checkout/src/api/validation.ts` | Validate `shipWave` |
| `packages/checkout/src/components/CheckoutPage.tsx` | Derive/ask order wave; send `shipWave`; quote with wave |
| `apps/nursery/lib/preorder-waves.ts` | **Create.** Client mirror of `preorder_waves` for display |
| `apps/nursery/app/shop/[id]/product-view.tsx` | Pre-order card with zone selector + Fall/Spring toggle; both options Sep 1 to Oct 15 |
| `apps/nursery/lib/fulfillment-method.ts` | Pickup shows Potted AND pre-order Sep 1 to Oct 15 |
| `apps/nursery/lib/fulfillment-mode.ts` | Retire the single auto-resolved bareroot mode on the PDP (keep exports used by homepage Field Notes) |

---

## Part B: Backend (grove-odoo-modules)

Work in a fresh worktree off `origin/main` (fetch over HTTPS; SSH agent signing fails on this Mac):

```bash
git -C grove-odoo-modules fetch https://github.com/Goldberry-Playground/grove-odoo-modules.git main:refs/remotes/origin/main
git -C grove-odoo-modules worktree add ../gom-preorder-waves -b feat/preorder-waves origin/main
```

### Task B1: `preorder_waves()` calendar function

**Files:**
- Modify: `grove_headless/models/shipping_calendar.py` (after `resolve_fulfillment`, ~`:533`)
- Test: `grove_headless/tests/test_preorder_waves.py`

**Interfaces:**
- Consumes: `default_calendar()`, calendar dict shape `{"zones": {"6": {"fall": [[m,d],[m,d]], "spring": ..., "fall_order_deadline": [m,d], "spring_order_deadline": [m,d]}}}`.
- Produces: `PREORDER_WAVES_OPEN: tuple[int, int] = (9, 1)`; `preorder_waves(zone: int, today: datetime.date, calendar: dict | None = None) -> list[dict]` returning, in order fall then spring, `{"wave": "fall"|"spring", "ship_window": [[m,d],[m,d]], "order_by": [m,d], "open": bool, "reason": None|"opens_sep_1"|"deadline_passed"}`.

- [ ] **Step 1: Write the failing tests**

```python
import datetime as dt

from conftest import load_module  # match the loader the sibling pure tests use

cal = load_module("grove_headless/models/shipping_calendar.py")


def waves(zone, m, d):
    return {w["wave"]: w for w in cal.preorder_waves(zone, dt.date(2026, m, d))}


def test_both_waves_open_from_sep_1():
    w = waves(8, 9, 1)
    assert w["fall"]["open"] and w["spring"]["open"]
    assert w["fall"]["order_by"] == [11, 21]
    assert w["spring"]["order_by"] == [4, 16]


def test_closed_before_sep_1_in_summer():
    w = waves(6, 8, 31)
    assert not w["fall"]["open"] and w["fall"]["reason"] == "opens_sep_1"
    assert not w["spring"]["open"] and w["spring"]["reason"] == "opens_sep_1"


def test_fall_greys_after_zone_order_by_inclusive():
    assert waves(8, 11, 21)["fall"]["open"]
    w = waves(8, 11, 22)
    assert not w["fall"]["open"] and w["fall"]["reason"] == "deadline_passed"
    assert w["spring"]["open"]


def test_spring_open_through_new_year_until_its_order_by():
    assert waves(8, 1, 10)["spring"]["open"]
    assert waves(8, 4, 16)["spring"]["open"]
    w = waves(8, 4, 17)
    assert not w["spring"]["open"] and w["spring"]["reason"] == "deadline_passed"


def test_fall_closed_in_spring_months():
    w = waves(6, 3, 1)
    assert not w["fall"]["open"] and w["fall"]["reason"] == "opens_sep_1"
```

(Open `tests/test_shipping_calendar.py` first and copy its exact module-loading lines instead of `load_module` if they differ.)

- [ ] **Step 2: Run to verify failure**

Run: `python3 -m pytest grove_headless/tests/test_preorder_waves.py -v`
Expected: FAIL, `AttributeError: ... has no attribute 'preorder_waves'`.

- [ ] **Step 3: Implement**

```python
# Josh 2026-10-07: both pre-order waves open Sep 1; each closes at the zone's
# order-by (inclusive). No late bundling past a deadline.
PREORDER_WAVES_OPEN = (9, 1)


def _md(value):
    return (int(value[0]), int(value[1]))


def preorder_waves(zone, today, calendar=None):
    """Fall + spring pre-order availability for one USDA zone on `today`.

    The fall wave is sold from Sep 1 to the zone's fall order-by. The spring
    wave is sold from Sep 1 through Dec 31 and Jan 1 to the zone's spring
    order-by. Outside those spans the wave is returned closed with a reason so
    the storefront can grey it out instead of hiding it.
    """
    calendar = calendar or default_calendar()
    z = calendar["zones"][str(zone)]
    t = (today.month, today.day)
    fall_by = _md(z["fall_order_deadline"])
    spring_by = _md(z["spring_order_deadline"])

    def entry(wave, window, order_by, open_, reason):
        return {
            "wave": wave,
            "ship_window": [list(_md(window[0])), list(_md(window[1]))],
            "order_by": list(order_by),
            "open": open_,
            "reason": None if open_ else reason,
        }

    if t >= PREORDER_WAVES_OPEN:
        fall_open, fall_reason = t <= fall_by, "deadline_passed"
    else:
        fall_open, fall_reason = False, "opens_sep_1"

    spring_open = t >= PREORDER_WAVES_OPEN or t <= spring_by
    # Closed spring: name the deadline that just passed through June, then point
    # at the Sep 1 reopening for the rest of the summer.
    spring_reason = "deadline_passed" if t <= (6, 30) else "opens_sep_1"
    return [
        entry("fall", z["fall"], fall_by, fall_open, fall_reason),
        entry("spring", z["spring"], spring_by, spring_open, spring_reason),
    ]
```

Expected reasons: Aug 31 spring → `opens_sep_1`; Apr 17 zone 8 spring → `deadline_passed`; Mar 1 fall → `opens_sep_1`. All covered by the tests above.

- [ ] **Step 4: Add waves to the feed.** In `serialize_resolved(calendar, today)` (~`:598`), add `"waves": preorder_waves(int(zone), today, calendar)` to each zone's resolved entry. Extend `tests/test_shipping_rates_feed.py` with one assertion that `resolved["6"]["waves"][0]["wave"] == "fall"`.

- [ ] **Step 5: Run** `python3 -m pytest grove_headless/tests/test_preorder_waves.py grove_headless/tests/test_shipping_rates_feed.py grove_headless/tests/test_shipping_calendar.py -v` → PASS. `ruff check --select E,F,I --line-length 120 grove_headless && ruff format --check grove_headless`.

- [ ] **Step 6: Commit** `feat(grove_headless): preorder_waves() fall/spring availability per zone`

### Task B2: `grove_ship_wave` on the order + checkout validation

**Files:**
- Modify: `grove_headless/models/sale_order.py` (field near `grove_fulfillment` `:56`)
- Modify: `grove_headless/controllers/main.py` `_create_draft_order` (`:2875`; fulfillment parse `:3048`; store `:3342`)
- Modify: `grove_headless/__manifest__.py` (version bump)
- Test: `grove_headless/tests/test_checkout_ship_wave.py` (Odoo test, `@tagged("post_install", "-at_install")`, pattern from `test_checkout_quote.py`)

**Interfaces:**
- Consumes: B1 `preorder_waves`, `LEAFED_WINDOW`, `usda_zone_for_zip`, `_farm_pickup_zip(env)`, variant `grove_effective_shipping_tier`.
- Produces: `sale.order.grove_ship_wave` (`fields.Selection([("fall","Fall"),("spring","Spring")], readonly=True, copy=False)`); request field `ship_wave`; helper `_validate_ship_wave(env, payload, lines, fulfillment, zip_code, today) -> str | None` raising `_BadRequest(message)` (use whatever 400 mechanism `_create_draft_order` already uses at `:3048`).

Rules, in `_create_draft_order` after fulfillment is parsed:
1. `tiers = {variant.grove_effective_shipping_tier for variant in lines}`.
2. Potted gate: if `"potted"` in tiers and `today` not in `LEAFED_WINDOW` (inclusive) → 400 "Potted trees are sold through Oct 15. Choose a bareroot pre-order."
3. If `"bareroot"` in tiers: `ship_wave` required and in `{"fall","spring"}` → else 400 "Choose a fall or spring pre-order wave."
4. Zone: ship → `usda_zone_for_zip(shipping zip)`; pickup → `usda_zone_for_zip(_farm_pickup_zip(env))`. Unknown zone → 400 "We could not find a planting zone for that ZIP code."
5. The chosen wave must be `open` in `preorder_waves(zone, today, calendar)` (calendar from `_parse_calendar_override(env)`) → else 400 "The <wave> pre-order for zone <n> closed on <Mon d>. Choose spring."
6. Store `order.grove_ship_wave = ship_wave` (None when no bareroot line) next to `grove_fulfillment` at `:3342`.

- [ ] **Step 1: Failing tests** (one `def test_...` per rule): potted line on Oct 16 → 400; potted line on Oct 15 → 200; bareroot without `ship_wave` → 400; zone 8 fall on Nov 22 → 400 with "closed"; zone 8 spring on Nov 22 → 200 and `order.grove_ship_wave == "spring"`; pickup fall on Nov 22 uses zone 6 (`order_by` 11/21) → 400; potted-only order stores `grove_ship_wave` False. Freeze dates with `freezegun` if the suite already uses it, else patch the module's `fields.Date.context_today` the way `test_checkout_quote.py` pins dates.
- [ ] **Step 2: Run** the Odoo suite (CI command, `--test-tags=/grove_headless:TestCheckoutShipWave`) → FAIL.
- [ ] **Step 3: Implement** the field and the six rules above.
- [ ] **Step 4: Run** → PASS; run the full `/grove_headless` tags to catch fixtures that post bareroot lines without `ship_wave` and add `"ship_wave": "fall"` to those payload fixtures (list them in the commit body).
- [ ] **Step 5: Commit** `feat(grove_headless): stored ship wave + checkout wave/potted-season validation`

### Task B3: Deposit trigger "pre-order"

**Files:**
- Modify: `grove_headless/controllers/main.py` `_deposit_reason_for_lines` (`:3538`), `_order_takes_deposit` (`:3561`), `checkout_quote` (`:1783`)
- Test: update `tests/test_checkout_quote.py`, `tests/test_stripe_checkout.py`

**Interfaces:**
- Consumes: B2 `grove_ship_wave`.
- Produces: `_deposit_reason_for_lines(env, lines, fulfillment, today, ship_wave=None) -> None | "preorder" | "sold-out" | "off-season"`.

New predicate (replaces the body):

```python
def _deposit_reason_for_lines(env, lines, fulfillment, today, ship_wave=None):
    """GOL-2233 as amended 2026-10-07: every bareroot line is a pre-order.

    Any bareroot line with a chosen wave takes the flat deposit, ship or pickup,
    before or after the cutover, in stock or not. Legacy callers that pass no
    wave keep the original sold-out / off-season rule.
    """
    has_bareroot = False
    for product, qty in lines:
        bareroot, sold_out, _free = _line_sold_out(product, qty)
        if not bareroot:
            continue
        has_bareroot = True
        if ship_wave:
            return "preorder"
        if sold_out:
            return "sold-out"
    if not has_bareroot or not _after_deposit_cutover(env, today) or fulfillment == "pickup":
        return None
    return "off-season"
```

`_order_takes_deposit(order, today=None)` passes `ship_wave=order.grove_ship_wave or None`. `checkout_quote` reads `payload.get("ship_wave")` and passes it; response gains `"ship_wave"`.

- [ ] **Step 1: Failing tests:** in-stock bareroot, Oct 7, ship, `ship_wave="fall"` → reason `"preorder"`, `amount_due_today == 10.0`; same with pickup → `"preorder"`; potted only → `None`; legacy no-wave cases unchanged (existing tests stay green).
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: Run full `/grove_headless` → PASS.**
- [ ] **Step 5:** Confirm pickup settlement charges the balance at collection: `_grove_mark_collected_and_settle` (`sale_order.py:418`) must run for `deposit_paid` pickup orders; add a test if `test_pickup_settlement.py` does not already cover a deposit order.
- [ ] **Step 6: Commit** `feat(grove_headless): every bareroot pre-order takes the flat $10 deposit`

### Task B4: Use the stored wave downstream

**Files:**
- Modify: `controllers/main.py` `_preorder_ship_season` (`:4378`) → `return order.grove_ship_wave or <existing recompute>`
- Modify: `models/sale_order.py` `_grove_pack_for_label` (`:674`, hold at `:786-794`) → a pre-order line is held until `today` is inside the stored wave's `ship_window` for `order.grove_usda_zone`; keep the `wave_assigned` stage rule.
- Test: `tests/test_preorder_email.py`, `tests/test_preorder_label_skip.py`, `tests/test_ship_wave_hand_label.py`

- [ ] **Step 1: Failing tests:** an order placed Oct 7 with `grove_ship_wave="spring"` (zone 6) is held on Nov 15 (inside the FALL window); email wording says "this spring".
- [ ] **Step 2-4:** Run → FAIL, implement, run full suite → PASS.
- [ ] **Step 5: Commit** `feat(grove_headless): label gate and pre-order email follow the chosen wave`

### Task B5: Open the gom PR

- [ ] Push, open PR `feat(grove_headless): fall/spring pre-order waves + always-preorder bareroot (Train 3)`; link this plan; mark Ready only after CI green; label for Train 3. Josh merges (protected paths).

---

## Part F: Storefront (grove-sites)

Worktree off `origin/main` after the hotfix PR merges: `git worktree add ../grove-sites-preorder-waves -b feat/preorder-waves origin/main`.

### Task F1: odoo-client types and pass-through

**Files:** `packages/odoo-client/src/types.ts`, `packages/odoo-client/src/client.ts`, tests beside them.

**Produces:**

```ts
export type ShipWave = "fall" | "spring";
export interface PreorderWave {
  wave: ShipWave;
  ship_window: [MonthDay, MonthDay];
  order_by: MonthDay;
  open: boolean;
  reason: null | "opens_sep_1" | "deadline_passed";
}
```

Add `ship_wave?: ShipWave | null` to `OrderCreateInput` (`:839`), `CheckoutSessionInput` (`:903`) and the quote input; add `waves?: PreorderWave[]` to the resolved-calendar zone type; quote response gains `ship_wave` and `deposit_reason: "preorder"`. `client.ts:379-401` forwards `ship_wave`.

- [ ] Failing test in `client.test.ts`: `createSession({... shipWave: "spring"})` posts `ship_wave: "spring"`. Run → FAIL. Implement. Run `pnpm vitest run packages/odoo-client` → PASS. Commit `feat(odoo-client): ship_wave + preorder waves types`.

### Task F2: Cart line wave + checkout sends `ship_wave`

**Files:** `packages/checkout/src/cart-reducer.ts` (`:5-36`), `cart-reducer.test.ts`, `packages/checkout/src/api/validation.ts` (`:97-167`), `packages/checkout/src/components/CheckoutPage.tsx` (`:120-205`), `CheckoutPage.test.tsx`.

**Produces:** `CartItem.wave?: ShipWave`; `orderWave(items: CartItem[]): { wave: ShipWave | null; conflict: boolean }` exported from `cart-reducer.ts`.

Rules:
- `addItem` with an existing `variantId` and a different `wave` replaces the wave (latest choice wins) and sums quantity.
- `validateCartItems` drops a line whose `wave` is present but not `"fall"|"spring"`.
- `orderWave`: unique waves across lines; one → that wave; zero → null; several → `{wave: null, conflict: true}`.
- `CheckoutPage`: when `conflict`, render a required radio "Which pre-order wave?" (Fall / Spring) above payment; disable submit until chosen. Send `shipWave` in the session body and the quote (`useCartDepositQuote`) and the promo preview.
- `validation.ts`: `shipWave` optional, must be `"fall"|"spring"` when present.

- [ ] TDD each rule (reducer unit tests first, then a `CheckoutPage.test.tsx` case for the conflict radio and the posted body). Commit `feat(checkout): carry the pre-order wave from cart to checkout`.

### Task F3: PDP pre-order card with zone selector and wave toggle

**Files:** `apps/nursery/lib/preorder-waves.ts` (+ test), `apps/nursery/lib/fulfillment-method.ts` (+ test), `apps/nursery/app/shop/[id]/product-view.tsx`, `product-view.copy.test.ts`, `packages/checkout/src/components/AddToCartButton.tsx` and `StickyAddToCartBar.tsx` (accept and pass `wave`).

**Interfaces:**
- `preorderWaves(zone: number, date: Date, calendar: ShippingCalendar): PreorderWave[]`: prefer the feed's `calendar.resolved[zone].waves` when present, else a TS port of B1 (same rules; port B1's tests verbatim to vitest).
- `formatsForMethod` change: in the potted season AND on/after Sep 1, pickup returns potted formats followed by bareroot formats; ship returns the potted-labelled-peat format followed by bareroot. Before Sep 1, unchanged from the hotfix. After Oct 15, potted formats are excluded for both methods.
- `FARM_ZONE = 6` fallback when the feed lacks `farm_zone`.

UI (matches mockup v4):
- Shipped: "Your USDA zone" select (zones from the feed), always visible, persisted in localStorage `grove:usda-zone`.
- Bareroot pre-order card: two wave buttons "Fall wave" / "Spring wave" (pickup: "Fall pickup" / "Spring pickup"), each with "Approx <Mon d> to <Mon d>" and "Order by <Mon d>"; closed waves render greyed with `aria-disabled` and the reason ("Order-by passed" / "Opens Sep 1").
- Subline: ship "$10 deposit today · balance when it ships"; pickup "$10 deposit today · pick up, we will call you to schedule". CTA "Pre-order for $10".
- When no wave is open, the card shows greyed and the CTA is unavailable; potted/peat card still offered in season.
- Add-to-cart passes `wave` for the bareroot card.

- [ ] TDD the helpers; source-text test the copy; browser-verify with `preview_start` at simulated dates by overriding `Date` in `javascript_tool` only for inspection (Aug 31, Sep 1, Oct 15, Oct 16, Nov 22 zone 8, Apr 17 zone 8). Commit `feat(nursery): fall/spring pre-order waves on the PDP`.

### Task F4: Retire the auto-resolved bareroot mode on the PDP

**Files:** `product-view.tsx`, `lib/fulfillment-mode.ts`, tests.

- [ ] Remove `shipMode`/`selectedShipMode`/`barerootNote` usage from the PDP (the wave card owns that copy). Keep `resolveShippableMode`, `zoneShipNote`, `depositByDate` exports used by the homepage (`git grep -n` each before deleting anything). Update `fulfillment-mode.ts` header comment to point at the 2026-10-07 ruling. Run `pnpm test`, `pnpm turbo run type-check lint`. Commit `refactor(nursery): PDP bareroot copy comes from the chosen wave`.

### Task F5: E2E + PR

- [ ] Extend `apps/nursery/e2e/checkout-pickup-only-and-exempt.spec.ts` and add `e2e/preorder-waves.spec.ts`: pickup potted → checkout locked to pickup; ship pre-order spring → session body has `ship_wave: "spring"`, deposit line $10. Run `pnpm --filter nursery test:e2e`.
- [ ] Open grove-sites PR `feat(nursery): pickup/shipped gate + fall/spring pre-order waves (Train 3)`; Draft until gom PR is merged to QA; promote together.

---

## Part D: Odoo data (Josh, or this session once Odoo writes are permitted)

### Task D1: Pairing and season data

- [ ] Every published plant template has both a Bareroot and a Potted variant per cultivar/rootstock so the shared pool works. Known gaps: #93 American Chestnut and #130 White Oak (potted only, no Format axis): add the Format attribute with Bareroot + Potted.
- [ ] Chestnut Hybrid #8 shows Bareroot 102 vs Potted 51 on the storefront; with a shared pool these should match. Inspect `stock.quant` for both variants and consolidate onto the Potted variant.
- [ ] Verify sysparam `grove_headless.shipping_calendar` does not override `leafed_window` away from May 1 to Oct 15.
- [ ] After D1, re-run the catalog audit script from this session (`$TMPDIR/pv.py` pattern) and confirm every listing shows paired formats.

## Verification before promote (Train 3 QA gate)

- [ ] QA: Persimmon, zone 8, ship, Oct 16 simulated: only pre-order, fall + spring open; Nov 22: fall greyed.
- [ ] QA: pickup pre-order charges $10, balance at collection.
- [ ] QA: direct API post of a potted line on Oct 16 → 400.
- [ ] QA: direct API post of a fall wave past order-by → 400.
