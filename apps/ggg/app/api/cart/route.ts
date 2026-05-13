import { NextResponse } from "next/server";
import { odoo } from "../../../lib/clients";

export async function GET() {
  try {
    const cart = await odoo.cart.get();
    return NextResponse.json(cart);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch cart";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, quantity } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    const cart = await odoo.cart.addItem(
      Number(product_id),
      Number(quantity ?? 1)
    );
    return NextResponse.json(cart);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update cart";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
