import Link from "next/link";
import { ODUBO_MARK } from "@/lib/brand/marks";
import { publicChapters, publicWorld } from "@/lib/loop/film/public";
import FlightList from "@/components/loop/film/FlightList";

export const dynamic = "force-dynamic";

/**
 * /recoolman: the world, as a sparse map.
 *
 * Built the way Adventure Time builds Ooo, kept minimal: shown, never
 * explained. Each entry is a name and one line, and it appears when its
 * chapter is revealed; until then only its silhouette is here, the shape of a
 * name without its letters. Every clip ends on the Danceman, and this is where
 * the Danceman leads. Nothing here names Him; everyone knows who we mean.
 */
export default async function WorldPage() {
  const [world, chapters] = await Promise.all([publicWorld(), publicChapters()]);
  const titleOf = (slug: string | null) => chapters.find((c) => c.slug === slug)?.title ?? null;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-sand px-6 pb-20 pt-16 text-ink">
      <span
        role="img"
        aria-label="The Danceman"
        className="mx-auto block h-16 w-16 bg-ink"
        style={{ mask: `url(${ODUBO_MARK}) center / contain no-repeat`, WebkitMask: `url(${ODUBO_MARK}) center / contain no-repeat` }}
      />
      <p className="loop-muted mt-8 text-center text-[11px] font-bold uppercase tracking-[0.25em]">Loop Soul</p>
      <h1 className="loop-display mt-2 text-center text-4xl font-bold tracking-tight">Recoolman</h1>

      <section className="mt-12" aria-label="The world">
        <ul>
          {world.map((w) => (
            <li key={w.slug} className="border-t border-ink/15 py-4 last:border-b">
              {w.shown ? (
                <>
                  <p className="text-base font-bold">{w.name}</p>
                  <p className="loop-muted mt-1 text-[15px] leading-snug">{w.line}</p>
                  {w.chapter && titleOf(w.chapter) && (
                    <Link href={`/loop/${w.chapter}`} className="loop-muted mt-2 inline-block min-h-[44px] py-2 text-[13px] underline underline-offset-4">
                      {titleOf(w.chapter)}
                    </Link>
                  )}
                </>
              ) : (
                <div aria-label="Not yet revealed">
                  <span className="block h-4 rounded-full bg-ink/15" style={{ width: `${Math.min(92, 18 + w.nameLength * 5)}%` }} />
                  <span className="mt-2 block h-2.5 w-3/4 rounded-full bg-ink/10" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-label="The flight">
        <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">The flight</h2>
        <FlightList chapters={chapters} />
      </section>

      <section className="mt-14">
        <Link href="/loop/store" className="flex min-h-[44px] items-center justify-between border-y border-ink/15 py-4">
          <span className="text-base font-bold">Wear the sign</span>
          <span className="loop-muted">→</span>
        </Link>
      </section>
    </main>
  );
}
