import { SLUG_ALIASES } from "../data/slug-aliases";
import { isProductIdSegment, isUsableSlug } from "./product-path";

/**
 * Where a `/shop/<segment>` request should 301 to, if anywhere (GOL-3601).
 *
 * Pure so `middleware.ts` stays a thin adapter and the rules are unit-tested.
 * Rules from GOL-2875 §3, in order:
 *
 * - **R1** `/shop/<id>` → `/shop/<slug>`, when the product has a usable slug.
 *   `slugForId` is the Odoo lookup; null means "no product, or no usable slug",
 *   and the request falls through to the page, which 404s or serves the id
 *   form `noindex` (R4).
 * - **R3** a retired slug → its current slug, per `SLUG_ALIASES`.
 * - **R6** a mixed-case segment → its lowercase form, in the same single hop as
 *   R3 when both apply.
 *
 * Returns the target segment, or null to let the request through untouched.
 * Never returns an id, so a redirect can never point slug → id (R2).
 */
export async function pdpRedirectTarget(
  segment: string,
  slugForId: (id: number) => Promise<string | null>,
): Promise<string | null> {
  if (isProductIdSegment(segment)) {
    const slug = await slugForId(Number(segment));
    return isUsableSlug(slug) ? slug : null;
  }

  const lower = segment.toLowerCase();
  const current = SLUG_ALIASES[lower];
  if (current) return current;
  return lower !== segment ? lower : null;
}
