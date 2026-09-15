import Link from "next/link";
import DrawPreview from "./DrawPreview";
import { dealablePool, earlyRule, earlySetFor, freeTrackNumber, loadAlbum } from "@/lib/loop/album";
import { getSetting } from "@/lib/loop/loopSetting";

export const dynamic = "force-dynamic";
export const metadata = { title: "The draw — Loop Soul admin" };

/**
 * Watch the draw the way a buyer sees it, without buying anything.
 * Gated by middleware with the rest of /loop/admin.
 *
 * `?as=someone@example.com` performs it for that address, which is how you
 * check that two different buyers really are dealt different songs. It loops,
 * because the point here is the ceremony rather than reaching the music.
 */
export default async function PreviewDrawPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const who = (as ?? "preview@odubostudio.com").trim().toLowerCase();

  const [album, featured, rule] = await Promise.all([loadAlbum(), getSetting("featured_track"), earlyRule()]);
  if (!album) {
    return <main className="p-10 text-sm">The album is not on the shelf yet.</main>;
  }

  const set = new Set(earlySetFor(who, album.tracks, featured, rule));
  const free = freeTrackNumber(album.tracks, featured);
  const freeTitle = album.tracks.find((t) => t.track_number === free)?.title ?? album.tracks[0].title;
  const dealtTitles = album.tracks.filter((t) => set.has(t.track_number) && t.track_number !== free).map((t) => t.title);
  const poolTitles = dealablePool(album.tracks, free)
    .map((n) => album.tracks.find((t) => t.track_number === n)?.title)
    .filter((t): t is string => Boolean(t));

  return (
    <>
      <DrawPreview
        albumTitle={album.album.title}
        artist={album.album.artist_name}
        total={album.tracks.length}
        freeTitle={freeTitle}
        dealtTitles={dealtTitles}
        poolTitles={poolTitles}
      />
      <div className="fixed inset-x-0 top-0 flex items-center justify-between bg-[#0f0b0b]/80 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#ede8df]/60 backdrop-blur">
        <span>Preview · as {who}</span>
        <Link href="/loop/admin">Admin</Link>
      </div>
    </>
  );
}
