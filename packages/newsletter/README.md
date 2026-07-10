# @grove/newsletter

Shared opt-in capture for the Grove brand family. Implements §6.4 of the
approved email/domain plan (GOL-205 / GOL-214): **one** MailerLite audience with
per-brand + per-interest tags, three active senders on `mail.<domain>`.

```
grove     → The Grove Digest         (mail.gatheringatthegrove.com)
nursery   → Nursery planting-season  (mail.atthegrovenursery.com)
goldberry → Goldberry from the farm  (mail.goldberrygrove.farm)
ggg       → (deferred) rides the Grove Digest
```

## What this package does

- `NewsletterProvider` seam + a `MailerLite` adapter (subscriber upsert, tags).
- `CrmSync` seam + an Odoo `grove_headless` adapter for order attribution.
- `captureOptIn()` orchestrator: newsletter is primary, CRM is best-effort.
- `validateOptIn()`: affirmative-consent + email validation.

Capture surfaces (newsletter signup, checkout opt-in, notify-me) POST to a thin
BFF route that calls `captureOptIn`. Reference route:
`apps/hub/app/api/newsletter/subscribe/route.ts`.

## Environment (server-only)

| Var | Required | Notes |
| --- | --- | --- |
| `MAILERLITE_API_KEY` | yes | Absent → feature is off; routes return `503 newsletter_not_configured` (no crash). |
| `MAILERLITE_GROUPS` | recommended | JSON map of tag → MailerLite group id. Keys: `brand:<sender>` and `interest:<interest>`. Example below. |
| `MAILERLITE_BASE_URL` | no | Defaults to `https://connect.mailerlite.com/api`. |
| `NEWSLETTER_DOUBLE_OPTIN` | no | `0` to disable double opt-in. Default on (subscribers created `unconfirmed`). |
| `GROVE_ODOO_URL`, `GROVE_ODOO_API_KEY` | no | For CRM attribution sync. |

```json
// MAILERLITE_GROUPS
{
  "brand:grove": "<group-id>",
  "brand:nursery": "<group-id>",
  "brand:goldberry": "<group-id>",
  "interest:produce": "<group-id>",
  "interest:nursery": "<group-id>",
  "interest:woodworking": "<group-id>",
  "interest:events": "<group-id>",
  "interest:farm-updates": "<group-id>"
}
```

## Handoff — what CMO / provisioning still owns (GOL-214 tasks 1–2)

This package + route are the code half. The remaining half is provisioning:

1. **MailerLite account** (free ≤1k subs). Create one shared audience + the
   brand/interest **groups**; drop their ids into `MAILERLITE_GROUPS` and the
   API key into `MAILERLITE_API_KEY` (1Password → per-env secrets).
2. **Sender identities + DNS.** For each of the 3 senders, add DNS on the
   `mail.<domain>` subdomain (Cloudflare token minted in GOL-209):
   - SPF: `TXT mail.<domain>  "v=spf1 include:_spf.mailerlite.com ~all"`
   - DKIM: the CNAME/TXT records MailerLite shows per verified sender.
   - (Optional) Return-Path / DMARC alignment per MailerLite's domain wizard.
   Verify each sender shows **authenticated** in MailerLite before first send.

## Odoo CRM endpoint contract (odoocker / grove_headless — separate follow-up)

The CRM adapter calls, best-effort:

```
POST {GROVE_ODOO_URL}/grove/api/v1/newsletter/subscribe
Headers: X-Grove-Tenant, Authorization: Bearer <key>
Body: { email, name, brand, interests[], source, consent, attribution{} }
→ 200 { partner_id | lead_id }
```

grove_headless should upsert a `mailing.contact` / `res.partner` and tag it with
the brand + interests so orders can be attributed. Until that endpoint exists it
404s, which is a logged best-effort miss — the visitor's subscription still
succeeds.
