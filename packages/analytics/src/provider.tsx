"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { pageview, startAnalytics } from "./sinks";
import type { AnalyticsConfig } from "./types";
import { reportWebVitals } from "./web-vitals";

/**
 * Mount once near the app root. Initialises every configured analytics sink from
 * the server-resolved `config` prop, wires Core Web Vitals (only once a sink is
 * actually active), and fires a page view on each App-Router client navigation.
 * Renders nothing.
 *
 * `config` is resolved on the server from the container's runtime env — a root
 * layout calls `resolveAnalyticsConfig(process.env)` (from "@grove/analytics/server")
 * and passes the plain result here. When it's null or disabled the provider does
 * nothing: no SDK download, no web-vitals listeners, no network. This is the
 * default that ships inert to every image until RUM is switched on per env.
 */
export function AnalyticsProvider({ config }: { config?: AnalyticsConfig | null }): null {
  const pathname = usePathname();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // Only pay for web-vitals instrumentation when a sink is live.
    if (startAnalytics(config ?? null)) reportWebVitals();
  }, [config]);

  useEffect(() => {
    if (pathname) pageview(pathname);
  }, [pathname]);

  return null;
}
