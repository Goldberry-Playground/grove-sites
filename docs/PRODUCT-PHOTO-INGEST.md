# Product photo ingest — naming guide + runbook

Product/catalog images live in Odoo (ADR-009, `odoocker/docs/ADR/009-grove-asset-storage.md`)
and are served to the storefronts by `grove_headless`. Family photos get there via
`scripts/upload-asset.ts` (GATH-95) — a deliberate, human-run CLI. Nothing uploads
automatically, and nothing writes at build time (`docs/QA-AGENT-GUARDRAILS.md` §1).

## For the family: how to name a photo

Name the file after the product's shop URL slug — the last part of its page address.
`gatheringatthegrove.com/shop/pawpaw-mango` → the slug is `pawpaw-mango`:

| Filename | What it becomes |
| --- | --- |
| `pawpaw-mango.jpg` | the product's main photo |
| `pawpaw-mango-2.jpg`, `pawpaw-mango-3.jpg` | extra gallery photos, in order |
| `pawpaw-mango-potted.jpg` | the photo for the "Potted" variant |
| `pawpaw-mango-potted-2.jpg` | an extra gallery photo, labeled by variant |

`jpg`, `jpeg`, `png`, and `webp` all work; capital letters and spaces are fine
(`American Persimmon 2.JPG` matches `american-persimmon`). Drop the files in the
inbox folder (default `./assets-inbox`) — a photo whose name matches no product is
**listed and left alone, never guessed**.

## For whoever runs it

```bash
# See how filenames resolve (read-only):
pnpm upload-asset -- --dir ./assets-inbox --tenant nursery --match-report

# Dry run (the default — prints the plan, writes nothing):
pnpm upload-asset -- --dir ./assets-inbox --tenant nursery

# Live run — the ONLY mode that writes. Refuses any host that is not the QA
# Odoo (odoo.qa.gatheringatthegrove.com) or localhost:
ODOO_DB=… ODOO_USER=… ODOO_PASSWORD=… \
  pnpm upload-asset -- --dir ./assets-inbox --tenant nursery --apply
```

Credentials come from the environment (same `ODOO_DB`/`ODOO_USER`/`ODOO_PASSWORD`
contract as `grove-odoo-modules/scripts/import_grove_catalog.py`; the admin login
lives in 1Password — reference it by item name, never paste values into commands).

Every photo is normalized before it touches Odoo: resized to at most 1600px on the
long edge, re-encoded as WebP, and **stripped of all EXIF metadata including GPS**
(family phone photos are geotagged with the farm/home).

Re-running with the same folder is safe: the main/variant photo is a single-field
overwrite and unchanged files are skipped; gallery entries carry a content-hash
marker in their name, so an unchanged file is skipped and an edited one updates the
existing entry instead of duplicating it.

**Sequencing note:** the durable-filestore `terraform apply` (2026-07-23) must land
before photos are ingested for keeps — images written before it live in the
non-durable filestore (see `docs/STOREFRONT-SPEC.md`, "Product images").
