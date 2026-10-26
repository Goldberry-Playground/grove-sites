// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsConfig } from "./types";

// Stand in for the heavy browser-RUM SDK so tests never load the real one. The
// sink imports it dynamically, so a spy here also proves the import only happens
// when a sink is actually enabled (lazy load — no cost when inert).
const rumInit = vi.fn();
const rumAddAction = vi.fn();
vi.mock("@openobserve/browser-rum", () => ({
  openobserveRum: { init: rumInit, addAction: rumAddAction },
}));

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
  Promise.resolve(new Response(null, { status: 202 })),
);

function ooConfig(over: Partial<AnalyticsConfig> = {}): AnalyticsConfig {
  return {
    enabled: true,
    tenant: "nursery",
    env: "qa",
    openobserve: {
      enabled: true,
      site: "oo.example.com",
      clientToken: "tok",
      applicationId: "grove-nursery",
      organizationIdentifier: "default",
      service: "grove-nursery",
      insecureHTTP: false,
    },
    plausible: { enabled: false, host: "", domain: "" },
    ...over,
  };
}

function plausibleConfig(): AnalyticsConfig {
  return {
    enabled: true,
    tenant: "nursery",
    env: "qa",
    openobserve: {
      enabled: false,
      site: "",
      clientToken: "",
      applicationId: "",
      organizationIdentifier: "",
      service: "",
      insecureHTTP: false,
    },
    plausible: { enabled: true, host: "https://plausible.example.com", domain: "atthegrovenursery.com" },
  };
}

// Fresh module graph per test so the one-shot `started`/`active` state resets.
async function freshSinks() {
  vi.resetModules();
  rumInit.mockClear();
  rumAddAction.mockClear();
  fetchMock.mockClear();
  return import("./sinks");
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startAnalytics — inert unless configured", () => {
  it("does nothing on a null config: no SDK import, no network, not active", async () => {
    const sinks = await freshSinks();
    expect(sinks.startAnalytics(null)).toBe(false);
    expect(sinks.analyticsActive()).toBe(false);
    sinks.pageview("/shop");
    sinks.emit("add_to_cart", { variant_id: "1" });
    await Promise.resolve();
    expect(rumInit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing on a disabled config", async () => {
    const sinks = await freshSinks();
    const cfg = ooConfig({ enabled: false });
    expect(sinks.startAnalytics(cfg)).toBe(false);
    expect(sinks.analyticsActive()).toBe(false);
    expect(rumInit).not.toHaveBeenCalled();
  });

  it("stays inert under Do-Not-Track even when fully configured", async () => {
    Object.defineProperty(window.navigator, "doNotTrack", { value: "1", configurable: true });
    const sinks = await freshSinks();
    expect(sinks.startAnalytics(ooConfig())).toBe(false);
    await Promise.resolve();
    expect(rumInit).not.toHaveBeenCalled();
    Object.defineProperty(window.navigator, "doNotTrack", { value: null, configurable: true });
  });
});

describe("startAnalytics — active when configured", () => {
  it("lazily imports + inits the OpenObserve SDK only once enabled", async () => {
    const sinks = await freshSinks();
    expect(sinks.startAnalytics(ooConfig())).toBe(true);
    await vi.waitFor(() => expect(rumInit).toHaveBeenCalledTimes(1));
    // session replay disabled; user input masked (privacy defaults)
    const initArg = rumInit.mock.calls[0][0];
    expect(initArg.sessionReplaySampleRate).toBe(0);
    expect(initArg.defaultPrivacyLevel).toBe("mask-user-input");
  });

  it("POSTs a cookieless Plausible pageview to the self-hosted events API", async () => {
    const sinks = await freshSinks();
    expect(sinks.startAnalytics(plausibleConfig())).toBe(true);
    sinks.pageview("/shop/29");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://plausible.example.com/api/event");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      name: "pageview",
      domain: "atthegrovenursery.com",
    });
  });

  it("is idempotent — a second start does not re-init", async () => {
    const sinks = await freshSinks();
    sinks.startAnalytics(ooConfig());
    sinks.startAnalytics(ooConfig());
    await vi.waitFor(() => expect(rumInit).toHaveBeenCalledTimes(1));
  });
});
