import type { PlanLine, PlannerPlant } from "@grove/planner";
import { stratumOf } from "@grove/planner";
import * as copy from "./copy";
import { CautionMark } from "./questions";

/**
 * The winter-beta line badges (planner-winter-beta spec §C.1): stratum and
 * role, succession, "fixes N", "Needs review", and the substrate line on
 * spawn. Each badge pairs its colour with words (or a mark), so nothing here
 * reads by colour alone.
 */

export function CaptionGlyph({ text, title }: { text: string; title?: string }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft" title={title}>
      {text}
    </span>
  );
}

export function LineBadges({ line }: { line: Pick<PlanLine, "plant" | "manual"> }) {
  const p: PlannerPlant = line.plant;
  const stratumRole = copy.stratumRole(stratumOf(p), p.role ?? null);
  return (
    <>
      {stratumRole && (
        <span
          className="rounded-full bg-primary/[0.08] px-2 py-0.5 font-mono tracking-[0.14em] uppercase text-primary-deep"
          data-testid="plan-badge-stratum"
        >
          {stratumRole}
        </span>
      )}
      {p.succession && <CaptionGlyph text={copy.SUCCESSION_LABELS[p.succession]} />}
      {p.nitrogen_fixer && <CaptionGlyph text={copy.FIXES_N} title={copy.FIXES_N_TITLE} />}
      {line.manual && (
        <span className="rounded-full border border-accent-fg/40 px-2 py-0.5 font-mono tracking-[0.14em] uppercase text-accent-fg" data-testid="plan-badge-manual">
          {copy.YOUR_PICK}
        </span>
      )}
      {p.flagged && (
        <span className="inline-flex items-center gap-1 text-caution" title={copy.NEEDS_REVIEW_TITLE} data-testid="plan-badge-review">
          <CautionMark />
          {copy.NEEDS_REVIEW}
        </span>
      )}
    </>
  );
}

export function SubstrateLine({ plant }: { plant: PlannerPlant }) {
  if (!plant.substrate) return null;
  return (
    <p className="mt-1 text-sm text-ink-soft" data-testid="plan-substrate">
      {copy.GROWS_ON(plant.substrate)}
    </p>
  );
}
