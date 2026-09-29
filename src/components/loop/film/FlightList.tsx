import Link from "next/link";
import type { PublicChapter } from "@/lib/loop/film/public";

/**
 * The fourteen chapters of the flight, as a playbill: number, title, each in
 * its own colour. A revealed chapter is a link; the rest wait, muted.
 */
export default function FlightList({ chapters, current }: { chapters: PublicChapter[]; current?: string }) {
  return (
    <ol className="mt-3">
      {chapters.map((c) => {
        const inner = (
          <>
            <span className="flex items-center gap-3">
              <span className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.field }} aria-hidden="true" />
              <span className="loop-muted w-6 text-[13px] tabular-nums">{String(c.number).padStart(2, "0")}</span>
              <span className={`text-base ${c.slug === current ? "font-bold" : ""} ${c.public ? "" : "opacity-45"}`}>{c.title}</span>
            </span>
            <span className="loop-muted shrink-0 text-[13px]">{c.public ? "→" : ""}</span>
          </>
        );
        return (
          <li key={c.slug} className="border-t border-ink/15 last:border-b">
            {c.public ? (
              <Link href={`/loop/${c.slug}`} aria-current={c.slug === current ? "page" : undefined} className="flex min-h-[44px] items-center justify-between gap-4 py-3">
                {inner}
              </Link>
            ) : (
              <div className="flex min-h-[44px] items-center justify-between gap-4 py-3">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
