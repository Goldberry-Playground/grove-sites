import type { AnalyticsConfig, AnalyticsProps, AnalyticsSink, PlausibleConfig } from "../types";

// First-party Plausible ingest: POST straight to the self-hosted instance's
// events API — the same request plausible.js makes internally. No remote script
// tag (simpler CSP, no third-party JS) and cookieless by design.
let cfg: PlausibleConfig | null = null;

function send(name: string, path: string, props?: AnalyticsProps): void {
  if (!cfg) return;
  const body = JSON.stringify({
    name,
    url: `https://${cfg.domain}${path}`,
    domain: cfg.domain,
    props: props ?? {},
  });
  // keepalive lets the request survive the page unload that follows a purchase.
  void fetch(`${cfg.host}/api/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Never surface an analytics failure to the user.
  });
}

export const plausibleSink: AnalyticsSink = {
  name: "plausible",

  init(config: AnalyticsConfig): boolean {
    if (!config.plausible.enabled) return false;
    cfg = config.plausible;
    return true;
  },

  pageview(path: string): void {
    send("pageview", path);
  },

  event(name: string, props?: AnalyticsProps): void {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    send(name, path, props);
  },
};
