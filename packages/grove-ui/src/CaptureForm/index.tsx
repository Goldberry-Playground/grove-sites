"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../Button";
import { useGroveLink } from "../link-context";

/** Brands a visitor can opt into — mirrors `@grove/newsletter` `Brand`. */
export type CaptureBrand = "grove" | "nursery" | "goldberry" | "ggg";

/** Where the opt-in happened — mirrors `@grove/newsletter` `OptInSource`. */
export type CaptureSource =
  | "newsletter-signup"
  | "checkout"
  | "notify-me"
  | "footer"
  | "import"
  // Odoo CRM lead captures (2026-10-15 hotfix): recorded in the lead's notes.
  | "consult-request"
  | "wholesale-inquiry";

/**
 * Josh's 2026-10-20 ruling (GOL-3456): one unticked checkbox on EVERY
 * newsletter form, hub included. Ticked, Odoo subscribes the address to every
 * other Grove list as well. Wording is verbatim from the approved consent copy.
 */
export const MULTIBRAND_OPT_IN_LABEL =
  "Also send me news from the other Grove brands (farm, nursery and the Grove Digest).";

/** Fine print under every newsletter form (approved consent copy, GOL-3456). */
export const NEWSLETTER_CONSENT_TEXT =
  "We'll send a confirmation email right away. Unsubscribe anytime with one click.";

/** Fine print under every request form that is NOT a newsletter signup. */
export const REQUEST_CONSENT_TEXT = "We'll only use your email to answer this request.";

/** Success copy for a newsletter signup (single opt-in + welcome email). */
export const NEWSLETTER_SUCCESS_MESSAGE =
  "You're on the list. Check your inbox for a welcome note.";

export interface CaptureFormProps {
  /**
   * Brand whose site the form is on. Informational on the wire: the
   * newsletter BFF pins the list of record from the app it runs in and never
   * trusts this field (GOL-3456).
   */
  brand: CaptureBrand;
  /** Where this opt-in is captured (drives the fallback segmentation label). */
  source?: CaptureSource;
  /** Per-form segmentation handle (e.g. `nursery-footer`), kept in Odoo's attribution note. */
  label?: string;
  /** Interest slugs applied as contact tags on top of the brand. */
  interests?: string[];
  /**
   * Small kicker/eyebrow above the heading, e.g. "Newsletter" vs "Back-in-stock
   * alert". Names the form's purpose so two captures on one page read as
   * distinct offers rather than the same ask twice (GOL-682 #1).
   */
  eyebrow?: string;
  /** Section heading shown above the fields. */
  heading?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /**
   * The per-brand "what you're signing up for and how often" line, rendered
   * under the email field and read to screen readers as the field's
   * description. Approved per-brand wording lives with each app's layout.
   */
  optInLine?: string;
  /** Submit-button label. */
  submitLabel?: string;
  /** Submit-button label while the request is in flight. */
  submittingLabel?: string;
  /** Message shown after a successful subscribe. */
  successMessage?: string;
  /** Collect an optional display name alongside the email. */
  collectName?: boolean;
  /** Collect an optional free-text note (wholesale / consult / visit requests
   *  that land in Odoo CRM). Sent as `message`. */
  collectMessage?: boolean;
  /** Label for the note field. */
  messageLabel?: string;
  /**
   * Render the single unticked "Also send me news from the other Grove brands"
   * checkbox (newsletter forms only; never on a lead/restock/waitlist form).
   */
  multibrandOptIn?: boolean;
  /** Label for the multibrand checkbox. Defaults to the approved wording. */
  multibrandLabel?: string;
  /**
   * Fine-print consent line under the button. The privacy-notice link is
   * appended to it on every form (Josh 2026-10-20).
   */
  consentText?: string;
  /** Where the "Privacy notice" link points. Every app serves `/privacy`. */
  privacyHref?: string;
  /**
   * BFF endpoint the form POSTs to. Defaults to the per-app newsletter route;
   * every app mounts `@grove/newsletter`'s handler at this path.
   */
  endpoint?: string;
  /** Visual density. `inline` is a single-row footer variant. */
  layout?: "stacked" | "inline";
  className?: string;
  /**
   * Message shown inline when the typed email isn't a plausible address, before
   * anything is sent. Overridable because the ask differs by surface (a
   * waitlist wants "Enter an email address like you@example.com"); the default
   * matches the tone of the server-side 400 copy.
   */
  invalidEmailMessage?: string;
  /** Fires after each submit attempt — for analytics/tests. */
  onResult?: (result: { ok: boolean; error?: string }) => void;
}

