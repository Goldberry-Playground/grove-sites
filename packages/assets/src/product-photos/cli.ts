/**
 * cli.ts — orchestration for `scripts/upload-asset.ts` (product-photo ingest).
 *
 * See the header of scripts/upload-asset.ts for usage. Kept inside
 * @grove/assets so vitest/tsc cover it and sharp/tsx resolve from this
 * package's dependencies.
 *
 * Mode contract (docs/QA-AGENT-GUARDRAILS.md §1 — QA Odoo write gate):
 *   default        dry run. Fetches the catalog (read-only), prints the plan,
 *                  writes NOTHING. No credentials needed.
 *   --match-report prints the filename→product matching table and exits.
 *   --apply        the ONLY mode that writes. Requires ODOO_DB / ODOO_USER /
 *                  ODOO_PASSWORD in the env and refuses any host that is not
 *                  the QA Odoo (or localhost). Run deliberately, by a human.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { processProductPhoto } from "./image";
import { matchFiles, SUPPORTED_EXTENSIONS, type MatchResult } from "./matcher";
import {
  assertKnownTenant,
  assertQaTarget,
  createOdooWriter,
  fetchCatalog,
  fetchExistingState,
  type OdooWriter,
} from "./odoo";
import { planIngest, type IngestPlan, type PlannedFile } from "./planner";

export interface CliOptions {
  dir: string;
  tenant: string;
  apply: boolean;
  matchReport: boolean;
  odooUrl: string;
}

export const DEFAULT_ODOO_URL = "https://odoo.qa.gatheringatthegrove.com";

export function parseCliArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): CliOptions {
  const opts: CliOptions = {
    dir: "./assets-inbox",
    tenant: "nursery",
    apply: false,
    matchReport: false,
    odooUrl: env.GROVE_ODOO_URL ?? env.ODOO_URL ?? DEFAULT_ODOO_URL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return v;
    };
    switch (arg) {
      case "--": // pnpm forwards the run-script separator literally; ignore it
        break;
      case "--dir":
        opts.dir = next();
        break;
      case "--tenant":
        opts.tenant = next();
        break;
      case "--apply":
        opts.apply = true;
        break;
      case "--dry-run": // already the default; accepted for explicitness
        opts.apply = false;
        break;
      case "--match-report":
        opts.matchReport = true;
        break;
      case "--odoo-url":
        opts.odooUrl = next();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  // `pnpm run` executes with the package as cwd; resolve --dir against where
  // the user actually invoked pnpm so relative paths behave as expected.
  opts.dir = resolve(env.INIT_CWD ?? process.cwd(), opts.dir);
  return opts;
}

async function listImageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

function printMatchTable(result: MatchResult): void {
  for (const m of result.matched) {
    const hint = m.variantHint ? `  variant=${m.variantHint}` : "";
    const seq = `  #${m.sequence ?? 1}`;
    console.log(`  MATCH  ${m.file}  ->  ${m.slug}${hint}${seq}`);
  }
  for (const u of result.unmatched) {
    console.log(`  UNMATCHED  ${u.file}  (${u.reason})`);
  }
}

function describeOp(p: PlannedFile): string {
  switch (p.op.kind) {
    case "set-primary":
      return `primary image of "${p.productName}" (product.template ${p.productId})`;
    case "set-variant-image":
      return `variant image of "${p.op.variantName}" (product.product ${p.op.variantId})`;
    case "add-gallery":
      return p.op.updateRowId
        ? `update gallery row ${p.op.updateRowId} on "${p.productName}"`
        : `new gallery image on "${p.productName}"`;
  }
}

function printPlan(plan: IngestPlan, apply: boolean): void {
  for (const p of plan.planned) {
    const verb = p.status === "skip" ? "SKIP " : apply ? "WRITE" : "WOULD";
    const why = p.reason ? `  (${p.reason})` : "";
    console.log(`  ${verb}  ${p.file}  ->  ${describeOp(p)}${why}`);
  }
  for (const problem of plan.problems) {
    console.log(`  ERROR  ${problem.file}  (${problem.reason})`);
  }
}

async function executePlan(
  writer: OdooWriter,
  plan: IngestPlan,
  imagesByFile: Record<string, Buffer>,
): Promise<number> {
  let failures = 0;
  for (const p of plan.planned) {
    if (p.status === "skip") {
      console.log(`  SKIP   ${p.file}  (${p.reason})`);
      continue;
    }
    const b64 = imagesByFile[p.file]!.toString("base64");
    try {
      if (p.op.kind === "set-primary") {
        await writer.executeKw("product.template", "write", [[p.op.productId], { image_1920: b64 }]);
      } else if (p.op.kind === "set-variant-image") {
        await writer.executeKw("product.product", "write", [
          [p.op.variantId],
          { image_variant_1920: b64 },
        ]);
      } else if (p.op.updateRowId) {
        await writer.executeKw("product.image", "write", [
          [p.op.updateRowId],
          { name: p.op.galleryName, image_1920: b64 },
        ]);
      } else {
        await writer.executeKw("product.image", "create", [
          { name: p.op.galleryName, product_tmpl_id: p.op.productId, image_1920: b64 },
        ]);
      }
      console.log(`  OK     ${p.file}  ->  ${describeOp(p)}`);
    } catch (err) {
      failures += 1;
      console.error(
        `  ERROR  ${p.file}  ->  ${describeOp(p)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return failures;
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const opts = parseCliArgs(argv);
  assertKnownTenant(opts.tenant);
  // Gate BEFORE any network I/O: a live run against anything but QA/localhost
  // must die with the refusal message, not a fetch error.
  if (opts.apply) assertQaTarget(opts.odooUrl);

  const files = (await listImageFiles(opts.dir)).filter((f) =>
    (SUPPORTED_EXTENSIONS as readonly string[]).includes(extname(f).slice(1).toLowerCase()),
  );
  const allFiles = await listImageFiles(opts.dir);
  console.log(
    `${basename(opts.dir)}: ${allFiles.length} file(s), ${files.length} with a supported extension` +
      ` (${SUPPORTED_EXTENSIONS.join("/")})  tenant=${opts.tenant}  odoo=${opts.odooUrl}`,
  );
  if (allFiles.length === 0) return 0;

  // Read-only catalog fetch (grove_headless REST) — used by every mode.
  console.log("Fetching catalog…");
  let catalog = await fetchCatalog({ odooUrl: opts.odooUrl, tenantId: opts.tenant });
  const slugs = catalog.map((c) => c.slug);
  const match = matchFiles(allFiles, slugs);

  if (opts.matchReport) {
    console.log(`\nMatch report (${match.matched.length} matched, ${match.unmatched.length} unmatched):`);
    printMatchTable(match);
    return 0;
  }

  // Load variants only for products that have variant-hinted files.
  const hinted = [...new Set(match.matched.filter((m) => m.variantHint).map((m) => m.slug))];
  if (hinted.length > 0) {
    catalog = await fetchCatalog({
      odooUrl: opts.odooUrl,
      tenantId: opts.tenant,
      slugsNeedingVariants: hinted,
    });
  }

  if (!opts.apply) {
    const plan = planIngest(match.matched, catalog);
    console.log(`\nDry run — nothing will be written (pass --apply for a live run):`);
    printPlan(plan, false);
    for (const u of match.unmatched) console.log(`  UNMATCHED  ${u.file}  (${u.reason})`);
    const bad = plan.problems.length + match.unmatched.length;
    if (bad > 0) console.log(`\n${bad} file(s) need attention before an --apply run.`);
    return bad > 0 ? 1 : 0;
  }

  // ── Live run ──────────────────────────────────────────────────────
  const { ODOO_DB, ODOO_USER, ODOO_PASSWORD } = process.env;
  if (!ODOO_DB || !ODOO_USER || !ODOO_PASSWORD) {
    throw new Error("--apply requires ODOO_DB, ODOO_USER and ODOO_PASSWORD in the environment");
  }

  console.log("Processing images (resize ≤1600px, strip EXIF, WebP)…");
  const hashes: Record<string, string> = {};
  const imagesByFile: Record<string, Buffer> = {};
  for (const m of match.matched) {
    const processed = await processProductPhoto(await readFile(resolve(opts.dir, m.file)));
    hashes[m.file] = processed.hash;
    imagesByFile[m.file] = processed.bytes;
  }

  const writer = await createOdooWriter({
    url: opts.odooUrl,
    db: ODOO_DB,
    user: ODOO_USER,
    password: ODOO_PASSWORD,
  });

  // Read current image state so identical re-runs become skips.
  const provisional = planIngest(match.matched, catalog, hashes);
  const productIds = [...new Set(provisional.planned.map((p) => p.productId))];
  const variantIds = [
    ...new Set(
      provisional.planned.flatMap((p) =>
        p.op.kind === "set-variant-image" ? [p.op.variantId] : [],
      ),
    ),
  ];
  const existing = await fetchExistingState(writer, productIds, variantIds);
  const plan = planIngest(match.matched, catalog, hashes, existing);

  console.log(`\nApplying to ${opts.odooUrl} (db=${ODOO_DB}):`);
  const failures = await executePlan(writer, plan, imagesByFile);
  for (const problem of plan.problems) {
    console.error(`  ERROR  ${problem.file}  (${problem.reason})`);
  }
  for (const u of match.unmatched) console.log(`  UNMATCHED  ${u.file}  (${u.reason})`);

  const bad = failures + plan.problems.length + match.unmatched.length;
  console.log(
    `\nDone: ${plan.planned.filter((p) => p.status === "write").length - failures} written, ` +
      `${plan.planned.filter((p) => p.status === "skip").length} skipped, ${bad} problem(s).`,
  );
  return bad > 0 ? 1 : 0;
}
