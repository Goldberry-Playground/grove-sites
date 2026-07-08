import { describe, expect, it } from "vitest";
import { getChecks } from "./index";
import { viewportCheck } from "./viewport";

describe("registered checks", () => {
  it("ships exactly the viewport check", () => {
    expect(getChecks().map((c) => c.id)).toEqual(["viewport"]);
  });

  it("the viewport check is well-formed", () => {
    expect(viewportCheck.id).toBe("viewport");
    expect(viewportCheck.label).toBe("Viewport");
    expect(typeof viewportCheck.Control).toBe("function");
  });
});
