"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CaptureForm, GlyphIcon, REQUEST_CONSENT_TEXT } from "@grove/ui-kit";
import { formatPhone } from "@grove/ui";
import { useCart, type CartItem } from "@grove/checkout";
import { resolveOdooImageUrl, type ShipWave, type ShippingCalendar } from "@grove/odoo-client";
import {
  applyBundle,
  countTrees,
  isFungal,
  manualLine,
  nextFor,
  orderLines,
  slotsFor,
  stratumOf,
  suggested,
  survivingManual,
  type BundleOffer,
  type PlanInput,
  type PlanLine,
  type PlanResult,
  type PlannerCatalog,
  type PlannerPlant,
  type Slot,
  type SuggestedPlant,
} from "@grove/planner";
import { ProductImage } from "../product-image";
import { barerootNote, resolveShippableMode } from "../../lib/fulfillment-mode";
import { postSave, postSignal, type SaveOutcome, type SignalContext } from "../../lib/planner-signals";
import { firstOpenWave, preorderWaves } from "../../lib/preorder-waves";
import { LineBadges, SubstrateLine } from "./badges";
import * as copy from "./copy";
import { dropSpan } from "./months";
import { CautionMark, CheckMark } from "./questions";
import { SuggestForm } from "./suggest-form";
import { SuggestedList } from "./suggested-list";

export interface ResultCardProps {
  result: PlanResult;
  input: PlanInput;
  /** The catalog the result was planned over (Swap and the suggested list re-read it). */
  catalog: PlannerCatalog;
  /** "ZIP 26501, zone 6, open ground" */
  eyebrow: string;
  calendar: ShippingCalendar | null;
  odooBase: string;
  contact: { phone: string; email: string };
  /** The customer's own picks (template ids); kept by the parent so they survive Edit (§C.2). */
  manualIds: readonly number[];
  onManualChange: (ids: number[]) => void;
  onEdit: () => void;
  onRetrySite: () => void;
  /** Signal transport seam (tests). */
  signal?: typeof postSignal;
  save?: typeof postSave;
}

/** A line the customer can still edit: the planner's line plus a live qty. */
interface EditableLine extends PlanLine {
  removed?: boolean;
}

type TierKey = "bareroot" | "potted";
const TIER_LABEL: Record<TierKey, string> = { bareroot: "bareroot", potted: "potted" };

const LAYER_ROWS: Slot[] = ["canopy", "understory", "shrub", "mushroom"];
const SEASON_ROWS: Slot[] = ["early", "late", "offseason"];

/* The site-wide orange `.btn` / `.btn-outline` measure 4.11:1 and 3.34:1 for
   their 13px text (below AA), so the builder's CTAs use the forest variant
   (9.8:1) and a forest outline for the secondary actions. Same shape, same
   type, AA-safe. */
const OUTLINE_BTN = "btn btn-forest-outline";
const REMOVE_BTN = "inline-flex min-h-11 items-center text-xs text-ink-soft underline underline-offset-2";

export { dropSpan } from "./months";

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function headlineFor(result: PlanResult, input: PlanInput, subgoalLabel?: string): string {
  const noun = input.track === "agro" && subgoalLabel ? subgoalLabel.toLowerCase() : copy.TRACK_NOUN[input.track];
  if (result.status === "empty") {
    const where = typeof input.zone === "number" ? `zone ${input.zone}` : "your zone range";
    return `Nothing we grow fits ${copy.SITE_NOUN[input.site]} in ${where} yet.`;
  }
  if (input.track === "deer") {
    const span = dropSpan(result.harvestMonths);
    return span ? `Something dropping from ${span}.` : `Your ${input.size}-tree ${noun}.`;
  }
  // Spawn fruits in its first season; the headline is about the trees.
  const years = result.lines
    .filter((l) => !isFungal(l.plant))
    .map((l) => l.plant.years_to_fruit_min)
    .filter((y): y is number => typeof y === "number" && y > 0);
  const lead = `Your ${input.size}-tree ${noun}`;
  if (result.status === "partial") {
    const filled = result.lines.filter((l) => !isFungal(l.plant)).length;
    const total = filled + result.unfilled.length;
    return `${lead}: we filled ${filled} of ${total} layers.`;
  }
  if (years.length === 0) return `${lead}.`;
  const n = Math.min(...years);
  return `${lead}, first harvest in about ${n} ${n === 1 ? "year" : "years"}.`;
}

