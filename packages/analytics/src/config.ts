import type { AnalyticsConfig } from "./types";

type EnvLike = Record<string, string | undefined>;

const s = (v: string | undefined): string => (v ?? "").trim();

/**
 * Resolve an analytics setting by its RUNTIME key first, falling back to the
 * build-time `NEXT_PUBLIC_*` name.
 *
 * Why not just read `NEXT_PUBLIC_*` in the client bundle (as this package used
 * to): `next build` runs ONCE for the storefronts in grove-sites CI and inlines
 * every `NEXT_PUBLIC_*` literal into the published GHCR image, so a var set on
 * the DO App Platform spec can never reach the client — and one image serves
 * BOTH QA and prod, which cannot carry two different tokens/hosts. Instead the
 * root layout (an async Server Component) calls `resolveAnalyticsConfig(process.env)`
 * per request, reading the container's real runtime env, and hands the plain
 * result to `<AnalyticsProvider config={...} />` as a prop. This mirrors the
 * live-chat resolver in each app's app/livechat-config.ts (GOL-3302).
 *
 * The `NEXT_PUBLIC_*` fallback is kept only so local `pnpm dev` (which is not
 * prebaked) and any legacy image still work. The OpenObserve RUM client token
 * is a publishable browser token by design, so carrying it in the config object
 * handed to the client is expected, not a secret leak.
 */
function pick(env: EnvLike, runtimeKey: string, buildKey: string): string {
  const runtime = s(env[runtimeKey]);
  if (runtime) return runtime;
  return s(env[buildKey]);
}

/** Honor the user's Do-Not-Track signal — analytics stays completely inert when set. */
export function doNotTrackEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = typeof window !== "undefined" ? (window as Window & { doNotTrack?: string }) : undefined;
  const dnt = nav.doNotTrack ?? win?.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

/**
 * Resolve the analytics config from a runtime env map (pass `process.env` on the
 * server, or a plain object in tests). A sink is enabled only when the master
 * switch is on AND that sink's required vars are present, so an unconfigured or
 * half-configured environment stays inert — no init, no network.
 */
export function resolveAnalyticsConfig(env: EnvLike): AnalyticsConfig {
  const masterOn = pick(env, "RUM_ENABLED", "NEXT_PUBLIC_RUM_ENABLED") === "true";
  const tenant = pick(env, "TENANT_ID", "NEXT_PUBLIC_TENANT_ID") || "unknown";

  const ooSite = pick(env, "OO_RUM_SITE", "NEXT_PUBLIC_OO_RUM_SITE");
  const ooToken = pick(env, "OO_RUM_CLIENT_TOKEN", "NEXT_PUBLIC_OO_RUM_CLIENT_TOKEN");
  const ooEnabled = masterOn && Boolean(ooSite && ooToken);

  const plHost = pick(env, "PLAUSIBLE_HOST", "NEXT_PUBLIC_PLAUSIBLE_HOST").replace(/\/+$/, "");
  const plDomain = pick(env, "PLAUSIBLE_DOMAIN", "NEXT_PUBLIC_PLAUSIBLE_DOMAIN");
  const plEnabled = masterOn && Boolean(plHost && plDomain);

  return {
    enabled: masterOn && (ooEnabled || plEnabled),
    tenant,
    env: pick(env, "RUM_ENV", "NEXT_PUBLIC_RUM_ENV") || "local",
    openobserve: {
      enabled: ooEnabled,
      site: ooSite,
      clientToken: ooToken,
      applicationId: pick(env, "OO_RUM_APP_ID", "NEXT_PUBLIC_OO_RUM_APP_ID") || `grove-${tenant}`,
      organizationIdentifier: pick(env, "OO_RUM_ORG", "NEXT_PUBLIC_OO_RUM_ORG") || "default",
      service: pick(env, "OO_RUM_SERVICE", "NEXT_PUBLIC_OO_RUM_SERVICE") || `grove-${tenant}`,
      insecureHTTP: pick(env, "OO_RUM_INSECURE", "NEXT_PUBLIC_OO_RUM_INSECURE") === "true",
    },
    plausible: {
      enabled: plEnabled,
      host: plHost,
      domain: plDomain,
    },
  };
}
