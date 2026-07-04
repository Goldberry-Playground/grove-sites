import type { AnalyticsConfig } from "./types";

// NEXT_PUBLIC_* vars are inlined by Next at build time ONLY via literal member
// access — process.env[dynamicKey] does NOT get replaced in the browser bundle.
// So every var is referenced literally here, once.
const RAW = {
  master: process.env.NEXT_PUBLIC_RUM_ENABLED,
  tenant: process.env.NEXT_PUBLIC_TENANT_ID,
  env: process.env.NEXT_PUBLIC_RUM_ENV,
  ooSite: process.env.NEXT_PUBLIC_OO_RUM_SITE,
  ooToken: process.env.NEXT_PUBLIC_OO_RUM_CLIENT_TOKEN,
  ooApp: process.env.NEXT_PUBLIC_OO_RUM_APP_ID,
  ooOrg: process.env.NEXT_PUBLIC_OO_RUM_ORG,
  ooService: process.env.NEXT_PUBLIC_OO_RUM_SERVICE,
  ooInsecure: process.env.NEXT_PUBLIC_OO_RUM_INSECURE,
  plHost: process.env.NEXT_PUBLIC_PLAUSIBLE_HOST,
  plDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
} as const;

const s = (v: string | undefined): string => (v ?? "").trim();

/** Honor the user's Do-Not-Track signal — analytics stays completely inert when set. */
export function doNotTrackEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = typeof window !== "undefined" ? (window as Window & { doNotTrack?: string }) : undefined;
  const dnt = nav.doNotTrack ?? win?.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

/** Resolve the analytics config from NEXT_PUBLIC_* env. A sink is enabled only
 *  when the master switch is on and that sink's required vars are present. */
export function getAnalyticsConfig(): AnalyticsConfig {
  const masterOn = s(RAW.master) === "true";
  const tenant = s(RAW.tenant) || "unknown";

  const ooSite = s(RAW.ooSite);
  const ooToken = s(RAW.ooToken);
  const ooEnabled = masterOn && Boolean(ooSite && ooToken);

  const plHost = s(RAW.plHost).replace(/\/+$/, "");
  const plDomain = s(RAW.plDomain);
  const plEnabled = masterOn && Boolean(plHost && plDomain);

  return {
    enabled: masterOn && (ooEnabled || plEnabled),
    tenant,
    env: s(RAW.env) || "local",
    openobserve: {
      enabled: ooEnabled,
      site: ooSite,
      clientToken: ooToken,
      applicationId: s(RAW.ooApp) || `grove-${tenant}`,
      organizationIdentifier: s(RAW.ooOrg) || "default",
      service: s(RAW.ooService) || `grove-${tenant}`,
      insecureHTTP: s(RAW.ooInsecure) === "true",
    },
    plausible: {
      enabled: plEnabled,
      host: plHost,
      domain: plDomain,
    },
  };
}
