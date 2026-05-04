import { NextResponse } from "next/server";
import type { OrderCreateInput, OrderItemInput } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";

const MAX_ITEMS = 100;
const MAX_QUANTITY = 9999;

function isValidItem(value: unknown): value is OrderItemInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "number" &&
    Number.isFinite(v.variantId) &&
    Number.isInteger(v.variantId) &&
    v.variantId > 0 &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    v.quantity <= MAX_QUANTITY
  );
}

export async function POST(request: Request) {
  let payload: OrderCreateInput;
  try {
    payload = (await request.json()) as OrderCreateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.contact?.email || !payload.contact?.name) {
    return NextResponse.json(
      { error: "contact.name and contact.email are required" },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(payload.items) ||
    payload.items.length === 0 ||
    payload.items.length > MAX_ITEMS
  ) {
    return NextResponse.json(
      { error: `items must be a non-empty array of at most ${MAX_ITEMS} entries` },
      { status: 400 }
    );
  }

  if (!payload.items.every(isValidItem)) {
    return NextResponse.json(
      { error: "Each item needs a positive integer variantId and finite quantity" },
      { status: 400 }
    );
  }

  try {
    const order = await odoo.orders.create(payload);
    return NextResponse.json(order);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
