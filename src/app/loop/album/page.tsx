import Link from "next/link";
import AlbumPlayer from "@/components/AlbumPlayer";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { albumAccessFor, decideAlbumAccess, loadAlbum, markClaimed } from "@/lib/loop/album";
import { getPassSettings } from "@/lib/loop/pass/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "The record — Loop Soul",
  robots: { index: false, follow: false },
};

/**
 * /loop/album — the pre-order, delivered.
 *
 * Four states, one rule (`decideAlbumAccess`):
 *   wait    owed it, not out yet
 *   listen  owed it, out: the album plays here
 *   prove   this device has not proven an inbox; go to /loop/code
 *   buy     (folded into prove: the gate names the pass)
 *
 * The proof is the same one that recovers a pass: six digits to the checkout
 * email. Nothing here asks for a password, and nothing here is public.
 */
export default async function LoopAlbumPage() {
  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const access = await albumAccessFor(event.id, voterId);
  const state = decideAlbumAccess(access);

  if (state === "listen") {
    const data = await loadAlbum();
    if (access.email) await markClaimed(access.email);
    if (!data) return <Shell title="The record">The album is not on the shelf yet. Try again shortly.</Shell>;
    return (
      <main className="min-h-[100dvh] bg-[#0f0b0b] text-[#ede8df]">
        <div className="mx-auto max-w-2xl px-5 pb-24 pt-10">
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · Yours</p>
          <h1 className="mt-2 text-2xl font-extrabold">{data.album.title}</h1>
          <p className="mt-1 text-sm opacity-70">
            {data.album.artist_name}. Pre-ordered with your pass{access.email ? ` under ${access.email}` : ""}.
          </p>
          <div className="mt-8">
            <AlbumPlayer album={data.album} tracks={data.tracks} />
          </div>
          <BackLink />
        </div>
      </main>
    );
  }

  if (state === "wait") {
    return (
      <Shell title="It's yours. It lands after the night.">
        {event.title} is performed live on the night, all fourteen tracks, and then it is released. This page
        plays it the moment it is out, and the address you paid with is told by email.
        {access.email && (
          <span className="mt-3 block text-xs opacity-60">Pre-order recorded under {access.email}.</span>
        )}
      </Shell>
    );
  }

  const checkoutUrl = (await getPassSettings()).checkoutUrl;
  return (
    <Shell title="The record is for people who pre-ordered it.">
      A pass is a pre-order. If you bought one, prove it&apos;s you with the email you paid with and this page
      opens{access.released ? " and plays" : " when the album is out"}.
      <span className="mt-6 grid gap-3">
        <Link
          href="/loop/code"
          className="flex min-h-[48px] items-center justify-center rounded-2xl bg-[#ede8df] px-5 font-bold text-[#0f0b0b]"
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

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#0f0b0b] text-[#ede8df]">
      <div className="mx-auto max-w-md px-6 pb-24 pt-12">
        <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Loop Soul · The record</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed opacity-85">{children}</p>
        <BackLink />
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/loop" className="mt-10 block text-center text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">
      ← Back to Loop Soul
    </Link>
  );
}
