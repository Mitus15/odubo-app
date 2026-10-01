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
import { resolveCover, coverCaption } from "@/lib/loop/cover";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { ALBUMS } from "@/lib/loop/songs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "The record · Loop Soul",
  robots: { index: false, follow: false },
};

/**
 * /loop/album — the pre-order, delivered.
 *
 * Loop Soul is two albums, Vol. 1 and Vol. 2, released separately; a pass is
 * owed both. This page is the one URL for both (it is in every pass email and
 * behind every claim link), and each album sits in its own state, decided by
 * the same rule (`decideAlbumAccess`):
 *   early   owed it, not out yet: the single, plus the ones dealt to this
 *           listener (Vol. 1 only: Vol. 2 has no draw)
 *   wait    owed it, not out yet, nothing early set
 *   listen  owed it, out: the album plays here
 *   prove   this device holds nothing: the link in the pass email binds it, or
 *           the code on the ticket does at /loop/code on a new phone
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
  const albums = await Promise.all(
    ALBUMS.map(async (a) => {
      const access = await albumAccessFor(event.id, voterId, a.albumId);
      const state = decideAlbumAccess({
        released: access.released,
        entitled: access.entitled,
        holder: access.holder,
        early: access.early.enabled,
      });
      return { ...a, access, state };
    }),
  );

  if (albums.every((a) => a.state === "prove")) return <Prove offerPass={event.phase !== "archived"} />;

  // Which cover THIS person sees on their record: theirs, the room's, or the owner's.
  const opens = albums.some((a) => a.state === "listen" || a.state === "early");
  const cover = opens ? await resolveCover(event.id, voterId) : null;
  if (!opens) return <Shell title="It isn't out yet.">You&apos;ll get an email the day it is.</Shell>;

  const featured = await getSetting("featured_track");
  let draw: React.ComponentProps<typeof EarlyAlbum> | null = null;
  const sections: React.ReactNode[] = [];

  for (const a of albums) {
    if (a.state === "listen") {
      const data = await loadAlbum(a.albumId);
      if (a.access.email) await markClaimed(a.access.email, a.albumId);
      if (!data) continue;
      sections.push(
        <section key={a.albumId} className="mt-10 first:mt-0">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Yours</p>
          <h1 className="mt-2 text-2xl font-extrabold">{data.album.title}</h1>
          <p className="mt-1 text-sm opacity-70">{data.album.artist_name}.</p>
          <div className="mt-8">
            <AlbumPlayer album={data.album} tracks={data.tracks} field={false} />
          </div>
        </section>,
      );
    } else if (a.state === "early") {
      const data = await loadAlbum(a.albumId);
      if (!data) continue;
      // Seeded on the address so the pair follows the person, not the phone.
      const set = new Set(earlySetFor(a.access.email ?? voterId, data.tracks, featured, a.access.early));
      const now = data.tracks.filter((t) => set.has(t.track_number));
      if (now.length === 0) {
        sections.push(<Coming key={a.albumId} title={data.album.title} />);
        continue;
      }
      // What the draw performs: the one everybody gets, the ones drawn for this
      // person, and the names the draw moves through on its way to them.
      const free = freeTrackNumber(data.tracks, featured);
      draw = {
        albumId: data.album.id,
        albumTitle: data.album.title,
        artist: data.album.artist_name,
        total: data.tracks.length,
        freeTitle: data.tracks.find((t) => t.track_number === free)?.title ?? now[0]?.title ?? "",
        dealtTitles: now.filter((t) => t.track_number !== free).map((t) => t.title),
        poolTitles: dealablePool(data.tracks, free)
          .map((n) => data.tracks.find((t) => t.track_number === n)?.title)
          .filter((t): t is string => Boolean(t)),
        children: null,
      };
      sections.push(
        <section key={a.albumId} className="mt-10 first:mt-0">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Yours, early</p>
          <h1 className="mt-2 text-2xl font-extrabold">{data.album.title}</h1>
          <p className="mt-1 text-sm opacity-70">
            {now.length} of {data.tracks.length} now. The rest the day it&apos;s out.
          </p>
          <div className="mt-8">
            <AlbumPlayer album={data.album} tracks={now} field={false} />
          </div>
        </section>,
      );
    } else if (a.state === "wait") {
      sections.push(<Coming key={a.albumId} title={a.title} />);
    }
  }

  const page = (
    <Dark>
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-10">
        <Cover cover={cover} />
        {sections}
        <BackLink />
      </div>
    </Dark>
  );
  return draw ? <EarlyAlbum {...draw}>{page}</EarlyAlbum> : page;
}

/** An album this person is owed that is not out yet. */
function Coming({ title }: { title: string }) {
  return (
    <section className="mt-10 border-t border-[var(--foreground)]/15 pt-8 first:mt-0 first:border-0 first:pt-0">
      <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Coming</p>
      <h2 className="mt-2 text-2xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm opacity-70">Yours the day it&apos;s out.</p>
    </section>
  );
}

/** This device holds nothing yet. No pass is offered once the night is archived. */
async function Prove({ offerPass }: { offerPass: boolean }) {
  // No bare checkout link here: the pass sheet on /loop is the only way to
  // buy, because it is the only place that takes the address the ticket goes
  // to. Sale #1 came through a bare link and arrived with no email.
  const pass = await getPassSettings();
  const price = formatPrice(pass.price, pass.currency);
  return (
    <Shell title="Your record is behind your pass.">
      The code on your ticket opens it.
      <span className="mt-6 grid gap-3">
        <Link
          href="/loop/code"
          className="flex min-h-[48px] items-center justify-center rounded-full bg-[var(--foreground)] px-5 font-bold text-[var(--background)]"
        >
          Enter your pass
        </Link>
        {offerPass && pass.checkoutUrl && (
          <Link href="/loop" className="text-center text-xs underline underline-offset-4 opacity-80">
            No pass yet? Get a pass{price === "FREE ENTRY" ? "" : ` · ${price}`}
          </Link>
        )}
      </span>
    </Shell>
  );
}

/** The cover this listener holds, above their record. Owner's art when they have none. */
function Cover({ cover }: { cover: Awaited<ReturnType<typeof resolveCover>> | null }) {
  if (!cover?.url) return null;
  return (
    <div className="mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.url} alt="The cover" className="aspect-square w-full max-w-[280px] object-cover" />
      <p className="mt-2 text-xs opacity-60">{coverCaption(cover)}</p>
    </div>
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
