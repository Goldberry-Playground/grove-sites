import { registerOTel } from "@vercel/otel";

/**
 * Server-side OpenTelemetry for the Grove frontends — the APM half of the
 * observability stack (spec §4). Called from each app's `instrumentation.ts`.
 *
 * `@vercel/otel` auto-instruments `fetch`, so every BFF→Odoo/Ghost call made
 * from a route handler emits a child span. Exported to OpenObserve over OTLP,
 * those spans correlate with Beyla's Odoo RED spans — one trace from the browser
 * request through the BFF to the Odoo handler.
 *
 * No-op unless an OTLP endpoint is configured, so it's off in local dev. All
 * config comes from the STANDARD OTEL_* env vars, read SERVER-SIDE only (the
 * OpenObserve basic-auth header must never reach the browser — these are plain
 * env, NOT NEXT_PUBLIC_*):
 *
 *   OTEL_SERVICE_NAME                   grove-<tenant>            (per app)
 *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT  https://<oo>/api/<org>/v1/traces
 *   OTEL_EXPORTER_OTLP_HEADERS          Authorization=Basic <base64(email:password)>
 *
 * `registerOTel` builds the OTLP exporter from those env vars; we only pass the
 * service name (with a safe fallback).
 */
export function registerGroveOtel(): void {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "grove-frontend",
  });
}
