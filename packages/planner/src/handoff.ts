import type { PlanAnswers } from "./url";
import type { PlanLine, PlanInput } from "./types";

/**
 * The `plan` object a consult-built cart line carries onto the order (§C.4):
 * `{ url, lines: [{id, qty}], zone, state, site, track, subgoal, timing }`.
 * Odoo stores it as `grove_planner_plan` so the SOP's "swap or drop" step
 * starts from the customer's own mix. Carrying it through the cart store and
 * the checkout session lives in `packages/checkout` (separate issue).
 */
export interface PlanHandoff {
  url: string;
  lines: { id: number; qty: number }[];
  zone: number | null;
  state: string | null;
  site: PlanInput["site"];
  track: PlanInput["track"];
  subgoal: PlanInput["subgoal"] | null;
  timing: PlanInput["timing"];
}

export function buildPlanHandoff(
  url: string,
  input: PlanInput,
  lines: readonly PlanLine[],
  answers?: Pick<PlanAnswers, "zip">,
): PlanHandoff {
  void answers;
  return {
    url,
    lines: lines.map((l) => ({ id: l.plant.id, qty: l.qty })),
    zone: typeof input.zone === "number" ? input.zone : null,
    state: input.state,
    site: input.site,
    track: input.track,
    subgoal: input.subgoal ?? null,
    timing: input.timing,
  };
}
