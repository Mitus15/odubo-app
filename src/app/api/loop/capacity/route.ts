import { NextResponse } from "next/server";
import { getPassCapacity } from "@/lib/loop/pass";

/** Scarcity counter source — real codes issued vs the event's capacity. */
export async function GET() {
  const capacity = await getPassCapacity();
  return NextResponse.json(capacity);
}
