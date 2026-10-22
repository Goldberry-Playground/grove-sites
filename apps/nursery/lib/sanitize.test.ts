import { describe, expect, it } from "vitest";
import { sanitizeGuideHtml } from "./sanitize";

describe("sanitizeGuideHtml", () => {
  it("strips script tags and javascript: hrefs", () => {
    expect(sanitizeGuideHtml("<p>safe</p><script>alert(1)</script>")).toBe("<p>safe</p>");
    expect(sanitizeGuideHtml('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
  });

  it("forces rel=noopener noreferrer on anchors (reverse tabnabbing)", () => {
    const out = sanitizeGuideHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toMatch(/target="_blank"/);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it("keeps an existing rel token while adding noopener/noreferrer", () => {
    const out = sanitizeGuideHtml('<a href="https://example.com" rel="nofollow">x</a>');
    expect(out).toMatch(/nofollow/);
    expect(out).toMatch(/noopener/);
    expect(out).toMatch(/noreferrer/);
  });
});
