import { describe, expect, it } from "vitest";
import { answersComplete, parsePlanParams, planParamsToSearch, defaultTiming } from "./url";

describe("plan URL state", () => {
  it("round-trips every answer", () => {
    const search = "zip=26501&site=open&track=food&size=20&timing=mixed";
    const parsed = parsePlanParams(new URLSearchParams(search));
    expect(parsed).toEqual({ zip: "26501", site: "open", track: "food", size: 20, timing: "mixed" });
    expect(planParamsToSearch(parsed)).toBe(search);
    expect(answersComplete(parsed)).toBe(true);
  });

  it("keeps the sub-goal only on the agro track, and the state fallback", () => {
    const agro = parsePlanParams({ state: "wv", site: "wet", track: "agro", subgoal: "riparian", size: "50", timing: "fast" });
    expect(agro).toEqual({ state: "WV", site: "wet", track: "agro", subgoal: "riparian", size: 50, timing: "fast" });
    expect(planParamsToSearch(agro)).toBe("state=WV&site=wet&track=agro&subgoal=riparian&size=50&timing=fast");
    const food = parsePlanParams({ zip: "26501", track: "food", subgoal: "riparian", timing: "early" });
    expect(food).toEqual({ zip: "26501", track: "food" });
  });

  it("drops anything invalid instead of throwing", () => {
    expect(parsePlanParams(new URLSearchParams("zip=2650&site=swamp&track=x&size=-3&timing=soon"))).toEqual({});
    expect(answersComplete({})).toBe(false);
    expect(answersComplete({ zip: "26501", site: "open", track: "agro", size: 50 })).toBe(false);
  });

  it("defaults timing per track", () => {
    expect(defaultTiming("food")).toBe("mixed");
    expect(defaultTiming("agro")).toBe("mixed");
    expect(defaultTiming("deer")).toBe("all");
  });
});