/**
 * Plausible-address check, deliberately permissive (GOL-2745).
 *
 * This exists to catch the typo the visitor can still fix — a missing `@`, a
 * trailing comma, `you@example` with no dot — NOT to adjudicate RFC 5322. Ghost
 * is the authority on deliverability and the BFF re-validates; a regex that
 * tries to be clever here only ever rejects somebody's real, valid address.
 */
export function isPlausibleEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

type Status = "idle" | "submitting" | "success" | "error";

/** utm_* params + referrer, captured at submit time for member attribution. */
function collectAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const attribution: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of params) {
      if (key.startsWith("utm_") || key === "src") attribution[key] = value;
    }
    if (document.referrer) attribution.referrer = document.referrer;
  } catch {
    // Attribution is best-effort — never block a signup on it.
  }
  return attribution;
}

/**
 * Grove email-capture form. Presentational + submit logic; the network target
 * is a prop (`endpoint`), so no app route is baked in. POSTs the shape
 * `@grove/newsletter`'s BFF route validates: `{ email, name?, brand, source,
 * label, interests, multibrand, consent, attribution }`. Submitting the form
 * with the consent line visible is the affirmative `consent`; Odoo subscribes
 * on submit (single opt-in) and sends one welcome email. A honeypot field
 * silently drops bots.
 */
