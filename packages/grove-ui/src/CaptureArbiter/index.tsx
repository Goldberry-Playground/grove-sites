"use client";

/**
 * One-CTA-per-page arbitration (GOL-2178 / GOL-2171).
 *
 * House rule (Josh ratified 2026-09-07): at most ONE email-capture *tier*
 * renders per navigation page. When more than one qualifies, the highest
 * priority wins and every lower tier suppresses itself. The ladder:
 *
 *   1. restock    — a product on this page is unavailable (sold out / preorder
 *                   cap reached) → "notify me when it's back"
 *   2. state      — the viewer's state isn't served yet (PLACEHOLDER tier; the
 *                   "when we ship to your state" capture is built separately in
 *                   GOL-2174 and registers here once it exists — do NOT invent
 *                   its data model in this module)
 *   3. newsletter — the general goldberrygrove / blog subscribe line (the shared
 *                   footer form in each app's layout)
 *
 * The footer `CaptureForm` is a SHARED layout concern, so suppression can never
 * be a per-page delete of a call site — it is driven from context here. A
 * page/section wraps its higher-priority capture in <CaptureSlot priority="…">;
 * that registers the tier, and every lower-priority <CaptureSlot> (the footer
 * newsletter) renders null while it is present. Homepage keeps the newsletter
 * only because nothing higher-priority applies — the same outcome as GOL-931 by
 * generalisation (superseded, not reverted).
 *
 * The rule bounds *tiers*, not instances within a tier: a /shop grid of several
 * sold-out cards may each mount a `restock` slot — they are the same offer
 * ("notify me about a specific product"), so they coexist while the lone footer
 * newsletter stays suppressed.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Capture tiers, highest priority first. Extend the ladder here, never inline. */
export type CapturePriority = "restock" | "state" | "newsletter";

/** Lower rank = higher priority. Kept private so callers speak in tier names. */
const RANK: Record<CapturePriority, number> = {
  restock: 1,
  state: 2,
  newsletter: 3,
};

interface ArbiterValue {
  register: (id: string, rank: number) => void;
  unregister: (id: string) => void;
  /** The best (lowest) rank currently registered; Infinity when none. */
  topRank: number;
}

const CaptureArbiterContext = createContext<ArbiterValue | null>(null);

/**
 * Wrap an app's tree once (via GroveProviders) so every <CaptureSlot> beneath
 * it arbitrates against the same registry. Absent (Storybook / Claude Design /
 * a standalone component) every slot renders unconditionally — see CaptureSlot.
 */
export function CaptureArbiterProvider({ children }: { children: ReactNode }) {
  const [ranks, setRanks] = useState<Record<string, number>>({});

  const register = useCallback((id: string, rank: number) => {
    setRanks((prev) => (prev[id] === rank ? prev : { ...prev, [id]: rank }));
  }, []);

  const unregister = useCallback((id: string) => {
    setRanks((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const topRank = useMemo(() => {
    const values = Object.values(ranks);
    return values.length ? Math.min(...values) : Infinity;
  }, [ranks]);

  const value = useMemo<ArbiterValue>(
    () => ({ register, unregister, topRank }),
    [register, unregister, topRank],
  );

  return (
    <CaptureArbiterContext.Provider value={value}>
      {children}
    </CaptureArbiterContext.Provider>
  );
}

export interface CaptureSlotProps {
  /** This capture's tier in the ladder. */
  priority: CapturePriority;
  children: ReactNode;
}

/**
 * Renders `children` only when no strictly-higher-priority capture is present
 * on the page. Registers its own tier on mount and releases it on unmount, so
 * navigating away from a page whose restock/state capture kept the footer
 * newsletter suppressed lets the newsletter re-appear.
 *
 * SSR note: registration runs in an effect (client-only), so the server render
 * — and the first client render before effects flush — has an empty registry
 * and every slot renders. After mount the lower tiers settle to null. The only
 * visible tier this can briefly double-show is the below-the-fold footer
 * newsletter, which then collapses; there is no hydration mismatch because
 * server and first client render agree.
 */
export function CaptureSlot({ priority, children }: CaptureSlotProps) {
  const ctx = useContext(CaptureArbiterContext);
  const id = useId();
  const rank = RANK[priority];

  useEffect(() => {
    if (!ctx) return;
    ctx.register(id, rank);
    return () => ctx.unregister(id);
  }, [ctx, id, rank]);

  // No provider in the tree (Storybook / standalone) → never suppress.
  if (!ctx) return <>{children}</>;

  // Win iff nothing strictly higher-priority is registered. Equal ranks (same
  // tier) all win — the /shop multi-card case.
  return rank <= ctx.topRank ? <>{children}</> : null;
}
