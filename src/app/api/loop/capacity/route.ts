import { NextResponse } from "next/server";
import { getPassCapacity } from "@/lib/loop/pass";

/** Scarcity counter source. Mock now; flips to live Eventbrite via env. */
export async function GET() {
  const capacity = await getPassCapacity();
  return NextResponse.json(capacity);
}
