import { describe, expect, it } from "vitest";

import { resolveAnalyticsConfig } from "./config";

describe("resolveAnalyticsConfig", () => {
  it("is fully inert on an empty env — the default every image ships with", () => {
    const cfg = resolveAnalyticsConfig({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.openobserve.enabled).toBe(false);
    expect(cfg.plausible.enabled).toBe(false);
  });

  it("stays inert when the master switch is on but no sink vars are set", () => {
    const cfg = resolveAnalyticsConfig({ RUM_ENABLED: "true" });
    expect(cfg.enabled).toBe(false);
    expect(cfg.openobserve.enabled).toBe(false);
    expect(cfg.plausible.enabled).toBe(false);
  });

  it("enables OpenObserve only when the master switch AND both required vars are present", () => {
    const base = { OO_RUM_SITE: "oo.example.com", OO_RUM_CLIENT_TOKEN: "tok_123" };
    expect(resolveAnalyticsConfig(base).openobserve.enabled).toBe(false); // master off
    expect(resolveAnalyticsConfig({ ...base, RUM_ENABLED: "true" }).openobserve.enabled).toBe(true);
    // half-configured: token missing => still off
    expect(
      resolveAnalyticsConfig({ RUM_ENABLED: "true", OO_RUM_SITE: "oo.example.com" }).openobserve.enabled,
    ).toBe(false);
  });

  it("enables Plausible only with host + domain (prod-only via env, never on by default)", () => {
    const cfg = resolveAnalyticsConfig({
      RUM_ENABLED: "true",
      PLAUSIBLE_HOST: "https://plausible.example.com/",
      PLAUSIBLE_DOMAIN: "atthegrovenursery.com",
    });
    expect(cfg.plausible.enabled).toBe(true);
    // trailing slash on the host is trimmed so `${host}/api/event` is well-formed
    expect(cfg.plausible.host).toBe("https://plausible.example.com");
    expect(cfg.enabled).toBe(true);
  });

  it("prefers the RUNTIME key over the baked NEXT_PUBLIC_* fallback", () => {
    const cfg = resolveAnalyticsConfig({
      RUM_ENABLED: "true",
      OO_RUM_SITE: "runtime.example.com",
      OO_RUM_CLIENT_TOKEN: "runtime_tok",
      NEXT_PUBLIC_OO_RUM_SITE: "baked.example.com",
      NEXT_PUBLIC_OO_RUM_CLIENT_TOKEN: "baked_tok",
    });
    expect(cfg.openobserve.site).toBe("runtime.example.com");
    expect(cfg.openobserve.clientToken).toBe("runtime_tok");
  });

  it("falls back to NEXT_PUBLIC_* when the runtime key is unset (local pnpm dev)", () => {
    const cfg = resolveAnalyticsConfig({
      NEXT_PUBLIC_RUM_ENABLED: "true",
      NEXT_PUBLIC_OO_RUM_SITE: "baked.example.com",
      NEXT_PUBLIC_OO_RUM_CLIENT_TOKEN: "baked_tok",
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.openobserve.site).toBe("baked.example.com");
  });

  it("derives sane service/application defaults from the tenant", () => {
    const cfg = resolveAnalyticsConfig({
      RUM_ENABLED: "true",
      TENANT_ID: "nursery",
      OO_RUM_SITE: "oo.example.com",
      OO_RUM_CLIENT_TOKEN: "tok",
    });
    expect(cfg.tenant).toBe("nursery");
    expect(cfg.openobserve.applicationId).toBe("grove-nursery");
    expect(cfg.openobserve.service).toBe("grove-nursery");
  });
});
