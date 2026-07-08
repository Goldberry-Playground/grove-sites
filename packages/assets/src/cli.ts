/**
 * Manual Tier-3 upload CLI — the same recipe as the Discord `#assets` ingest,
 * for one-off uploads before/without AgenticOS.
 *
 *   tsx packages/assets/src/cli.ts <file> --brand goldberry --class hero --slug "orchard at dusk"
 *
 * Credentials come from the environment (`GROVE_ASSETS_KEY` / `GROVE_ASSETS_SECRET`,
 * provisioned via the secret broker per ADR-0001) — never passed on the command line.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createSpacesAssetPipeline, spacesConfigFromEnv } from "./upload-asset";

interface CliArgs {
  file: string;
  brand: string;
  assetClass: string;
  slug: string;
}

function parseArgs(argv: string[]): CliArgs {
  const opts: Record<string, string> = {};
  let file: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`Missing value for --${key}`);
      opts[key] = value;
      i += 1;
    } else if (!file) {
      file = arg;
    }
  }
  if (!file) throw new Error("Usage: cli.ts <file> --brand <b> --class <c> [--slug <s>]");
  if (!opts.brand) throw new Error("Missing required --brand");
  if (!opts.class) throw new Error("Missing required --class");
  return {
    file,
    brand: opts.brand,
    assetClass: opts.class,
    slug: opts.slug ?? opts.class,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pipeline = createSpacesAssetPipeline(spacesConfigFromEnv());
  const bytes = await readFile(args.file);
  const result = await pipeline.optimizeAndUpload({
    bytes,
    filename: basename(args.file),
    brand: args.brand,
    assetClass: args.assetClass,
    slug: args.slug,
  });
  process.stdout.write(`${result.cdnUrl}\n`);
  process.stderr.write(
    `Uploaded ${result.variants.length} variants (hash ${result.hash}):\n` +
      result.variants.map((v) => `  ${v.format} ${v.width}w  ${v.cdnUrl}`).join("\n") +
      "\n",
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`upload-asset cli failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
