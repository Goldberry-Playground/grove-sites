import type { OrderItemInput } from "@grove/odoo-client";

export const MAX_ITEMS = 100;
export const MAX_QUANTITY = 9999;

// Field length caps. Tuned so legit international input flows through but
// junk/abuse payloads bounce at the BFF before reaching Odoo. RFC 5321 caps
// email at 254 chars; the rest are pragmatic ceilings well above real-world
// values (longest US state name "Massachusetts" is 13 chars, etc.).
export const MAX_NAME = 200;
export const MAX_EMAIL = 254;
export const MAX_PHONE = 30;
export const MAX_STREET = 200;
export const MAX_CITY = 100;
export const MAX_STATE = 50;
export const MAX_ZIP = 20;
export const MAX_COUNTRY = 100;
// A checkout redirect URL. Bounded to keep an abusive payload from ballooning
// the Stripe session request; well above any real success/cancel URL.
export const MAX_URL = 2048;

// Deliberately permissive — we let Odoo + the email-delivery layer handle the
// RFC 5322 long tail. This catches the actual failure mode we see today (typos
// like "abc" or "user@", missing '@', whitespace) without the famous
// 6000-character regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidItem(value: unknown): value is OrderItemInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "number" &&
    Number.isFinite(v.variantId) &&
    Number.isInteger(v.variantId) &&
    v.variantId > 0 &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    v.quantity <= MAX_QUANTITY
  );
}

/** Required string in [1, max] chars. */
function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= max;
}

/** Optional string in [0, max] chars when present. Allows undefined/null/missing. */
function isOptionalBoundedString(
  value: unknown,
  max: number,
): value is string | undefined {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.length <= max;
}

/**
 * Validate a shipping/billing address. Returns an error string keyed by the
 * outer field name (e.g. "shipping" or "billing"), or null when valid.
 */
function validateAddress(addr: unknown, label: string): string | null {
  if (!addr || typeof addr !== "object") {
    return `${label} is required and must be an object`;
  }
  const a = addr as Record<string, unknown>;
  if (!isBoundedString(a.street, MAX_STREET)) {
    return `${label}.street is required and must be 1..${MAX_STREET} chars`;
  }
  if (!isOptionalBoundedString(a.street2, MAX_STREET)) {
    return `${label}.street2 must be a string of at most ${MAX_STREET} chars`;
  }
  if (!isBoundedString(a.city, MAX_CITY)) {
    return `${label}.city is required and must be 1..${MAX_CITY} chars`;
  }
  if (!isBoundedString(a.state, MAX_STATE)) {
    return `${label}.state is required and must be 1..${MAX_STATE} chars`;
  }
  if (!isBoundedString(a.zip, MAX_ZIP)) {
    return `${label}.zip is required and must be 1..${MAX_ZIP} chars`;
  }
  if (!isBoundedString(a.country, MAX_COUNTRY)) {
    return `${label}.country is required and must be 1..${MAX_COUNTRY} chars`;
  }
  return null;
}

/**
 * Validate the shared order payload (contact + addresses + items) used by both
 * the draft-order and Stripe-session routes. Returns the first error message,
 * or null when the payload is well-formed. Field-specific messages are stable
 * — createCheckoutRoute.test.ts asserts them.
 */
export function validateOrderInput(payload: unknown): string | null {
  // request.json() returns whatever JSON.parse returns — null, primitives, and
  // arrays all parse cleanly. Guard so downstream `payload.contact` can't throw.
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Body must be a JSON object";
  }
  const p = payload as Record<string, unknown>;
  const contact = p.contact as Record<string, unknown> | undefined;

  if (!contact?.email || !contact?.name) {
    return "contact.name and contact.email are required";
  }
  if (!isBoundedString(contact.name, MAX_NAME)) {
    return `contact.name must be 1..${MAX_NAME} chars`;
  }
  if (
    typeof contact.email !== "string" ||
    contact.email.length > MAX_EMAIL ||
    !EMAIL_REGEX.test(contact.email)
  ) {
    return `contact.email must be a valid email of at most ${MAX_EMAIL} chars`;
  }
  if (!isOptionalBoundedString(contact.phone, MAX_PHONE)) {
    return `contact.phone must be a string of at most ${MAX_PHONE} chars`;
  }

  const shippingError = validateAddress(p.shipping, "shipping");
  if (shippingError) return shippingError;

  if (p.billing !== undefined && p.billing !== null) {
    const billingError = validateAddress(p.billing, "billing");
    if (billingError) return billingError;
  }

  if (
    !Array.isArray(p.items) ||
    p.items.length === 0 ||
    p.items.length > MAX_ITEMS
  ) {
    return `items must be a non-empty array of at most ${MAX_ITEMS} entries`;
  }
  if (!p.items.every(isValidItem)) {
    return "Each item needs a positive integer variantId and finite quantity";
  }

  if (
    p.fulfillment !== undefined &&
    p.fulfillment !== "ship" &&
    p.fulfillment !== "pickup"
  ) {
    return 'fulfillment must be "ship" or "pickup"';
  }

  return null;
}

/** Require a non-empty, bounded, absolute http(s) URL. Returns the labelled
 *  error message or null. */
export function validateRedirectUrl(value: unknown, label: string): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_URL) {
    return `${label} is required and must be a URL of at most ${MAX_URL} chars`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${label} must be an absolute http(s) URL`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return `${label} must be an absolute http(s) URL`;
  }
  return null;
}
