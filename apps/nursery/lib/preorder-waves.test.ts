import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { PreorderWave, ShippingCalendar } from "@grove/odoo-client";
import {
  DEFAULT_WAVE_ZONES,
  FARM_ZONE,
  PREORDER_WAVES_OPEN,
  USDA_ZONE_KEY,
  farmZoneOf,
  firstOpenWave,
  isPreorderSeason,
  preorderWaves,
  readUsdaZone,
  waveZones,
  writeUsdaZone,
} from "./preorder-waves";

const utc = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d, 12));

function waves(zone: number, m: number, d: number) {
  const out: Record<string, PreorderWave> = {};
  for (const w of preorderWaves(zone, utc(m, d), null)) out[w.wave] = w;
  return out;
}

// Port of grove_headless/tests/test_preorder_waves.py (B1), verbatim cases.
describe("preorderWaves (TS port of B1)", () => {
  it("both waves open from Sep 1", () => {
    const w = waves(8, 9, 1);
    expect(w.fall.open && w.spring.open).toBe(true);
    expect(w.fall.order_by).toEqual([11, 21]);
    expect(w.spring.order_by).toEqual([2, 22]);
  });

  it("closed before Sep 1 in summer", () => {
    const w = waves(6, 8, 31);
    expect(w.fall.open).toBe(false);
    expect(w.fall.reason).toBe("opens_sep_1");
    expect(w.spring.open).toBe(false);
    expect(w.spring.reason).toBe("opens_sep_1");
  });

  it("fall greys after the zone order-by, inclusive", () => {
    expect(waves(8, 11, 21).fall.open).toBe(true);
    const w = waves(8, 11, 22);
    expect(w.fall.open).toBe(false);
    expect(w.fall.reason).toBe("deadline_passed");
    expect(w.spring.open).toBe(true);
  });

  it("spring is open through the new year until its order-by", () => {
    expect(waves(8, 1, 10).spring.open).toBe(true);
    expect(waves(8, 2, 22).spring.open).toBe(true);
    const w = waves(8, 2, 23);
    expect(w.spring.open).toBe(false);
    expect(w.spring.reason).toBe("deadline_passed");
  });

  it("fall is closed in spring months", () => {
    const w = waves(6, 3, 1);
    expect(w.fall.open).toBe(false);
    expect(w.fall.reason).toBe("opens_sep_1");
  });

  it("returns fall then spring with the feed's shape", () => {
    const out = preorderWaves(6, utc(9, 15), null);
    expect(out.map((w) => w.wave)).toEqual(["fall", "spring"]);
    expect(new Set(Object.keys(out[0]))).toEqual(
      new Set(["wave", "ship_window", "order_by", "open", "reason"]),
    );
    expect(out[0].reason).toBeNull();
  });

  it("carries the zone's ship windows", () => {
    const w = waves(8, 10, 7);
    expect(w.fall.ship_window).toEqual([
      [11, 9],
      [12, 12],
    ]);
    expect(w.spring.ship_window).toEqual([
      [3, 1],
      [4, 15],
    ]);
  });
});

describe("preorderWaves: feed first", () => {
  const feedWaves: PreorderWave[] = [
    { wave: "fall", ship_window: [[11, 1], [11, 30]], order_by: [11, 2], open: false, reason: "deadline_passed" },
    { wave: "spring", ship_window: [[3, 1], [4, 1]], order_by: [3, 1], open: true, reason: null },
  ];

  it("prefers calendar.resolved[zone].waves when present", () => {
    const cal = { zones: {}, resolved: { "8": { waves: feedWaves } } } as unknown as ShippingCalendar;
    expect(preorderWaves(8, utc(10, 7), cal)).toEqual(feedWaves);
  });

  it("computes from the feed's zone calendar when resolved waves are absent", () => {
    const cal = {
      zones: {
        "8": {
          fall: [[11, 9], [12, 12]],
          spring: [[3, 1], [4, 15]],
          fall_order_deadline: [10, 1],
          spring_order_deadline: [2, 22],
        },
      },
    } as unknown as ShippingCalendar;
    const w = preorderWaves(8, utc(10, 7), cal);
    expect(w[0].open).toBe(false);
    expect(w[0].reason).toBe("deadline_passed");
  });

  it("falls back to the bundled schedule for a zone the feed lacks", () => {
    const cal = { zones: {} } as unknown as ShippingCalendar;
    expect(preorderWaves(8, utc(10, 7), cal)[0].order_by).toEqual([11, 21]);
  });

  it("returns nothing for an unknown zone", () => {
    expect(preorderWaves(42, utc(10, 7), null)).toEqual([]);
  });
});

describe("helpers", () => {
  it("opens pre-orders on Sep 1", () => {
    expect(PREORDER_WAVES_OPEN).toEqual([9, 1]);
    expect(isPreorderSeason(utc(8, 31))).toBe(false);
    expect(isPreorderSeason(utc(9, 1))).toBe(true);
    expect(isPreorderSeason(utc(12, 31))).toBe(true);
  });

  it("firstOpenWave picks fall before spring and skips closed waves", () => {
    expect(firstOpenWave(preorderWaves(8, utc(10, 7), null))).toBe("fall");
    expect(firstOpenWave(preorderWaves(8, utc(11, 22), null))).toBe("spring");
    expect(firstOpenWave(preorderWaves(8, utc(4, 17), null))).toBeNull();
  });

  it("zones come from the feed, else the bundled schedule", () => {
    expect(waveZones(null)).toEqual(DEFAULT_WAVE_ZONES);
    const cal = { zones: { "7": {}, "10": {}, "5": {} } } as unknown as ShippingCalendar;
    expect(waveZones(cal)).toEqual([5, 7, 10]);
  });

  it("farm zone defaults to 6", () => {
    expect(FARM_ZONE).toBe(6);
    expect(farmZoneOf(null)).toBe(6);
    expect(farmZoneOf({ farm_zone: 7 })).toBe(7);
    expect(farmZoneOf({ farm_zone: "x" })).toBe(6);
  });
});

describe("remembered USDA zone", () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips through grove:usda-zone", () => {
    expect(USDA_ZONE_KEY).toBe("grove:usda-zone");
    expect(readUsdaZone()).toBeNull();
    writeUsdaZone(8);
    expect(localStorage.getItem("grove:usda-zone")).toBe("8");
    expect(readUsdaZone()).toBe(8);
  });

  it("ignores garbage", () => {
    localStorage.setItem(USDA_ZONE_KEY, "eight");
    expect(readUsdaZone()).toBeNull();
  });
});
