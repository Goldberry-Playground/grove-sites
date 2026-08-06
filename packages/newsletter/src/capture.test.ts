import { describe, it, expect, vi } from "vitest";
import {
  captureOptIn,
  validateOptIn,
  ghostCaptureDeps,
  OptInValidationError,
} from "./capture";
import { resolveGhostConfig } from "./config";
import type { NewsletterProvider, OptInRequest } from "./types";

const valid: OptInRequest = {
  email: "Sam@Example.com ",
  brand: "nursery",
  source: "footer",
  consent: true,
};

describe("validateOptIn", () => {
  it("lowercases + trims the email and defaults optional fields", () => {
    const out = validateOptIn(valid);
    expect(out.email).toBe("sam@example.com");
    expect(out.interests).toEqual([]);
    expect(out.hubOptIn).toBe(false);
  });

  it("normalizes hubOptIn + label", () => {
    const out = validateOptIn({ ...valid, hubOptIn: true, label: " nursery-footer " });
    expect(out.hubOptIn).toBe(true);
    expect(out.label).toBe("nursery-footer");
  });

  it("rejects a missing/garbage email", () => {
    expect(() => validateOptIn({ ...valid, email: "nope" })).toThrow(
      OptInValidationError,
    );
  });

  it("rejects a request without affirmative consent", () => {
    expect(() => validateOptIn({ ...valid, consent: false })).toThrow(/consent/i);
  });

  it("rejects a missing brand", () => {
    expect(() =>
      validateOptIn({ ...valid, brand: undefined as unknown as OptInRequest["brand"] }),
    ).toThrow(OptInValidationError);
  });
});

const okBrand: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: true, id: "m_brand" }),
};
const failBrand: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: false, error: "boom" }),
};
const okHub: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: true, id: "m_hub" }),
};
const failHub: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: false, error: "hub down" }),
};
const okOdoo: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: true, id: "42" }),
};
const failOdoo: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: false, error: "odoo 500" }),
};

describe("captureOptIn", () => {
  const req = validateOptIn(valid);
  const reqHub = validateOptIn({ ...valid, hubOptIn: true });

  it("succeeds when the brand write succeeds; hub + odoo skipped when absent", async () => {
    const res = await captureOptIn(req, { brand: okBrand, hub: okHub });
    expect(res.ok).toBe(true);
    expect(res.brand.ok).toBe(true);
    expect(res.hub.skipped).toBe(true);
    expect(res.odoo.skipped).toBe(true);
  });

  it("syncs to Odoo CRM on a successful brand write", async () => {
    const res = await captureOptIn(req, { brand: okBrand, odoo: okOdoo });
    expect(res.ok).toBe(true);
    expect(res.odoo.ok).toBe(true);
    expect(res.odoo.id).toBe("42");
    expect(okOdoo.subscribe).toHaveBeenCalledWith(req);
  });

  it("stays ok when only the Odoo CRM sync fails (best-effort)", async () => {
    const res = await captureOptIn(req, { brand: okBrand, odoo: failOdoo });
    expect(res.ok).toBe(true);
    expect(res.odoo.ok).toBe(false);
    expect(res.odoo.error).toBe("odoo 500");
  });

  it("does not sync to Odoo when the brand write fails", async () => {
    const odoo: NewsletterProvider = {
      subscribe: vi.fn().mockResolvedValue({ ok: true, id: "42" }),
    };
    const res = await captureOptIn(req, { brand: failBrand, odoo });
    expect(res.ok).toBe(false);
    expect(res.odoo.skipped).toBe(true);
    expect(odoo.subscribe).not.toHaveBeenCalled();
  });

  it("dual-writes to the hub on explicit hub opt-in", async () => {
    const res = await captureOptIn(reqHub, { brand: okBrand, hub: okHub });
    expect(res.ok).toBe(true);
    expect(res.hub.ok).toBe(true);
    expect(res.hub.id).toBe("m_hub");
  });

  it("stays ok when only the hub dual-write fails (best-effort)", async () => {
    const res = await captureOptIn(reqHub, { brand: okBrand, hub: failHub });
    expect(res.ok).toBe(true);
    expect(res.hub.ok).toBe(false);
    expect(res.hub.error).toBe("hub down");
  });

  it("does not write to the hub when opted in but no hub provider exists", async () => {
    const res = await captureOptIn(reqHub, { brand: okBrand, hub: null });
    expect(res.ok).toBe(true);
    expect(res.hub.skipped).toBe(true);
  });

  it("fails overall when the brand write fails", async () => {
    const res = await captureOptIn(req, { brand: failBrand });
    expect(res.ok).toBe(false);
    expect(res.brand.error).toBe("boom");
  });

  it("marks brand skipped when the instance is not provisioned", async () => {
    const res = await captureOptIn(req, { brand: null });
    expect(res.ok).toBe(false);
    expect(res.brand.skipped).toBe(true);
  });
});

describe("ghostCaptureDeps", () => {
  const cfg = resolveGhostConfig({
    GHOST_NEWSLETTER_INSTANCES: JSON.stringify({
      grove: { url: "https://hub.test" },
      nursery: { url: "https://nursery.test" },
    }),
  })!;

  it("wires a brand provider and a hub provider for a tenant brand", () => {
    const deps = ghostCaptureDeps(cfg, "nursery");
    expect(deps.brand).not.toBeNull();
    expect(deps.hub).not.toBeNull();
  });

  it("wires no hub provider when the brand is the hub itself", () => {
    const deps = ghostCaptureDeps(cfg, "grove");
    expect(deps.brand).not.toBeNull();
    expect(deps.hub).toBeNull();
  });

  it("leaves the brand provider null when that instance is unconfigured", () => {
    const deps = ghostCaptureDeps(cfg, "goldberry");
    expect(deps.brand).toBeNull();
  });
});
