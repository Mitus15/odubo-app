import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { lookupCode } from "@/lib/loop/event-codes";
import { parseScannedCode } from "@/lib/loop/door";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { renderTicketPng } from "@/lib/loop/ticketImage";

export const runtime = "nodejs";

/**
 * One ticket as a PNG. Auth: middleware gates /api/loop/admin/*.
 *
 * The buyer's copy arrives by email; this is the host's — to look at before a
 * send, to print for somebody who has no phone, or to hand over at the door.
 * `?n=2&of=3` previews how an order for several is numbered.
 * Admin-only on purpose: a public renderer that draws any string would answer
 * "is this a real code?" for anyone who asked it enough times.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = parseScannedCode(searchParams.get("c"));
  if (!code) return NextResponse.json({ error: "Which code?" }, { status: 400 });

  const event = await getCurrentEvent();
  const pass = await lookupCode(event.id, code);
  if (!pass) return NextResponse.json({ error: "No such code on this volume." }, { status: 404 });

  const when = new Date(event.date);
  const at = (o: Intl.DateTimeFormatOptions) =>
    when.toLocaleString("en-CA", { timeZone: "America/Vancouver", ...o });

  const png = await renderTicketPng({
    code: pass.code,
    baseUrl: await getPublicBaseUrl(),
    eventTitle: event.title,
    dateLabel: at({ weekday: "short", month: "short", day: "numeric" }),
    timeLabel: at({ hour: "numeric", minute: "2-digit" }),
    venue: event.venue,
    theme: event.theme,
    index: Number(searchParams.get("n")) || undefined,
    total: Number(searchParams.get("of")) || undefined,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `inline; filename="loop-soul-ticket-${pass.code}.png"`,
      "cache-control": "no-store",
    },
  });
}
