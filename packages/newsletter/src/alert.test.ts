import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportCaptureFailure, resetCaptureAlertThrottle, CAPTURE_ALERT_THROTTLE_MS } from "./alert";

const failure = { app: "nursery", route: "/api/newsletter/subscribe", status: 502, detail: "odoo 500" };

describe("reportCaptureFailure (GOL-3456 capture 5xx alert)", () => {
  beforeEach(() => resetCaptureAlertThrottle());

  it("always writes one grep-able log line, even with no webhook configured", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn();
    await reportCaptureFailure(failure, { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch, log });
    expect(log).toHaveBeenCalledWith(
      "[grove-capture] ALERT nursery /api/newsletter/subscribe -> 502: odoo 500",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to CAPTURE_ALERT_WEBHOOK_URL with mentions disarmed, throttled per app+route", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 204 }));
    let t = 1_000_000;
    const opts = {
      env: { CAPTURE_ALERT_WEBHOOK_URL: "https://hooks.test/abc" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t,
      log: () => {},
    };
    await reportCaptureFailure(failure, opts);
    await reportCaptureFailure(failure, opts); // same minute: suppressed
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.test/abc");
    const body = JSON.parse(String(init.body));
    expect(body.content).toContain("ALERT nursery /api/newsletter/subscribe -> 502");
    expect(body.allowed_mentions).toEqual({ parse: [] });

    // A different route is its own key.
    await reportCaptureFailure({ ...failure, route: "/api/leads" }, opts);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // After the window the same route posts again.
    t += CAPTURE_ALERT_THROTTLE_MS + 1;
    await reportCaptureFailure(failure, opts);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("never throws when the webhook or the logger fails", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("boom"); });
    await expect(
      reportCaptureFailure(failure, {
        env: { CAPTURE_ALERT_WEBHOOK_URL: "https://hooks.test/abc" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        log: () => { throw new Error("logger down"); },
      }),
    ).resolves.toBeUndefined();
  });
});
