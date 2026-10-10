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
import { releaseLabel, sharePath, singleBySlug } from "@/lib/loop/singles";
import { getSingleStatuses } from "@/lib/loop/singlesStore";
import { isAdminRequest } from "@/lib/loop/audioAccess";
import SingleStandalone, { type SingleRow } from "@/components/loop/gathering/SingleStandalone";
import ChapterView from "@/components/loop/film/ChapterView";
import { songBySlug } from "@/lib/loop/songs";
import { chapterClips, publicChapters, publicFilm } from "@/lib/loop/film/public";
import { listenLinks } from "@/lib/loop/listen";
import { ALBUM_ID } from "@/lib/loop/songs";
import { ALBUM_NAME } from "@/lib/loop/albumName";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /loop/<slug> (and /signsoflife/<slug>, its address since 2026-10-03): a
 * single, on a link of its own. Makunahea, 1984, News Peak
 * (lib/loop/singles.ts), each with a music video pointing here.
 *
 * OUT: plays on the first tap, scrubs on the vinyl ring, and opens its ways
 * in (the stem field where a pack exists, the runner for every single).
 * COMING: the cover, the name, the date if there is one, and nothing that
 * plays, so a teaser post can link here before the song is out. An admin sees
 * a coming single as if it were out, to check it before the day.
 *
 * The other eleven songs are chapters of the flight (ChapterView): a
 * silhouette until the chapter is revealed, then its thread, its scripture
 * cards, its clips and the ways in. Any other segment 404s: /loop's own
 * routes (album, press, admin...) are static and win over this one.
 */
async function load(slug: string) {
  const def = singleBySlug(slug);
  if (!def) return null;
  const [statuses, track] = await Promise.all([getSingleStatuses(), getTrackAsSingle(def.title)]);
  const status = statuses.find((s) => s.slug === def.slug)!;
  return { def, statuses, status, track };
}

/** The eleven songs that are not singles: a chapter page of the flight. */
async function chapterMeta(slug: string): Promise<Metadata> {
  const song = songBySlug(slug);
  if (!song) return { title: ALBUM_NAME };
  const [chapters, base] = await Promise.all([publicChapters(), getPublicBaseUrl()]);
  const c = chapters.find((x) => x.slug === slug);
  const title = `${c?.title ?? song.title} · ${ALBUM_NAME}`;
  const description = c?.public && c.thread ? c.thread : `Chapter ${song.number} of ${ALBUM_NAME}, an album by Mani Odubo.`;
  const path = sharePath(slug);
  const url = base ? `${base}${path}` : path;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url }, twitter: { card: "summary_large_image", title, description } };
}

export async function generateMetadata({ params }: { params: Promise<{ single: string }> }): Promise<Metadata> {
  const slug = (await params).single;
  if (!singleBySlug(slug)) return chapterMeta(slug);
  const data = await load(slug);
  if (!data?.track) return { title: ALBUM_NAME };
  const [event, base] = await Promise.all([getCurrentEvent(), getPublicBaseUrl()]);
  const m = singleMeta(
    data.track,
    event.phase === "archived" ? null : { dateLabel: shortDate(event.date), venue: event.venue },
    { out: data.status.out, dateLabel: releaseLabel(data.status.releaseDate) },
  );
  // Absolute, from the configured origin: Facebook ignores a relative og:url.
  const path = sharePath(data.def.slug);
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
  const slug = (await params).single;
  if (!singleBySlug(slug)) {
    // A chapter of the flight that is not a single.
    if (!songBySlug(slug)) notFound();
    const [chapters, clips, film, listenOn] = await Promise.all([publicChapters(), chapterClips(slug), publicFilm(), listenLinks(ALBUM_ID)]);
    const chapter = chapters.find((c) => c.slug === slug)!;
    const watchAt = film?.markers.find((m) => m.label === slug)?.t ?? null;
    return <ChapterView chapter={chapter} chapters={chapters} clips={chapter.public ? clips : []} watchAt={watchAt} listenOn={listenOn} />;
  }
  const data = await load(slug);
  if (!data?.track) notFound();
  const { def, statuses, status, track } = data;

  const [event, voterId, admin] = await Promise.all([getCurrentEvent(), currentVoterId(), isAdminRequest(null)]);
  const archived = event.phase === "archived";

  const [cover, held, offer] = await Promise.all([
    resolveCover(event.id, voterId),
    codesHeldBy(event.id, voterId).catch(() => []),
    archived ? Promise.resolve(null) : getPassOffer(event),
  ]);

  const [chapter, listenOn] = await Promise.all([
    publicChapters().then((all) => all.find((c) => c.slug === def.slug) ?? null),
    listenLinks(ALBUM_ID),
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
      chapter={chapter && chapter.public ? chapter : null}
      listenOn={listenOn}
    />
  );
}
