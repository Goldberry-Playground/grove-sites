import { describe, it, expect } from "vitest";
import { organizationJsonLd, serializeJsonLd } from "./json-ld";

describe("organizationJsonLd", () => {
  it("emits name, url, an absolute logo and sameAs", () => {
    expect(
      organizationJsonLd({
        name: "Goldberry Grove Farm",
        url: "https://goldberrygrove.farm",
        logo: "/photos/logo-wordmark.png",
        sameAs: ["https://www.instagram.com/goldberrygrove/"],
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Goldberry Grove Farm",
      url: "https://goldberrygrove.farm",
      logo: "https://goldberrygrove.farm/photos/logo-wordmark.png",
      sameAs: ["https://www.instagram.com/goldberrygrove/"],
    });
  });

  it("keeps an already-absolute logo (asset CDN) as is", () => {
    const { logo } = organizationJsonLd({
      name: "x",
      url: "https://example.com",
      logo: "https://cdn.example.net/goldberry/photos/logo.png",
    });
    expect(logo).toBe("https://cdn.example.net/goldberry/photos/logo.png");
  });

  it("omits logo and sameAs when there are none", () => {
    const block = organizationJsonLd({ name: "x", url: "https://example.com", sameAs: [] });
    expect(block).not.toHaveProperty("logo");
    expect(block).not.toHaveProperty("sameAs");
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a value cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
