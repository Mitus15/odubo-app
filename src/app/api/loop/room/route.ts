import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { roomHeads } from "@/lib/loop/doors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The head count, for the in-room page to poll. One number, public: it is
 * only rendered to people who hold a pass on a live night, and it says
 * nothing a person standing in the courtyard could not count themselves.
 */
export async function GET() {
  const event = await getCurrentEvent();
  const heads = await roomHeads(event.id).catch(() => 0);
  return NextResponse.json({ heads }, { headers: { "cache-control": "no-store" } });
}
