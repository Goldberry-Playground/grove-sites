import { describe, it, expect } from "vitest";
import {
  postCount,
  impressions,
  engagements,
  engagementRate,
  wowDeltaPct,
} from "./metrics";
import type { BufferMetric } from "./types";

// Real Threads metric shape (verified live against Buffer 2026-07-11).
const threads: BufferMetric[] = [
  { type: "postCount", value: 446 },
  { type: "reactions", value: 13682 },
  { type: "comments", value: 2623 },
  { type: "engagementRate", value: 2.23 },
  { type: "views", value: 787666 },
  { type: "quotes", value: 91 },
  { type: "reposts", value: 1156 },
];

describe("metrics parsing", () => {
  it("reads post count from postCount", () => {
    expect(postCount(threads)).toBe(446);
    expect(postCount([])).toBe(0);
  });

  it("prefers impressions, then views, then reach", () => {
    expect(impressions(threads)).toBe(787666); // views
    expect(impressions([{ type: "impressions", value: 10 }, { type: "views", value: 99 }])).toBe(10);
    expect(impressions([{ type: "reach", value: 42 }])).toBe(42);
    expect(impressions([])).toBe(0);
  });

  it("sums engagement-type metrics and excludes rate/views/postCount", () => {
    // 13682 + 2623 + 91 + 1156 = 17552 (engagementRate, views, postCount excluded)
    expect(engagements(threads)).toBe(17552);
  });

  it("ignores non-finite metric values", () => {
    expect(engagements([{ type: "reactions", value: Number.NaN }])).toBe(0);
  });

  it("computes engagement_rate as engagements/impressions, null on zero impressions", () => {
    expect(engagementRate(1830, 41200)).toBeCloseTo(0.0444, 4);
    expect(engagementRate(10, 0)).toBeNull();
  });

  it("computes WoW delta percent, null when prior is missing or zero", () => {
    expect(wowDeltaPct(112, 100)).toBeCloseTo(12, 5);
    expect(wowDeltaPct(80, 100)).toBeCloseTo(-20, 5);
    expect(wowDeltaPct(5, 0)).toBeNull();
    expect(wowDeltaPct(5, null)).toBeNull();
  });
});
