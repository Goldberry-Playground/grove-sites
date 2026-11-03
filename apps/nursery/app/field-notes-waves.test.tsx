// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FieldNotesWaves } from "./field-notes-waves";
import { fieldNoteWaves } from "../lib/preorder-waves";

const utc = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d, 12));
const ZONES = [3, 4, 5, 6, 7];

afterEach(cleanup);

describe("FieldNotesWaves", () => {
  it("two waves: Fall/Spring tabs switch aria-selected on click and arrow keys", () => {
    render(<FieldNotesWaves waves={fieldNoteWaves(utc(11, 2), null, ZONES)} />);
    const fall = screen.getByRole("tab", { name: "Fall" });
    const spring = screen.getByRole("tab", { name: "Spring" });
    expect(fall.getAttribute("aria-selected")).toBe("true");
    expect(spring.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText("Swipe for spring")).toBeTruthy();

    fireEvent.click(spring);
    expect(spring.getAttribute("aria-selected")).toBe("true");
    expect(fall.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText("Swipe back for fall")).toBeTruthy();

    fireEvent.keyDown(spring, { key: "ArrowLeft" });
    expect(fall.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Spring shipping pre-orders" })).toBeTruthy();
  });

  it("one wave: plain list, no tabs, dots or hint", () => {
    render(<FieldNotesWaves waves={fieldNoteWaves(utc(11, 22), null, ZONES)} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText(/Swipe/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Spring shipping pre-orders" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