export function CaptureForm({
  brand,
  source = "newsletter-signup",
  label,
  interests,
  eyebrow,
  heading,
  description,
  optInLine,
  submitLabel = "Sign up",
  submittingLabel = "Signing you up…",
  successMessage = NEWSLETTER_SUCCESS_MESSAGE,
  collectName = false,
  collectMessage = false,
  messageLabel = "Note (optional)",
  multibrandOptIn = false,
  multibrandLabel = MULTIBRAND_OPT_IN_LABEL,
  consentText = NEWSLETTER_CONSENT_TEXT,
  privacyHref = "/privacy",
  endpoint = "/api/newsletter/subscribe",
  invalidEmailMessage = "That email doesn't look right. Mind checking it?",
  layout = "stacked",
  className = "",
  onResult,
}: CaptureFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  // Tracked separately from `status`: it's what wires aria-invalid on the FIELD,
  // where a server-side error (5xx, network) is about the request, not the value.
  const [invalidEmail, setInvalidEmail] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const emailId = useId();
  const errorId = useId();
  const nameId = useId();
  const messageId = useId();
  const multibrandId = useId();
  const optInLineId = useId();
  const Link = useGroveLink();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    // Honeypot: real users never see or fill `company`. Bots do — succeed
    // silently without touching the list.
    if (String(data.get("company") ?? "").trim() !== "") {
      setStatus("success");
      onResult?.({ ok: true });
      return;
    }

    const email = String(data.get("email") ?? "").trim();

    // Validate inline BEFORE the round-trip (GOL-2745). The form is `noValidate`
    // so the browser's own bubble never fires; without this a typo cost a full
    // network round-trip to come back as a 400, well past the 400ms the visitor
    // reads as "instant". Focus moves to the field so a keyboard or screen-
    // reader user lands on the thing to fix, not on a message about it.
    if (!isPlausibleEmail(email)) {
      setStatus("error");
      setError(invalidEmailMessage);
      setInvalidEmail(true);
      emailRef.current?.focus();
      onResult?.({ ok: false, error: invalidEmailMessage });
      return;
    }
    setInvalidEmail(false);

    const name = collectName ? String(data.get("name") ?? "").trim() : undefined;
    const wantsMultibrand = multibrandOptIn && data.get("multibrand") === "on";
    const message = collectMessage ? String(data.get("message") ?? "").trim() : "";

    setStatus("submitting");
    setError("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          ...(message ? { message } : {}),
          brand,
          source,
          label,
          interests,
          multibrand: wantsMultibrand,
          consent: true,
          attribution: collectAttribution(),
        }),
      });

      if (res.ok) {
        setStatus("success");
        form.reset();
        onResult?.({ ok: true });
        return;
      }

      // DigitalOcean's edge shows the browser a 504 for an app 503 AND for an
      // app 502 (a real backend failure), so the status can't tell "not wired"
      // from "broken". The old "Signups aren't open just yet" copy hid the
      // 2026-10-15 Ghost outage for days; every 5xx now reads as a temporary
      // failure, which is true in both cases.
      let reason = "Something went wrong on our end. Mind trying that again?";
      if (res.status === 400) {
        reason = "That email doesn't look right. Mind checking it?";
      } else if (res.status >= 500) {
        reason = "We couldn't save that just now. Please try again in a few minutes.";
      }
      setStatus("error");
      setError(reason);
      onResult?.({ ok: false, error: reason });
    } catch {
      const reason = "We couldn't reach the server — check your connection and try again.";
      setStatus("error");
      setError(reason);
      onResult?.({ ok: false, error: reason });
    }
  }

  const extras = (
    <>
      {optInLine ? (
        <p id={optInLineId} className="grove-capture__optin">
          {optInLine}
        </p>
      ) : null}
      {multibrandOptIn ? (
        <label htmlFor={multibrandId} className="grove-capture__multibrand">
          <input id={multibrandId} name="multibrand" type="checkbox" />
          <span>{multibrandLabel}</span>
        </label>
      ) : null}
    </>
  );

  if (status === "success") {
    return (
      <div
        className={`grove-capture grove-capture--success ${className}`}
        role="status"
        aria-live="polite"
      >
        {eyebrow ? <p className="grove-capture__eyebrow">{eyebrow}</p> : null}
        {heading ? <p className="grove-capture__heading">{heading}</p> : null}
        <p className="grove-capture__success">{successMessage}</p>
      </div>
    );
  }

  return (
    <form
      className={`grove-capture grove-capture--${layout} ${className}`}
      onSubmit={handleSubmit}
      noValidate
    >
      {eyebrow ? <p className="grove-capture__eyebrow">{eyebrow}</p> : null}
      {heading ? <p className="grove-capture__heading">{heading}</p> : null}
      {description ? <p className="grove-capture__desc">{description}</p> : null}

      <div className="grove-capture__fields">
        {collectName ? (
          <div className="grove-capture__field">
            <label htmlFor={nameId} className="grove-capture__label">
              Name
            </label>
            <input
              id={nameId}
              name="name"
              type="text"
              autoComplete="name"
              className="grove-capture__input"
            />
          </div>
        ) : null}

        <div className="grove-capture__field">
          <label htmlFor={emailId} className="grove-capture__label">
            Email
          </label>
          <input
            id={emailId}
            ref={emailRef}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="grove-capture__input"
            aria-invalid={invalidEmail || undefined}
            // Associates the message below with the field, so a screen reader
            // reads the reason when focus lands here — the <p role="alert"> on
            // its own announces once and is then orphaned from the input.
            aria-describedby={
              [status === "error" ? errorId : null, optInLine ? optInLineId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            // Clear the inline error as soon as the visitor starts fixing it;
            // leaving a stale "that's wrong" under a corrected field is the
            // forgiveness failure that makes inline validation feel hostile.
            onInput={() => {
              if (invalidEmail) {
                setInvalidEmail(false);
                setStatus("idle");
                setError("");
              }
            }}
          />
        </div>

        {collectMessage ? (
          <div className="grove-capture__field grove-capture__field--message">
            <label htmlFor={messageId} className="grove-capture__label">
              {messageLabel}
            </label>
            <textarea id={messageId} name="message" rows={3} maxLength={2000} className="grove-capture__input" />
          </div>
        ) : null}

        {/* Honeypot — visually hidden, off the tab order, ignored by humans. */}
        <div className="grove-capture__hp" aria-hidden="true">
          <label htmlFor="grove-capture-company">Company</label>
          <input
            id="grove-capture-company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Stacked: the opt-in line and the multibrand choice sit between the
            field and the button, so reading order, DOM order and tab order
            agree (field → what you get → optional add-on → action). Inline:
            the field + button stay one row and the extras follow it. */}
        {layout === "stacked" ? extras : null}

        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? submittingLabel : submitLabel}
        </Button>
      </div>

      {layout === "inline" ? extras : null}

      <p className="grove-capture__consent">
        {consentText}{" "}
        <Link href={privacyHref} className="grove-capture__privacy">
          Privacy notice
        </Link>
      </p>

      <p
        id={errorId}
        className="grove-capture__error"
        role="alert"
        aria-live="assertive"
      >
        {status === "error" ? error : ""}
      </p>
    </form>
  );
}
