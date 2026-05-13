import { NextResponse } from "next/server";

/**
 * Enforce application/json on state-changing POSTs.
 *
 * Returns null when the Content-Type is acceptable (caller should proceed).
 * Returns a 415 Response when it isn't (caller should `return` it).
 *
 * Form-encoded POSTs (application/x-www-form-urlencoded, multipart/form-data,
 * text/plain) are CORS-simple and can be issued cross-site from a plain
 * <form> tag without preflight — the Origin gate stops most of this, but a
 * 415 here is a precise, early-exit defense in depth.
 */
export function requireJsonContentType(request: Request): Response | null {
  const raw = request.headers.get("content-type");
  const type = raw?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }
  return null;
}
