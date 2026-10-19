import { NextResponse, type NextRequest } from "next/server";
import { TAGS } from "../../../../data/recipes";
import { nurseryOrigin, nurseryProductUrl } from "../../../../lib/nursery-link";

/**
 * GOL-3435: `/recipes/trees/<tag>` → the live At The Grove Nursery listing for
 * that tree. `/recipes/trees/nursery` → the nursery home page. Resolved per
 * request so QA links land on QA product ids and prod on prod (see
 * lib/nursery-link.ts). A temporary redirect, so a relisted tree is picked up
 * without a stale permanent cache entry in anyone's browser.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tree: string }> }) {
  const { tree } = await params;
  const host = request.headers.get("host");
  if (tree === "nursery") return NextResponse.redirect(`${nurseryOrigin(host)}/`, 307);
  const tag = TAGS.find((t) => t.k === tree);
  return NextResponse.redirect(await nurseryProductUrl(tag?.nurserySlug, host), 307);
}
