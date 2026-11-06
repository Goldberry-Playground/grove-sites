import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CategoryBar } from "../category-bar";
import { tenantConfig } from "../../tenant.config";
import { plannerEnabled } from "../../lib/planner-flag";
import * as copy from "./copy";
import { Planner } from "./planner";

/**
 * /plan: the order builder (order-builder spec §C, GOL-3383). Four questions,
 * a planned order, Build my order. Behind `PLANNER_ENABLED` (§F kill switch,
 * a runtime env read per request): off, the route is a 404 like any other
 * unknown path.
 */
export const metadata: Metadata = {
  title: "Plant a community",
  description:
    "Tell us where you are planting and what you want from it. We lay out a planting as a community from what we grow: anchors, companions, and the layers between.",
  alternates: { canonical: "/plan" },
};

export const dynamic = "force-dynamic";

export default function PlanPage() {
  if (!plannerEnabled()) notFound();
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  return (
    <>
      <CategoryBar />
      <section className="section">
        <div className="section-header">
          <div>
            <span className="section-tag">{copy.PLAN_EYEBROW}</span>
            <span className="plan-experimental" data-testid="plan-experimental">
              {copy.PLAN_EXPERIMENTAL_TAG}
            </span>
            <h1>
              {copy.PLAN_HEADING.lead} <em>{copy.PLAN_HEADING.em}</em>
            </h1>
          </div>
        </div>
        <p className="section-lede">{copy.PLAN_LEDE}</p>
        <p className="plan-experimental-note">{copy.PLAN_EXPERIMENTAL_NOTE}</p>
        <div className="max-w-5xl">
          <Suspense fallback={null}>
            <Planner mode="page" odooBase={odooBase} contact={tenantConfig.contact} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
