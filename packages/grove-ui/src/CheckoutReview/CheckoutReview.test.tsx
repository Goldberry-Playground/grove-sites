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

// Josh's ruling (2026-09-22, GOL-2432/2450): every ships-now Review & pay
// summary reads goods, ONE pre-tax Discount, Shipping, WV tax, then the
// emphasised TOTAL DUE TODAY, all backend numbers.
describe("<CheckoutReview /> ships-now summary shape (GOL-2432)", () => {
  const RULING_LINES: CheckoutReviewItemizedLine[] = [
    { name: "Pear (Magness, Potted)", kind: "goods", unitAmount: 35, quantity: 2 },
    { name: "Discount (FLATWOODS)", kind: "discount", unitAmount: -10, quantity: 1 },
    { name: "Shipping", kind: "shipping", unitAmount: 22, quantity: 1 },
    { name: "WV Sales Tax (6%)", kind: "tax", unitAmount: 4.92, quantity: 1 },
  ];

  function renderShipsNow(lineItems: CheckoutReviewItemizedLine[]) {
    return render(
      <CheckoutReview
        items={[{ variantId: 7, name: "Pear (Magness, Potted)", quantity: 2, price: 35 }]}
        lineItems={lineItems}
        amountDueToday={86.92}
        amountTotal={86.92}
        hasPreorder={false}
        onPay={vi.fn()}
        onBack={vi.fn()}
      />,
    );
  }

  const rows = (container: HTMLElement) =>
    [...container.querySelectorAll(".grove-review__lines > li")].map((li) => [
      li.firstElementChild!.firstChild!.textContent,
      li.lastElementChild!.textContent,
    ]);

  it("renders the exact ruling example in order, ending on the emphasised total", () => {
    const { container } = renderShipsNow(RULING_LINES);
    expect(rows(container)).toEqual([
      ["Pear (Magness, Potted)", "$70.00"],
      ["Discount (FLATWOODS)", "−$10.00"],
      ["Shipping", "$22.00"],
      ["WV Sales Tax (6%)", "$4.92"],
      ["Total due today", "$86.92"],
    ]);
    // The total is the shared emphasised summary-total row; ships-now lines
    // carry no badges.
    expect(container.querySelector(".grove-review__total")).toBeTruthy();
    expect(container.querySelectorAll(".grove-review__badge")).toHaveLength(0);
  });

  it("re-orders an older build's lines and folds a per-tax-group split into ONE Discount", () => {
    // Pre-GOL-2450 order: goods, shipping, tax, then the reward split in two.
    const legacy: CheckoutReviewItemizedLine[] = [
      RULING_LINES[0],
      RULING_LINES[2],
      RULING_LINES[3],
      { name: "$10 on your order", kind: "discount", unitAmount: -6, quantity: 1 },
      { name: "$10 on your order", kind: "discount", unitAmount: -4, quantity: 1 },
    ];
    const { container } = renderShipsNow(legacy);
    expect(rows(container).map(([label]) => label)).toEqual([
      "Pear (Magness, Potted)",
      "Discount",
      "Shipping",
      "WV Sales Tax (6%)",
      "Total due today",
    ]);
    expect(rows(container)[1][1]).toBe("−$10.00");
    // One row; the loyalty wording rides as its detail, not a second line.
    expect(screen.getAllByText("$10 on your order")).toHaveLength(1);
    expect(container.querySelectorAll(".grove-review__line-detail")).toHaveLength(1);
  });

  it("shows no tax row for an out-of-state order (backend sends none)", () => {
    const { container } = renderShipsNow(RULING_LINES.filter((l) => l.kind !== "tax"));
    expect(container.querySelectorAll('.grove-review__lines > li')).toHaveLength(4);
    expect(screen.queryByText(/Sales Tax/)).toBeNull();
  });
});