export function ResultCard({
  result,
  input,
  catalog,
  eyebrow,
  calendar,
  odooBase,
  contact,
  manualIds,
  onManualChange,
  onEdit,
  onRetrySite,
  signal = postSignal,
  save = postSave,
}: ResultCardProps) {
  // The engine's lines in planting order (stratum, then anchors first) plus
  // the customer's own picks that still pass this result's filter (§C.2).
  // Read through a ref so a hand add (which changes `manualIds`) does not
  // re-seed the card and undo a Remove or a Swap made before it; only a new
  // result (new answers) starts the lines over.
  const manualRef = useRef(manualIds);
  manualRef.current = manualIds;
  const seedLines = useCallback(
    (): EditableLine[] => orderLines([...result.lines, ...survivingManual(input, catalog, result, manualRef.current)]),
    [result, input, catalog],
  );
  const [lines, setLines] = useState<EditableLine[]>(seedLines);
  const [bundleTaken, setBundleTaken] = useState(false);
  // Plants swapped out stay out: Swap never offers them back (§C.1).
  const [swappedOut, setSwappedOut] = useState<number[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const scrollTo = useRef<number | null>(null);
  useEffect(() => {
    setLines(seedLines());
    setBundleTaken(false);
    setSwappedOut([]);
    setNotice(null);
  }, [seedLines]);
  // A pick the engine placed itself on a re-run is no longer "manual".
  useEffect(() => {
    const placed = new Set(result.lines.map((l) => l.plant.id));
    const still = manualIds.filter((id) => !placed.has(id));
    if (still.length !== manualIds.length) onManualChange(still);
  }, [result, manualIds, onManualChange]);

  const signalCtx = useCallback(
    (): SignalContext => ({
      input,
      planUrl: typeof window === "undefined" ? "" : window.location.href,
      catalogVersion: catalog.catalog_version ?? null,
    }),
    [input, catalog.catalog_version],
  );

  const active = lines.filter((l) => !l.removed);
  const subtotal = active.reduce((s, l) => s + l.qty * l.plant.price, 0) +
    (bundleTaken && result.bundle ? result.bundle.price : 0);
  const treeCount = countTrees(active) + (bundleTaken && result.bundle ? result.bundle.covers : 0);
  const isDeer = input.track === "deer";
  // Only the rows this track plans (alley crop has no understory slot), plus
  // any layer a support plant actually lands in. The mushroom row shows only
  // once a spawn line sits in it, so a catalog without spawn has no empty row.
  const planned = new Set(slotsFor(input.track, input.subgoal, input.timing).map((s) => s.slot));
  const rows = (isDeer ? SEASON_ROWS : LAYER_ROWS).filter(
    (r) => (planned.has(r) && r !== "mushroom") || active.some((l) => rowOfLine(l) === r),
  );
  const headline = headlineFor(result, input, input.subgoal ? copy.SUBGOALS[input.subgoal] : undefined);

  const suggestions = useMemo(
    () => suggested(input, catalog, result, lines.map((l) => l.plant.id)),
    [input, catalog, result, lines],
  );

  function remove(id: number) {
    setLines((cur) => cur.map((l) => (l.plant.id === id ? { ...l, removed: true } : l)));
    void signal("removed", signalCtx(), id);
  }

  function swap(line: EditableLine) {
    const exclude = [...lines.map((l) => l.plant.id), ...swappedOut];
    const next = nextFor(input, catalog, line.slot, exclude);
    if (!next) {
      setNotice({ kind: "error", text: copy.SWAP_NONE(copy.SLOT_LABELS[line.slot]) });
      return;
    }
    setLines((cur) => cur.map((l) => (l.plant.id === line.plant.id ? { ...next, removed: false } : l)));
    setSwappedOut((cur) => [...cur, line.plant.id]);
    if (line.manual) onManualChange(manualIds.filter((id) => id !== line.plant.id));
    setNotice({ kind: "ok", text: copy.SWAPPED_FOR(line.plant.name, next.plant.name) });
    scrollTo.current = next.plant.id;
    void signal("swapped", signalCtx(), line.plant.id);
  }

  function add(pick: SuggestedPlant) {
    const line = manualLine(pick);
    setLines((cur) => [...cur.filter((l) => l.plant.id !== line.plant.id), line]);
    onManualChange([...manualIds.filter((id) => id !== line.plant.id), line.plant.id]);
    setNotice({ kind: "ok", text: copy.SUGGESTED_ADDED(line.plant.name) });
    scrollTo.current = line.plant.id;
    void signal("added", signalCtx(), line.plant.id);
  }

  // After an add or a swap, bring the line into view and put focus on it so a
  // keyboard or screen-reader user lands where the change happened.
  useEffect(() => {
    const id = scrollTo.current;
    if (id == null) return;
    scrollTo.current = null;
    const el = document.querySelector<HTMLElement>(`[data-plan-line="${id}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
  }, [lines]);

  if (result.status === "empty") {
    return (
      <section aria-labelledby="plan-result-heading" className="plan-result" data-status="empty">
        <Eyebrow text={eyebrow} onEdit={onEdit} />
        <h2 id="plan-result-heading" className="font-display font-medium text-3xl text-primary-deep mt-2 max-w-[28ch] leading-tight">
          {headline}
        </h2>
        <p className="mt-3 max-w-prose text-ink-soft">
          Every plant we grow is rated for a zone range and a kind of ground. A drier spot usually opens the list right up, and if the land is what it is, we will plan around it with you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {input.site !== "open" && (
            <button type="button" className="btn btn-forest" onClick={onRetrySite}>
              {copy.TRY_OPEN_GROUND}
            </button>
          )}
          <a href="#consult" className={OUTLINE_BTN}>
            {copy.TALK_FIRST}
          </a>
        </div>
        <ConsultPanel contact={contact} />
        <SuggestForm />
      </section>
    );
  }

  return (
    <section aria-labelledby="plan-result-heading" className="plan-result" data-status={result.status}>
      <Eyebrow text={eyebrow} onEdit={onEdit} />
      <h2 id="plan-result-heading" className="font-display font-medium text-3xl text-primary-deep mt-2 max-w-[28ch] leading-tight">
        {headline}
      </h2>
      {result.status === "partial" && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-caution">
          <CautionMark />
          <span>
            We had nothing in stock for the {result.unfilled.map((s) => copy.SLOT_LABELS[s].toLowerCase()).join(" and ")}{" "}
            {result.unfilled.length === 1 ? "layer" : "layers"} on this ground. The consult can fill it.
          </span>
        </p>
      )}
      {!isDeer && (
        <p className="mt-4 max-w-prose border-l-2 border-primary/30 pl-4 text-sm text-ink-soft" data-testid="plan-philosophy">
          {copy.PHILOSOPHY}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-10 lg:gap-y-8">
        <div className="order-1 lg:col-start-1 lg:row-start-1">
          <LayerStrip rows={rows} lines={active} />
        </div>
        <div className="order-3 lg:col-start-1 lg:row-start-2">
          <p role="status" aria-live="polite" className={notice ? `mb-3 flex items-start gap-1.5 text-sm ${notice.kind === "error" ? "text-caution" : "text-affirm"}` : "sr-only"} data-testid="plan-notice">
            {notice && (notice.kind === "error" ? <CautionMark /> : <CheckMark />)}
            {notice && <span>{notice.text}</span>}
          </p>
          <ul className="divide-y divide-primary/10 border-y border-primary/10" aria-label="Planned lines">
            {lines.map((line) => (
              <LineRow
                key={line.plant.id}
                line={line}
                odooBase={odooBase}
                substitution={result.substitutions.find((s) => s.to.id === line.plant.id)}
                onQty={(qty) =>
                  setLines((cur) => cur.map((l) => (l.plant.id === line.plant.id ? { ...l, qty } : l)))
                }
                onRemove={() => remove(line.plant.id)}
                onSwap={() => swap(line)}
                onRestore={() =>
                  setLines((cur) => cur.map((l) => (l.plant.id === line.plant.id ? { ...l, removed: false } : l)))
                }
              />
            ))}
            {bundleTaken && result.bundle && <BundleLineRow offer={result.bundle} />}
          </ul>
          {(lines.some((l) => l.removed || l.manual || l.qty !== result.lines.find((r) => r.plant.id === l.plant.id)?.qty) || bundleTaken) && (
            <button
              type="button"
              className="mt-3 text-sm text-primary underline underline-offset-2"
              onClick={() => {
                setLines(orderLines(result.lines));
                setBundleTaken(false);
                setSwappedOut([]);
                onManualChange([]);
              }}
            >
              {copy.RESET_PLAN}
            </button>
          )}

          {result.notify.length > 0 && <NotifyChips plants={result.notify} />}

          <SuggestedList suggestions={suggestions} onAdd={add} />
          <SuggestForm />
        </div>

        <aside className="order-2 self-start rounded-lg border border-primary/15 bg-paper-soft p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-soft">Trees</dt>
            <dd className="text-right font-semibold">{treeCount}</dd>
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="text-right font-semibold">{usd(subtotal)}</dd>
          </dl>
          <ShipTiming lines={active} calendar={calendar} zone={input.zone} />
          {result.bundle && !bundleTaken && (
            <BundleOfferBox
              offer={result.bundle}
              onAccept={() => {
                setLines((cur) => {
                  const kept = applyBundle(cur.filter((l) => !l.removed), result.bundle!);
                  return cur.map((l) => {
                    const k = kept.find((x) => x.plant.id === l.plant.id);
                    return k ? { ...l, qty: k.qty } : { ...l, removed: true };
                  });
                });
                setBundleTaken(true);
              }}
            />
          )}
          <BuildButtons
            lines={active}
            bundle={bundleTaken ? result.bundle ?? null : null}
            calendar={calendar}
            zone={input.zone}
            odooBase={odooBase}
            onBuilt={() => void signal("built", signalCtx())}
          />
          {result.consult && (
            <a href="#consult" className="mt-3 block text-center text-sm font-semibold text-primary underline underline-offset-2">
              {copy.TALK_FIRST}
            </a>
          )}
          <SavePlan lines={active} input={input} save={save} onSaved={() => void signal("saved", signalCtx())} />
        </aside>
      </div>

      {result.consult && <ConsultPanel contact={contact} />}
    </section>
  );
}

/**
 * Save this plan (§C.1 / §B.7): a name and a button. The copy goes to Odoo
 * as a `grove.planner.plan`; the answers stay in the URL regardless, so a
 * failure here loses nothing.
 */
function SavePlan({
  lines,
  input,
  save,
  onSaved,
}: {
  lines: PlanLine[];
  input: PlanInput;
  save: typeof postSave;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "saving" } | { kind: "done"; name: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const inputId = "plan-save-name";

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setState({ kind: "error", text: copy.SAVE_NAME_REQUIRED });
      document.getElementById(inputId)?.focus();
      return;
    }
    setState({ kind: "saving" });
    const outcome: SaveOutcome = await save({
      name: trimmed,
      plan_url: typeof window === "undefined" ? null : window.location.href,
      zone: typeof input.zone === "number" ? input.zone : null,
      track: input.track,
      lines: lines.map((l) => ({
        product_tmpl_id: l.plant.id,
        qty: l.qty,
        role: l.plant.role ?? null,
        stratum: stratumOf(l.plant),
      })),
    });
    if (outcome.ok) {
      setState({ kind: "done", name: trimmed });
      onSaved();
    } else {
      setState({ kind: "error", text: outcome.reason === "off" ? copy.SAVE_OFF : copy.SAVE_FAILED });
    }
  }

  if (lines.length === 0) return null;
  return (
    <div className="mt-5 border-t border-primary/10 pt-4" data-testid="plan-save">
      <h3 className="text-sm font-semibold text-foreground">{copy.SAVE_HEADING}</h3>
      <p className="mt-1 text-xs text-ink-soft">{copy.SAVE_LEDE}</p>
      {state.kind === "done" ? (
        <p role="status" className="mt-3 flex items-start gap-1.5 text-sm text-affirm">
          <CheckMark />
          <span>{copy.SAVE_DONE(state.name)}</span>
        </p>
      ) : (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor={inputId} className="text-xs font-semibold">
            {copy.SAVE_NAME_LABEL}
          </label>
          <input
            id={inputId}
            name="plan-name"
            type="text"
            maxLength={200}
            value={name}
            placeholder={copy.SAVE_NAME_PLACEHOLDER}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={state.kind === "error" && !name.trim() ? true : undefined}
            aria-describedby={state.kind === "error" ? "plan-save-error" : undefined}
            className="w-full rounded border border-primary/30 bg-paper px-3 py-2 text-base"
          />
          {state.kind === "error" && (
            <p id="plan-save-error" role="alert" className="flex items-start gap-1.5 text-sm text-caution">
              <CautionMark />
              <span>{state.text}</span>
            </p>
          )}
          <button type="submit" className={`${OUTLINE_BTN} w-full justify-center`} disabled={state.kind === "saving"} data-testid="plan-save-button">
            {state.kind === "saving" ? copy.SAVE_SAVING : copy.SAVE_BUTTON}
          </button>
        </form>
      )}
    </div>
  );
}

function Eyebrow({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.18em] uppercase text-accent-fg">
      <span>{text}</span>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 rounded px-2 normal-case tracking-normal font-sans text-sm font-semibold text-primary underline underline-offset-2"
      >
        {copy.EDIT_ANSWERS}
      </button>
    </p>
  );
}

/**
 * The layer strip: canopy over understory over shrub (seasons for deer), each
 * line placed in its row so the customer sees why there are eight shrubs and
 * two canopy trees. Support plants sit in their own botanical layer with a
 * "support" tag, since that is where they will actually grow.
 */
/** The strip row a line sits in: its slot, or its botanical layer for a support plant. */
function rowOfLine(line: PlanLine): Slot {
  if (isFungal(line.plant)) return "mushroom";
  if (line.slot === "support") {
    const layer = line.plant.layer;
    return layer === "canopy" || layer === "understory" || layer === "shrub" ? layer : "shrub";
  }
  return line.slot;
}

function LayerStrip({ rows, lines }: { rows: Slot[]; lines: EditableLine[] }) {
  const rowOf = rowOfLine;
  return (
    <ol className="overflow-hidden rounded-lg border border-primary/15" aria-label="Layers">
      {rows.map((row, i) => {
        const here = lines.filter((l) => rowOf(l) === row);
        const tint = ["bg-primary/[0.09]", "bg-primary/[0.06]", "bg-primary/[0.03]", "bg-secondary/10"][i] ?? "";
        return (
          <li key={row} className={`grid grid-cols-[7rem_1fr] items-center gap-3 border-b border-primary/10 last:border-b-0 ${tint} px-4 py-3`}>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary-deep">
              {copy.SLOT_LABELS[row]}
            </span>
            <span className="flex flex-wrap gap-2">
              {here.length === 0 && <span className="text-sm text-ink-soft">Nothing here yet</span>}
              {here.map((l) => (
                <span
                  key={l.plant.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-paper-soft px-3 py-1 text-sm"
                >
                  <span className="font-semibold">{l.qty}</span>
                  <span>{l.plant.name}</span>
                  {l.slot === "support" && (
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">support</span>
                  )}
                  {l.manual && (
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-accent-fg">{copy.YOUR_PICK}</span>
                  )}
                </span>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LineRow({
  line,
  odooBase,
  substitution,
  onQty,
  onRemove,
  onSwap,
  onRestore,
}: {
  line: EditableLine;
  odooBase: string;
  substitution?: { from: PlannerPlant; state: string };
  onQty: (qty: number) => void;
  onRemove: () => void;
  onSwap: () => void;
  onRestore: () => void;
}) {
  const p = line.plant;
  if (line.removed) {
    return (
      <li className="flex items-center justify-between gap-3 py-3 text-sm text-ink-soft" data-plan-line={p.id}>
        <span>
          <span className="line-through">{p.name}</span> removed
        </span>
        <button type="button" className="min-h-11 px-2 font-semibold text-primary underline underline-offset-2" onClick={onRestore}>
          Undo
        </button>
      </li>
    );
  }
  return (
    <li
      className="grid grid-cols-[4rem_1fr] gap-4 py-4 sm:grid-cols-[4rem_1fr_auto]"
      data-testid="plan-line"
      data-plan-line={p.id}
      data-tier={tierOf(p)}
      data-manual={line.manual ? "true" : undefined}
    >
      <div className="relative h-16 w-16 overflow-hidden rounded bg-paper-deep">
        <ProductImage src={p.image ? resolveOdooImageUrl(p.image, odooBase) : null} alt="" sizes="64px" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/shop/${p.id}`} className="font-semibold text-foreground underline-offset-2 hover:underline">
            {p.name}
          </Link>
          <span className="text-sm italic text-ink-soft">{p.botanical_name}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-primary/25 px-2 py-0.5 font-mono tracking-[0.14em] uppercase text-primary-deep">
            {copy.SLOT_LABELS[line.slot]}
          </span>
          <LineBadges line={line} />
          {line.zoneFit === "marginal" && (
            <span className="inline-flex items-center gap-1 text-caution">
              <CautionMark />
              {copy.MARGINAL_ZONE}
            </span>
          )}
          {line.note && <span className="text-ink-soft">{line.note}</span>}
        </div>
        <SubstrateLine plant={p} />
        {substitution && (
          <p className="mt-1 text-sm text-ink-soft">
            {stateName(substitution.state)}: {p.name.toLowerCase()} ships in place of {substitution.from.name.toLowerCase()}.
          </p>
        )}
      </div>
      {/* One set of controls in the DOM: a row under the text on a phone, a
          column at the right from `sm` up. Two copies toggled by CSS would put
          two "Remove" buttons in the accessibility tree. */}
      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2">
        <Stepper qty={line.qty} onQty={onQty} name={p.name} />
        <span className="text-sm font-semibold">{usd(line.qty * p.price)}</span>
        <span className="hidden text-xs text-ink-soft sm:inline">{usd(p.price)} each</span>
        <LineActions name={p.name} onRemove={onRemove} onSwap={onSwap} />
      </div>
    </li>
  );
}

/** Swap and Remove (§C.1), both named for the plant so a screen reader knows which line. */
function LineActions({ name, onRemove, onSwap }: { name: string; onRemove: () => void; onSwap: () => void }) {
  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" className={REMOVE_BTN} onClick={onSwap} aria-label={`${copy.SWAP_LINE} ${name}`} data-testid="plan-swap">
        {copy.SWAP_LINE}
      </button>
      <button type="button" className={REMOVE_BTN} onClick={onRemove} aria-label={`${copy.REMOVE_LINE} ${name}`} data-testid="plan-remove">
        {copy.REMOVE_LINE}
      </button>
    </span>
  );
}

function Stepper({ qty, onQty, name }: { qty: number; onQty: (q: number) => void; name: string }) {
  return (
    <div className="inline-flex items-center rounded border border-primary/25" role="group" aria-label={`Quantity of ${name}`}>
      <button
        type="button"
        className="min-h-11 min-w-11 text-lg leading-none"
        aria-label={`Fewer ${name}`}
        onClick={() => onQty(Math.max(1, qty - 1))}
      >
        &minus;
      </button>
      <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="min-h-11 min-w-11 text-lg leading-none"
        aria-label={`More ${name}`}
        onClick={() => onQty(Math.min(999, qty + 1))}
      >
        +
      </button>
    </div>
  );
}

function BundleLineRow({ offer }: { offer: BundleOffer }) {
  return (
    <li className="flex items-center justify-between gap-3 py-4" data-testid="plan-line">
      <div>
        <span className="font-semibold text-foreground">{offer.name}</span>
        <span className="ml-2 rounded-full border border-primary/25 px-2 py-0.5 font-mono text-[11px] tracking-[0.14em] uppercase text-primary-deep">
          bundle
        </span>
      </div>
      <span className="text-sm font-semibold">{usd(offer.price)}</span>
    </li>
  );
}

function BundleOfferBox({ offer, onAccept }: { offer: BundleOffer; onAccept: () => void }) {
  return (
    <div className="mt-4 rounded border border-primary/20 bg-paper p-3 text-sm" data-testid="plan-bundle-offer">
      {offer.consultBuilt ? (
        <>
          <p>
            <span className="font-semibold">{offer.name}</span> is a consult-built package: we build the mix with you, starting from this plan, for {usd(offer.price)}.
          </p>
          <button type="button" className="btn btn-forest mt-3 w-full justify-center" onClick={onAccept}>
            {copy.START_FROM_MIX}
          </button>
        </>
      ) : (
        <>
          <p>
            <span className="font-semibold">{offer.name}</span> covers {offer.covers} of these for {usd(offer.price)}, saves {usd(offer.saves)}.
          </p>
          <button type="button" className={`${OUTLINE_BTN} mt-3 w-full justify-center`} onClick={onAccept}>
            {copy.USE_BUNDLE}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Mirror of the cart's own add rule (`canAdd` in @grove/checkout's reducer,
 * which the package does not export and this issue may not touch): a cart is
 * all immediate, or a pre-order for exactly one wave, or seed only. Same
 * messages as the product page shows, so a refusal reads the same everywhere.
 */
export function cartAcceptsGroup(
  items: readonly CartItem[],
  wave: ShipWave | undefined,
): { ok: true } | { ok: false; message: string } {
  if (items.length === 0) return { ok: true };
  if (items.some((i) => i.seed)) {
    return { ok: false, message: "Seeds check out on their own. Check out or clear your cart first." };
  }
  const cartWave = items.find((i) => i.wave)?.wave;
  const mixed = items.some((i) => i.wave) && items.some((i) => !i.wave);
  const incomingKind = wave ? "preorder" : "immediate";
  const cartKind = cartWave ? "preorder" : "immediate";
  if (mixed || cartKind !== incomingKind) {
    return { ok: false, message: "Pre-orders check out on their own. Check out or clear your cart first." };
  }
  if (cartWave && cartWave !== wave) {
    return {
      ok: false,
      message: `Your cart is a ${cartWave} pre-order. One wave per order: check out or clear your cart first.`,
    };
  }
  return { ok: true };
}

function tierOf(plant: PlannerPlant): TierKey {
  return plant.tier === "potted" ? "potted" : "bareroot";
}

/** Ship timing from the live calendar: bareroot in the zone's window, potted now. */
function ShipTiming({ lines, calendar, zone }: { lines: PlanLine[]; calendar: ShippingCalendar | null; zone: PlanInput["zone"] }) {
  const usda = typeof zone === "number" ? zone : null;
  const tierKey = [...new Set(lines.map((l) => tierOf(l.plant)))].sort().join("+");
  const text = useMemo(() => {
    const tiers = new Set(tierKey.split("+").filter(Boolean));
    const parts: string[] = [];
    if (tiers.size === 2) parts.push(copy.SHIP_BOTH_TIERS);
    if (tiers.has("potted")) parts.push(copy.SHIP_POTTED(calendar?.fulfillment_days ?? [5, 10]));
    if (tiers.has("bareroot")) {
      if (calendar) parts.push(barerootNote(resolveShippableMode(new Date(), calendar, usda)));
      else parts.push("Bareroot trees ship dormant in your zone's window; the exact dates show at checkout.");
    }
    return parts;
  }, [calendar, usda, tierKey]);
  if (lines.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-primary/10 pt-3 text-sm text-ink-soft" data-testid="plan-ship-timing">
      {text.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  );
}

/**
 * Build my order: adds every line to the cart store the way the product page
 * does, then opens the mini cart. Potted lines are immediate; bareroot lines
 * are always a fall or spring wave pre-order (Josh 2026-10-07), so a plan with
 * both tiers is two orders, potted first, exactly as the cart's own rule
 * (`canAdd`) would otherwise refuse the mix at the second add.
 */
function BuildButtons({
  lines,
  bundle,
  calendar,
  zone,
  odooBase,
  onBuilt,
}: {
  lines: PlanLine[];
  bundle: BundleOffer | null;
  calendar: ShippingCalendar | null;
  zone: PlanInput["zone"];
  odooBase: string;
  /** Fired once per press, before the cart writes (§C.1: the `built` signal). */
  onBuilt: () => void;
}) {
  const { items, add, openDrawer } = useCart();
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [built, setBuilt] = useState<TierKey[]>([]);
  const usda = typeof zone === "number" ? zone : null;

  const groups: Record<TierKey, PlanLine[]> = { potted: [], bareroot: [] };
  for (const l of lines) groups[tierOf(l.plant)].push(l);
  const order: TierKey[] = (["potted", "bareroot"] as TierKey[]).filter((t) => groups[t].length > 0);
  if (bundle) order.push(...(order.includes("bareroot") ? [] : (["bareroot"] as TierKey[])));

  function build(tier: TierKey) {
    const group = groups[tier];
    let wave: ShipWave | undefined;
    if (tier === "bareroot") {
      const waves = usda != null ? preorderWaves(usda, new Date(), calendar) : [];
      wave = firstOpenWave(waves) ?? undefined;
      if (!wave) {
        setMessage({ kind: "error", text: copy.WAVES_CLOSED(usda ?? 0) });
        return;
      }
    }
    const check = cartAcceptsGroup(items, wave);
    if (!check.ok) {
      setMessage({ kind: "error", text: check.message });
      return;
    }
    const missing = group.filter((l) => !l.plant.variant_id);
    if (missing.length > 0) {
      setMessage({
        kind: "error",
        text: `We could not add ${missing.map((l) => l.plant.name).join(", ")} from here. Open the product page to add it.`,
      });
      return;
    }
    onBuilt();
    let first: number | undefined;
    for (const l of group) {
      const variantId = l.plant.variant_id as number;
      first ??= variantId;
      add(
        {
          variantId,
          templateId: l.plant.id,
          name: l.plant.name,
          price: l.plant.price,
          imageUrl: l.plant.image ? resolveOdooImageUrl(l.plant.image, odooBase) : "",
          ...(wave ? { wave } : {}),
        },
        l.qty,
      );
    }
    if (bundle && tier === "bareroot" && bundle.variantId) {
      first ??= bundle.variantId;
      add(
        {
          variantId: bundle.variantId,
          templateId: bundle.id,
          name: bundle.name,
          price: bundle.price,
          imageUrl: "",
          consultBuilt: bundle.consultBuilt,
          ...(wave ? { wave } : {}),
        },
        1,
      );
    }
    setBuilt((b) => [...b, tier]);
    setMessage({ kind: "ok", text: `Added ${countLabel(group, bundle && tier === "bareroot" ? bundle.covers : 0)} to your cart.` });
    openDrawer(first);
  }

  return (
    <div className="mt-4">
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mb-3 flex items-start gap-1.5 text-sm ${message.kind === "error" ? "text-caution" : "text-affirm"}`}
        >
          {message.kind === "error" ? <CautionMark /> : <CheckMark />}
          <span>{message.text}</span>
        </p>
      )}
      <div className="flex flex-col gap-2">
        {order.map((tier) => {
          const units = groups[tier].reduce((s, l) => s + l.qty, 0) + (bundle && tier === "bareroot" ? bundle.covers : 0);
          const label = order.length === 1 ? copy.BUILD_ORDER : copy.BUILD_GROUP(TIER_LABEL[tier], countLabel(groups[tier], bundle && tier === "bareroot" ? bundle.covers : 0));
          return (
            <button
              key={tier}
              type="button"
              className="btn btn-forest w-full justify-center"
              data-testid={`plan-build-${tier}`}
              disabled={built.includes(tier) || units === 0}
              onClick={() => build(tier)}
            >
              {label} <GlyphIcon name="arrow-right" />
            </button>
          );
        })}
      </div>
      {order.length === 2 && (
        <p className="mt-2 text-xs text-ink-soft">{copy.MIX_REFUSED_BARE_FIRST}</p>
      )}
    </div>
  );
}

/** "20 trees", "1 tree and 1 spawn", "2 spawn": what a build group holds, since spawn is not a tree. */
export function countLabel(group: readonly PlanLine[], extraTrees = 0): string {
  const trees = countTrees(group) + extraTrees;
  const spawn = group.reduce((s, l) => s + (isFungal(l.plant) ? l.qty : 0), 0);
  const parts: string[] = [];
  if (trees > 0) parts.push(`${trees} ${trees === 1 ? "tree" : "trees"}`);
  if (spawn > 0) parts.push(`${spawn} spawn`);
  return parts.join(" and ") || "0 trees";
}

/** "Fig, back in stock soon, notify me": a chip that opens the restock capture. */
function NotifyChips({ plants }: { plants: PlannerPlant[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-8" data-testid="plan-notify">
      <p className="mb-2 text-sm font-semibold text-foreground">Would have made the list, {copy.BACK_SOON}:</p>
      <div className="flex flex-wrap gap-2">
        {plants.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-expanded={open === p.id}
            aria-controls={`plan-notify-${p.id}`}
            onClick={() => setOpen(open === p.id ? null : p.id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm ${
              open === p.id ? "border-primary bg-primary/[0.07]" : "border-primary/25 hover:border-primary/60"
            }`}
          >
            <span className="font-semibold">{p.name}</span>
            <span className="text-ink-soft">{copy.NOTIFY_ME}</span>
          </button>
        ))}
      </div>
      {open != null && (
        <div id={`plan-notify-${open}`} className="mt-3 max-w-md rounded-lg border border-primary/10 bg-secondary/10 p-4">
          <CaptureForm
            brand="nursery"
            source="notify-me"
            endpoint={`/api/notify/restock?product=${open}${variantParam(plants, open)}`}
            label={`nursery-restock-${open}`}
            submitLabel={copy.NOTIFY_ME}
            successMessage="You're on the list. One email when it is back, nothing else."
            consentText={REQUEST_CONSENT_TEXT}
            invalidEmailMessage="Enter an email address like you@example.com"
            layout="inline"
          />
        </div>
      )}
    </div>
  );
}

function variantParam(plants: PlannerPlant[], id: number): string {
  const v = plants.find((p) => p.id === id)?.variant_id;
  return v ? `&variant=${v}` : "";
}

function ConsultPanel({ contact }: { contact: { phone: string; email: string } }) {
  return (
    <div id="consult" className="mt-10 rounded-lg border border-primary/15 bg-secondary/10 p-6" data-testid="plan-consult">
      <h3 className="font-display text-xl text-primary-deep">{copy.CONSULT_HEADING}</h3>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">{copy.CONSULT_BODY}</p>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <a href={`tel:+1${contact.phone}`} className="font-semibold text-primary underline underline-offset-2">
          {formatPhone(contact.phone)}
        </a>
        <a href={`mailto:${contact.email}`} className="font-semibold text-primary underline underline-offset-2">
          {contact.email}
        </a>
      </p>
    </div>
  );
}

const STATE_NAMES: Record<string, string> = {
  FL: "Florida", WA: "Washington", OR: "Oregon", IN: "Indiana", OH: "Ohio", WI: "Wisconsin",
  AZ: "Arizona", NM: "New Mexico", CA: "California",
};
function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}
