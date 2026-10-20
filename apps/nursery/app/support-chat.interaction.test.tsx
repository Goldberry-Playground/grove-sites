// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { FIRST_INTERACTION_EVENTS, useFirstInteraction } from "./support-chat";

afterEach(cleanup);

describe("useFirstInteraction (livechat loads on intent, not on page load)", () => {
  it("stays false until the visitor interacts", () => {
    const { result } = renderHook(() => useFirstInteraction());
    expect(result.current).toBe(false);
  });

  it.each(FIRST_INTERACTION_EVENTS)("flips to true on the first %s", (type) => {
    const { result } = renderHook(() => useFirstInteraction());
    act(() => {
      window.dispatchEvent(new Event(type));
    });
    expect(result.current).toBe(true);
  });

  it("never arms when disabled (no channel configured)", () => {
    const { result } = renderHook(() => useFirstInteraction(false));
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(result.current).toBe(false);
  });
});
