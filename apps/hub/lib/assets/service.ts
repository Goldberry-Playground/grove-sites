/**
 * Server-side assets-ingest service (GOL-290) — the HTTP body behind the hub's
 * `POST /api/assets/optimize` and `POST /api/assets/brand-entry` route handlers.
 *
 * Why a service and not an in-process import on the caller: the AgenticOS
 * discord-plugin worker is a sandboxed, esbuild-bundled `dist/worker.js` with no
 * runtime `node_modules`, so native `sharp` (which `@grove/assets`' ADR-009
 * optimize recipe needs) cannot run there. The optimize step runs here instead,
 * which also keeps grove-assets credentials off the sandbox. Full rationale in
 * AgenticOS PR #329.
 *
 * These handlers are pure w.r.t. their dependencies: the asset pipeline and the
 * brand-PR seam are injected (`OptimizeDeps` / `BrandEntryDeps`) so they unit-test
 * with fakes — no sharp, no Spaces, no GitHub. The route handlers wire the real
 * env-backed implementations via `optimizeDepsFromEnv` / `brandEntryDepsFromEnv`.
 */
import { NextResponse } from "next/server";
// NOTE: these are TYPE-ONLY imports on purpose. @grove/assets pulls in native
// `sharp`, whose binary loads at module-evaluation time. Next's `next build`
// "Collecting page data" step imports every route module, so an eager value
// import here would try to load sharp during the build and fail. The concrete
// implementations are loaded lazily (dynamic import) inside the env-backed deps
// builders below, which only run at request time.
import type { AssetPipeline, AssetPipelineInput } from "@grove/assets";
import type { AssetBrand } from "@grove/brand/ingest";

/** Env var holding the shared bearer token the discord-plugin presents. */
const TOKEN_ENV = "GROVE_ASSETS_OPTIMIZE_TOKEN";

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

/**
 * Bearer-token gate. Returns an error `NextResponse` to short-circuit, or `null`
 * when the request is authorized. A missing server-side token is a 503 (the
 * endpoint is not configured), never an open door.
 */
export function checkAuth(
  req: Request,
  env: Record<string, string | undefined> = process.env,
): NextResponse | null {
  const expected = env[TOKEN_ENV] ?? "";
  if (!expected) {
    return json({ error: "not_configured" }, 503);
  }
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim() ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

/** Length-independent constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

interface ParsedForm {
  meta: Record<string, unknown>;
  bytes: Uint8Array | null;
  filename: string | null;
}

/** Parse the `meta` (JSON) + optional `file` multipart body the plugin sends. */
async function parseForm(req: Request): Promise<ParsedForm | { error: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "invalid_multipart" };
  }
  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") {
    return { error: "missing_meta" };
  }
  let meta: unknown;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return { error: "invalid_meta_json" };
  }
  if (!meta || typeof meta !== "object") {
    return { error: "invalid_meta" };
  }
  const file = form.get("file");
  if (file && typeof file !== "string") {
    const blob = file as Blob & { name?: string };
    return {
      meta: meta as Record<string, unknown>,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      filename: typeof blob.name === "string" ? blob.name : null,
    };
  }
  return { meta: meta as Record<string, unknown>, bytes: null, filename: null };
}

function str(meta: Record<string, unknown>, field: string): string {
  const v = meta[field];
  return typeof v === "string" ? v.trim() : "";
}

/** Build the `{brand, assetClass, slug, filename}` core of an optimize input. */
function buildInput(
  meta: Record<string, unknown>,
  bytes: Uint8Array,
  fallbackFilename: string | null,
  defaultClass?: string,
): AssetPipelineInput | { error: string; field?: string } {
  const brand = str(meta, "brand");
  const slug = str(meta, "slug");
  const assetClass = str(meta, "assetClass") || defaultClass || "";
  const filename = str(meta, "filename") || fallbackFilename || "upload";
  if (!brand) return { error: "missing_field", field: "brand" };
  if (!slug) return { error: "missing_field", field: "slug" };
  if (!assetClass) return { error: "missing_field", field: "assetClass" };
  return { bytes, filename, brand, assetClass, slug };
}

/* ------------------------------- /optimize ------------------------------- */

export interface OptimizeDeps {
  pipeline: AssetPipeline;
}

