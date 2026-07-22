import type { RunOfShowItem } from "@/lib/loop/content";

/**
 * The Night — ONE timeline that is both the run of show and the lineup. Each row
 * is a timed slot; rows with a performer show their name/role and link out to
 * Instagram right where they happen. Data is editable from /admin and arrives as
 * a prop (see `content-store.ts`). In State 2 this gets a live "now" marker.
 */
export function RunOfShow({
  items,
  showHeader = true,
}: {
  items: RunOfShowItem[];
  showHeader?: boolean;
}) {
  return (
    <section className="w-full">
      {showHeader && (
        <header className="mb-3 px-1">
          <h2 className="text-2xl font-extrabold">The Night</h2>
          <p className="text-sm opacity-70">Run of show — who, what, when.</p>
        </header>
      )}
      <ol className="relative ml-2 border-l border-ink/20">
        {items.map((item) => {
          const meta = [item.performer, item.role].filter(Boolean).join(" · ");
          return (
            <li key={item.id} className="ml-5 pb-5 last:pb-0">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-ink" />
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="shrink-0 text-sm font-black tabular-nums">{item.time}</span>
                  <span className="font-bold">{item.title}</span>
                </div>
                {item.instagram && (
                  <a
                    href={`https://instagram.com/${item.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full border border-ink/20 px-3 py-1 text-[11px] font-bold"
                  >
                    @{item.instagram}
                  </a>
                )}
              </div>
              {meta && (
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60">{meta}</div>
              )}
              <p className="mt-0.5 text-sm opacity-70">{item.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default RunOfShow;
