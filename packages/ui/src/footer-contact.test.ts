import { describe, it, expect } from "vitest";
import { formatPhone } from "./footer-contact";

describe("formatPhone", () => {
  it("formats 10 raw digits as (NNN) NNN-NNNN", () => {
    expect(formatPhone("4457875140")).toBe("(445) 787-5140");
  });

  it("strips non-digits from a 10-digit number before formatting", () => {
    expect(formatPhone("445-787-5140")).toBe("(445) 787-5140");
    expect(formatPhone("(445) 787 5140")).toBe("(445) 787-5140");
  });

  it("passes through anything that is not exactly 10 digits", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("14457875140")).toBe("14457875140");
  });
});
