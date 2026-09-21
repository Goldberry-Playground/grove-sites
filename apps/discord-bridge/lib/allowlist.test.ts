import { describe, it, expect } from "vitest";
import { MACY_DISCORD_ID, actorId, isApprover, parseApproverIds, parseOperatorIds } from "./allowlist";

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

describe("parseOperatorIds", () => {
  it("parses a list with NO baked-in default (distinct from approvers)", () => {
    const s = parseOperatorIds("700000000000000000, 800000000000000000");
    expect(s.has("700000000000000000")).toBe(true);
    expect(s.has("800000000000000000")).toBe(true);
    // unlike parseApproverIds, Macy is not automatically an order operator
    expect(s.has(MACY_DISCORD_ID)).toBe(false);
  });
  it("an unset roster is empty ⇒ nobody can mark shipped", () => {
    expect(parseOperatorIds(undefined).size).toBe(0);
    expect(parseOperatorIds("").size).toBe(0);
    expect(parseOperatorIds("junk, 12").size).toBe(0);
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
