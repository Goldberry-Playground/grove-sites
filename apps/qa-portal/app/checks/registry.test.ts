import { describe, expect, it } from "vitest";
import { getChecks, registerCheck } from "./registry";
import type { Check } from "./types";

const stub = (id: string): Check => ({
  id,
  label: id,
  Control: () => null,
});

describe("checks registry", () => {
  it("registers a check and returns it from getChecks", () => {
    registerCheck(stub("alpha"));
    expect(getChecks().map((c) => c.id)).toContain("alpha");
  });

  it("rejects a duplicate id", () => {
    registerCheck(stub("beta"));
    expect(() => registerCheck(stub("beta"))).toThrow(/already registered/);
  });
});
