import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

import { emit } from "./sinks";

/**
 * Wire Core Web Vitals → the dual-writer as `web_vitals` events with a stable
 * schema (metric / value / rating) so the rum-webvitals-* alerts have known
 * field names to query. CLS is unitless, so it's scaled ×1000 to an integer;
 * the others are millisecond values, rounded.
 */
export function reportWebVitals(): void {
  const report = (metric: Metric): void => {
    emit("web_vitals", {
      metric: metric.name, // LCP | INP | CLS | FCP | TTFB
      value: metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value),
      rating: metric.rating, // good | needs-improvement | poor
    });
  };
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
}
