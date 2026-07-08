/**
 * SHA-256 hex digest via the Web Crypto API. Used to hash order ids before they
 * leave the browser — the funnel joins on `order_id_hash`, never the raw,
 * customer-guessable order number.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
