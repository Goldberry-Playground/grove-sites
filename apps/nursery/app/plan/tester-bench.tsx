"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import {
  DEFAULT_RULES,
  RULE_KEYS,
  RULE_LABELS,
  explain,
  plan,
  resolveRules,
  type PlanInput,
  type PlanLine,
  type PlannerCatalog,
  type PlannerPlant,
  type PlannerRules,
  type RuleKey,
  type Slot,
} from "@grove/planner";
import { postDispute, postPropose, type SaveOutcome } from "../../lib/planner-signals";
import { TESTER_FACTS, type TesterFact } from "../../lib/planner-tester";
import * as copy from "./copy";
import { MONTHS } from "./months";
import { CautionMark, CheckMark } from "./questions";

/**
 * The tester bench (planner winter-beta spec §C.4, GOL-3551). Rendered under
 * the result card only when the page saw the tester cookie. Three tools:
 *
 *   - the score per line, term by term, from the engine's `explain(line)`;
 *   - what-if sliders for every rule key that re-run the engine here, in
 *     component state only: no fetch, no storage, gone on reload;
 *   - Propose this weight and Dispute a fact, the only two writes, each one
 *     POST per press through the BFF (which adds the tester token).
 *
 * The bench never calls Odoo itself, and never changes what the card above
 * it shows a customer.
 */

export interface TesterBenchProps {
  input: PlanInput;
  catalog: PlannerCatalog;
  /** The card's live lines (after any Remove, Swap or Add). */
  lines: readonly PlanLine[];
  /** Transport seams (tests). */
  dispute?: typeof postDispute;
  propose?: typeof postPropose;
}

type Send = { kind: "idle" } | { kind: "sending" } | { kind: "done"; text: string } | { kind: "error"; text: string };

function failureText(outcome: Extract<SaveOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case "off":
      return copy.BENCH_OFF;
    case "limit":
      return copy.BENCH_LIMIT;
    case "forbidden":
      return copy.BENCH_NOT_TESTER;
    default:
      return copy.BENCH_FAILED;
  }
}

/** "1.5", "40", "0.25": no trailing zeros, at most two places. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** "+10" / "−80" with a true minus sign, so the column reads as arithmetic. */
function signed(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (v === 0) return "0";
  return v > 0 ? `+${num(v)}` : `−${num(-v)}`;
}

/** A slider's range: room to triple the shipped value, or double the live one. */
function rangeFor(key: RuleKey, live: number): { max: number; step: number } {
  const max = Math.max(DEFAULT_RULES[key] * 3, live * 2, 1);
  const step = max >= 30 ? 1 : 0.1;
  return { max: step === 1 ? Math.ceil(max) : Math.ceil(max * 10) / 10, step };
}

/** A plant's current value for one disputable fact, as words. */
export function factValue(plant: PlannerPlant, fact: TesterFact): string {
  const yesNo = (b: boolean | undefined) => (b ? copy.BENCH_YES : copy.BENCH_NO);
  switch (fact) {
    case "zone_min":
      return plant.zone_min != null ? String(plant.zone_min) : copy.BENCH_UNSET;
    case "zone_max":
      return plant.zone_max != null ? String(plant.zone_max) : copy.BENCH_UNSET;
    case "years_to_fruit":
      return plant.years_to_fruit_min != null ? String(plant.years_to_fruit_min) : copy.BENCH_UNSET;
    case "tolerates_wet":
      return yesNo(plant.tolerates?.wet);
    case "tolerates_poor_soil":
      return yesNo(plant.tolerates?.poor_soil);
    case "tolerates_shade":
      return yesNo(plant.tolerates?.shade);
    case "pollination":
      return String(plant.pollination_min ?? 1);
    case "harvest_months":
      return plant.harvest_months.length ? plant.harvest_months.map((m) => MONTHS[m] ?? m).join(", ") : copy.BENCH_UNSET;
    case "role":
      return plant.role ? copy.ROLE_LABELS[plant.role] : copy.BENCH_UNSET;
    case "succession":
      return plant.succession ? copy.SUCCESSION_LABELS[plant.succession] : copy.BENCH_UNSET;
    case "stratum":
      return plant.stratum ? copy.STRATUM_LABELS[plant.stratum] : copy.BENCH_UNSET;
  }
}

