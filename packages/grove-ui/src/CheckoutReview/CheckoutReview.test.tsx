// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CheckoutReview, type CheckoutReviewItemizedLine } from "./index";

const CART_ITEMS = [
  { variantId: 1, name: "Pawpaw 'Shenandoah'", quantity: 2, price: 25 },
];

const MIXED_LINES: CheckoutReviewItemizedLine[] = [
  { name: "Pawpaw 'Shenandoah'", kind: "goods", unitAmount: 25, quantity: 1 },
  { name: "Deposit — Persimmon 'Prok'", kind: "deposit", unitAmount: 5, quantity: 3 },
  { name: "Shipping", kind: "shipping", unitAmount: 12, quantity: 1 },
  { name: "Sales tax (WV)", kind: "tax", unitAmount: 1.75, quantity: 1 },
];

function renderReview(lineItems?: CheckoutReviewItemizedLine[]) {
  return render(
    <CheckoutReview
      items={CART_ITEMS}
      lineItems={lineItems}
      amountDueToday={53.75}
      amountTotal={92.75}
      hasPreorder
      onPay={vi.fn()}
      onBack={vi.fn()}
    />,
  );
}

describe("<CheckoutReview /> itemized parity (GOL-1057)", () => {
  it("renders the itemized session lines, not the cart lines, when provided", () => {
    renderReview(MIXED_LINES);
    // Deposit line total = 5 * 3 = $15.00, and the qty multiplier is shown.
    expect(screen.getByText("Deposit — Persimmon 'Prok'")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
    expect(screen.getByText("× 3")).toBeTruthy();
    // Shipping and tax lines are surfaced explicitly.
    expect(screen.getByText("Shipping")).toBeTruthy();
    expect(screen.getByText("Sales tax (WV)")).toBeTruthy();
  });

  it("badges goods as 'Ships now' and deposits as 'Reserve'", () => {
    renderReview(MIXED_LINES);
    expect(screen.getByText("Ships now")).toBeTruthy();
    expect(screen.getByText("Reserve")).toBeTruthy();
  });

  it("does not badge the shipping/tax fee lines", () => {
    const { container } = renderReview(MIXED_LINES);
    // Two badges total (goods + deposit); the fee lines carry none.
    expect(container.querySelectorAll(".grove-review__badge")).toHaveLength(2);
    expect(container.querySelectorAll(".grove-review__line--fee")).toHaveLength(2);
  });

  it("sums the itemized lines to amountDueToday (parity invariant)", () => {
    // 25*1 + 5*3 + 12*1 + 1.75*1 = 53.75 — the headline charged-today amount.
    const summed = MIXED_LINES.reduce(
      (n, li) => n + li.unitAmount * li.quantity,
      0,
    );
    expect(summed).toBeCloseTo(53.75, 2);
  });

  it("falls back to cart lines when no lineItems are supplied", () => {
    const { container } = renderReview(undefined);
    // Cart line total = 25 * 2 = $50.00; no ship/reserve badges rendered.
    const lines = within(container).getByText("Pawpaw 'Shenandoah'");
    expect(lines).toBeTruthy();
    expect(screen.getByText("$50.00")).toBeTruthy();
    expect(container.querySelectorAll(".grove-review__badge")).toHaveLength(0);
  });
});
