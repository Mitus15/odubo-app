import Link from "next/link";
import type { PublicChapter, PublicClip } from "@/lib/loop/film/public";
import type { ListenLink } from "@/lib/loop/listen";
import FlightList from "./FlightList";

/**
 * A chapter of the flight that is not a single: its page.
 *
 * Revealed: the thread, the scripture cards (the flip, the verse it samples,
 * the reference), the clips cut from it, and the ways in. Not yet: its number,
 * its title, and "Soon." Shown, never explained.
 */
export default function ChapterView({
  chapter,
  chapters,
  clips,
  watchAt,
  listenOn = [],
}: {
  chapter: PublicChapter;
  chapters: PublicChapter[];
  clips: PublicClip[];
  /** Where this chapter starts in the published film (its marker), if it is out. */
  watchAt: number | null;
  /** Where the album streams, once it does. */
  listenOn?: ListenLink[];
}) {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-sand px-6 pb-20 pt-16 text-ink">
      <p className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
        Loop Soul · Chapter {chapter.number}
      </p>
      <h1 className="loop-display mt-2 text-5xl font-bold tracking-tight">{chapter.title}</h1>
      <span className="mt-4 block h-1.5 w-12 rounded-full" style={{ background: chapter.field }} aria-hidden="true" />
      {chapter.public ? (
        chapter.thread && <p className="mt-6 text-lg leading-snug">{chapter.thread}</p>
      ) : (
        <p className="loop-muted mt-6 text-lg">Soon.</p>
      )}

      {chapter.public && chapter.cards.length > 0 && (
        <section className="mt-12" aria-label="Scripture">
          {chapter.cards.map((c) => (
            <figure key={c.id} className="border-t border-ink/15 py-6 last:border-b">
              {c.flip && <p className="text-2xl font-bold leading-tight">{c.flip}</p>}
              <blockquote className={`${c.flip ? "loop-muted mt-3 text-[15px]" : "text-lg"} leading-snug`}>{c.verseText}</blockquote>
              <figcaption className="loop-muted mt-3 text-[11px] font-bold uppercase tracking-[0.2em]">{c.verseRef}</figcaption>
            </figure>
          ))}
        </section>
      )}

      {chapter.public && clips.length > 0 && (
        <section className="mt-12" aria-label="Clips">
          <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">Clips</h2>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {clips.map((clip) => (
              <Link key={clip.id} href={`/?clip=${clip.uid ?? clip.id}`} className="block aspect-[9/16] overflow-hidden bg-ink/10">
                {clip.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.poster} alt={clip.title ?? chapter.title} className="h-full w-full object-cover" loading="lazy" />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12" aria-label="Ways in">
        {chapter.public && watchAt != null && (
          <Link href={`/loop/film?t=${Math.floor(watchAt)}`} className="flex min-h-[44px] items-center justify-between border-t border-ink/15 py-4">
            <span className="text-base font-bold">Watch the chapter</span>
            <span className="loop-muted">→</span>
          </Link>
        )}
        <Link href="/recoolman" className="flex min-h-[44px] items-center justify-between border-t border-ink/15 py-4">
          <span className="text-base font-bold">Enter the world</span>
          <span className="loop-muted">→</span>
        </Link>
        <Link href="/loop/store" className="flex min-h-[44px] items-center justify-between border-y border-ink/15 py-4">
          <span className="text-base font-bold">Wear the sign</span>
          <span className="loop-muted">→</span>
        </Link>
      </section>

      {listenOn.length > 0 && (
        <section className="mt-12" aria-label="Listen on">
          <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">Listen on</h2>
          {listenOn.map((l) => (
            <a key={l.dsp} href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center justify-between border-t border-ink/15 py-3 last:border-b">
              <span className="text-base font-bold">{l.label}</span>
              <span className="loop-muted">↗</span>
            </a>
          ))}
        </section>
      )}

      <section className="mt-14" aria-label="The flight">
        <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">The flight</h2>
        <FlightList chapters={chapters} current={chapter.slug} />
      </section>
    </main>
  );
}
