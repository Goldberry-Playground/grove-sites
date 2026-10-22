"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { US_SHIP_TO_STATES } from "@grove/checkout";
import {
  SIZES,
  SUBGOALS as SUBGOAL_VALUES,
  TIMINGS as TIMING_VALUES,
  TRACKS as TRACK_VALUES,
  SITES as SITE_VALUES,
  defaultTiming,
  type PlanAnswers,
  type Site,
  type Subgoal,
  type Timing,
  type Track,
} from "@grove/planner";
import { optionCardClass, RadioDot } from "../shop/[slug]/option-card";
import * as copy from "./copy";

/** Where question 1 stands: the ZIP lookup, or the state fallback. */
export type ZoneStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "known"; zone: number }
  | { kind: "unknown" }
  | { kind: "error" };

export interface QuestionsProps {
  answers: PlanAnswers;
  onChange: (next: PlanAnswers) => void;
  zone: ZoneStatus;
  /** Green states from the feed; null while the catalog is still loading. */
  states: string[] | null;
  /** Tighter spacing for the home-page teaser. */
  compact?: boolean;
}

/**
 * The four questions (order-builder spec §C.1). Each is a real radio group:
 * native keyboard order, arrow keys move within a group, Space selects, and
 * the selected card carries three cues (border + ring, filled dot, tint) so
 * choice never rides on colour alone. Questions reveal progressively so the
 * customer sees one decision at a time (Hick's law), and an answered question
 * stays on screen to change.
 */
export function Questions({ answers, onChange, zone, states, compact = false }: QuestionsProps) {
  const set = (patch: Partial<PlanAnswers>) => onChange({ ...answers, ...patch });
  const zoneKnown = zone.kind === "known";
  const stateChosen = !!answers.state;
  const stateUnsupported = stateChosen && states != null && !states.includes(answers.state!);
  const q1Done = (zoneKnown || (stateChosen && states != null && !stateUnsupported));
  const q2Done = q1Done && !!answers.site;
  const q3Done =
    q2Done && !!answers.track && answers.size != null && (answers.track !== "agro" || !!answers.subgoal);
  const gap = compact ? "space-y-8" : "space-y-12";

  return (
    <div className={gap}>
      <Question n={1} title={copy.QUESTIONS.where} compact={compact}>
        <ZipField
          zip={answers.zip ?? ""}
          onZip={(zip) => set({ zip: zip || undefined, state: undefined })}
          zone={zone}
        />
        {(zone.kind === "unknown" || zone.kind === "error") && (
          <StateFallback
            state={answers.state}
            onState={(state) => set({ state })}
            message={zone.kind === "error" ? copy.ZIP_ERROR : copy.ZIP_UNKNOWN}
          />
        )}
        {stateUnsupported && <StateUnsupported />}
      </Question>

      {q1Done && (
        <Question n={2} title={copy.QUESTIONS.spot} compact={compact}>
          <CardGroup
            name="site"
            value={answers.site}
            options={SITE_VALUES.map((s) => ({ value: s, ...copy.SITES[s] }))}
            onPick={(site) => set({ site: site as Site })}
            columns={4}
          />
        </Question>
      )}

      {q2Done && (
        <Question n={3} title={copy.QUESTIONS.goal} compact={compact}>
          <CardGroup
            name="track"
            value={answers.track}
            options={TRACK_VALUES.map((t) => ({ value: t, ...copy.TRACKS[t], light: t === "deer" }))}
            onPick={(track) =>
              set({
                track: track as Track,
                size: undefined,
                subgoal: undefined,
                timing: defaultTiming(track as Track),
              })
            }
            columns={3}
          />
          {answers.track === "agro" && (
            <SubQuestion title={copy.SUBGOAL_QUESTION}>
              <ChipGroup
                name="subgoal"
                value={answers.subgoal}
                options={SUBGOAL_VALUES.map((g) => ({ value: g, label: copy.SUBGOALS[g] }))}
                onPick={(g) => set({ subgoal: g as Subgoal })}
              />
            </SubQuestion>
          )}
          {answers.track && (answers.track !== "agro" || answers.subgoal) && (
            <SubQuestion title={copy.SIZE_QUESTION}>
              <ChipGroup
                name="size"
                value={answers.size != null ? String(answers.size) : undefined}
                options={SIZES[answers.track].map((n) => ({
                  value: String(n),
                  label: copy.SIZE_LABELS[answers.track!][n].label,
                  detail: copy.SIZE_LABELS[answers.track!][n].detail,
                }))}
                onPick={(n) => set({ size: Number(n) })}
                trailing={
                  answers.track === "agro" ? (
                    <a
                      href="#consult"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-primary/40 px-4 py-2 text-sm text-primary underline-offset-2 hover:underline"
                    >
                      <span className="font-semibold">{copy.AGRO_MORE_LABEL}</span>
                      <span className="text-ink-soft">{copy.AGRO_MORE_DETAIL}</span>
                    </a>
                  ) : null
                }
              />
            </SubQuestion>
          )}
        </Question>
      )}

      {q3Done && answers.track && (
        <Question n={4} title={copy.QUESTIONS.when} compact={compact}>
          <ChipGroup
            name="timing"
            value={answers.timing ?? defaultTiming(answers.track)}
            options={TIMING_VALUES[answers.track].map((t) => ({
              value: t,
              label: copy.TIMINGS[t].label,
              detail: copy.TIMINGS[t].detail,
            }))}
            onPick={(t) => set({ timing: t as Timing })}
          />
        </Question>
      )}
    </div>
  );
}

