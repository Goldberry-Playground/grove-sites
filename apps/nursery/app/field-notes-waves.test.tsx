// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("tab click: mid-scroll positions never flip aria-selected back; swipe still syncs", () => {
    const { container } = render(
      <FieldNotesWaves waves={fieldNoteWaves(utc(11, 2), null, ZONES)} />,
    );
    const track = container.querySelector(".field-notes-track") as HTMLDivElement;
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 275 });
    track.scrollTo = vi.fn() as unknown as typeof track.scrollTo;
    const fall = screen.getByRole("tab", { name: "Fall" });
    const spring = screen.getByRole("tab", { name: "Spring" });

    fireEvent.click(spring);
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 275, behavior: "smooth" });
    for (const left of [20, 100, 130, 200]) {
      track.scrollLeft = left;
      fireEvent.scroll(track);
      expect(spring.getAttribute("aria-selected")).toBe("true");
    }
    track.scrollLeft = 275;
    fireEvent.scroll(track); // landed: programmatic scroll released

    track.scrollLeft = 10; // user swipes back to fall
    fireEvent.scroll(track);
    expect(fall.getAttribute("aria-selected")).toBe("true");
  });

  it("one wave: plain list, no tabs, dots or hint", () => {
    render(<FieldNotesWaves waves={fieldNoteWaves(utc(11, 22), null, ZONES)} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText(/Swipe/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Spring shipping pre-orders" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
