import { Suspense } from "react";
import { tenantConfig } from "../tenant.config";
import { plannerEnabled } from "../lib/planner-flag";
import { HOME_TEASER_HEADING, HOME_TEASER_LEDE, PLAN_EYEBROW } from "./plan/copy";
import { Planner } from "./plan/planner";

/**
 * Home-page section (order-builder spec §C.3): the same component collapsed
 * to the four questions under "Need help choosing trees?". The answers hand
 * off to /plan, where the result renders. Renders nothing while the planner
 * flag (`PLANNER_ENABLED`, read per request) is off, so the homepage is
 * byte-identical to today in prod until Josh flips it.
 */
export function PlanTeaser() {
  if (!plannerEnabled()) return null;
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  return (
    <section className="section plan-teaser" aria-labelledby="plan-teaser-heading">
      <div className="section-header">
        <div>
          <span className="section-tag">{PLAN_EYEBROW}</span>
          <h2 id="plan-teaser-heading">
            {HOME_TEASER_HEADING} <em>{HOME_TEASER_LEDE}</em>
          </h2>
        </div>
      </div>
      <div className="max-w-5xl">
        <Suspense fallback={null}>
          <Planner mode="home" odooBase={odooBase} contact={tenantConfig.contact} />
        </Suspense>
      </div>
    </section>
  );
}
