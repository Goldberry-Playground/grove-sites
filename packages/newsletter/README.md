# @grove/newsletter

Shared opt-in capture for the Grove brand family. **Ghost-native** per the
GOL-245 decision (drop MailerLite): each brand's own Ghost instance is that
brand's **list of record**. Signups POST a Ghost member (the
`data-members-email` / `send-magic-link` pattern), so Ghost owns confirmation
(double opt-in via magic link), the member database, and segmentation labels —
no external ESP audience, no CSV export/import.

```
grove     → Gathering at the Grove (the hub)   The Grove Digest
nursery   → At the Grove Nursery
goldberry → Goldberry Grove (the farm)
ggg       → (deferred) rides the hub Digest → maps to the `grove` instance
```

## What this package does

- `NewsletterProvider` seam + a Ghost adapter (`createGhostNewsletterProvider`)
  that POSTs a member to `{ghostUrl}/members/api/send-magic-link/`.
- **Dual-write**: on an explicit hub opt-in ("Also get news from Gathering at
  the Grove"), the member is written to BOTH the brand instance and the hub
  (`grove`) instance. Explicit consent, best-effort — a hub failure never costs
  the brand subscription.
- **Per-form Ghost labels** applied at signup for segmentation (`labelsFor`):
  the per-form label (or a `<brand>-<source>` fallback) plus one
  `interest-<name>` label per interest.
- `captureOptIn()` orchestrator + `ghostCaptureDeps()` factory (wires the brand
  provider and, for tenant brands, the hub provider).
- `validateOptIn()`: affirmative-consent + email validation.

Capture surfaces (newsletter signup, checkout opt-in, notify-me) POST to a thin
BFF route that calls `resolveGhostConfig` → `ghostCaptureDeps` → `captureOptIn`.
Reference route: `apps/hub/app/api/newsletter/subscribe/route.ts`.

## Double opt-in & the transactional-SMTP dependency

`send-magic-link` is inherently double opt-in: Ghost creates the member
(unconfirmed) and emails a magic link the visitor must click. The **POST here
succeeds regardless** of whether that email actually sends — so this package is
not blocked on SMTP — but a subscriber only *confirms* once each instance's
**transactional SMTP** is wired (see the Email Systems doc and the transactional
SMTP task). Coordinate ordering: capture can ship first; confirmations light up
when SMTP lands.

## Environment (server-only)

| Var | Required | Notes |
| --- | --- | --- |
| `GHOST_NEWSLETTER_INSTANCES` | yes* | JSON map of sender → instance. Absent (and no `GHOST_URL`) → feature off; routes return `503 newsletter_not_configured`. |
| `GHOST_URL` | fallback | A bare `GHOST_URL` is read as the `grove` (hub) instance, so a single-tenant app works without the map. Dual-write needs the map. |

```json
// GHOST_NEWSLETTER_INSTANCES
{
  "grove":     { "url": "https://blog.gatheringatthegrove.com" },
  "nursery":   { "url": "https://blog.atthegrovenursery.com", "newsletters": ["<newsletter-id>"] },
  "goldberry": { "url": "https://blog.goldberrygrove.farm" }
}
```

`newsletters` is optional per instance — omit to let Ghost apply the instance's
default newsletter(s). No API key is needed: `send-magic-link` is Ghost's public
members endpoint.

## Handoff — what CMO / provisioning still owns

1. **Ghost instance URLs** for the three senders → `GHOST_NEWSLETTER_INSTANCES`
   (per-env secret). Post-cutover these are the `blog.{domain}` origins.
2. **Transactional SMTP** on each instance so magic-link / welcome emails
   actually send (blocks confirmation, not capture).
3. **Labels & newsletters** (optional): pre-create the segmentation labels and,
   if targeting a specific newsletter, grab its id for the map.
4. **CRM retirement (GOL-221):** Ghost is the list of record; the
   `grove_headless` newsletter CRM endpoint is no longer the target. Order
   attribution, if needed later, is a separate concern — not part of capture.
