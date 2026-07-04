import { registerGroveOtel } from "@grove/otel";

/**
 * Next.js server instrumentation hook — runs once when the server process boots.
 * Registers OpenTelemetry (traces → OpenObserve, incl. auto fetch spans for
 * BFF→Odoo/Ghost calls). No-op until the OTEL_* env vars are set.
 */
export function register(): void {
  registerGroveOtel();
}
