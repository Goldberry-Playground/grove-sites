// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FooterContact } from "./footer-contact";

describe("<FooterContact /> address + privacy link (GOL-3456)", () => {
  it("renders the postal line and the Privacy notice link when given", () => {
    render(
      <FooterContact
        phone="4457875140"
        email="orders@atthegrovenursery.com"
        address="2291 Armstrong Road, Summersville, WV 26651"
        privacyHref="/privacy"
      />,
    );
    expect(screen.getByText("2291 Armstrong Road, Summersville, WV 26651")).toBeDefined();
    expect(screen.getByRole("link", { name: "Privacy notice" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "(445) 787-5140" }).getAttribute("href")).toBe("tel:+14457875140");
  });

  it("renders only phone (+ email) when neither extra is given", () => {
    render(<FooterContact phone="4457875140" />);
    expect(screen.queryByRole("link", { name: "Privacy notice" })).toBeNull();
    expect(screen.queryByText(/Armstrong/)).toBeNull();
  });
});
