import type { Product } from "@grove/odoo-client";

/**
 * Tag-inferred guild companions (design spec §"Companions", v1 inference).
 *
 * v1 rule: a candidate is a companion of the subject when it
 *   1. is not the subject itself,
 *   2. shares at least one tag with the subject, and
 *   3. has an overlapping USDA hardiness range (so we never suggest a zone-8
 *      fig next to a zone-3 apple).
 * Results are ranked by shared-tag count (strongest guild affinity first) and
 * capped at `limit` (default 4). v3 replaces this with a curated
 * `grove_companion_ids` m2m + purchasable guild kits.
 *
 * Zone overlap uses the subject's and candidate's `facts.zoneMin/zoneMax` when
 * present. List-endpoint products don't carry facts, so callers that only have
 * list data pass `subjectZone`/candidate zones as undefined — in that case the
 * zone gate is skipped (tag overlap alone), which is the honest behaviour until
 * the list serializer exposes zones.
 */
export interface CompanionInput {
  id: number;
  tags?: string[];
  zoneMin?: number | null;
  zoneMax?: number | null;
}

/** True when [aMin,aMax] and [bMin,bMax] overlap. Missing bounds → treat as
 * open on that side, so a product with unknown zones never gets filtered out
 * on a zone technicality. */
export function zonesOverlap(
  a: { zoneMin?: number | null; zoneMax?: number | null },
  b: { zoneMin?: number | null; zoneMax?: number | null },
): boolean {
  const aMin = a.zoneMin ?? -Infinity;
  const aMax = a.zoneMax ?? Infinity;
  const bMin = b.zoneMin ?? -Infinity;
  const bMax = b.zoneMax ?? Infinity;
  return aMin <= bMax && bMin <= aMax;
}

export function inferCompanions<T extends CompanionInput>(
  subject: CompanionInput,
  candidates: T[],
  limit = 4,
): T[] {
  const subjectTags = new Set(subject.tags ?? []);
  if (subjectTags.size === 0) return [];

  return candidates
    .filter((c) => c.id !== subject.id)
    .map((c) => ({
      candidate: c,
      shared: (c.tags ?? []).filter((t) => subjectTags.has(t)).length,
    }))
    .filter(({ candidate, shared }) => shared > 0 && zonesOverlap(subject, candidate))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/** Convenience adapter: derive the companion input from a normalized Product
 * (pulls zone bounds out of the optional facts block). */
export function toCompanionInput(p: Product): CompanionInput {
  return {
    id: p.id,
    tags: p.tags,
    zoneMin: p.facts?.zoneMin ?? null,
    zoneMax: p.facts?.zoneMax ?? null,
  };
}
