/**
 * One clamp for every cart-quantity input surface (GOL-1055).
 *
 * Cart quantities must be positive integers. The stepper buttons already keep
 * that invariant, but a typed <input type="number"> can hand us "1.5", "abc"
 * (→ NaN), "-3", or "" — none of which may reach the cart or the checkout
 * session. This funnels any candidate to a safe positive integer:
 *
 *   • NaN / non-finite / < 1        → `min` (default 1)
 *   • fractional                    → floored
 *   • above `max` (when given)      → `max`
 *
 * Keep the UI's clamp and the server's `MAX_QUANTITY` (checkout/api/validation)
 * consistent when a ceiling is passed.
 */
export function clampQuantity(value: number, min = 1, max?: number): number {
  if (!Number.isFinite(value)) return min;
  let n = Math.floor(value);
  if (n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}
