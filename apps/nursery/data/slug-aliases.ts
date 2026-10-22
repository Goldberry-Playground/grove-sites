/**
 * Retired product slugs → their current slug (GOL-2875 §3 R3, GOL-3601).
 *
 * Every slug the nursery has ever served keeps answering forever, as a 301 to
 * the product's current slug. Links already posted to email, social and print
 * point at these URLs, so dropping a row breaks them.
 *
 * ## Renaming a product's `grove_slug`
 * Add the row in the SAME release that the Odoo rename reaches prod, not
 * before. Until the rename lands, the old slug is still the live product and
 * an early row would 301 it to a page that does not exist yet.
 *
 * Keys and values are lowercase. A value must be a CURRENT slug, never another
 * alias, so a redirect is always one hop (R1). `slug-aliases.test.ts` enforces
 * both rules.
 *
 * Empty today: none of the six GOL-2875 §2 renames has run yet.
 */
export const SLUG_ALIASES: Readonly<Record<string, string>> = {};
