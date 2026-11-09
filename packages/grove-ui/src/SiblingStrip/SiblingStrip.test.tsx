// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiblingStrip } from "./index";

const sites = [
  { name: "Gather at the Grove", href: "https://gatheringatthegrove.com" },
  { name: "Goldberry Grove Farm", href: "https://goldberrygrove.farm" },
];

describe("<SiblingStrip />", () => {
  it("is a labelled navigation landmark (axe `region` + landmark-unique, prod matrix 2026-11-07)", () => {
    render(<SiblingStrip currentSiteName="Goldberry Grove Farm" sites={sites} />);
    // The strip sits above every app's <header>; as a plain div its pill list
    // was content outside any landmark on all four brands. The label keeps it
    // distinct from each app's own "Primary" / "Footer" navs.
    const nav = screen.getByRole("navigation", { name: "Grove sister sites" });
    expect(nav.querySelector("#sibling-strip-list")).not.toBeNull();
  });

  it("marks the current site and links the others cross-origin", () => {
    render(<SiblingStrip currentSiteName="Goldberry Grove Farm" sites={sites} />);
    expect(screen.getByRole("link", { name: "Goldberry Grove Farm" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Gather at the Grove" }).getAttribute("href")).toBe(
      "https://gatheringatthegrove.com",
    );
  });
});