function Question({
  n,
  title,
  compact,
  children,
}: {
  n: number;
  title: string;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`plan-q${n}`} className="plan-question">
      <h3
        id={`plan-q${n}`}
        className={`font-display font-medium text-primary-deep ${compact ? "text-xl" : "text-2xl"} mb-4 flex items-baseline gap-3`}
      >
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-accent-fg">
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function SubQuestion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

function ZipField({
  zip,
  onZip,
  zone,
}: {
  zip: string;
  onZip: (zip: string) => void;
  zone: ZoneStatus;
}) {
  // The field is typed locally and committed to the answers (and so the URL)
  // only as a complete 5-digit ZIP or when cleared: a router navigation per
  // keystroke would lag the controlled value and drop characters, and a
  // half-typed ZIP is not an answer anyone wants to share.
  const [draft, setDraft] = useState(zip);
  useEffect(() => {
    setDraft(zip);
  }, [zip]);
  const onInput = (raw: string) => {
    const value = raw.replace(/\D/g, "").slice(0, 5);
    setDraft(value);
    if (value.length === 5) onZip(value);
    else if (value.length === 0 && zip) onZip("");
  };
  return (
    <div>
      <label htmlFor="plan-zip" className="block text-sm font-semibold text-foreground mb-2">
        {copy.ZIP_LABEL}
      </label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          id="plan-zip"
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => onInput(e.target.value)}
          placeholder="26501"
          aria-describedby="plan-zip-hint"
          className="min-h-11 w-36 rounded border border-primary/25 bg-paper-soft px-3 py-2 text-base focus:border-primary"
        />
        <span id="plan-zip-hint" className="text-sm text-ink-soft">
          {copy.ZIP_HINT}
        </span>
      </div>
      <p className="mt-2 min-h-5 text-sm" aria-live="polite">
        {zone.kind === "loading" && <span className="text-ink-soft">{copy.ZIP_LOOKING}</span>}
        {zone.kind === "known" && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-affirm">
            <CheckMark />
            ZIP {zip} is in USDA zone {zone.zone}.
          </span>
        )}
      </p>
    </div>
  );
}

function StateFallback({
  state,
  onState,
  message,
}: {
  state: string | undefined;
  onState: (state: string) => void;
  message: string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-primary/10 bg-secondary/10 p-4">
      <p className="mb-3 flex items-start gap-1.5 text-sm text-caution">
        <CautionMark />
        <span>{message}</span>
      </p>
      <label htmlFor="plan-state" className="block text-sm font-semibold text-foreground mb-2">
        {copy.STATE_LABEL}
      </label>
      <select
        id="plan-state"
        name="state"
        value={state ?? ""}
        onChange={(e) => onState(e.target.value)}
        className="min-h-11 w-full max-w-xs rounded border border-primary/25 bg-paper-soft px-3 py-2 text-base focus:border-primary"
      >
        <option value="" disabled>
          {copy.STATE_PLACEHOLDER}
        </option>
        {US_SHIP_TO_STATES.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function StateUnsupported() {
  return (
    <div
      role="status"
      data-testid="plan-state-unsupported"
      className="mt-4 rounded-lg border border-caution/40 bg-paper-soft p-5"
    >
      <p className="flex items-start gap-1.5 font-display text-lg text-primary-deep">
        <CautionMark />
        <span>{copy.STATE_UNSUPPORTED_HEADING}</span>
      </p>
      <p className="mt-2 text-sm text-ink-soft">{copy.STATE_UNSUPPORTED_BODY}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/shop" className="btn btn-forest">
          {copy.STATE_UNSUPPORTED_PICKUP}
        </Link>
        <Link href="/notify" className="btn btn-forest-outline">
          Tell me when my state opens
        </Link>
      </div>
    </div>
  );
}

interface CardOption {
  value: string;
  label: string;
  detail?: string;
  /** Visually lightest treatment (the deer chip), never hidden. */
  light?: boolean;
}

function CardGroup({
  name,
  value,
  options,
  onPick,
  columns,
}: {
  name: string;
  value: string | undefined;
  options: CardOption[];
  onPick: (value: string) => void;
  columns: 3 | 4;
}) {
  const cols = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div role="radiogroup" aria-label={name} className={`grid grid-cols-1 gap-3 ${cols}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${optionCardClass(active)} ${
              o.light && !active ? "bg-paper-soft/60" : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => onPick(o.value)}
              className="sr-only"
            />
            <span className="mt-0.5">
              <RadioDot active={active} />
            </span>
            <span>
              <span className={`block ${o.light ? "font-medium" : "font-semibold"} text-foreground`}>
                {o.label}
              </span>
              {o.detail && <span className="mt-0.5 block text-sm text-ink-soft">{o.detail}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ChipGroup({
  name,
  value,
  options,
  onPick,
  trailing,
}: {
  name: string;
  value: string | undefined;
  options: CardOption[];
  onPick: (value: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <label
            key={o.value}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${optionCardClass(active)}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => onPick(o.value)}
              className="sr-only"
            />
            <RadioDot active={active} small />
            <span className="font-semibold text-foreground">{o.label}</span>
            {o.detail && <span className="text-ink-soft">{o.detail}</span>}
          </label>
        );
      })}
      {trailing}
    </div>
  );
}

/* Inline SVG marks (house pattern, see shop/[slug]/zone-check.tsx): the words
   carry the verdict, the mark only reinforces it (WCAG 1.4.1). */
export function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
      <path d="M6.2 12.4 2 8.2l1.5-1.5 2.7 2.7 6.3-6.3L14 4.6l-7.8 7.8Z" />
    </svg>
  );
}

export function CautionMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
      <path d="M8 1.3 15.3 14H.7L8 1.3Zm-.9 4.5v4h1.8v-4H7.1Zm0 5.2v1.6h1.8V11H7.1Z" />
    </svg>
  );
}
