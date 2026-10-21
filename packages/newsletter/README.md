# @grove/newsletter

Shared newsletter opt-in capture for the Grove brands. **Odoo Email Marketing
(`mass_mailing`) is the list of record** for every Grove newsletter and Ghost
is blog-only (Josh, "option C", 2026-10-19; grove_headless GOL-3454, storefront
GOL-3456). There is one destination and one write per signup.

```
grove     → Grove Digest   (the hub)
nursery   → Nursery News   (At The Grove Nursery)
goldberry → Farm News      (Goldberry Grove)
ggg       → Grove Digest   (GGG rides the Digest)
```

## What this package does

- `createNewsletterSubscribeRoute({ brand, tenantId, allowedOrigins })` — the
  whole `POST /api/newsletter/subscribe` handler every app mounts. The brand is
  **pinned server-side**: the request body cannot pick a list of record.
- `listsFor(brand, multibrand)` — the brand's own list first, plus every other
  seeded list when the "Also send me news from the other Grove brands" box was
  ticked (spec §2). Sent to Odoo as the explicit `lists` array.
- `validateOptIn()` — affirmative-consent + email validation, unchanged.
- `createOdooNewsletterProvider()` — the Odoo adapter over
  `@grove/odoo-client`'s `newsletter.subscribe()`; never throws.
- `reportCaptureFailure()` — operator alert on any capture-route 5xx: one
  grep-able `[grove-capture] ALERT …` log line, plus a throttled post to
  `CAPTURE_ALERT_WEBHOOK_URL` when that env is set.

## Opt-in model

**Single opt-in.** Odoo adds the address to the chosen lists on submit and
sends one welcome email with a one-click unsubscribe; nobody has to click a
confirmation link. Re-submitting the same address within 24h is an idempotent
no-op (no duplicate contact, no second welcome). The submit itself is the
recorded consent, so `consent: true` is still required and the form's consent
line must be visible next to the button.

## Environment (server-only)

| Var | Required | Notes |
| --- | --- | --- |
| `ODOO_URL` (hub: `GROVE_ODOO_URL`) | yes | grove_headless base URL. Absent → `503 newsletter_not_configured` (and an alert). |
| `ODOO_API_KEY` | yes | Bearer key; the endpoint is `auth="bearer"`. |
| `CAPTURE_ALERT_WEBHOOK_URL` | no | Discord-compatible webhook for the 5xx alert. Absent → log line only. |

`GHOST_NEWSLETTER_INSTANCES` / `GHOST_URL` are no longer read.

## Request → Odoo

```
POST /api/newsletter/subscribe
{ email, name?, interests?, source?, label?, multibrand?, consent: true, attribution? }
        │ brand pinned by the route, lists = listsFor(brand, multibrand)
        ▼
POST {ODOO_URL}/grove/api/v1/newsletter/subscribe   (X-Grove-Tenant: <tenantId>)
{ email, name?, brand, interests, source, consent, lists, multibrand, attribution }
→ 200 { partner_id, lists, welcomed }
```

The per-form `label` rides inside `attribution.form` so the chatter note on the
partner still says which form the signup came from.

## Not this package

- Consult / wholesale / farm-visit / state-waitlist requests → `/api/leads`
  (`@grove/checkout/server`, CRM leads). Back-in-stock → `/api/notify/restock`.
- The department "coming soon" waitlist → `/api/leads?kind=dept_waitlist&dept=…`
  (spec §8: a tag on the partner, never a list membership).
- Legacy Ghost subscriber import: one-time, Josh-gated, grove_headless §9.
