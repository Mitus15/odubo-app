import { NextResponse } from "next/server";
import { getPublicCapacity } from "@/lib/loop/pass";

/**
 * How full the room is, as far as anyone outside is concerned.
 *
 * Deliberately the PUBLIC view: the size of the room always, the number left
 * only once it is low enough to be a warning rather than a sales report. This
 * endpoint used to hand `{sold, remaining}` to anyone who asked, which is a
 * live sales figure published to the internet.
 */
export async function GET() {
  return NextResponse.json(await getPublicCapacity(), { headers: { "cache-control": "no-store" } });
}
