import { describe, expect, it } from "vitest";
import { sanitizePostHtml } from "../sanitize";

describe("sanitizePostHtml", () => {
  it("preserves common safe tags", () => {
    const html = "<p>Hello <strong>world</strong></p><h2>A heading</h2><ul><li>a</li></ul>";
    expect(sanitizePostHtml(html)).toBe(html);
  });

  it("strips script tags", () => {
    const html = "<p>safe</p><script>alert(1)</script>";
    expect(sanitizePostHtml(html)).toBe("<p>safe</p>");
  });

  it("strips onerror handlers from img tags", () => {
    const html = '<img src="x" onerror="alert(1)" />';
    const out = sanitizePostHtml(html);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toMatch(/src="x"/);
  });

  it("strips javascript: hrefs", () => {
    const html = '<a href="javascript:alert(1)">x</a>';
    const out = sanitizePostHtml(html);
    expect(out).not.toMatch(/javascript:/i);
  });

  it("preserves anchor href when safe and forces rel=noopener noreferrer", () => {
    const out = sanitizePostHtml('<a href="https://example.com">x</a>');
    expect(out).toMatch(/href="https:\/\/example\.com"/);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it("forces noopener on a target=_blank link (reverse tabnabbing)", () => {
    const out = sanitizePostHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toMatch(/target="_blank"/);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it("keeps an existing rel token while adding noopener/noreferrer", () => {
    const out = sanitizePostHtml('<a href="https://example.com" rel="nofollow">x</a>');
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toMatch(/noopener/);
    expect(out).toMatch(/noreferrer/);
  });
});
