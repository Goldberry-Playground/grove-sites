/**
 * Re-host a raw operator media drop to a durable public URL (GOL-1122, GOL-1119).
 *
 * The front door of the CMO media path: an operator drops a raw farm photo (a
 * Discord attachment or a Drive file) and this turns it into the durable,
 * publicly-fetchable https `MediaAsset` the existing approval-card → Buffer flow
 * needs. It fetches the raw bytes, forwards them to the hub re-host endpoint
 * (which strips EXIF/GPS + re-hosts to grove-assets Spaces), and prints the
 * validated MediaAsset JSON — paste it straight into a `content_suggestion.media`:
 *
 *   pnpm --filter @grove/discord-bridge rehost -- ./farm.jpg --type image --source manual
 *   pnpm --filter @grove/discord-bridge rehost -- https://cdn.discordapp.com/.../x.jpg --type image --source manual --alt "Pawpaw seedlings"
 *
 * Requires GROVE_ASSETS_HUB_URL + GROVE_ASSETS_OPTIMIZE_TOKEN in the env (GOL-1124).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { IgPostType, MediaSource, MediaType } from "./lib/media.ts";
import { rehostClientConfigFromEnv, rehostViaHub, type RawDrop } from "./lib/rehost-client.ts";

interface Args {
  fileOrUrl: string;
  declaredType: MediaType;
  source: MediaSource;
  igPostType?: IgPostType;
  altText?: string;
}

const MEDIA_TYPES: readonly MediaType[] = ["image", "video"];
const MEDIA_SOURCES: readonly MediaSource[] = ["canva", "manual"];
const IG_POST_TYPES: readonly IgPostType[] = ["post", "reel", "story"];

function fail(msg: string): never {
  process.stderr.write(`rehost: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const [fileOrUrl, ...rest] = argv;
  if (!fileOrUrl) fail("missing file path or URL (first positional arg)");
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const val = rest[i + 1];
    if (!key?.startsWith("--") || val === undefined) fail(`bad flag near "${key}"`);
    flags[key.slice(2)] = val;
  }
  const declaredType = (flags.type ?? "image") as MediaType;
  if (!MEDIA_TYPES.includes(declaredType)) fail(`--type must be one of ${MEDIA_TYPES.join(", ")}`);
  const source = (flags.source ?? "manual") as MediaSource;
  if (!MEDIA_SOURCES.includes(source)) fail(`--source must be one of ${MEDIA_SOURCES.join(", ")}`);
  let igPostType: IgPostType | undefined;
  if (flags.ig) {
    if (!IG_POST_TYPES.includes(flags.ig as IgPostType)) {
      fail(`--ig must be one of ${IG_POST_TYPES.join(", ")}`);
    }
    igPostType = flags.ig as IgPostType;
  }
  return { fileOrUrl, declaredType, source, igPostType, altText: flags.alt };
}

/** Fetch the raw bytes + a filename from a local path or an http(s) URL. */
async function loadBytes(fileOrUrl: string): Promise<{ bytes: Uint8Array; filename: string }> {
  if (/^https?:\/\//i.test(fileOrUrl)) {
    const res = await fetch(fileOrUrl);
    if (!res.ok) fail(`failed to fetch ${fileOrUrl}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = new URL(fileOrUrl).pathname;
    const filename = basename(path) || "drop";
    return { bytes, filename };
  }
  return { bytes: new Uint8Array(readFileSync(fileOrUrl)), filename: basename(fileOrUrl) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = rehostClientConfigFromEnv();
  const { bytes, filename } = await loadBytes(args.fileOrUrl);
  const drop: RawDrop = {
    bytes,
    filename,
    declaredType: args.declaredType,
    source: args.source,
    igPostType: args.igPostType,
    altText: args.altText,
  };
  const asset = await rehostViaHub(drop, config);
  process.stdout.write(`${JSON.stringify(asset, null, 2)}\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
