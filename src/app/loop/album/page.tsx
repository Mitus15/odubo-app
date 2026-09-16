import Link from "next/link";
import AlbumPlayer from "@/components/AlbumPlayer";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import {
  albumAccessFor,
  dealablePool,
  decideAlbumAccess,
  earlySetFor,
  freeTrackNumber,
  loadAlbum,
  markClaimed,
} from "@/lib/loop/album";
import EarlyAlbum from "@/components/loop/album/EarlyAlbum";
import { getSetting } from "@/lib/loop/loopSetting";
import { getPassSettings } from "@/lib/loop/pass/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "The record · Loop Soul",
  robots: { index: false, follow: false },
};

/**
 * /loop/album — the pre-order, delivered.
 *
 * Four states, one rule (`decideAlbumAccess`):
 *   early   owed it, not out yet: the single, plus the ones dealt to this listener
 *   wait    owed it, not out yet, nothing early set
 *   listen  owed it, out: the album plays here
 *   prove   this device holds nothing: the link in the pass email binds it, or
 *           the six digits at /loop/code do on a new phone
 *
 * A buyer normally never sees `prove`: the pass email's button lands them
 * here already bound. Nothing here asks for a password, and nothing here is
 * public.
 *
 * Dark on purpose, through the vault tokens rather than typed hexes, so the
 * record and the vault are the same dark and nothing on this page can drift
 * from the palette.
 */
export default async function LoopAlbumPage() {
  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const access = await albumAccessFor(event.id, voterId);
  const state = decideAlbumAccess({
    released: access.released,
    entitled: access.entitled,
    holder: access.holder,
    early: access.early.enabled,
  });

  if (state === "listen") {
    const data = await loadAlbum();
    if (access.email) await markClaimed(access.email);
    if (!data) return <Shell title="Not on the shelf yet.">Try again shortly.</Shell>;
    return (
      <Dark>
        <div className="mx-auto max-w-2xl px-5 pb-24 pt-10">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Yours</p>
          <h1 className="mt-2 text-2xl font-extrabold">{data.album.title}</h1>
          <p className="mt-1 text-sm opacity-70">{data.album.artist_name}.</p>
          <div className="mt-8">
            <AlbumPlayer album={data.album} tracks={data.tracks} />
          </div>
          <BackLink />
        </div>
      </Dark>
    );
  }

  if (state === "early") {
    const [data, featured] = await Promise.all([loadAlbum(), getSetting("featured_track")]);
    if (!data) return <Shell title="Not on the shelf yet.">Try again shortly.</Shell>;
    // Seeded on the address so the pair follows the person, not the phone.
    const set = new Set(earlySetFor(access.email ?? voterId, data.tracks, featured, access.early));
    const now = data.tracks.filter((t) => set.has(t.track_number));
    // What the draw performs: the one everybody gets, the ones drawn for this
    // person, and the names the draw moves through on its way to them.
    const free = freeTrackNumber(data.tracks, featured);
    const freeTitle = data.tracks.find((t) => t.track_number === free)?.title ?? now[0]?.title ?? "";
    const dealtTitles = now.filter((t) => t.track_number !== free).map((t) => t.title);
    const poolTitles = dealablePool(data.tracks, free)
      .map((n) => data.tracks.find((t) => t.track_number === n)?.title)
      .filter((t): t is string => Boolean(t));
    if (now.length === 0) return <Shell title="It lands after the night." />;
    return (
      <EarlyAlbum
        albumId={data.album.id}
        albumTitle={data.album.title}
        artist={data.album.artist_name}
        total={data.tracks.length}
        freeTitle={freeTitle}
        dealtTitles={dealtTitles}
        poolTitles={poolTitles}
      >
        <Dark>
          <div className="mx-auto max-w-2xl px-5 pb-24 pt-10">
            <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Yours, early</p>
            <h1 className="mt-2 text-2xl font-extrabold">{data.album.title}</h1>
            <p className="mt-1 text-sm opacity-70">
              {now.length} of {data.tracks.length} now. The rest after the night.
            </p>
            <div className="mt-8">
              <AlbumPlayer album={data.album} tracks={now} />
            </div>
            <BackLink />
          </div>
        </Dark>
      </EarlyAlbum>
    );
  }

  if (state === "wait") return <Shell title="It lands after the night." />;

  const checkoutUrl = (await getPassSettings()).checkoutUrl;
  return (
    <Shell title="Your record opens from your pass email.">
      Tap the link in it. New phone, or lost the email? Prove the inbox.
      <span className="mt-6 grid gap-3">
        <Link
          href="/loop/code"
          className="flex min-h-[48px] items-center justify-center rounded-full bg-[var(--foreground)] px-5 font-bold text-[var(--background)]"
        >
          That&apos;s me
        </Link>
        {checkoutUrl && (
          <a href={checkoutUrl} className="text-center text-xs underline underline-offset-4 opacity-80">
            No pass yet? Get one, $5
          </a>
        )}
      </span>
    </Shell>
  );
}

/** The vault tokens, applied at render so there is no sand-to-ink flash. */
function Dark({ children }: { children: React.ReactNode }) {
  return (
    <div className="loop-theme" data-mode="vault">
      <main className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">{children}</main>
    </div>
  );
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Dark>
      <div className="mx-auto max-w-md px-6 pb-24 pt-12">
        <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · The record</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{title}</h1>
        {children && <p className="mt-4 text-sm leading-relaxed opacity-85">{children}</p>}
        <BackLink />
      </div>
    </Dark>
  );
}

function BackLink() {
  return (
    <Link href="/loop" className="mt-10 block text-center text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">
      ← Back to Loop Soul
    </Link>
  );
}
