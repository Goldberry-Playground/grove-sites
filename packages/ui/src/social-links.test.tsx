import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SOCIAL_THEME_VARS, SocialLinks, type SocialLink } from "./social-links";

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

  // GOL-2813. An inline style beats a class rule, so any inline value a site
  // legitimately re-themes has to resolve through a custom property or the
  // consumer's rule is silently discarded — that is how the Goldberry footer
  // shipped a hover state whose glyph and disc were both Harvest Gold (1.00:1,
  // an invisible icon). These assertions fail on a hard-coded inline value, so
  // the regression trips CI instead of only showing up in a render.
  it("resolves every themeable inline value through a custom property", () => {
    const html = renderToStaticMarkup(<SocialLinks links={links} owner="X" />);
    // Collect the declarations rather than probing for a substring, so a
    // hard-coded value fails with a readable diff instead of "no match".
    const decls = (prop: string) =>
      [...html.matchAll(new RegExp(`[;"](${prop}:[^;"]*)`, "g"))].map((m) => m[1]);
    expect(decls("margin")).toEqual([`margin:var(${SOCIAL_THEME_VARS.rowMargin}, 0)`]);
    expect(decls("color")).toEqual(links.map(() => `color:var(${SOCIAL_THEME_VARS.linkInk}, inherit)`));
  });

  it("keeps structural inline values hard-coded, so sites cannot break the target", () => {
    const html = renderToStaticMarkup(<SocialLinks links={links} owner="X" />);
    expect(html.match(/width:44px;height:44px/g)).toHaveLength(links.length);
    expect(html).toContain("border-radius:50%");
  });

  it("renders nothing for an empty list", () => {
    expect(renderToStaticMarkup(<SocialLinks links={[]} owner="X" />)).toBe("");
  });
});
