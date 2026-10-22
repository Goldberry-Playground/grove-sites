import { NextResponse } from "next/server";
import type { CaptureLeadInput, CaptureLeadKind, OdooClient } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { clientIp, overLimit } from "./rateLimit";
import { forwardCheckoutError, sanitizeUpstreamError } from "./upstreamError";

/**
 * Storefront capture routed to Odoo (2026-10-15 hotfix, Josh): consult /
 * wholesale / farm-visit / new-state-waitlist requests are customer
 * relationships, so they become Odoo CRM leads; back-in-stock alerts ride
 * Odoo's own stock notifications; only the newsletter stays in Ghost.
 *
 * Both routes accept the body the shared `CaptureForm` already POSTs
 * (`{ email, name?, message?, label?, source?, consent, ... }`) so a form is
 * re-pointed with its `endpoint` prop alone. What the form can't say about
 * itself rides the query string: `?kind=&state=&product=` / `?product=&variant=`.
 */
export interface CaptureRouteOptions {
  /** Exact-match allowlist of `Origin` header values (same gate as checkout). */
  allowedOrigins: readonly string[];
}

const LEAD_KINDS: readonly CaptureLeadKind[] = [
  "food_forest_consult",
  "wholesale",
  "farm_visit",
  "state_waitlist",
  "dept_waitlist",
];
const MAX_DEPT = 60;
const MAX_EMAIL = 254;
const MAX_NAME = 200;
const MAX_MESSAGE = 2000;
const MAX_LABEL = 100;

async function readCaptureBody(request: Request): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const email = (body as { email?: unknown }).email;
  if (typeof email !== "string" || !email.trim() || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  return body as Record<string, unknown>;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function positiveInt(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n > 0 ? n : undefined;
}

function guard(request: Request, allowedOrigins: readonly string[]): Response | null {
  if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
  return requireJsonContentType(request);
}

/**
 * Anti-abuse gate for a capture POST whose body has already parsed and carries a
 * valid `email`. Returns a terminal Response (caller should `return` it) or
 * null to proceed:
 *
 *   - Honeypot — a filled `company` field is a bot (humans never see it; the
 *     shared `CaptureForm` drops it client-side). Answer 200 and write nothing,
 *     so the bot can't tell it was caught. Does not count against the limiter.
 *   - Rate limit — `CAPTURE_LIMIT` per window, keyed by client IP *and* by
 *     email, so one IP spraying many addresses and one address hit from many
 *     requests are both capped. Over either → 429.
 */
function spamGate(request: Request, body: Record<string, unknown>): Response | null {
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }
  const now = Date.now();
  const email = String(body.email).trim().toLowerCase();
  if (overLimit(`ip:${clientIp(request)}`, now) || overLimit(`email:${email}`, now)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

/**
 * `POST /api/leads?kind=<kind>[&state=XX][&product=<template id>][&dept=<slug>]`
 *
 * `dept` carries the department slug for `kind=dept_waitlist` — the shop
 * "coming soon" waitlist moved here from the newsletter route (GOL-3456, spec
 * §8) so a waitlist signup never becomes a mailing-list membership.
 */
export function createLeadCaptureRoute(odoo: OdooClient, { allowedOrigins }: CaptureRouteOptions) {
  async function POST(request: Request) {
    const rejected = guard(request, allowedOrigins);
    if (rejected) return rejected;
    const query = new URL(request.url).searchParams;
    const kind = query.get("kind") as CaptureLeadKind | null;
    if (!kind || !LEAD_KINDS.includes(kind)) {
      return NextResponse.json({ error: `kind must be one of ${LEAD_KINDS.join(", ")}` }, { status: 400 });
    }
    const body = await readCaptureBody(request);
    if (body instanceof Response) return body;
    const spam = spamGate(request, body);
    if (spam) return spam;

    const input: CaptureLeadInput = { email: String(body.email).trim(), kind };
    const name = text(body.name, MAX_NAME);
    const message = text(body.message, MAX_MESSAGE);
    const label = text(body.label, MAX_LABEL);
    const source = text(body.source, MAX_LABEL);
    const state = text(query.get("state"), 2)?.toUpperCase();
    const department = text(query.get("dept"), MAX_DEPT)?.toLowerCase();
    const productId = positiveInt(query.get("product"));
    if (kind === "dept_waitlist" && !department) {
      return NextResponse.json({ error: "dept is required for dept_waitlist" }, { status: 400 });
    }
    if (name) input.name = name;
    if (message) input.message = message;
    if (label) input.label = label;
    if (state) input.state = state;
    if (department) input.department = department;
    if (productId) input.productId = productId;
    if (source) input.source = source;

    try {
      await odoo.capture.lead(input);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return forwardCheckoutError(error) ?? sanitizeUpstreamError(error, "capture/lead");
    }
  }
  return { POST };
}

/** `POST /api/notify/restock?product=<template id>[&variant=<variant id>]` */
export function createRestockCaptureRoute(odoo: OdooClient, { allowedOrigins }: CaptureRouteOptions) {
  async function POST(request: Request) {
    const rejected = guard(request, allowedOrigins);
    if (rejected) return rejected;
    const query = new URL(request.url).searchParams;
    const templateId = positiveInt(query.get("product"));
    if (!templateId) {
      return NextResponse.json({ error: "product must be a positive integer" }, { status: 400 });
    }
    const body = await readCaptureBody(request);
    if (body instanceof Response) return body;
    const spam = spamGate(request, body);
    if (spam) return spam;

    const input: { email: string; name?: string; variantId?: number } = { email: String(body.email).trim() };
    const name = text(body.name, MAX_NAME);
    const variantId = positiveInt(query.get("variant"));
    if (name) input.name = name;
    if (variantId) input.variantId = variantId;

    try {
      await odoo.capture.restock(templateId, input);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return forwardCheckoutError(error) ?? sanitizeUpstreamError(error, "capture/restock");
    }
  }
  return { POST };
}
