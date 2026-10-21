"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GlyphIcon } from "@grove/ui-kit";
import {
  answersComplete,
  parsePlanParams,
  plan,
  planParamsToSearch,
  stateBand,
  type PlanAnswers,
  type PlanInput,
  type PlannerCatalog,
  type ZoneInput,
} from "@grove/planner";
import type { ShippingCalendar } from "@grove/odoo-client";
import * as copy from "./copy";
import { Questions, type ZoneStatus } from "./questions";
import { ResultCard } from "./result-card";

export interface PlannerCatalogPayload extends PlannerCatalog {
  calendar: ShippingCalendar | null;
  source?: "odoo" | "fixture";
}

export interface PlannerProps {
  /** "page" renders the result in place; "home" sends the four answers to /plan. */
  mode: "page" | "home";
  odooBase: string;
  contact: { phone: string; email: string };
  /** Answers to start from (the page passes the URL's; the teaser starts empty). */
  initialAnswers?: PlanAnswers;
}

type CatalogState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; catalog: PlannerCatalogPayload }
  | { kind: "error" };

/**
 * The order builder (order-builder spec §C): the four questions, the planner
 * run, the result card. Every answer lives in the URL on /plan so a result is
 * shareable; the home teaser keeps answers local and hands them to /plan.
 */
