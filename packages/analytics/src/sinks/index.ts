import { doNotTrackEnabled, getAnalyticsConfig } from "../config";
import type { AnalyticsProps, AnalyticsSink } from "../types";
import { openobserveSink } from "./openobserve";
import { plausibleSink } from "./plausible";

const SINKS: AnalyticsSink[] = [openobserveSink, plausibleSink];

let active: AnalyticsSink[] = [];
let started = false;

/** Initialise every configured sink once, on the client. Idempotent and safe to
 *  call from an effect. Stays inert under Do-Not-Track or when nothing's configured. */
export function startAnalytics(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (doNotTrackEnabled()) return;
  const config = getAnalyticsConfig();
  if (!config.enabled) return;
  active = SINKS.filter((sink) => sink.init(config));
}

export function pageview(path: string): void {
  for (const sink of active) sink.pageview(path);
}

export function emit(name: string, props?: AnalyticsProps): void {
  for (const sink of active) sink.event(name, props);
}

/** True once at least one sink is live — used by tests and debug tooling. */
export function analyticsActive(): boolean {
  return active.length > 0;
}
