"use client";

import { useEffect } from "react";

import { emit, pageview } from "./sinks";

export { AnalyticsProvider } from "./provider";
export { trackAddToCart, trackBeginCheckout, trackPurchase } from "./events";
export type { AnalyticsConfig, AnalyticsProps, AnalyticsSink } from "./types";

/**
 * Track a page view imperatively. Most pages don't need this —
 * `AnalyticsProvider` fires a page view on every route change automatically.
 */
export function usePageView(path?: string): void {
  useEffect(() => {
    pageview(path ?? window.location.pathname);
  }, [path]);
}

/** Track a custom event. Props must be a flat, PII-free record. */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  emit(name, props);
}
