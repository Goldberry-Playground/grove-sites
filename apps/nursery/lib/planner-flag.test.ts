import { describe, expect, it } from "vitest";
import { plannerEnabled } from "./planner-flag";

/**
 * §F kill switch (GOL-3527): a runtime env read, so QA can flip the planner on
 * without a rebuild while prod stays dark on the same image.
 */
describe("plannerEnabled", () => {
  it("is off when neither variable is set", () => {
    expect(plannerEnabled({})).toBe(false);
  });

  it.each(["1", "true", "on", "yes", "TRUE", "Yes"])("is on for PLANNER_ENABLED=%s", (v) => {
    expect(plannerEnabled({ PLANNER_ENABLED: v })).toBe(true);
  });

  it.each(["0", "false", "off", "no", "", " 1", "enabled"])("is off for PLANNER_ENABLED=%j", (v) => {
    expect(plannerEnabled({ PLANNER_ENABLED: v })).toBe(false);
  });

  it("accepts NEXT_PUBLIC_PLANNER as an alias for the local render recipe", () => {
    expect(plannerEnabled({ NEXT_PUBLIC_PLANNER: "1" })).toBe(true);
  });

  it("lets PLANNER_ENABLED win when both are set", () => {
    expect(plannerEnabled({ PLANNER_ENABLED: "0", NEXT_PUBLIC_PLANNER: "1" })).toBe(false);
    expect(plannerEnabled({ PLANNER_ENABLED: "1", NEXT_PUBLIC_PLANNER: "0" })).toBe(true);
  });

  it("reads process.env at call time, not module load", () => {
    const prev = process.env.PLANNER_ENABLED;
    try {
      process.env.PLANNER_ENABLED = "1";
      expect(plannerEnabled()).toBe(true);
      delete process.env.PLANNER_ENABLED;
      expect(plannerEnabled()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.PLANNER_ENABLED;
      else process.env.PLANNER_ENABLED = prev;
    }
  });
});
