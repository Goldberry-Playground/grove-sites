import type { AnalyticsConfig, AnalyticsProps, AnalyticsSink } from "../types";

// The OpenObserve RUM SDK is browser-only and heavy, so it's loaded lazily via
// dynamic import — it never enters the server bundle and only downloads when RUM
// is actually enabled for this app.
type RumApi = {
  init(config: Record<string, unknown>): void;
  addAction(name: string, context?: Record<string, unknown>): void;
};

let rum: RumApi | null = null;
// The SDK loads asynchronously (dynamic import) while events may already be
// firing — most importantly `purchase`, emitted from a mount effect on the order
// page. Buffer events until `rum` is ready, then flush, so OpenObserve doesn't
// silently miss the early ones (Plausible, being sync, already has them).
// `failed` stops us buffering forever if the SDK chunk never loads.
const queue: Array<[string, Record<string, unknown>]> = [];
let failed = false;
const MAX_QUEUE = 100;

export const openobserveSink: AnalyticsSink = {
  name: "openobserve",

  init(config: AnalyticsConfig): boolean {
    if (!config.openobserve.enabled) return false;
    void import("@openobserve/browser-rum")
      .then(({ openobserveRum }) => {
        openobserveRum.init({
          applicationId: config.openobserve.applicationId,
          clientToken: config.openobserve.clientToken,
          site: config.openobserve.site,
          organizationIdentifier: config.openobserve.organizationIdentifier,
          service: config.openobserve.service,
          env: config.env,
          version: "1.0.0",
          insecureHTTP: config.openobserve.insecureHTTP,
          apiVersion: "v1",
          // USE / interaction signals we want in the RUM views:
          trackResources: true,
          trackLongTasks: true,
          trackUserInteractions: true,
          // Privacy: mask user input. Session replay is OFF (sessionReplaySampleRate
          // 0 + we never call startSessionReplayRecording()) — deliberate for now.
          defaultPrivacyLevel: "mask-user-input",
          sessionSampleRate: 100,
          sessionReplaySampleRate: 0,
        });
        rum = openobserveRum as unknown as RumApi;
        for (const [name, ctx] of queue.splice(0)) rum.addAction(name, ctx);
      })
      .catch(() => {
        // A telemetry SDK failing to load must never break the site — drop the
        // buffer and stop queueing so we don't leak memory on repeated events.
        failed = true;
        queue.length = 0;
      });
    return true;
  },

  pageview(): void {
    // OpenObserve RUM tracks views automatically from History API changes, so
    // there's nothing to do here — kept to satisfy the AnalyticsSink contract.
  },

  event(name: string, props?: AnalyticsProps): void {
    const ctx = props ?? {};
    if (rum) {
      rum.addAction(name, ctx);
    } else if (!failed && queue.length < MAX_QUEUE) {
      queue.push([name, ctx]);
    }
  },
};
