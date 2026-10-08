"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../Button";

/** Brands a visitor can opt into — mirrors `@grove/newsletter` `Brand`. */
export type CaptureBrand = "grove" | "nursery" | "goldberry" | "ggg";

/** Where the opt-in happened — mirrors `@grove/newsletter` `OptInSource`. */
export type CaptureSource =
  | "newsletter-signup"
  | "checkout"
  | "notify-me"
  | "footer"
  | "import";

export interface CaptureFormProps {
  /** Brand whose Ghost instance is the list of record for this signup. */
  brand: CaptureBrand;
  /** Where this opt-in is captured (drives the fallback segmentation label). */
  source?: CaptureSource;
  /** Per-form Ghost label applied at signup (e.g. `nursery-restock`). */
  label?: string;
  /** Interest tags applied as Ghost labels on top of the brand. */
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
  /** Submit-button label. */
  submitLabel?: string;
  /** Message shown after a successful subscribe. */
  successMessage?: string;
  /** Collect an optional display name alongside the email. */
  collectName?: boolean;
  /** Render the "Also get news from Gathering at the Grove" hub opt-in checkbox. */
  hubOptIn?: boolean;
  /** Label for the hub opt-in checkbox. */
  hubOptInLabel?: string;
  /** Fine-print consent line under the button. */
  consentText?: string;
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
 * label, interests, hubOptIn, consent, attribution }`. Submitting the form —
 * with the consent line visible — is the affirmative `consent`; Ghost then
 * double-opts-in via magic link. A honeypot field silently drops bots.
 */
export function CaptureForm({
  brand,
  source = "newsletter-signup",
  label,
  interests,
  eyebrow,
  heading,
  description,
  submitLabel = "Sign up",
  successMessage = "Thanks — check your inbox to confirm.",
  collectName = false,
  hubOptIn = false,
  hubOptInLabel = "Also send me news from Gathering at the Grove — the community behind the farm.",
  consentText = "We'll only email you what you signed up for. Unsubscribe anytime.",
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
  const hubId = useId();

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
    const wantsHub = hubOptIn && data.get("hubOptIn") === "on";

    setStatus("submitting");
    setError("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          brand,
          source,
          label,
          interests,
          hubOptIn: wantsHub,
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

      // The app returns a clean 503 when the newsletter backend isn't
      // provisioned, but DigitalOcean's edge surfaces that to the browser as a
      // 504 (x-do-orig-status: 503). Map the whole 5xx family to the same
      // "temporarily unavailable" message so the visitor gets accurate,
      // non-misleading feedback instead of a "try again" that keeps failing
      // (GOL-1881).
      let reason = "Something went wrong on our end — mind trying that again?";
      if (res.status === 400) {
        reason = "That email doesn't look right. Mind checking it?";
      } else if (res.status >= 500) {
        reason = "Signups aren't open just yet — please check back soon.";
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
            aria-describedby={status === "error" ? errorId : undefined}
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

        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Signing you up…" : submitLabel}
        </Button>
      </div>

      {hubOptIn ? (
        <label htmlFor={hubId} className="grove-capture__hub">
          <input id={hubId} name="hubOptIn" type="checkbox" />
          <span>{hubOptInLabel}</span>
        </label>
      ) : null}

      <p className="grove-capture__consent">{consentText}</p>

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
