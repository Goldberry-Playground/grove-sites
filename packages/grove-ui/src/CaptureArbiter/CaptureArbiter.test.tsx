// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CaptureArbiterProvider, CaptureSlot } from "./index";

/**
 * The one-CTA-per-page rule (GOL-2178): the highest-priority tier wins, every
 * lower tier suppresses itself, and equal tiers coexist. Registration runs in
 * an effect, so lower tiers settle to null after mount — assertions wait for it.
 */
describe("<CaptureSlot /> arbitration", () => {
  it("renders the newsletter alone when it is the only capture on the page", async () => {
    render(
      <CaptureArbiterProvider>
        <CaptureSlot priority="newsletter">
          <div>newsletter</div>
        </CaptureSlot>
      </CaptureArbiterProvider>,
    );
    expect(await screen.findByText("newsletter")).toBeTruthy();
  });

  it("suppresses the newsletter when a higher-priority restock capture is present", async () => {
    render(
      <CaptureArbiterProvider>
        <CaptureSlot priority="restock">
          <div>restock</div>
        </CaptureSlot>
        <CaptureSlot priority="newsletter">
          <div>newsletter</div>
        </CaptureSlot>
      </CaptureArbiterProvider>,
    );
    expect(await screen.findByText("restock")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("newsletter")).toBeNull();
    });
  });

  it("suppresses the newsletter under the state tier and keeps state visible", async () => {
    render(
      <CaptureArbiterProvider>
        <CaptureSlot priority="state">
          <div>state</div>
        </CaptureSlot>
        <CaptureSlot priority="newsletter">
          <div>newsletter</div>
        </CaptureSlot>
      </CaptureArbiterProvider>,
    );
    expect(await screen.findByText("state")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("newsletter")).toBeNull();
    });
  });

  it("lets restock win over state when both qualify", async () => {
    render(
      <CaptureArbiterProvider>
        <CaptureSlot priority="restock">
          <div>restock</div>
        </CaptureSlot>
        <CaptureSlot priority="state">
          <div>state</div>
        </CaptureSlot>
      </CaptureArbiterProvider>,
    );
    expect(await screen.findByText("restock")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("state")).toBeNull();
    });
  });

  it("renders every instance of the winning tier (the /shop multi-card case)", async () => {
    render(
      <CaptureArbiterProvider>
        <CaptureSlot priority="restock">
          <div>restock-a</div>
        </CaptureSlot>
        <CaptureSlot priority="restock">
          <div>restock-b</div>
        </CaptureSlot>
        <CaptureSlot priority="newsletter">
          <div>newsletter</div>
        </CaptureSlot>
      </CaptureArbiterProvider>,
    );
    expect(await screen.findByText("restock-a")).toBeTruthy();
    expect(await screen.findByText("restock-b")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("newsletter")).toBeNull();
    });
  });

  it("re-shows the newsletter after the higher-priority capture unmounts", async () => {
    function Harness({ withRestock }: { withRestock: boolean }) {
      return (
        <CaptureArbiterProvider>
          {withRestock ? (
            <CaptureSlot priority="restock">
              <div>restock</div>
            </CaptureSlot>
          ) : null}
          <CaptureSlot priority="newsletter">
            <div>newsletter</div>
          </CaptureSlot>
        </CaptureArbiterProvider>
      );
    }
    const { rerender } = render(<Harness withRestock />);
    await waitFor(() => expect(screen.queryByText("newsletter")).toBeNull());
    rerender(<Harness withRestock={false} />);
    expect(await screen.findByText("newsletter")).toBeTruthy();
  });

  it("renders unconditionally with no provider (Storybook / standalone)", () => {
    render(
      <CaptureSlot priority="newsletter">
        <div>standalone</div>
      </CaptureSlot>,
    );
    expect(screen.getByText("standalone")).toBeTruthy();
  });
});
