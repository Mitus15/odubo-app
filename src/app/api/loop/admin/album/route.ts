import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  albumReleased,
  backfillFromCodes,
  entitlementStats,
  loadAlbum,
  markNotified,
  setAlbumReleased,
  unnotifiedAddresses,
} from "@/lib/loop/album";
import { sendAlbumReleaseEmail } from "@/lib/loop/email";

export const runtime = "nodejs";

/**
 * The record's release, from the admin. Auth: middleware gates /api/loop/admin/*.
 *
 *   GET            → { released, stats }
 *   POST release   → the listening page opens for everyone owed it
 *   POST unrelease → closes it again (a mistake, a date change)
 *   POST notify    → one "it's out" email per address not yet told
 *   POST backfill  → any real pass order missing a ledger row gets one
 */
export async function GET() {
  const [released, stats] = await Promise.all([albumReleased(), entitlementStats()]);
  return NextResponse.json({ released, stats }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const event = await getCurrentEvent();

  switch (body?.action) {
    case "release":
      await setAlbumReleased(true);
      break;
    case "unrelease":
      await setAlbumReleased(false);
      break;
    case "backfill": {
      const added = await backfillFromCodes(event.id);
      return NextResponse.json({ ok: true, added, released: await albumReleased(), stats: await entitlementStats() });
    }
    case "notify": {
      if (!(await albumReleased())) {
        return NextResponse.json({ error: "Release the record first, then tell people." }, { status: 400 });
      }
      const album = await loadAlbum();
      const title = album?.album.title ?? event.title;
      const addresses = await unnotifiedAddresses();
      let sent = 0;
      let failed = 0;
      for (const email of addresses) {
        const res = await sendAlbumReleaseEmail(email, title);
        if (res.ok) {
          await markNotified(email);
          sent++;
        } else {
          failed++;
          console.error(`[loop:album] release email NOT sent to ${email}`);
        }
      }
      return NextResponse.json({ ok: true, sent, failed, released: true, stats: await entitlementStats() });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, released: await albumReleased(), stats: await entitlementStats() });
}
