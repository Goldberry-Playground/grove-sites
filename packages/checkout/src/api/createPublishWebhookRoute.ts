import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Odoo → grove-sites storefront-invalidation webhook receiver.
 *
 * Implements the authoritative wire contract in grove-odoo-modules
 * `grove_headless/docs/publish-webhook-contract.md` (GOL-985). Two event types
 * ride the same signed channel, and both revalidate the same two paths:
 *
 *   - `guide.publish`       — an operator clicks "Publish Guide to Storefront".
 *   - `product.availability` — a product crosses an availability boundary
 *     (sellout / restock / `sale_ok` / `website_published` flip), so the ISR
 *     `/shop` grid does not keep advertising a stale "In stock" (GOL-1896). The
 *     webhook is the fast path; the `/shop` ISR window is the safety net that
 *     catches any missed or failed delivery.
 *
 * This lives beside the other per-tenant server route factories
 * (`createCheckoutRoute`, `createCartRoute`): one implementation, injected with
 * the tenant's secret + id, serving all three storefronts. It supersedes the
 * hub's shared-secret `x-grove-revalidate-secret` scheme with a per-tenant HMAC
 * signature over the RAW request body.
 *
 * Security: verify the signature BEFORE parsing or doing any work, in constant
 * time. Fail closed — a missing/empty secret or missing signature is a 401.
 */

export type PublishTenant = "goldberry" | "ggg" | "nursery";

/**
 * Event types this receiver handles. Both revalidate the same two paths
 * (`/shop/${id}` + `/shop`), so accepting a new type is a one-line addition —
 * the signature check, dedupe, and revalidation below are event-agnostic.
 */
const HANDLED_EVENTS = new Set(["guide.publish", "product.availability"]);

export interface PublishWebhookOptions {
  /** HMAC-SHA256 signing secret shared out-of-band with Odoo (per tenant). */
  secret: string;
  /** This deployment's tenant id (matches Odoo's `X-Grove-Tenant`). */
  tenant: PublishTenant;
  /**
   * Revalidator seam — defaults to Next's `revalidatePath`. Injectable so the
   * factory is unit-testable without a live request/render context.
   */
  revalidate?: (path: string) => void;
  /** Bounded delivery-id dedupe cap (module memory guard). */
  dedupeCap?: number;
}

/**
 * Constant-time verify of `sha256=<hex>` against HMAC-SHA256(secret, rawBody).
 * Never `JSON.parse` then re-stringify before this — that changes the bytes and
 * breaks the MAC. Returns false (→ 401) on any missing input.
 */
function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  // timingSafeEqual throws on length mismatch, so gate on length first — the
  // length of the expected digest is not secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

interface PublishBody {
  event?: unknown;
  tenant?: unknown;
  product?: { id?: unknown; slug?: unknown } | null;
}

/**
 * Build the POST handler for `/api/webhooks/publish` on a storefront app.
 *
 * Storefront product pages are id-keyed (`/shop/[id]`), so we revalidate
 * `/shop/${product.id}` plus the `/shop` listing. The contract's `product.slug`
 * is carried for future slug-routed tenants but is not the URL key here.
 */
export function createPublishWebhookRoute({
  secret,
  tenant,
  revalidate = revalidatePath,
  dedupeCap = 500,
}: PublishWebhookOptions) {
  // Per-instance, bounded, best-effort dedupe of `X-Grove-Delivery`. Retries
  // reuse the id; revalidation is idempotent, so at-least-once delivery is fine
  // and a repeat just short-circuits. In-memory only (multi-instance /
  // cold-start safe precisely because the underlying op is idempotent).
  const seen = new Set<string>();
  const remember = (id: string) => {
    seen.add(id);
    while (seen.size > dedupeCap) {
      const oldest = seen.values().next().value as string | undefined;
      if (oldest === undefined) break;
      seen.delete(oldest);
    }
  };

  return async function POST(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-grove-signature-256");
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: PublishBody;
    try {
      body = JSON.parse(rawBody) as PublishBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const event = request.headers.get("x-grove-event") ?? body.event;
    if (typeof event !== "string" || !HANDLED_EVENTS.has(event)) {
      return NextResponse.json({ error: "unknown_event" }, { status: 400 });
    }

    const productId = Number(body.product?.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "missing_product" }, { status: 400 });
    }

    // Dedupe on the delivery id — return 200 without re-doing work on a repeat.
    const delivery = request.headers.get("x-grove-delivery");
    if (delivery && seen.has(delivery)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const paths = [`/shop/${productId}`, "/shop"];
    for (const p of paths) revalidate(p);
    if (delivery) remember(delivery);

    return NextResponse.json({ ok: true, tenant, revalidated: paths });
  };
}
