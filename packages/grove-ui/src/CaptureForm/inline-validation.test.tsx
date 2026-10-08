// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureForm, isPlausibleEmail } from "./index";

/**
 * Inline email validation (GOL-2745).
 *
 * The form is `noValidate`, so the browser's own bubble never fires; before
 * this, a typo cost a full round-trip to come back as a 400. These pin the two
 * things that make inline validation humane rather than hostile: it must not
 * send, and it must clear itself the moment the visitor starts fixing it.
 */

function mockFetch() {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("isPlausibleEmail", () => {
  it("accepts ordinary addresses, including plus-tags and subdomains", () => {
    expect(isPlausibleEmail("you@example.com")).toBe(true);
    expect(isPlausibleEmail("josh+waitlist@goldberrygrove.farm")).toBe(true);
    expect(isPlausibleEmail("a@b.co.uk")).toBe(true);
  });

  it("rejects the typos a visitor can still fix", () => {
    expect(isPlausibleEmail("")).toBe(false);
    expect(isPlausibleEmail("you")).toBe(false);
    expect(isPlausibleEmail("you@example")).toBe(false);
    expect(isPlausibleEmail("you example.com")).toBe(false);
    expect(isPlausibleEmail("you@@example.com")).toBe(false);
  });
});

describe("<CaptureForm /> inline validation", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("shows the message and does NOT send on an implausible address", async () => {
    const fetchFn = mockFetch();
    const user = userEvent.setup();
    render(
      <CaptureForm
        brand="nursery"
        submitLabel="Notify me"
        invalidEmailMessage="Enter an email address like you@example.com"
      />,
    );

    await user.type(screen.getByLabelText("Email"), "josh@");
    await user.click(screen.getByRole("button", { name: "Notify me" }));

    expect(
      await screen.findByText("Enter an email address like you@example.com"),
    ).toBeTruthy();
    // The whole point: no wasted round-trip.
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("marks the FIELD invalid and describes it by the message", async () => {
    const user = userEvent.setup();
    mockFetch();
    render(<CaptureForm brand="nursery" submitLabel="Notify me" />);

    const field = screen.getByLabelText("Email") as HTMLInputElement;
    await user.type(field, "nope");
    await user.click(screen.getByRole("button", { name: "Notify me" }));

    await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
    // A screen reader landing on the field must hear the reason; the
    // role="alert" paragraph alone announces once and is then orphaned.
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain("email");
  });

  it("clears the error as soon as the visitor starts fixing it", async () => {
    const user = userEvent.setup();
    mockFetch();
    render(
      <CaptureForm
        brand="nursery"
        submitLabel="Notify me"
        invalidEmailMessage="Enter an email address like you@example.com"
      />,
    );

    const field = screen.getByLabelText("Email");
    await user.type(field, "nope");
    await user.click(screen.getByRole("button", { name: "Notify me" }));
    expect(
      await screen.findByText("Enter an email address like you@example.com"),
    ).toBeTruthy();

    // Leaving a stale "that's wrong" under a field being corrected is the
    // forgiveness failure that makes inline validation feel hostile.
    await user.type(field, "@example.com");
    await waitFor(() =>
      expect(
        screen.queryByText("Enter an email address like you@example.com"),
      ).toBeNull(),
    );
    expect(field.getAttribute("aria-invalid")).toBeNull();
  });

  it("still sends a valid address through untouched", async () => {
    const fetchFn = mockFetch();
    const user = userEvent.setup();
    render(
      <CaptureForm
        brand="nursery"
        submitLabel="Notify me"
        interests={["waitlist:mycoforestry"]}
        source="notify-me"
      />,
    );

    await user.type(screen.getByLabelText("Email"), "josh@goldberrygrove.farm");
    await user.click(screen.getByRole("button", { name: "Notify me" }));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.email).toBe("josh@goldberrygrove.farm");
    // The department waitlist tag the spec's Odoo side filters on.
    expect(body.interests).toEqual(["waitlist:mycoforestry"]);
  });
});
