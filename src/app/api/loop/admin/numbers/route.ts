import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { loopNumbers } from "@/lib/loop/numbers";

/** The funnel in six counts. Auth: middleware gates /api/loop/admin/*. */
export async function GET() {
  const event = await getCurrentEvent();
  const numbers = await loopNumbers(event.id);
  return NextResponse.json(numbers, { headers: { "cache-control": "no-store" } });
}