export function Planner({ mode, odooBase, contact, initialAnswers }: PlannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlAnswers = useMemo(
    () => (mode === "page" ? parsePlanParams(searchParams) : {}),
    [mode, searchParams],
  );
  const [localAnswers, setLocalAnswers] = useState<PlanAnswers>(initialAnswers ?? {});
  const answers = mode === "page" ? urlAnswers : localAnswers;

  const setAnswers = useCallback(
    (next: PlanAnswers) => {
      if (mode === "page") {
        const search = planParamsToSearch(next);
        router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
      } else {
        setLocalAnswers(next);
      }
    },
    [mode, pathname, router],
  );

  // ── Question 1: ZIP → zone, with the state fallback ───────────────────────
  const [zone, setZone] = useState<ZoneStatus>({ kind: "idle" });
  const zoneReq = useRef(0);
  useEffect(() => {
    const zip = answers.zip;
    if (!zip) {
      setZone({ kind: "idle" });
      return;
    }
    const id = ++zoneReq.current;
    setZone({ kind: "loading" });
    fetch(`/api/zone?zip=${zip}`)
      .then(async (res) => {
        if (id !== zoneReq.current) return;
        if (res.ok) {
          const data = (await res.json()) as { zone: number };
          setZone({ kind: "known", zone: data.zone });
        } else {
          setZone({ kind: "unknown" });
        }
      })
      .catch(() => {
        if (id === zoneReq.current) setZone({ kind: "error" });
      });
  }, [answers.zip]);

  // ── The catalog: fetched once per quiz run, only once it is needed ────────
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "idle" });
  const needsCatalog =
    mode === "page" ? !!(answers.zip || answers.state) : zone.kind === "unknown" || zone.kind === "error";
  const loadCatalog = useCallback(() => {
    setCatalog({ kind: "loading" });
    fetch("/api/planner/catalog")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setCatalog({ kind: "ready", catalog: (await res.json()) as PlannerCatalogPayload });
      })
      .catch(() => setCatalog({ kind: "error" }));
  }, []);
  useEffect(() => {
    if (needsCatalog && catalog.kind === "idle") loadCatalog();
  }, [needsCatalog, catalog.kind, loadCatalog]);

  const ready = catalog.kind === "ready" ? catalog.catalog : null;

  // ── The plan ──────────────────────────────────────────────────────────────
  const zoneInput: ZoneInput | null = useMemo(() => {
    if (zone.kind === "known") return zone.zone;
    if (answers.state && ready) {
      const band = stateBand(ready.state_zones, answers.state);
      return band ? { band } : null;
    }
    return null;
  }, [zone, answers.state, ready]);

  const complete = answersComplete(answers) && zoneInput != null;
  const input: PlanInput | null = useMemo(() => {
    if (!complete || zoneInput == null || !answers.site || !answers.track || answers.size == null) return null;
    return {
      zone: zoneInput,
      state: answers.state ?? null,
      site: answers.site,
      track: answers.track,
      subgoal: answers.subgoal,
      size: answers.size,
      timing: answers.timing ?? (answers.track === "deer" ? "all" : "mixed"),
    };
  }, [complete, zoneInput, answers]);

  const result = useMemo(() => (input && ready ? plan(input, ready) : null), [input, ready]);

  // A complete URL (shared link, Edit then See my plan) renders the result at
  // once; answering live keeps the four questions on screen until the
  // customer asks to see the plan, so question 4 is a real question and not
  // a default that slips by.
  const [editing, setEditing] = useState(false);
  const showResult = mode === "page" && input != null && !editing;

  const eyebrow = useMemo(() => {
    const band = answers.state ? ready?.state_zones[answers.state] : undefined;
    const where =
      zone.kind === "known" && answers.zip
        ? `ZIP ${answers.zip}, zone ${zone.zone}`
        : answers.state
          ? `${answers.state}${band ? `, zones ${band[0]} to ${band[1]}` : ""}`
          : answers.zip
            ? `ZIP ${answers.zip}`
            : "";
    const site = answers.site ? copy.SITES[answers.site].label.toLowerCase() : "";
    return [where, site].filter(Boolean).join(", ");
  }, [answers.zip, answers.state, answers.site, zone, ready]);

  const search = planParamsToSearch(answers);

  return (
    <div className="plan" data-mode={mode}>
      {!showResult && (
        <>
          <Questions
            answers={answers}
            onChange={(next) => {
              setAnswers(next);
              setEditing(true);
            }}
            zone={zone}
            states={ready?.states ?? null}
            compact={mode === "home"}
          />
          {mode === "home" && complete && (
            <div className="mt-8">
              <a href={`/plan?${search}`} className="btn btn-forest" data-testid="plan-see">
                {copy.SEE_PLAN} <GlyphIcon name="arrow-right" />
              </a>
            </div>
          )}
          {mode === "page" && editing && input && (
            <div className="mt-8">
              <button type="button" className="btn btn-forest" data-testid="plan-see" onClick={() => setEditing(false)}>
                {copy.SEE_PLAN} <GlyphIcon name="arrow-right" />
              </button>
            </div>
          )}
        </>
      )}

      {showResult && (
        <div className="mt-2">
          {catalog.kind === "loading" || catalog.kind === "idle" ? (
            <ResultSkeleton />
          ) : catalog.kind === "error" ? (
            <div role="alert" className="rounded-lg border border-caution/40 bg-paper-soft p-6" data-testid="plan-error">
              <p className="font-display text-xl text-primary-deep">{copy.CATALOG_ERROR}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="btn btn-forest" onClick={loadCatalog}>
                  {copy.RETRY}
                </button>
                <button type="button" className="btn btn-forest-outline" onClick={() => setEditing(true)}>
                  {copy.EDIT_ANSWERS}
                </button>
              </div>
            </div>
          ) : result && input && ready ? (
            <ResultCard
              result={result}
              input={input}
              eyebrow={eyebrow}
              calendar={ready.calendar ?? null}
              odooBase={odooBase}
              contact={contact}
              onEdit={() => setEditing(true)}
              onRetrySite={() => setAnswers({ ...answers, site: "open" })}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div aria-busy="true" aria-label={copy.CATALOG_LOADING} className="animate-pulse space-y-4" data-testid="plan-loading">
      <div className="h-3 w-48 rounded bg-primary/10" />
      <div className="h-8 w-3/4 max-w-xl rounded bg-primary/10" />
      <div className="mt-6 h-32 rounded-lg bg-primary/[0.06]" />
      <div className="h-20 rounded bg-primary/[0.06]" />
      <div className="h-20 rounded bg-primary/[0.06]" />
      <p className="text-sm text-ink-soft">{copy.CATALOG_LOADING}</p>
    </div>
  );
}
