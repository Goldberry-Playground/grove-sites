import { describe, it, expect } from "vitest";
import { MACY_DISCORD_ID, actorId, isApprover, parseApproverIds } from "./allowlist";

describe("parseApproverIds", () => {
  it("always includes Macy and parses a comma/space list", () => {
    const s = parseApproverIds("111111, 222222 333333");
    expect(s.has(MACY_DISCORD_ID)).toBe(true);
    expect([...s]).toEqual(expect.arrayContaining(["111111", "222222", "333333"]));
  });
  it("drops non-snowflake junk and tolerates undefined", () => {
    const s = parseApproverIds("abc, 12, 4444444");
    expect(s.has("abc")).toBe(false);
    expect(s.has("12")).toBe(false); // too short
    expect(s.has("4444444")).toBe(true);
    expect(parseApproverIds(undefined).has(MACY_DISCORD_ID)).toBe(true);
  });
});

describe("actorId", () => {
  it("prefers guild member.user.id, falls back to DM user.id", () => {
    expect(actorId({ member: { user: { id: "a" } } })).toBe("a");
    expect(actorId({ user: { id: "b" } })).toBe("b");
    expect(actorId({})).toBeUndefined();
  });
});

describe("isApprover", () => {
  const allow = parseApproverIds("777777777");
  it("permits Macy and configured ids, denies everyone else", () => {
    expect(isApprover({ member: { user: { id: MACY_DISCORD_ID } } }, allow)).toBe(true);
    expect(isApprover({ member: { user: { id: "777777777" } } }, allow)).toBe(true);
    expect(isApprover({ member: { user: { id: "000000000" } } }, allow)).toBe(false);
    expect(isApprover({}, allow)).toBe(false);
  });
});