/** POST /optimize — multipart `meta` + `file` → `{ cdnUrl, key }`. */
export async function handleOptimize(req: Request, deps: OptimizeDeps): Promise<NextResponse> {
  const parsed = await parseForm(req);
  if ("error" in parsed) return json(parsed, 400);
  if (!parsed.bytes) return json({ error: "missing_file" }, 400);

  const input = buildInput(parsed.meta, parsed.bytes, parsed.filename);
  if ("error" in input) return json(input, 400);

  try {
    const result = await deps.pipeline.optimizeAndUpload(input);
    return json({ cdnUrl: result.cdnUrl, key: result.key }, 200);
  } catch (err) {
    return json({ error: "optimize_failed", detail: message(err) }, 502);
  }
}

/* ------------------------------ /brand-entry ----------------------------- */

export interface BrandEntryDeps {
  pipeline: AssetPipeline;
  assetBrand: AssetBrand;
}

/**
 * POST /brand-entry — optimize a logo (unless the caller already supplied
 * `cdnUrl`+`key` in `meta`), then open the typed `@grove/brand` PR. → `{ prUrl }`.
 */
export async function handleBrandEntry(req: Request, deps: BrandEntryDeps): Promise<NextResponse> {
  const parsed = await parseForm(req);
  if ("error" in parsed) return json(parsed, 400);

  const meta = parsed.meta;
  const brand = str(meta, "brand");
  const slug = str(meta, "slug");
  const caption = typeof meta.caption === "string" ? meta.caption : "";
  if (!brand) return json({ error: "missing_field", field: "brand" }, 400);
  if (!slug) return json({ error: "missing_field", field: "slug" }, 400);

  let cdnUrl = str(meta, "cdnUrl");
  let key = str(meta, "key");

  // Derive the CDN object by optimizing the file when the caller did not already
  // provide one (the plugin may call /optimize first and pass the result here,
  // or hand us the raw logo and let us do both). Logos route to the Tier-4 lane.
  if (!cdnUrl || !key) {
    if (!parsed.bytes) return json({ error: "missing_file" }, 400);
    const input = buildInput(meta, parsed.bytes, parsed.filename, "logo");
    if ("error" in input) return json(input, 400);
    try {
      const result = await deps.pipeline.optimizeAndUpload(input);
      cdnUrl = result.cdnUrl;
      key = result.key;
    } catch (err) {
      return json({ error: "optimize_failed", detail: message(err) }, 502);
    }
  }

  try {
    const { prUrl } = await deps.assetBrand.proposeBrandEntry({ brand, slug, cdnUrl, key, caption });
    return json({ prUrl, cdnUrl, key }, 200);
  } catch (err) {
    return json({ error: "brand_entry_failed", detail: message(err) }, 502);
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ---------------------------- env-backed deps ---------------------------- */

/**
 * Real optimize dependency: the Spaces-backed `@grove/assets` pipeline.
 * `@grove/assets` (and its native `sharp`) is imported lazily so the route
 * module stays sharp-free at build time — see the type-only imports at the top.
 */
export async function optimizeDepsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<OptimizeDeps> {
  const { createSpacesAssetPipeline, spacesConfigFromEnv } = await import("@grove/assets");
  return { pipeline: createSpacesAssetPipeline(spacesConfigFromEnv(env)) };
}

/** Real brand-entry dependencies: the pipeline plus the GitHub-backed PR seam. */
export async function brandEntryDepsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BrandEntryDeps> {
  const [{ createSpacesAssetPipeline, spacesConfigFromEnv }, { createAssetBrand }, github] =
    await Promise.all([
      import("@grove/assets"),
      import("@grove/brand/ingest"),
      import("./github-brand"),
    ]);
  const { repo, pr } = github.createGithubBrandAdapters(github.githubBrandConfigFromEnv(env));
  return {
    pipeline: createSpacesAssetPipeline(spacesConfigFromEnv(env)),
    assetBrand: createAssetBrand({ repo, pr }),
  };
}

/** Wrap a deps builder so a configuration error surfaces as a 503, not a 500. */
export async function withConfig<T>(
  build: () => T | Promise<T>,
  run: (deps: T) => Promise<NextResponse>,
): Promise<NextResponse> {
  let deps: T;
  try {
    deps = await build();
  } catch (err) {
    return json({ error: "not_configured", detail: message(err) }, 503);
  }
  return run(deps);
}
