import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { getFeaturedSingle } from "@/lib/loop/single";
import { resolveCover, coverCaption } from "@/lib/loop/cover";
import { codesHeldBy } from "@/lib/loop/event-codes";
import { getPassOffer } from "@/lib/loop/pass/offer";
import { shortDate } from "@/lib/loop/eventFacts";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { isThisSingle, singleMeta, SINGLE_PATH } from "@/lib/loop/singlePage";
import SingleStandalone from "@/components/loop/gathering/SingleStandalone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /loop/1984 — the single, on a link of its own.
 *
 * Shareable (its own share card, see opengraph-image.tsx), playable on the
 * first tap, scrubbable on the vinyl ring. `?from=<gift code>` still says who
 * sent it. See lib/loop/singlePage.ts for why the page refuses to play a song
 * that is not 1984 under this name.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [single, event, base] = await Promise.all([getFeaturedSingle(), getCurrentEvent(), getPublicBaseUrl()]);
  if (!single || !isThisSingle(single.title)) return { title: "Loop Soul" };
  const m = singleMeta(single, { dateLabel: shortDate(event.date), venue: event.venue });
  // Absolute, from the configured origin: Facebook ignores a relative og:url.
  const url = base ? `${base}${SINGLE_PATH}` : SINGLE_PATH;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: url },
    openGraph: { title: m.title, description: m.description, type: "music.song", url },
    twitter: { card: "summary_large_image", title: m.title, description: m.description },
  };
}

export default async function SinglePage() {
  const [event, voterId, single] = await Promise.all([getCurrentEvent(), currentVoterId(), getFeaturedSingle()]);
  // Not playable, or no longer the featured song: the poster, not a lie.
  if (!single || !isThisSingle(single.title)) redirect("/loop");

  const [cover, held, offer] = await Promise.all([
    resolveCover(event.id, voterId),
    codesHeldBy(event.id, voterId).catch(() => []),
    event.phase === "archived" ? Promise.resolve(null) : getPassOffer(event),
  ]);

  return (
    <SingleStandalone
      single={single}
      coverUrl={cover.url}
      coverCaption={coverCaption(cover)}
      dateLabel={shortDate(event.date)}
      holder={held.length > 0}
      offer={offer}
    />
  );
}
