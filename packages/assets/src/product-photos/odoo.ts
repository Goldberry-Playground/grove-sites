/**
 * odoo.ts — the network side of the product-photo ingest.
 *
 * Reads use the grove_headless REST API via @grove/odoo-client (same client
 * the storefronts use — X-Grove-Tenant header scopes the catalog, so product
 * ids are already tenant-correct and no company handling is needed on write).
 *
 * Writes use Odoo's standard JSON-RPC endpoint (/jsonrpc, service "object",
 * method "execute_kw") — the JSON twin of the /xmlrpc/2 `execute_kw` calls
 * that grove-odoo-modules/scripts/import_grove_catalog.py already uses to
 * seed image_1920, with the same ODOO_DB / ODOO_USER / ODOO_PASSWORD env
 * contract. grove_headless intentionally exposes no image-write endpoint.
 *
 * NOTHING in this module runs at build time; writes happen only when the CLI
 * is invoked with --apply (docs/QA-AGENT-GUARDRAILS.md §1).
 */
import { createOdooClient } from "@grove/odoo-client";
import { sha256Hex } from "./image";
import { kebab } from "./matcher";
import type { CatalogProduct, ExistingGalleryRow, ExistingState } from "./planner";

// ── Catalog reads (grove_headless REST) ─────────────────────────────

export interface FetchCatalogOptions {
  odooUrl: string;
  tenantId: string;
  apiKey?: string;
  /** Slugs whose variants must be loaded (variant-hinted files exist). */
  slugsNeedingVariants?: readonly string[];
}

/** Fetch the tenant catalog (slug → id), loading variants only where needed. */
export async function fetchCatalog(options: FetchCatalogOptions): Promise<CatalogProduct[]> {
  const client = createOdooClient({
    tenantId: options.tenantId,
    odooUrl: options.odooUrl,
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
  });

  const { products } = await client.products.list({ limit: 500 });
  const needVariants = new Set(options.slugsNeedingVariants ?? []);
  const catalog: CatalogProduct[] = [];

  for (const p of products) {
    const entry: CatalogProduct = { id: p.id, slug: p.slug, name: p.name };
    if (needVariants.has(p.slug)) {
      const detail = await client.products.get(p.id);
      entry.variants = detail.variants.map((v) => ({
        id: v.id,
        displayName: v.name,
        format: v.format ?? "",
        cultivar: v.cultivar ?? "",
      }));
    }
    catalog.push(entry);
  }
  return catalog;
}

// ── Writes + state reads (Odoo JSON-RPC) ────────────────────────────

export interface OdooRpcConfig {
  url: string;
  db: string;
  user: string;
  password: string;
}

interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { message?: string; data?: { message?: string } };
}

let rpcId = 0;

async function jsonRpcCall(url: string, service: string, args: unknown[]): Promise<unknown> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: (rpcId += 1),
      params: { service, method: service === "common" ? "authenticate" : "execute_kw", args },
    }),
  });
  if (!response.ok) {
    throw new Error(`Odoo JSON-RPC HTTP ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as JsonRpcEnvelope;
  if (body.error) {
    // Odoo error payloads never include credentials; safe to surface.
    throw new Error(
      `Odoo JSON-RPC error: ${body.error.data?.message ?? body.error.message ?? "unknown"}`,
    );
  }
  return body.result;
}

export interface OdooWriter {
  uid: number;
  executeKw(model: string, method: string, args: unknown[], kwargs?: object): Promise<unknown>;
}

/** Authenticate against /jsonrpc. Throws (without echoing the password) on failure. */
export async function createOdooWriter(config: OdooRpcConfig): Promise<OdooWriter> {
  const uid = await jsonRpcCall(config.url, "common", [
    config.db,
    config.user,
    config.password,
    {},
  ]);
  if (typeof uid !== "number" || uid <= 0) {
    throw new Error(`Odoo authentication failed for ${config.user} on db "${config.db}"`);
  }
  return {
    uid,
    executeKw(model, method, args, kwargs = {}) {
      return jsonRpcCall(config.url, "object", [
        config.db,
        uid,
        config.password,
        model,
        method,
        args,
        kwargs,
      ]);
    },
  };
}

function hashOfB64(value: unknown): string {
  return typeof value === "string" && value.length > 0
    ? sha256Hex(Buffer.from(value, "base64"))
    : "";
}

/** Read back current image state for the products/variants the plan touches. */
export async function fetchExistingState(
  writer: OdooWriter,
  productIds: readonly number[],
  variantIds: readonly number[],
): Promise<ExistingState> {
  const primaryHashByProduct: Record<number, string> = {};
  const galleryByProduct: Record<number, ExistingGalleryRow[]> = {};
  const variantHashByVariant: Record<number, string> = {};

  if (productIds.length > 0) {
    const templates = (await writer.executeKw(
      "product.template",
      "read",
      [[...productIds], ["id", "image_1920"]],
    )) as Array<{ id: number; image_1920: string | false }>;
    for (const t of templates) primaryHashByProduct[t.id] = hashOfB64(t.image_1920);

    const rows = (await writer.executeKw(
      "product.image",
      "search_read",
      [[["product_tmpl_id", "in", [...productIds]]]],
      { fields: ["id", "name", "product_tmpl_id"] },
    )) as Array<{ id: number; name: string; product_tmpl_id: [number, string] }>;
    for (const row of rows) {
      const pid = row.product_tmpl_id[0];
      (galleryByProduct[pid] ??= []).push({ id: row.id, name: row.name });
    }
  }

  if (variantIds.length > 0) {
    const variants = (await writer.executeKw(
      "product.product",
      "read",
      [[...variantIds], ["id", "image_variant_1920"]],
    )) as Array<{ id: number; image_variant_1920: string | false }>;
    for (const v of variants) variantHashByVariant[v.id] = hashOfB64(v.image_variant_1920);
  }

  return { primaryHashByProduct, galleryByProduct, variantHashByVariant };
}

// ── Apply-mode target gate ──────────────────────────────────────────

/** Hosts --apply is allowed to write to: the QA droplet, or a local dev Odoo. */
export const ALLOWED_APPLY_HOSTS = [
  "odoo.qa.gatheringatthegrove.com",
  "localhost",
  "127.0.0.1",
] as const;

/**
 * QA write gate (docs/QA-AGENT-GUARDRAILS.md): --apply refuses any Odoo URL
 * that is not the known QA host (or a localhost dev instance). There is no
 * override flag on purpose — pointing this script at prod requires editing it.
 */
export function assertQaTarget(odooUrl: string): void {
  let host: string;
  try {
    host = new URL(odooUrl).hostname;
  } catch {
    throw new Error(`--apply refused: "${odooUrl}" is not a valid URL`);
  }
  if (!(ALLOWED_APPLY_HOSTS as readonly string[]).includes(host)) {
    throw new Error(
      `--apply refused: host "${host}" is not the QA Odoo (${ALLOWED_APPLY_HOSTS.join(", ")}). ` +
        "QA Odoo is system-of-record; this script never writes anywhere else.",
    );
  }
}

/** Tenant ids grove_headless knows about (import_grove_catalog.py TENANT_CONFIG). */
export const KNOWN_TENANTS = ["goldberry", "ggg", "nursery"] as const;

export function assertKnownTenant(tenant: string): void {
  if (!(KNOWN_TENANTS as readonly string[]).includes(kebab(tenant))) {
    throw new Error(`unknown tenant "${tenant}" (expected one of ${KNOWN_TENANTS.join(", ")})`);
  }
}
