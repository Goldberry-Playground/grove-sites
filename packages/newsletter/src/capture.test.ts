import { describe, it, expect, vi } from "vitest";
import { captureOptIn, listsFor, validateOptIn, OptInValidationError } from "./capture";
import type { NewsletterProvider, OptInRequest } from "./types";

const base: OptInRequest = {
  email: "Sam@Example.com ",
  brand: "nursery",
  source: "footer",
  consent: true,
};

describe("validateOptIn", () => {
  it("normalizes the email, trims the name, defaults the flags", () => {
    const out = validateOptIn({ ...base, name: " Sam ", label: " nursery-footer " });
    expect(out.email).toBe("sam@example.com");
    expect(out.name).toBe("Sam");
    expect(out.label).toBe("nursery-footer");
    expect(out.multibrand).toBe(false);
    expect(out.interests).toEqual([]);
  });

  it("drops blank and non-string interests", () => {
    const out = validateOptIn({
      ...base,
      interests: ["produce", " ", 7 as unknown as string, "events"],
    });
    expect(out.interests).toEqual(["produce", "events"]);
  });

  it("rejects a bad email, missing consent, or an unknown brand", () => {
    expect(() => validateOptIn({ ...base, email: "nope" })).toThrow(OptInValidationError);
    expect(() => validateOptIn({ ...base, consent: false })).toThrowError(
      expect.objectContaining({ field: "consent" }),
    );
    expect(() =>
      validateOptIn({ ...base, brand: "etsy" as unknown as OptInRequest["brand"] }),
    ).toThrowError(expect.objectContaining({ field: "brand" }));
  });
});

describe("listsFor (spec §2, Josh 2026-10-20)", () => {
  it("defaults to the brand's own list", () => {
    expect(listsFor("nursery")).toEqual(["nursery"]);
    expect(listsFor("goldberry")).toEqual(["farm"]);
    expect(listsFor("grove")).toEqual(["digest"]);
    expect(listsFor("ggg")).toEqual(["digest"]);
  });

  it("adds EVERY other list when the multibrand box is ticked, primary first", () => {
    expect(listsFor("nursery", true)).toEqual(["nursery", "farm", "digest"]);
    expect(listsFor("goldberry", true)).toEqual(["farm", "nursery", "digest"]);
    // The hub's primary is the Digest; its box adds Nursery News + Farm News.
    expect(listsFor("grove", true)).toEqual(["digest", "nursery", "farm"]);
  });
});

describe("captureOptIn", () => {
  it("writes once to the provider with the resolved lists", async () => {
    const subscribe = vi.fn<NewsletterProvider["subscribe"]>(async () => ({
      ok: true,
      lists: ["farm", "nursery", "digest"],
    }));
    const provider: NewsletterProvider = { subscribe };
    const req = validateOptIn({ ...base, brand: "goldberry", multibrand: true });
    const out = await captureOptIn(req, provider);
    expect(out.ok).toBe(true);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0]![1]).toEqual(["farm", "nursery", "digest"]);
  });

  it("reports skipped + not ok when Odoo is not configured", async () => {
    const out = await captureOptIn(validateOptIn(base), null);
    expect(out).toMatchObject({ ok: false, skipped: true });
  });
});
