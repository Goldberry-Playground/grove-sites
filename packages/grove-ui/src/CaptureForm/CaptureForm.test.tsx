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
      hubOptIn: false,
    });
  });

  it("sends hubOptIn: true only when the hub checkbox is checked", async () => {
    const fetchFn = mockFetch({ ok: true });
    const user = userEvent.setup();
    render(<CaptureForm brand="nursery" hubOptIn submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.hubOptIn).toBe(true);
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

  it("surfaces a 503 not-configured state as a friendly error", async () => {
    mockFetch({ ok: false, status: 503 });
    const user = userEvent.setup();
    render(<CaptureForm brand="goldberry" submitLabel="Sign up" />);
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("check back soon"),
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
});
