# Stripe Integration — Design Spec

**Date:** 2026-07-17 · **Status:** Draft for Josh's review · **Expands:** STOREFRONT-SPEC decisions 4/5/8 ("Stripe next phase", $10 deposit, mixed-cart split) and the Production Launch commerce plan (hosted Checkout, webhook-confirmed orders, oversell guard). Companion to `2026-07-13-nursery-product-pages-design.md` (v2 of its phasing).

## Scope

Full charging model for the Grove storefronts: pay-today checkout, preorder deposits with off-session balance capture, shipping charges from the zone-rate engine, and tax collection. QA runs everything in **Stripe sandbox (test mode)** first; live keys are gated (see Gates).

## The charging matrix (what is charged, when)

| Cart contents | Charged at checkout (Stripe hosted Checkout) | Charged later |
|---|---|---|
| In-stock only | Products + shipping (chosen rate) + WV tax — full amount | — |
| Preorder only | **$10 flat deposit** (per order, applied toward total — not a fee) + $0 shipping/tax now | Balance (products + shipping + tax − $10) **off-session** at confirmed shipping |
| Mixed | In-stock full amount + $10 deposit, one session, one confirmation | Preorder balance as above |

Server-side the order-create API already splits mixed carts into an in-stock order + a `Preorder` order (STOREFRONT-SPEC #8); the Checkout Session's metadata carries **both** Odoo order refs so the webhook confirms both.

## Architecture (one flow, three phases of money)

```
grove-sites checkout page
  → BFF /api/checkout → grove_headless POST /grove/api/v1/checkout/session
      1. validate cart + stock (oversell pre-check)
      2. price via Odoo: lines + zone-rate shipping + WV taxes  ← Odoo is the calculator
      3. create draft sale.order(s) (auto-cancel after 24h if unpaid)
      4. stripe.checkout.Session.create(...)  ← server key, never in frontend
  → customer pays on Stripe's hosted page
  → Stripe webhook checkout.session.completed → /grove/api/v1/stripe/webhook
      confirm order(s); oversell RE-check (auto-cancel + refund + apology email
      + Discord if stock vanished mid-payment); Discord order ping (non-blocking)
  → [preorders] at confirmed shipping: PaymentIntent off_session with the saved
      payment method for the balance; on card failure → hold shipment, Mailgun
      dunning email + Discord alert, retry 3× over 7 days
```

**Key Stripe primitives:** hosted Checkout Session (mode `payment`) · `setup_future_usage: "off_session"` on sessions containing preorders (saves the card for balance capture, with the mandate language Stripe auto-displays) · PaymentIntent (off-session) for balances · Refund API for the oversell guard · webhook signature verification.

## Shipping charges

- The **zone-rate engine stays the calculator** (`/grove/api/v1/shipping/options`, per-tree tier rates; bareroot 4 lb / potted ~25 lb — variant-level tier per catalog API v1). The customer picks the option in OUR checkout page before redirect; it becomes a dedicated line item in the Session ("Shipping — Zone 3, 2 trees").
- Do **not** use Stripe's dynamic shipping-rate callbacks (adds a webhook round-trip for a number we already computed).
- `shipping_address_collection` restricted to US; address collected in our checkout (we need it for rates *before* session creation) and passed to Stripe as prefill; the compliance gate (21 green states) rejects before a session is ever created.
- Free local pickup stays a fulfillment choice pre-redirect: pickup orders simply have no shipping line.

## Taxes

- **Odoo computes; Stripe records.** The WV pair (6% state + 1% municipal, per-company defaults with regression tests) prices every taxable line; the Session carries a single "WV Sales Tax" line item (or tax-inclusive line prices — implementation picks one and sticks to it). **Stripe Tax stays OFF** — enabling it would double-tax and move the tax system of record out of Odoo, where WV quarterly filing lives.
- Deposits: the $10 deposit is **not taxed at deposit time**; tax on the full order rides the balance capture (deposit is a prepayment, not a sale line). Balance = (products + shipping + tax) − $10.
- **Out-of-state nexus: open question for the accountant** — economic-nexus thresholds (~$100k or 200 transactions/state) are far above current volume, so v1 collects WV tax only and charges no tax on other green-state shipments. Revisit at volume; do not silently enable Stripe Tax as the "fix".

## Webhook endpoint (the security surface)

`POST /grove/api/v1/stripe/webhook` on grove_headless: signature verified with `STRIPE_WEBHOOK_SECRET` (reject early, before any parsing); **idempotent by Stripe event id** (dedupe table — Stripe redelivers); Cloudflare path exemption per the established Paperclip webhook pattern; handles `checkout.session.completed`, `checkout.session.expired` (release draft order + stock hold), `payment_intent.succeeded` / `payment_intent.payment_failed` (balance captures). Discord notification is fire-and-forget — checkout must never fail on Discord.

Odoo-side bookkeeping: a `payment.provider` Stripe record (test/live per env) + `payment.transaction` rows per charge, so payments reconcile in Odoo accounting without adopting Odoo's own JS checkout.

## Config & secrets

Per environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (droplet env via TF), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (App Platform env). **QA = test-mode keys.** Storage: 1Password `Grove Infra` fields (`stripe_test_secret_key`, `stripe_test_webhook_secret`, `stripe_test_publishable_key`, later `stripe_live_*`) → `.env.op` → TF — never Infisical (being retired, #202).

## Gates (blockers by phase)

1. **Sandbox/QA testing:** none — a Stripe account in test mode is enough. Statement-descriptor/entity question does NOT block sandbox.
2. **Live keys:** the open **Stripe entity decision** (one account with per-brand statement descriptors vs per-LLC accounts — affects bookkeeping; vault Production Launch open question) + Mailgun transactional email live (GOL-244/245, needed for receipts/dunning) + the prod launch checklist item "Stripe live keys + webhook verified".

## Implementation phases (each gets its own TDD plan)

- **S1 — Backend (grove_headless):** checkout-session endpoint (validate → price → draft order → session), webhook endpoint (signature, idempotency, confirm/expire/oversell-refund), payment.transaction bookkeeping. Pure-python payload builders tested under pytest (repo pattern); webhook flows tested with Stripe CLI fixtures.
- **S2 — Frontend (grove-sites):** checkout page collects address + fulfillment + shows zone rates → POST BFF → redirect to Stripe; success/cancel pages off session_id; mixed-cart "pay today / due at shipping" breakdown UI (STOREFRONT-SPEC cart grouping).
- **S3 — Balance capture ops:** "capture balance" action at confirmed-shipping (Odoo server action or shipping-flow hook), off-session PaymentIntent, retry/dunning (Mailgun) + Discord alerts, preorder-cap bookkeeping.
- **S4 — Hardening:** oversell auto-refund E2E, `checkout.session.expired` stock release, nightly synthetic checkout against QA (test card, per the observability plan), refund runbook.

## QA release train (what "release to QA" means, both tracks)

| Item | Mechanism |
|---|---|
| Catalog API v1 (Plan 1, in flight) | Merge → git-sync delivers in ~60 s → **manual module upgrade on QA droplet**: `docker exec grove-odoo-1 odoo -d odoo -u grove_headless --stop-after-init` + restart odoo container |
| Facts/tags backfill for the 22 live products | With Plan 2 seed rework (script sets facts + tags + website categories for existing templates too) |
| Nursery pages (Plan 3) | grove-sites CI → GHCR → App Platform auto-deploy (`deploy_on_push`) |
| Stripe sandbox (S1+S2) | Same two paths + one-time: create test-mode webhook endpoint in Stripe dashboard pointing at `https://odoo.qa.gatheringatthegrove.com/grove/api/v1/stripe/webhook`, put test keys in 1P → `.env.op` → QA TF apply (droplet env change = droplet replace — schedule it) |
| QA test pass | Test cards incl. 3DS challenge card; mixed-cart scenario; preorder deposit + simulated balance capture; oversell path (buy same last unit twice) |

## Non-goals

Stripe Tax · subscriptions/memberships · Stripe-hosted customer portal · per-brand Stripe accounts before the entity decision · POS/Terminal (Square stays in-person for now — one payment stack per channel until the entity question resolves).
