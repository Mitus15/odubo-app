import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  albumReleased,
  backfillFromCodes,
  dealablePool,
  earlyRule,
  entitlementStats,
  freeTrackNumber,
  loadAlbum,
  markNotified,
  setAlbumReleased,
  setEarlyRule,
  unnotifiedAddresses,
} from "@/lib/loop/album";
import { getSetting } from "@/lib/loop/loopSetting";
import { sendAlbumReleaseEmail } from "@/lib/loop/email";
import { releaseLinkFor } from "@/lib/loop/pass/deliver";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";

export const runtime = "nodejs";

/**
 * The record's release, from the admin. Auth: middleware gates /api/loop/admin/*.
 *
 *   GET            → { released, early, tracks, stats }
 *   POST setEarly  → { enabled?, extra? }: the before-release rule
 *   POST release   → the listening page opens for everyone owed it
 *   POST unrelease → closes it again (a mistake, a date change)
 *   POST notify    → one "it's out" email per address not yet told
 *   POST backfill  → any real pass order missing a ledger row gets one
 */
async function snapshot() {
  const [released, stats, early, album, featured] = await Promise.all([
    albumReleased(),
    entitlementStats(),
    earlyRule(),
    loadAlbum(),
    getSetting("featured_track"),
  ]);
  const all = album?.tracks ?? [];
  const free = freeTrackNumber(all, featured);
  const pool = dealablePool(all, free);
  const tracks = all.map((t) => ({
    number: t.track_number,
    title: t.title,
    seconds: t.duration ?? 0,
    free: t.track_number === free,
    dealable: pool.includes(t.track_number),
  }));
  return { released, stats, early, tracks };
}

export async function GET() {
  return NextResponse.json(await snapshot(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { action?: string; enabled?: boolean; extra?: number }
    | null;
  const event = await getCurrentEvent();

  switch (body?.action) {
    case "setEarly": {
      const { enabled, extra } = body as { enabled?: boolean; extra?: number };
      if (enabled === undefined && extra === undefined) {
        return NextResponse.json({ error: "nothing to set" }, { status: 400 });
      }
      await setEarlyRule({ enabled, extra });
      return NextResponse.json({ ok: true, ...(await snapshot()) });
    }
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
      const plain = `${(await getPublicBaseUrl()) ?? ""}/loop/album`;
      let sent = 0;
      let failed = 0;
      for (const email of addresses) {
        // A claim link where one of their passes can carry it, so the phone
        // that taps Play is bound and the record simply plays.
        const link = (await releaseLinkFor(event.id, email).catch(() => null)) ?? plain;
        const res = await sendAlbumReleaseEmail(email, title, link);
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
