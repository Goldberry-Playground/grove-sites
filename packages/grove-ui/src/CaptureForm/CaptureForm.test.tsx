// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureForm } from "./index";

function mockFetch(response: Partial<Response> & { ok: boolean; status?: number }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => ({}),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("<CaptureForm />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders heading, description, and a labelled email field", () => {
    render(
      <CaptureForm
        brand="nursery"
        heading="News from the nursery"
        description="A few emails a season."
      />,
    );
    expect(screen.getByText("News from the nursery")).toBeDefined();
    expect(screen.getByText("A few emails a season.")).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
  });

  it("renders the eyebrow kicker when provided (GOL-682 #1 — differentiates two captures on one page)", () => {
    render(
      <CaptureForm brand="nursery" eyebrow="Back-in-stock alert" heading="Want us to tell you?" />,
    );
    expect(screen.getByText("Back-in-stock alert")).toBeDefined();
  });

  it("POSTs the newsletter payload with brand, label, source and consent", async () => {
    const fetchFn = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(
      <CaptureForm
        brand="nursery"
        source="notify-me"
        label="nursery-restock"
        interests={["nursery"]}
        endpoint="/api/newsletter/subscribe"
        submitLabel="Notify me"
      />,
    );
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Notify me" }));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/newsletter/subscribe");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      email: "sam@example.com",
      brand: "nursery",
      source: "notify-me",
      label: "nursery-restock",
      interests: ["nursery"],
      consent: true,
      multibrand: false,
    });
    expect("hubOptIn" in body).toBe(false);
  });

  it("renders the multibrand box UNTICKED with the approved label and sends multibrand: true only when ticked (GOL-3456)", async () => {
    const fetchFn = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" multibrandOptIn submitLabel="Sign up" />);
    const box = screen.getByRole("checkbox", {
      name: "Also send me news from the other Grove brands (farm, nursery and the Grove Digest).",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchFn.mock.calls[0][1].body as string).multibrand).toBe(false);
  });

  it("sends multibrand: true when the box is ticked", async () => {
    const fetchFn = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" multibrandOptIn submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchFn.mock.calls[0][1].body as string).multibrand).toBe(true);
  });

  it("does not render the multibrand box by default (lead / restock / waitlist forms)", () => {
    render(<CaptureForm brand="nursery" submitLabel="Ask us" />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("renders the opt-in line as the email field's description and the privacy link in the fine print", () => {
    render(
      <CaptureForm
        brand="goldberry"
        optInLine="U-pick openings, workshops and farm news from Goldberry Grove, about twice a month."
        consentText="We'll send a confirmation email right away. Unsubscribe anytime with one click."
      />,
    );
    const email = screen.getByLabelText("Email");
    const line = screen.getByText(
      "U-pick openings, workshops and farm news from Goldberry Grove, about twice a month.",
    );
    expect(email.getAttribute("aria-describedby")).toContain(line.id);
    const link = screen.getByRole("link", { name: "Privacy notice" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/privacy");
    expect(link.closest("p")?.textContent).toContain("Unsubscribe anytime with one click.");
  });

  it("uses the ruled single-opt-in success copy by default", async () => {
    mockFetch({ ok: true });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "You're on the list. Check your inbox for a welcome note.",
      ),
    );
  });

  it("shows the success message and stops rendering the form after a 200", async () => {
    mockFetch({ ok: true });
    const user = userEvent.setup();
    render(
      <CaptureForm
        brand="goldberry"
        successMessage="You're in. First one lands next week."
        submitLabel="Send me TreeFacts"
      />,
    );
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Send me TreeFacts" }));

    await waitFor(() =>
      expect(screen.getByText("You're in. First one lands next week.")).toBeDefined(),
    );
    expect(screen.queryByRole("button", { name: "Send me TreeFacts" })).toBeNull();
  });

  it("surfaces a 503 as an honest try-again error (2026-10-15: never a fake 'not open yet')", async () => {
    mockFetch({ ok: false, status: 503 });
    const user = userEvent.setup();
    render(<CaptureForm brand="goldberry" submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Please try again in a few minutes"),
    );
  });

  it("surfaces an edge-wrapped 504 the same way", async () => {
    // DigitalOcean's edge shows the browser a 504 for BOTH an app 503 and an app
    // 502 (a real backend failure). "Not open yet" hid the 2026-10-15 Ghost
    // outage for days, so every 5xx now reads as a temporary failure.
    mockFetch({ ok: false, status: 504 });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Please try again in a few minutes"),
    );
  });

  it("silently drops honeypot bot submissions without calling fetch", async () => {
    const fetchFn = mockFetch({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<CaptureForm brand="nursery" submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "bot@example.com");
    const honeypot = container.querySelector<HTMLInputElement>('input[name="company"]')!;
    honeypot.value = "Acme Bots Inc";
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(screen.getByRole("status")).toBeDefined());
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it("collects and sends an optional note when collectMessage is set", async () => {
    const fetchMock = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(
      <CaptureForm brand="nursery" collectMessage messageLabel="What are you planting?" submitLabel="Send inquiry" endpoint="/api/leads?kind=wholesale" />,
    );
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText("What are you planting?"), "200 pawpaws, zone 6");
    await user.click(screen.getByRole("button", { name: "Send inquiry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/leads?kind=wholesale");
    expect(JSON.parse(init.body).message).toBe("200 pawpaws, zone 6");
  });

  it("does not render or send a note by default", async () => {
    const fetchMock = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" submitLabel="Sign up" />);
    expect(screen.queryByRole("textbox", { name: /note/i })).toBeNull();
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect("message" in JSON.parse(fetchMock.mock.calls[0][1].body)).toBe(false);
  });
});
