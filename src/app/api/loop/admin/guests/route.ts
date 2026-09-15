import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { guestStats, guestsCsv, listGuests } from "@/lib/loop/guests";

/**
 * The guest list. Auth: middleware gates /api/loop/admin/*.
 *   GET              → { rows, stats }
 *   GET ?format=csv  → the same as a file, for a spreadsheet or a mail tool
 */
export async function GET(req: NextRequest) {
  const event = await getCurrentEvent();
  const [rows, stats] = await Promise.all([listGuests(event.id), guestStats(event.id)]);

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const day = new Date().toISOString().slice(0, 10);
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
