import type { BundleOffer, PlanInput, PlanLine, PlannerBundle, PlannerCatalog } from "./types";

/** Lines a bundle's components would be taken from, as `{ templateId: qty }`. */
function lineCounts(lines: readonly PlanLine[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const l of lines) counts.set(l.plant.id, (counts.get(l.plant.id) ?? 0) + l.qty);
  return counts;
}

/** `component_ids` as a multiset. */
function componentCounts(bundle: PlannerBundle): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of bundle.component_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** True when every component (with multiplicity) is covered by the lines. */
export function coversLines(bundle: PlannerBundle, lines: readonly PlanLine[]): boolean {
  if (bundle.component_ids.length === 0) return false;
  const have = lineCounts(lines);
  for (const [id, need] of componentCounts(bundle)) {
    if ((have.get(id) ?? 0) < need) return false;
  }
  return true;
}

/**
 * Bundle match (§C.2). A bundle whose `component_ids` is a sub-multiset of
 * the planned lines is offered with what it saves. Consult-built bundles are
 * offered instead of individual lines on the agroforestry track or at 50 trees
 * and up; the planned mix rides along as the starting point (§C.4).
 */
export function matchBundle(
  lines: readonly PlanLine[],
  catalog: PlannerCatalog,
  input: Pick<PlanInput, "track" | "size">,
  subtotal: number,
): BundleOffer | undefined {
  const bundles = [...catalog.bundles].sort((a, b) => a.id - b.id);

  if (input.track === "agro" || input.size >= 50) {
    const consult = bundles.filter((b) => b.consult_built);
    if (consult.length > 0) {
      const fits = consult
        .filter((b) => (b.tree_count ?? 0) >= input.size)
        .sort((a, b) => (a.tree_count ?? 0) - (b.tree_count ?? 0) || a.id - b.id);
      const pick =
        fits[0] ??
        [...consult].sort((a, b) => (b.tree_count ?? 0) - (a.tree_count ?? 0) || a.id - b.id)[0];
      return {
        id: pick.id,
        name: pick.name,
        price: pick.price,
        saves: 0,
        covers: pick.tree_count ?? 0,
        consultBuilt: true,
        componentIds: [],
        variantId: pick.variant_id ?? null,
      };
    }
  }

  if (lines.length === 0) return undefined;
  const priceOf = new Map(catalog.plants.map((p) => [p.id, p.price] as const));
  const matches = bundles
    .filter((b) => !b.consult_built && coversLines(b, lines))
    .sort((a, b) => b.component_ids.length - a.component_ids.length || a.id - b.id);
  const best = matches[0];
  if (!best) return undefined;
  const replaced = best.component_ids.reduce((sum, id) => sum + (priceOf.get(id) ?? 0), 0);
  const saves = Math.max(0, Math.round((replaced - best.price) * 100) / 100);
  void subtotal;
  return {
    id: best.id,
    name: best.name,
    price: best.price,
    saves,
    covers: best.component_ids.length,
    consultBuilt: false,
    componentIds: [...best.component_ids],
    variantId: best.variant_id ?? null,
  };
}

/**
 * Accepting a bundle offer: subtract its components from the lines (dropping
 * any line that reaches zero). The caller adds the bundle line itself.
 */
export function applyBundle(lines: readonly PlanLine[], offer: BundleOffer): PlanLine[] {
  const take = new Map<number, number>();
  for (const id of offer.componentIds) take.set(id, (take.get(id) ?? 0) + 1);
  const out: PlanLine[] = [];
  for (const l of lines) {
    const t = take.get(l.plant.id) ?? 0;
    const qty = l.qty - t;
    if (qty > 0) out.push({ ...l, qty });
  }
  return out;
}
