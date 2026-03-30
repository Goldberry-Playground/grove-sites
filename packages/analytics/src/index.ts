"use client";

import { useEffect } from "react";

/**
 * Track a page view. Call in a layout or page component.
 * Currently a no-op placeholder — will integrate with Plausible or similar.
 */
export function usePageView(path?: string) {
  useEffect(() => {
    const pagePath = path ?? window.location.pathname;
    // Placeholder: send to analytics provider
    if (process.env.NODE_ENV === "development") {
      console.warn(`[grove/analytics] pageview: ${pagePath}`);
    }
  }, [path]);
}

/**
 * Track a custom event.
 * Currently a no-op placeholder — will integrate with Plausible or similar.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>
) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[grove/analytics] event: ${name}`, props);
  }
  // Placeholder: send to analytics provider
}
