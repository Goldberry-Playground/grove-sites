/**
 * upload-asset.ts — generic product-photo ingest into QA Odoo (ADR-009, GATH-95).
 *
 * Family members photograph nursery products; the photos land in a local
 * folder; this script matches them to Odoo products BY FILENAME and ingests
 * them (resize ≤1600px long edge, EXIF/GPS stripped, WebP) into the product
 * image fields grove_headless serves. See docs/PRODUCT-PHOTO-INGEST.md for
 * the family-facing naming guide.
 *
 * Filename convention:  <grove_slug>[-<variant-hint>][-<n>].(jpg|jpeg|png|webp)
 *   pawpaw-mango.jpg          primary photo of the pawpaw-mango product
 *   pawpaw-mango-2.jpg        second (gallery) photo
 *   pawpaw-mango-potted.jpg   photo of its "Potted" variant
 * Files that match no product slug are listed, never guessed.
 *
 * Usage (from the repo root):
 *   pnpm upload-asset -- [--dir <folder>] [--tenant <t>] [--match-report] [--apply]
 *
 *   --dir           photo folder (default ./assets-inbox, relative to where you ran pnpm)
 *   --tenant        goldberry | ggg | nursery (default nursery)
 *   --match-report  print the filename→product matching table and exit
 *   --dry-run       DEFAULT — fetch, match, plan, write nothing
 *   --apply         the only mode that writes. Needs ODOO_DB / ODOO_USER /
 *                   ODOO_PASSWORD in the env, and refuses any host that is not
 *                   the QA Odoo (odoo.qa.gatheringatthegrove.com) or localhost.
 *   --odoo-url      override the Odoo base URL (env: GROVE_ODOO_URL / ODOO_URL;
 *                   default https://odoo.qa.gatheringatthegrove.com)
 *
 * Re-running with the same files never duplicates: primary/variant writes
 * overwrite one field, and gallery rows carry a content-hash marker in their
 * name so unchanged files are skipped and changed files update in place.
 *
 * Guardrails (docs/QA-AGENT-GUARDRAILS.md): QA Odoo is system-of-record.
 * Nothing here runs at build time; writes happen only when a human runs
 * --apply deliberately. Never pass credentials on the command line.
 */
import { runCli } from "../packages/assets/src/product-photos/cli";

runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`upload-asset failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  },
);
