import { NextResponse } from "next/server";
import { getEventbrite } from "@/lib/loop/eventbrite";

/** Scarcity counter source. Mock now; flips to live Eventbrite via env. */
export async function GET() {
  const capacity = await getEventbrite().getCapacity();
  return NextResponse.json(capacity);
}
