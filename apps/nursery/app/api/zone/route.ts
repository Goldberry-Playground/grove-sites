import { NextResponse } from "next/server";
import { odoo } from "../../../lib/clients";

/**
 * ZIP → USDA hardiness zone lookup (BFF).
 *
 * GET /api/zone?zip=26501  →  { zip, zone }        (200)
 *                          →  { error: "unknown_zip" } (404) for a ZIP the USDA
 *                             matrix doesn't cover, or a malformed ZIP.
 *
 * Server-only wrapper over grove_headless `/grove/api/v1/zone` so the browser
 * never talks to Odoo directly (BFF pattern). Powers the product-page
 * "Will this grow for me?" zone check.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  const result = await odoo.zone(zip);
  if (!result) {
    return NextResponse.json({ error: "unknown_zip" }, { status: 404 });
  }
  return NextResponse.json(result);
}
