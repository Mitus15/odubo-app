import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { getTrackAsSingle } from "@/lib/loop/single";
import { resolveCover, coverCaption } from "@/lib/loop/cover";
import { codesHeldBy } from "@/lib/loop/event-codes";
import { getPassOffer } from "@/lib/loop/pass/offer";
import { shortDate } from "@/lib/loop/eventFacts";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { singleMeta } from "@/lib/loop/singlePage";
import { releaseLabel, singleBySlug, singlePath } from "@/lib/loop/singles";
import { getSingleStatuses } from "@/lib/loop/singlesStore";
import { isAdminRequest } from "@/lib/loop/audioAccess";
import SingleStandalone, { type SingleRow } from "@/components/loop/gathering/SingleStandalone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /loop/<slug>: a single, on a link of its own. Makunahea, 1984, News Peak
 * (lib/loop/singles.ts), each with a music video pointing here.
 *
 * OUT: plays on the first tap, scrubs on the vinyl ring, and opens its ways
 * in (the stem field where a pack exists, the runner for every single).
 * COMING: the cover, the name, the date if there is one, and nothing that
 * plays, so a teaser post can link here before the song is out. An admin sees
 * a coming single as if it were out, to check it before the day.
 *
 * Any other segment 404s: /loop's own routes (album, press, admin...) are
 * static and win over this one.
 */
async function load(slug: string) {
  const def = singleBySlug(slug);
  if (!def) return null;
  const [statuses, track] = await Promise.all([getSingleStatuses(), getTrackAsSingle(def.title)]);
  const status = statuses.find((s) => s.slug === def.slug)!;
  return { def, statuses, status, track };
}

export async function generateMetadata({ params }: { params: Promise<{ single: string }> }): Promise<Metadata> {
  const data = await load((await params).single);
  if (!data?.track) return { title: "Loop Soul" };
  const [event, base] = await Promise.all([getCurrentEvent(), getPublicBaseUrl()]);
  const m = singleMeta(
    data.track,
    event.phase === "archived" ? null : { dateLabel: shortDate(event.date), venue: event.venue },
    { out: data.status.out, dateLabel: releaseLabel(data.status.releaseDate) },
  );
  // Absolute, from the configured origin: Facebook ignores a relative og:url.
  const path = singlePath(data.def.slug);
  const url = base ? `${base}${path}` : path;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: url },
    openGraph: { title: m.title, description: m.description, type: "music.song", url },
    twitter: { card: "summary_large_image", title: m.title, description: m.description },
  };
}

export default async function SinglePage({ params }: { params: Promise<{ single: string }> }) {
  const data = await load((await params).single);
  if (!data?.track) notFound();
  const { def, statuses, status, track } = data;

  const [event, voterId, admin] = await Promise.all([getCurrentEvent(), currentVoterId(), isAdminRequest(null)]);
  const archived = event.phase === "archived";

  const [cover, held, offer] = await Promise.all([
    resolveCover(event.id, voterId),
    codesHeldBy(event.id, voterId).catch(() => []),
    archived ? Promise.resolve(null) : getPassOffer(event),
  ]);

  const singles: SingleRow[] = statuses.map((s) => ({
    slug: s.slug,
    title: s.title,
    number: s.number,
    out: s.out,
    dateLabel: releaseLabel(s.releaseDate),
  }));

  return (
    <SingleStandalone
      single={track}
      slug={def.slug}
      out={status.out}
      playable={status.out || admin}
      releaseDateLabel={releaseLabel(status.releaseDate)}
      fieldPack={def.fieldPack ?? null}
      singles={singles}
      coverUrl={cover.url}
      coverCaption={coverCaption(cover)}
      dateLabel={archived ? null : shortDate(event.date)}
      holder={held.length > 0}
      offer={offer}
      closable={!archived}
    />
  );
}
