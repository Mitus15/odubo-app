import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { countRedeemed, generate, listCodes } from "@/lib/loop/event-codes";

/**
 * Event codes for the door: list them (with redeemed state) and bulk-generate.
 * Auth: middleware gates /api/loop/admin/*. This closes the "Event codes —
 * generate & issue" backlog item — a 75-person night needs codes in hand.
 */
export async function GET() {
  const event = await getCurrentEvent();
  const [codes, stats] = await Promise.all([
    listCodes(event.id),
    countRedeemed(event.id),
  ]);
  return NextResponse.json({ codes, stats });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 0, 1), 100);

  const event = await getCurrentEvent();
  const created = await generate(event.id, count, Date.now());
  const stats = await countRedeemed(event.id);
  return NextResponse.json({ success: true, created, stats });
}
