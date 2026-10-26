"use client";

import { useId, useState, type FormEvent } from "react";
import { STRATA, type Stratum } from "@grove/planner";
import { postSuggest, type SaveOutcome } from "../../lib/planner-signals";
import * as copy from "./copy";
import { CautionMark, CheckMark } from "./questions";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; text: string };

function failureText(outcome: Extract<SaveOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case "off":
      return copy.SUGGEST_OFF;
    case "limit":
      return copy.SUGGEST_LIMIT;
    default:
      return copy.SUGGEST_FAILED;
  }
}

/**
 * Suggest a plant (planner-winter-beta spec §C.3): name, stratum, why, Send.
 * Single column, inline validation before the round trip, a honeypot the BFF
 * checks, and a confirmation that says where it goes. The form keeps no
 * personal data: a suggestion is a plant name and a reason, nothing else.
 */
export function SuggestForm({ send = postSuggest }: { send?: typeof postSuggest }) {
  const id = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [nameError, setNameError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setNameError(copy.SUGGEST_NAME_REQUIRED);
      (form.elements.namedItem("name") as HTMLInputElement | null)?.focus();
      return;
    }
    setNameError(null);
    setStatus({ kind: "sending" });
    const stratum = String(data.get("stratum") ?? "");
    const outcome = await send({
      name,
      stratum: (STRATA as readonly string[]).includes(stratum) ? (stratum as Stratum) : null,
      note: String(data.get("note") ?? "").trim() || null,
      company: String(data.get("company") ?? ""),
    });
    if (outcome.ok) {
      setStatus({ kind: "done" });
      form.reset();
    } else {
      setStatus({ kind: "error", text: failureText(outcome) });
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10 rounded-lg border border-primary/15 bg-paper-soft p-6" data-testid="plan-suggest">
      <h3 id={`${id}-heading`} className="font-display text-xl text-primary-deep">
        {copy.SUGGEST_HEADING}
      </h3>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">{copy.SUGGEST_LEDE}</p>
      {status.kind === "done" ? (
        <p role="status" className="mt-4 flex items-start gap-1.5 text-sm text-affirm">
          <CheckMark />
          <span>{copy.SUGGEST_DONE}</span>
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 grid max-w-md gap-4">
          <div>
            <label htmlFor={`${id}-name`} className="block text-sm font-semibold">
              {copy.SUGGEST_NAME_LABEL}
            </label>
            <input
              id={`${id}-name`}
              name="name"
              type="text"
              maxLength={200}
              required
              placeholder={copy.SUGGEST_NAME_PLACEHOLDER}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-name-error` : undefined}
              className="mt-1 w-full rounded border border-primary/30 bg-paper px-3 py-2 text-base"
            />
            {nameError && (
              <p id={`${id}-name-error`} className="mt-1 flex items-center gap-1 text-sm text-caution">
                <CautionMark />
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-stratum`} className="block text-sm font-semibold">
              {copy.SUGGEST_STRATUM_LABEL}
            </label>
            <select id={`${id}-stratum`} name="stratum" defaultValue="" className="mt-1 w-full rounded border border-primary/30 bg-paper px-3 py-2 text-base">
              <option value="">{copy.SUGGEST_STRATUM_ANY}</option>
              {STRATA.map((s) => (
                <option key={s} value={s}>
                  {copy.STRATUM_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-note`} className="block text-sm font-semibold">
              {copy.SUGGEST_NOTE_LABEL}
            </label>
            <p id={`${id}-note-hint`} className="text-xs text-ink-soft">
              {copy.SUGGEST_NOTE_HINT}
            </p>
            <textarea
              id={`${id}-note`}
              name="note"
              rows={3}
              maxLength={2000}
              aria-describedby={`${id}-note-hint`}
              className="mt-1 w-full rounded border border-primary/30 bg-paper px-3 py-2 text-base"
            />
          </div>
          {/* Honeypot: off screen, off the tab order, ignored by humans; the BFF drops a filled one. */}
          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor={`${id}-company`}>Company</label>
            <input id={`${id}-company`} name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          {status.kind === "error" && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-caution">
              <CautionMark />
              <span>{status.text}</span>
            </p>
          )}
          <div>
            <button type="submit" className="btn btn-forest" disabled={status.kind === "sending"} data-testid="plan-suggest-send">
              {status.kind === "sending" ? copy.SUGGEST_SENDING : copy.SUGGEST_BUTTON}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