export function TesterBench({ input, catalog, lines, dispute = postDispute, propose = postPropose }: TesterBenchProps) {
  const id = useId();
  // What the live plan runs on (feed values over the shipped constants).
  const live = useMemo(() => resolveRules(catalog), [catalog]);
  // Slider values that differ from live (a slider moved back to live drops
  // its key). Component state only: never posted, never stored; a reload
  // starts from the live rules again.
  const [overrides, setOverrides] = useState<Partial<PlannerRules>>({});
  const changed = Object.keys(overrides).length > 0;

  const whatIf = useMemo(() => {
    if (Object.keys(overrides).length === 0) return null;
    const base = plan(input, catalog);
    const next = plan(input, { ...catalog, rules: { ...live, ...overrides } });
    const pick = (lines: readonly PlanLine[], slot: Slot) => lines.find((l) => l.slot === slot)?.plant.name ?? null;
    const slots = [...new Set([...base.lines, ...next.lines].map((l) => l.slot))];
    return slots
      .map((slot) => ({ slot, was: pick(base.lines, slot), now: pick(next.lines, slot) }))
      .filter((s) => s.was !== s.now);
  }, [input, catalog, live, overrides]);

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-12 rounded-lg border border-dashed border-primary/40 bg-paper-soft p-5 sm:p-6"
      data-testid="plan-tester-bench"
    >
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">{copy.BENCH_EYEBROW}</span>
      <h3 id={`${id}-heading`} className="mt-1 font-display text-2xl text-primary-deep">
        {copy.BENCH_HEADING}
      </h3>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">{copy.BENCH_LEDE}</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-10">
        <div>
          <h4 className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary-deep">{copy.BENCH_LINES_HEADING}</h4>
          <ul className="mt-3 divide-y divide-primary/10 border-y border-primary/10">
            {lines.map((line) => (
              <BenchLine
                key={line.plant.id}
                line={line}
                input={input}
                catalog={catalog}
                overrides={changed ? overrides : undefined}
                dispute={dispute}
              />
            ))}
          </ul>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <h4 className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary-deep">{copy.BENCH_WEIGHTS_HEADING}</h4>
          <p className="mt-1 text-sm text-ink-soft">{copy.BENCH_WEIGHTS_LEDE}</p>
          <div className="mt-4 space-y-5">
            {RULE_KEYS.map((key) => (
              <WeightSlider
                key={key}
                ruleKey={key}
                live={live[key]}
                value={overrides[key] ?? live[key]}
                onChange={(v) =>
                  setOverrides((cur) => {
                    const next = { ...cur };
                    if (v === live[key]) delete next[key];
                    else next[key] = v;
                    return next;
                  })
                }
                propose={propose}
              />
            ))}
          </div>
          {changed && (
            <button
              type="button"
              className="mt-5 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-2"
              onClick={() => setOverrides({})}
            >
              {copy.BENCH_RESET_ALL}
            </button>
          )}
          <div role="status" aria-live="polite" className="mt-4 text-sm" data-testid="plan-bench-whatif">
            {whatIf == null ? null : whatIf.length === 0 ? (
              <p className="text-ink-soft">{copy.BENCH_SAME_PICKS}</p>
            ) : (
              <>
                <p className="font-semibold text-primary-deep">{copy.BENCH_PICKS_HEADING}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {whatIf.map((s) => (
                    <li key={s.slot}>
                      {copy.BENCH_PICK_CHANGE(copy.SLOT_LABELS[s.slot], s.now ?? copy.BENCH_PICK_NONE, s.was ?? copy.BENCH_PICK_NONE)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenchLine({
  line,
  input,
  catalog,
  overrides,
  dispute,
}: {
  line: PlanLine;
  input: PlanInput;
  catalog: PlannerCatalog;
  overrides: Partial<PlannerRules> | undefined;
  dispute: typeof postDispute;
}) {
  const liveScore = useMemo(() => explain(input, catalog, line), [input, catalog, line]);
  const shown = useMemo(
    () => (overrides ? explain(input, catalog, line, overrides) : liveScore),
    [input, catalog, line, overrides, liveScore],
  );
  const moved = shown.total !== liveScore.total;
  return (
    <li className="py-4" data-testid="plan-bench-line" data-plant={line.plant.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold text-primary-deep">
          {line.plant.name}{" "}
          <span className="font-mono text-[10px] font-normal tracking-[0.14em] uppercase text-ink-soft">
            {copy.SLOT_LABELS[line.slot]}
          </span>
        </p>
        <p className="font-mono text-sm tabular-nums">
          <span className="text-ink-soft">{copy.BENCH_TOTAL} </span>
          <strong className="text-foreground" data-testid="plan-bench-total">
            {num(shown.total)}
          </strong>
          {moved && <span className="ml-2 text-ink-soft">({copy.BENCH_WAS(num(liveScore.total))})</span>}
        </p>
      </div>
      <dl className="mt-2 grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-0.5 text-sm">
        {shown.parts.map((part, i) => (
          <div key={`${part.key}-${i}`} className="contents">
            <dt className="text-ink-soft">{part.label}</dt>
            <dd className="text-right font-mono tabular-nums">{signed(part.value)}</dd>
          </div>
        ))}
      </dl>
      <DisputeMenu plant={line.plant} zone={typeof input.zone === "number" ? input.zone : null} dispute={dispute} />
    </li>
  );
}

function DisputeMenu({ plant, zone, dispute }: { plant: PlannerPlant; zone: number | null; dispute: typeof postDispute }) {
  const id = useId();
  const [fact, setFact] = useState<TesterFact | null>(null);
  const [pickError, setPickError] = useState(false);
  const [state, setState] = useState<Send>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    if (!fact) {
      setPickError(true);
      e.currentTarget.querySelector<HTMLInputElement>("input[type=radio]")?.focus();
      return;
    }
    setPickError(false);
    setState({ kind: "sending" });
    const form = e.currentTarget;
    const note = String(new FormData(form).get("note") ?? "").trim() || null;
    const outcome = await dispute({ product_tmpl_id: plant.id, fact, note, zone });
    if (outcome.ok) {
      setState({ kind: "done", text: copy.BENCH_DISPUTED(copy.BENCH_FACT_LABELS[fact]) });
      setFact(null);
      form.reset();
    } else {
      setState({ kind: "error", text: failureText(outcome) });
    }
  }

  return (
    <details className="group mt-3" data-testid="plan-bench-dispute">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary underline underline-offset-2">
        {copy.BENCH_DISPUTE}
      </summary>
      <form onSubmit={onSubmit} noValidate className="mt-2 grid max-w-md gap-4">
        <fieldset aria-describedby={pickError ? `${id}-pick-error` : undefined}>
          <legend className="text-sm font-semibold">{copy.BENCH_DISPUTE_LEGEND(plant.name)}</legend>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {TESTER_FACTS.map((f) => (
              <label key={f} className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-primary/[0.05]">
                <input
                  type="radio"
                  name="fact"
                  value={f}
                  checked={fact === f}
                  onChange={() => {
                    setFact(f);
                    setPickError(false);
                  }}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>
                  {copy.BENCH_FACT_LABELS[f]} <span className="font-mono text-ink-soft">{factValue(plant, f)}</span>
                </span>
              </label>
            ))}
          </div>
          {pickError && (
            <p id={`${id}-pick-error`} className="mt-1 flex items-center gap-1 text-sm text-caution">
              <CautionMark />
              {copy.BENCH_DISPUTE_PICK}
            </p>
          )}
        </fieldset>
        <div>
          <label htmlFor={`${id}-note`} className="block text-sm font-semibold">
            {copy.BENCH_DISPUTE_NOTE}
          </label>
          <p id={`${id}-note-hint`} className="text-xs text-ink-soft">
            {copy.BENCH_DISPUTE_NOTE_HINT}
          </p>
          <textarea
            id={`${id}-note`}
            name="note"
            rows={2}
            maxLength={2000}
            aria-describedby={`${id}-note-hint`}
            className="mt-1 w-full rounded border border-primary/30 bg-paper px-3 py-2 text-base"
          />
        </div>
        <SendStatus state={state} />
        <div>
          <button type="submit" className="btn btn-forest-outline" disabled={state.kind === "sending"} data-testid="plan-bench-dispute-send">
            {state.kind === "sending" ? copy.BENCH_DISPUTE_SENDING : copy.BENCH_DISPUTE_SEND}
          </button>
        </div>
      </form>
    </details>
  );
}

function WeightSlider({
  ruleKey,
  live,
  value,
  onChange,
  propose,
}: {
  ruleKey: RuleKey;
  live: number;
  value: number;
  onChange: (v: number) => void;
  propose: typeof postPropose;
}) {
  const id = useId();
  const { label, hint } = RULE_LABELS[ruleKey];
  const { max, step } = rangeFor(ruleKey, live);
  const [state, setState] = useState<Send>({ kind: "idle" });
  // The value last proposed, so the button cannot send the same number twice.
  const [sent, setSent] = useState<number | null>(null);
  const moved = value !== live;
  const canPropose = moved && value !== sent && state.kind !== "sending";

  async function onPropose() {
    if (!canPropose) return;
    setState({ kind: "sending" });
    const outcome = await propose({ key: ruleKey, value });
    if (outcome.ok) {
      setSent(value);
      setState({ kind: "done", text: copy.BENCH_PROPOSED(label, num(value)) });
    } else {
      setState({ kind: "error", text: failureText(outcome) });
    }
  }

  return (
    <div data-testid={`plan-bench-rule-${ruleKey}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`${id}-range`} className="text-sm font-semibold">
          {label}
        </label>
        {/* Visual readout only: the slider's own aria-valuetext speaks the
            value, and an <output> (an implicit live region) would say it twice. */}
        <span aria-hidden="true" className="font-mono text-sm tabular-nums text-foreground">
          {num(value)}
        </span>
      </div>
      <p id={`${id}-hint`} className="text-xs text-ink-soft">
        {hint}. {copy.BENCH_LIVE(num(live))}.
      </p>
      <input
        id={`${id}-range`}
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${id}-hint`}
        aria-valuetext={num(value)}
        onChange={(e) => {
          onChange(Number(e.currentTarget.value));
          if (state.kind !== "sending") setState({ kind: "idle" });
        }}
        className="mt-2 h-11 w-full cursor-pointer accent-[var(--color-primary)]"
      />
      {moved && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            className="btn btn-forest-outline"
            disabled={!canPropose}
            onClick={onPropose}
            data-testid="plan-bench-propose"
          >
            {state.kind === "sending" ? copy.BENCH_PROPOSING : copy.BENCH_PROPOSE}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-2"
            onClick={() => onChange(live)}
          >
            {copy.BENCH_RESET_ONE(label)}
          </button>
        </div>
      )}
      <SendStatus state={state} />
    </div>
  );
}

function SendStatus({ state }: { state: Send }) {
  if (state.kind === "done") {
    return (
      <p role="status" className="mt-2 flex items-start gap-1.5 text-sm text-affirm">
        <CheckMark />
        <span>{state.text}</span>
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-caution">
        <CautionMark />
        <span>{state.text}</span>
      </p>
    );
  }
  return null;
}
