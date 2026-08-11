import { NextResponse } from "next/server";
import { getPassProvider } from "@/lib/loop/pass";

/** Scarcity counter source. Mock now; flips to live Eventbrite via env. */
export async function GET() {
  const capacity = await getPassProvider().getCapacity();
  return NextResponse.json(capacity);
}
