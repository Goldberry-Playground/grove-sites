/** Flat, PII-free event properties. Values are primitives so every sink can serialise them. */
export type AnalyticsPropValue = string | number | boolean;
export type AnalyticsProps = Record<string, AnalyticsPropValue>;

/**
 * A destination for analytics signals. Both the OpenObserve RUM sink and the
 * Plausible sink implement this — the dual-writer just fans out to each.
 */
export interface AnalyticsSink {
  readonly name: string;
  /** Initialise on the client. Return true if the sink became active. */
  init(config: AnalyticsConfig): boolean;
  /** Record a page view for `path`. */
  pageview(path: string): void;
  /** Record a named custom event with optional flat, already-PII-safe props. */
  event(name: string, props?: AnalyticsProps): void;
}

export interface OpenObserveConfig {
  enabled: boolean;
  site: string;
  clientToken: string;
  applicationId: string;
  organizationIdentifier: string;
  service: string;
  insecureHTTP: boolean;
}

export interface PlausibleConfig {
  enabled: boolean;
  host: string;
  domain: string;
}

export interface AnalyticsConfig {
  /** True only if the master switch is on AND at least one sink is configured. */
  enabled: boolean;
  tenant: string;
  env: string;
  openobserve: OpenObserveConfig;
  plausible: PlausibleConfig;
}
