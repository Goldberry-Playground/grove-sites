import { doNotTrackEnabled } from "../config";
import type { AnalyticsConfig, AnalyticsProps, AnalyticsSink } from "../types";
import { openobserveSink } from "./openobserve";
import { plausibleSink } from "./plausible";

const SINKS: AnalyticsSink[] = [openobserveSink, plausibleSink];

let active: AnalyticsSink[] = [];
let started = false;

/**
 * Initialise every configured sink once, on the client, from a config resolved
 * on the server and passed in. Idempotent and safe to call from an effect.
 * Returns true if at least one sink became active. Stays completely inert — no
 * init, no network, no cost — under Do-Not-Track, when `config` is null, or when
 * nothing is configured (the switch-off default that ships to every image).
 */
export function startAnalytics(config: AnalyticsConfig | null): boolean {
  if (started || typeof window === "undefined") return analyticsActive();
  started = true;
  if (!config || !config.enabled) return false;
  if (doNotTrackEnabled()) return false;
  active = SINKS.filter((sink) => sink.init(config));
  return active.length > 0;
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
