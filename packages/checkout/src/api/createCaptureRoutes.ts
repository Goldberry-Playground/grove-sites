import { NextResponse } from "next/server";
import type { CaptureLeadInput, CaptureLeadKind, OdooClient } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
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

const LEAD_KINDS: readonly CaptureLeadKind[] = ["food_forest_consult", "wholesale", "farm_visit", "state_waitlist"];
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

/** `POST /api/leads?kind=<kind>[&state=XX][&product=<template id>]` */
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

    const input: CaptureLeadInput = { email: String(body.email).trim(), kind };
    const name = text(body.name, MAX_NAME);
    const message = text(body.message, MAX_MESSAGE);
    const label = text(body.label, MAX_LABEL);
    const source = text(body.source, MAX_LABEL);
    const state = text(query.get("state"), 2)?.toUpperCase();
    const productId = positiveInt(query.get("product"));
    if (name) input.name = name;
    if (message) input.message = message;
    if (label) input.label = label;
    if (state) input.state = state;
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
