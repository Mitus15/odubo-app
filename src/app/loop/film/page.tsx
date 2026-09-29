import Link from "next/link";
import { publicChapters, publicFilm } from "@/lib/loop/film/public";

export const dynamic = "force-dynamic";
export const metadata = { title: "The film · Loop Soul", description: "Loop Soul, danced in one take." };

/**
 * /loop/film: the whole album, danced in one take, as one film.
 *
 * The film is the long render of the same take the clips are cut from, so a
 * clip and its moment here match frame for frame. Chapters come from the
 * film's markers (film:publish writes one per song, labelled with its slug);
 * ?t= starts it at a moment. Until the film is published: the chapters, and a
 * line saying when.
 */
export default async function FilmPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [film, chapters] = await Promise.all([publicFilm(), publicChapters()]);
  const t = Math.max(0, Math.floor(Number((await searchParams).t) || 0));
  const at = (slug: string) => film?.markers.find((m) => m.label === slug)?.t ?? null;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-sand px-6 pb-20 pt-16 text-ink">
      <p className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">Loop Soul</p>
      <h1 className="loop-display mt-2 text-5xl font-bold tracking-tight">The film</h1>
      {film ? (
        <div className="mt-8 aspect-video w-full overflow-hidden bg-ink">
          <iframe
            key={t}
            src={`https://iframe.videodelivery.net/${film.uid}?startTime=${t}s${film.poster ? `&poster=${encodeURIComponent(film.poster)}` : ""}`}
            title="Loop Soul, the film"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <p className="loop-muted mt-6 text-lg">It arrives with the album.</p>
      )}
      <section className="mt-12" aria-label="Chapters">
        <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">Chapters</h2>
        <ol className="mt-3">
          {chapters.map((c) => {
            const mark = c.public ? at(c.slug) : null;
            return (
              <li key={c.slug} className="border-t border-ink/15 last:border-b">
                {mark != null ? (
                  <Link href={`/loop/film?t=${Math.floor(mark)}`} className="flex min-h-[44px] items-center justify-between gap-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="block h-2.5 w-2.5 rounded-full" style={{ background: c.field }} aria-hidden="true" />
                      <span className="loop-muted w-6 text-[13px] tabular-nums">{String(c.number).padStart(2, "0")}</span>
                      <span className="text-base">{c.title}</span>
                    </span>
                    <span className="loop-muted text-[13px] tabular-nums">
                      {Math.floor(mark / 60)}:{String(Math.floor(mark % 60)).padStart(2, "0")}
                    </span>
                  </Link>
                ) : (
                  <div className="flex min-h-[44px] items-center gap-3 py-3">
                    <span className="block h-2.5 w-2.5 rounded-full" style={{ background: c.field }} aria-hidden="true" />
                    <span className="loop-muted w-6 text-[13px] tabular-nums">{String(c.number).padStart(2, "0")}</span>
                    <span className={`text-base ${c.public ? "" : "opacity-45"}`}>{c.title}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <Link href="/recoolman" className="mt-12 flex min-h-[44px] items-center justify-between border-y border-ink/15 py-4">
        <span className="text-base font-bold">Enter the world</span>
        <span className="loop-muted">→</span>
      </Link>
    </main>
  );
}
