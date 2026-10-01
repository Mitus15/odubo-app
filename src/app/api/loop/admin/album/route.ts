import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  EARLY_ALBUM_ID,
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
import { ALBUMS, albumOfVolume, type Volume } from "@/lib/loop/songs";

export const runtime = "nodejs";

/**
 * Each album's release, from the admin: Loop Soul Vol. 1 and Vol. 2 come out
 * separately (`volume` 1 or 2, default 1). Auth: middleware gates /api/loop/admin/*.
 *
 *   GET ?volume=   → { volume, title, released, early, tracks, stats }
 *   POST setEarly  → { enabled?, extra? }: the before-release rule (Vol. 1's draw)
 *   POST release   → that album opens on /loop/album for everyone owed it
 *   POST unrelease → closes it again (a mistake, a date change)
 *   POST notify    → one "it's out" email per address not yet told about that album
 *   POST backfill  → any real pass order missing a ledger row gets one, for both albums
 */
const volumeOf = (v: unknown): Volume => (Number(v) === 2 ? 2 : 1);

async function snapshot(volume: Volume) {
  const { albumId, title } = albumOfVolume(volume);
  const [released, stats, early, album, featured] = await Promise.all([
    albumReleased(albumId),
    entitlementStats(albumId),
    earlyRule(),
    loadAlbum(albumId),
    getSetting("featured_track"),
  ]);
  const all = album?.tracks ?? [];
  const drawn = albumId === EARLY_ALBUM_ID;
  const free = drawn ? freeTrackNumber(all, featured) : null;
  const pool = drawn ? dealablePool(all, free) : [];
  const tracks = all.map((t) => ({
    number: t.track_number,
    title: t.title,
    seconds: t.duration ?? 0,
    free: t.track_number === free,
    dealable: pool.includes(t.track_number),
  }));
  return { volume, title: album?.album.title ?? title, released, stats, early: drawn ? early : null, tracks };
}

export async function GET(req: NextRequest) {
  const volume = volumeOf(req.nextUrl.searchParams.get("volume"));
  return NextResponse.json(await snapshot(volume), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { action?: string; enabled?: boolean; extra?: number; volume?: number }
    | null;
  const event = await getCurrentEvent();
  const volume = volumeOf(body?.volume);
  const { albumId } = albumOfVolume(volume);

  switch (body?.action) {
    case "setEarly": {
      const { enabled, extra } = body as { enabled?: boolean; extra?: number };
      if (enabled === undefined && extra === undefined) {
        return NextResponse.json({ error: "nothing to set" }, { status: 400 });
      }
      await setEarlyRule({ enabled, extra });
      return NextResponse.json({ ok: true, ...(await snapshot(volume)) });
    }
    case "release":
      await setAlbumReleased(true, albumId);
      break;
    case "unrelease":
      await setAlbumReleased(false, albumId);
      break;
    case "backfill": {
      // A pass is the whole record, so a missing row is missing for both albums.
      let added = 0;
      for (const a of ALBUMS) added += await backfillFromCodes(event.id, a.albumId);
      return NextResponse.json({ ok: true, added, released: await albumReleased(albumId), stats: await entitlementStats(albumId) });
    }
    case "notify": {
      if (!(await albumReleased(albumId))) {
        return NextResponse.json({ error: "Release it first, then tell people." }, { status: 400 });
      }
      const album = await loadAlbum(albumId);
      const title = album?.album.title ?? albumOfVolume(volume).title;
      const addresses = await unnotifiedAddresses(albumId);
      const plain = `${(await getPublicBaseUrl()) ?? ""}/loop/album`;
      let sent = 0;
      let failed = 0;
      for (const email of addresses) {
        // A claim link where one of their passes can carry it, so the phone
        // that taps Play is bound and the record simply plays.
        const link = (await releaseLinkFor(event.id, email).catch(() => null)) ?? plain;
        const res = await sendAlbumReleaseEmail(email, title, link);
        if (res.ok) {
          await markNotified(email, albumId);
          sent++;
        } else {
          failed++;
          console.error(`[loop:album] release email NOT sent to ${email}`);
        }
      }
      return NextResponse.json({ ok: true, sent, failed, released: true, stats: await entitlementStats(albumId) });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, released: await albumReleased(albumId), stats: await entitlementStats(albumId) });
}
