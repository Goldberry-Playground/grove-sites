"use client";

import { useId, useState, type FormEvent } from "react";
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
  /** Fires after each submit attempt — for analytics/tests. */
  onResult?: (result: { ok: boolean; error?: string }) => void;
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
  layout = "stacked",
  className = "",
  onResult,
}: CaptureFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const emailId = useId();
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

      let reason = "Something went wrong on our end — mind trying that again?";
      if (res.status === 503) {
        reason = "Signups aren't open just yet — please check back soon.";
      } else if (res.status === 400) {
        reason = "That email doesn't look right — mind checking it?";
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
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="grove-capture__input"
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
        className="grove-capture__error"
        role="alert"
        aria-live="assertive"
      >
        {status === "error" ? error : ""}
      </p>
    </form>
  );
}
