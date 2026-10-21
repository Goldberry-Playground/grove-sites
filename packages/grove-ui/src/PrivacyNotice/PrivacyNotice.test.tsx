// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrivacyNotice, GROVE_BRAND_NAMES } from "./index";

describe("<PrivacyNotice /> (GOL-3456)", () => {
  it("leads with the host brand and names all four Grove brands", () => {
    render(<PrivacyNotice brandName="At The Grove Nursery" />);
    const lede = screen.getByText(/is run by the same family as/);
    expect(lede.textContent?.startsWith("At The Grove Nursery is run by the same family as")).toBe(true);
    for (const name of GROVE_BRAND_NAMES) expect(lede.textContent).toContain(name);
  });

  it("renders the Armstrong Road postal address and the contact email", () => {
    render(<PrivacyNotice brandName="Gather at the Grove" />);
    const address = screen.getByText(/2291 Armstrong Road/).closest("address");
    expect(address?.textContent).toContain("Summersville, WV 26651");
    expect(screen.getAllByRole("link", { name: "sales@goldberrygrove.farm" }).length).toBeGreaterThan(0);
  });

  it("renders every section the draft has, with an on-page contents nav", () => {
    render(<PrivacyNotice brandName="Goldberry Grove Farm" />);
    for (const h of ["What we collect", "Why we use it", "Who helps us", "Your choices", "Children", "Changes", "Contact us"]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeDefined();
    }
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeDefined();
    expect(screen.getByText(/Last updated:/).textContent).toContain("October 2026");
  });

  it("honours the no-em-dash rule in everything a customer reads (GOL-589)", () => {
    const src = readFileSync(path.join(__dirname, "index.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(src.includes("—")).toBe(false);
  });
});
