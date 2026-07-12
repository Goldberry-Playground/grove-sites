import { describe, it, expect } from "vitest";
import { parsePeriod, resolveWindow, PERIODS } from "./period";

describe("parsePeriod", () => {
  it("normalizes aliases and defaults to last7d", () => {
    expect(parsePeriod("7d")).toBe("last7d");
    expect(parsePeriod("last30d")).toBe("last30d");
    expect(parsePeriod("90D")).toBe("last90d");
    expect(parsePeriod("quarter")).toBe("last90d");
    expect(parsePeriod(undefined)).toBe("last7d");
    expect(parsePeriod("garbage")).toBe("last7d");
  });
});

describe("resolveWindow", () => {
  // Wednesday 2026-07-08T15:30:00Z
  const now = new Date("2026-07-08T15:30:00.000Z");

  it("builds a 7-day inclusive current window", () => {
    const w = resolveWindow("last7d", now);
    expect(w.start).toBe("2026-07-02T00:00:00.000Z");
    expect(w.end).toBe("2026-07-08T23:59:59.999Z");
    expect(w.label).toBe("2026-07-02..2026-07-08");
  });

  it("prior window is the immediately-preceding equal-length window", () => {
    const w = resolveWindow("last7d", now);
    expect(w.prevEnd).toBe("2026-07-01T23:59:59.999Z");
    expect(w.prevStart).toBe("2026-06-25T00:00:00.000Z");
  });

  it("scales for 30d and 90d", () => {
    expect(resolveWindow("last30d", now).start).toBe("2026-06-09T00:00:00.000Z");
    expect(resolveWindow("last90d", now).start).toBe("2026-04-10T00:00:00.000Z");
  });

  it("exposes the three supported periods", () => {
    expect(PERIODS).toEqual(["last7d", "last30d", "last90d"]);
  });
});
