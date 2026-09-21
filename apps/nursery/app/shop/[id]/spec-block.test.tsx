// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { GrowingFacts } from "@grove/odoo-client";
import { SpecBlock } from "./spec-block";
import { ProductDescription } from "./product-description";

// A complete listing under the listing-content gate (GOL-2386, spec §E).
const complete: GrowingFacts = {
  botanicalName: "Malus domestica 'Honeycrisp'",
  zoneMin: 3,
  zoneMax: 7,
  layer: "canopy",
  sun: "full",
  matureSize: "12–15 ft",
  spacing: "15 ft",
  soil: "Well-drained loam, pH 6.0–7.0",
  growthRate: "moderate",
  bloomSeason: "Mid spring",
  harvestSeason: "Late September",
  watering: "moderate",
  wildlife: "Attracts bees, birds",
  matureSpread: "12–15 ft",
  chillHours: "800–1000",
  pollination: "Needs a second variety",
  yearsToFruit: "3–4 years",
};

function rowsOf(container: HTMLElement): Array<[string, string]> {
  return Array.from(container.querySelectorAll("dl > div")).map((row) => [
    row.querySelector("dt")!.textContent ?? "",
    row.querySelector("dd")!.textContent ?? "",
  ]);
}

describe("<SpecBlock /> — fully populated (Arbor Day order)", () => {
  it("renders every fact row in the spec §E order with display values", () => {
    const { container } = render(<SpecBlock facts={complete} />);
    expect(rowsOf(container)).toEqual([
      ["USDA zones", "3–7"],
      ["Growth rate", "Moderate"],
      ["Mature height", "12–15 ft"],
      ["Mature spread", "12–15 ft"],
      ["Spacing", "15 ft"],
      ["Sun", "Full"],
      ["Soil", "Well-drained loam, pH 6.0–7.0"],
      ["Watering", "Moderate"],
      ["Bloom", "Mid spring"],
      ["Harvest", "Late September"],
      ["Wildlife", "Attracts bees, birds"],
      ["Pollination", "Needs a second variety"],
      ["Years to fruit", "3–4 years"],
      ["Chill hours", "800–1000"],
      ["Layer", "Canopy"],
    ]);
  });

  it("keeps the botanical-name caption under the list", () => {
    render(<SpecBlock facts={complete} />);
    const section = screen.getByRole("region", { name: "Growing specs" });
    expect(within(section).getByText("Malus domestica 'Honeycrisp'").tagName).toBe("P");
  });

  it("still omits blank rows on a sparse (pre-gate) listing", () => {
    const sparse: GrowingFacts = {
      ...complete,
      growthRate: null,
      bloomSeason: null,
      harvestSeason: null,
      watering: null,
      wildlife: null,
      matureSpread: null,
      chillHours: null,
      pollination: null,
      yearsToFruit: null,
      spacing: null,
    };
    const { container } = render(<SpecBlock facts={sparse} />);
    expect(rowsOf(container).map(([label]) => label)).toEqual([
      "USDA zones",
      "Mature height",
      "Sun",
      "Soil",
      "Layer",
    ]);
  });
});

describe("<ProductDescription /> — sanitized HTML (GOL-2386)", () => {
  it("renders allow-listed markup as real elements, not a plain <p> of text", () => {
    const { container } = render(
      <ProductDescription html={"<p>A <strong>cold-hardy</strong> apple.</p><ul><li>Zones 3–7</li></ul>"} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("cold-hardy");
    expect(container.querySelector("ul > li")?.textContent).toBe("Zones 3–7");
    expect(container.textContent).not.toContain("<strong>");
  });

  it("strips scripts, event handlers and javascript: links", () => {
    const { container } = render(
      <ProductDescription
        html={'<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a></p><script>alert(1)</script>'}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("a")?.getAttribute("href") ?? null).toBeNull();
  });

  it("renders nothing for null or markup that sanitizes to empty", () => {
    expect(render(<ProductDescription html={null} />).container.innerHTML).toBe("");
    expect(render(<ProductDescription html={"<script>x</script>"} />).container.innerHTML).toBe("");
  });
});
