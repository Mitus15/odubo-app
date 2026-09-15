import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { previewCodesEmail } from "@/lib/loop/email";

export const runtime = "nodejs";

/**
 * Read the pass email exactly as a buyer gets it, without sending one.
 * Auth: middleware gates /api/loop/admin/*.
 *
 * It exists because the email is the only part of the product the owner
 * cannot look at by visiting a page, and it is the part a buyer reads first.
 *   ?email=…&n=2 renders it for that address with that many passes.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const n = Math.min(Math.max(Number(searchParams.get("n")) || 1, 1), 5);
  const event = await getCurrentEvent();
  const codes = Array.from({ length: n }, (_, i) => `LOOP-DEM${i + 1}`);
  const text = await previewCodesEmail(codes, event.title, email);
  return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
