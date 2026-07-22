/**
 * Hashtag composition for the Phase 2 content-approval loop (GOL-470 / GOL-233 §2).
 *
 * Rules (frozen with Sora, CMO):
 *  - Anchor `#TreeFacts` is ALWAYS present and ALWAYS first.
 *  - Then species tags, then place/practice tags, then any extra tags.
 *  - `#WoodWideWeb` is BANNED (case-insensitively) and stripped everywhere.
 *  - Per-platform caps: Threads leans 1–3 tags, Instagram 4–6.
 *
 * Pure/deterministic so it is trivially unit-testable; no I/O, no deps.
 */

/** Social platforms a suggestion can target. */
export type Platform = "threads" | "instagram";

/** The load-bearing anchor tag — first on every post. */
export const ANCHOR_TAG = "#TreeFacts";

/** Tags that must never appear (compared case-insensitively, without the `#`). */
const BANNED = new Set(["woodwideweb"]);

/** Per-platform hashtag budget (inclusive). */
export const HASHTAG_CAPS: Record<Platform, { min: number; max: number }> = {
  threads: { min: 1, max: 3 },
  instagram: { min: 4, max: 6 },
};

/** Inputs from a content suggestion used to build the tag pool. */
export interface HashtagInput {
  /** e.g. ["American chestnut", "pawpaw"] */
  species?: string[];
  /** e.g. ["Appalachia"] */
  places?: string[];
  /** e.g. ["forest farming", "syntropic"] */
  practices?: string[];
  /** Any additional pre-approved tags (already topical). */
  extra?: string[];
}

/**
 * Normalise a free-text phrase (or an existing `#tag`) into a CamelCase hashtag.
 * "American chestnut" → "#AmericanChestnut"; "forest farming" → "#ForestFarming";
 * "#TreeFacts" → "#TreeFacts". Returns null for anything with no usable letters.
 */
export function normalizeTag(raw: string): string | null {
  const words = raw
    .replace(/^#/, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  const body = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  if (!body) return null;
  return `#${body}`;
}

/** True when a tag is banned (compared case-insensitively, ignoring the `#`). */
export function isBanned(tag: string): boolean {
  return BANNED.has(tag.replace(/^#/, "").toLowerCase());
}

/**
 * Build the ordered, de-duplicated, ban-filtered tag pool for a suggestion.
 * The anchor is prepended unconditionally (and can never be a duplicate/banned).
 */
export function buildHashtagPool(input: HashtagInput): string[] {
  const ordered = [
    ...(input.species ?? []),
    ...(input.places ?? []),
    ...(input.practices ?? []),
    ...(input.extra ?? []),
  ];

  const seen = new Set<string>([ANCHOR_TAG.toLowerCase()]);
  const pool: string[] = [ANCHOR_TAG];

  for (const raw of ordered) {
    const tag = normalizeTag(raw);
    if (!tag || isBanned(tag)) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(tag);
  }
  return pool;
}

/**
 * Select the platform-appropriate slice of the pool. Takes a prefix up to the
 * platform's max (the anchor, being first, is always retained). The `min` is a
 * lean-toward target, not a hard floor — we never invent tags to reach it, so a
 * thin pool simply yields fewer tags.
 */
export function selectForPlatform(pool: string[], platform: Platform): string[] {
  const { max } = HASHTAG_CAPS[platform];
  return pool.slice(0, max);
}

/**
 * Compose the final post text for a platform: body, a blank line, then the
 * selected hashtags. Bodies with no available tags return just the trimmed body.
 */
export function composePost(body: string, pool: string[], platform: Platform): string {
  const tags = selectForPlatform(pool, platform);
  const trimmed = body.trim();
  return tags.length ? `${trimmed}\n\n${tags.join(" ")}` : trimmed;
}
