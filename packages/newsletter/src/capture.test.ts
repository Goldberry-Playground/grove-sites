import { describe, it, expect, vi } from "vitest";
import {
  captureOptIn,
  validateOptIn,
  OptInValidationError,
} from "./capture";
import type { NewsletterProvider, CrmSync, OptInRequest } from "./types";

const valid: OptInRequest = {
  email: "Sam@Example.com ",
  brand: "grove",
  source: "footer",
  consent: true,
};

describe("validateOptIn", () => {
  it("lowercases + trims the email and defaults interests", () => {
    const out = validateOptIn(valid);
    expect(out.email).toBe("sam@example.com");
    expect(out.interests).toEqual([]);
  });

  it("rejects a missing/garbage email", () => {
    expect(() => validateOptIn({ ...valid, email: "nope" })).toThrow(
      OptInValidationError,
    );
  });

  it("rejects a request without affirmative consent", () => {
    expect(() =>
      validateOptIn({ ...valid, consent: false }),
    ).toThrow(/consent/i);
  });

  it("rejects a missing brand", () => {
    expect(() =>
      validateOptIn({ ...valid, brand: undefined as unknown as OptInRequest["brand"] }),
    ).toThrow(OptInValidationError);
  });
});

const okProvider: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: true, id: "sub_1" }),
};
const failProvider: NewsletterProvider = {
  subscribe: vi.fn().mockResolvedValue({ ok: false, error: "boom" }),
};
const okCrm: CrmSync = { record: vi.fn().mockResolvedValue({ ok: true, id: "42" }) };
const failCrm: CrmSync = { record: vi.fn().mockResolvedValue({ ok: false, error: "crm down" }) };

describe("captureOptIn", () => {
  const req = validateOptIn(valid);

  it("succeeds when the newsletter subscribe succeeds", async () => {
    const res = await captureOptIn(req, { provider: okProvider, crm: okCrm });
    expect(res.ok).toBe(true);
    expect(res.newsletter.ok).toBe(true);
    expect(res.crm.ok).toBe(true);
  });

  it("stays ok when only CRM attribution fails (best-effort)", async () => {
    const res = await captureOptIn(req, { provider: okProvider, crm: failCrm });
    expect(res.ok).toBe(true);
    expect(res.crm.ok).toBe(false);
    expect(res.crm.error).toBe("crm down");
  });

  it("fails overall when the newsletter subscribe fails", async () => {
    const res = await captureOptIn(req, { provider: failProvider, crm: okCrm });
    expect(res.ok).toBe(false);
    expect(res.newsletter.error).toBe("boom");
  });

  it("marks newsletter skipped when the provider is not provisioned", async () => {
    const res = await captureOptIn(req, { provider: null });
    expect(res.ok).toBe(false);
    expect(res.newsletter.skipped).toBe(true);
    expect(res.crm.skipped).toBe(true);
  });
});
