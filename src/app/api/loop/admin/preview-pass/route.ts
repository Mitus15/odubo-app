import { NextRequest, NextResponse } from "next/server";
import { previewPassEmail } from "@/lib/loop/email";
import { passLinkUrl } from "@/lib/loop/passLink";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";

export const runtime = "nodejs";

/**
 * Read the pass email exactly as a buyer gets it, without sending one.
 * Auth: middleware gates /api/loop/admin/*.
 *
 * It exists because the email is the only part of the product the owner
 * cannot look at by visiting a page, and it is the part a buyer reads first.
 *   ?n=2            two passes, numbered as one order would be
 *   ?format=html    the designed part; the default is the plain part
 * The links are placeholders: a preview must never mint a real claim.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const n = Math.min(Math.max(Number(searchParams.get("n")) || 1, 1), 5);
  const base = (await getPublicBaseUrl()) ?? "";
  const passes = Array.from({ length: n }, (_, i) => ({
    code: `LOOP-DEM${i + 1}`,
    serial: 42 + i,
    link: passLinkUrl("pl_preview", base),
    index: i + 1,
    total: n,
  }));
  const { text, html } = await previewPassEmail(passes);
  const asHtml = searchParams.get("format") === "html";
  return new NextResponse(asHtml ? html : text, {
    headers: { "content-type": `${asHtml ? "text/html" : "text/plain"}; charset=utf-8`, "cache-control": "no-store" },
  });
}
