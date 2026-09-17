import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { consentCsv, guestStats, guestsCsv, listConsent, listGuests } from "@/lib/loop/guests";

/**
 * The guest list. Auth: middleware gates /api/loop/admin/*.
 *   GET                            → { rows, stats }
 *   GET ?format=csv                → one row per pass, as a file
 *   GET ?format=csv&list=consent   → everyone who may be written to (buyer or
 *                                    not), for a Resend Broadcast
 */
export async function GET(req: NextRequest) {
  const event = await getCurrentEvent();
  const params = new URL(req.url).searchParams;
  const day = new Date().toISOString().slice(0, 10);

  if (params.get("format") === "csv" && params.get("list") === "consent") {
    return new NextResponse(consentCsv(await listConsent()), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="loop-soul-marketing-list-${day}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const [rows, stats] = await Promise.all([listGuests(event.id), guestStats(event.id)]);

  if (params.get("format") === "csv") {
    return new NextResponse(guestsCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="loop-soul-guests-${day}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.json({ rows, stats }, { headers: { "cache-control": "no-store" } });
}
