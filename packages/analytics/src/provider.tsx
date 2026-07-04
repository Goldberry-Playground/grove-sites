"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { pageview, startAnalytics } from "./sinks";
import { reportWebVitals } from "./web-vitals";

/**
 * Mount once near the app root (inside the client `Providers` tree). Initialises
 * every configured analytics sink, wires Core Web Vitals, and fires a page view
 * on each App-Router client navigation. Renders nothing.
 */
export function AnalyticsProvider(): null {
  const pathname = usePathname();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    startAnalytics();
    reportWebVitals();
  }, []);

  useEffect(() => {
    if (pathname) pageview(pathname);
  }, [pathname]);

  return null;
}
