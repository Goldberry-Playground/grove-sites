import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SocialLinks, type SocialLink } from "./social-links";

const links: SocialLink[] = [
  { kind: "facebook", href: "https://www.facebook.com/goldberrygrove/" },
  { kind: "youtube", href: "https://www.youtube.com/@GoldberryGrove" },
];

describe("SocialLinks", () => {
  it("labels each icon link 'Owner on Platform' and links the profile", () => {
    const html = renderToStaticMarkup(<SocialLinks links={links} owner="Goldberry Grove" />);
    expect(html).toContain('aria-label="Goldberry Grove on Facebook"');
    expect(html).toContain('aria-label="Goldberry Grove on YouTube"');
    expect(html).toContain('href="https://www.facebook.com/goldberrygrove/"');
    expect(html).toContain('aria-label="Goldberry Grove on social media"');
  });

  it("gives every link a 44px tap target, ringed only when asked", () => {
    const plain = renderToStaticMarkup(<SocialLinks links={links} owner="X" />);
    expect(plain.match(/width:44px;height:44px/g)).toHaveLength(2);
    expect(plain).not.toContain("solid currentColor");
    const ringed = renderToStaticMarkup(<SocialLinks links={links} owner="X" ringed />);
    expect(ringed).toContain("1.5px solid currentColor");
  });

  it("renders nothing for an empty list", () => {
    expect(renderToStaticMarkup(<SocialLinks links={[]} owner="X" />)).toBe("");
  });
});
