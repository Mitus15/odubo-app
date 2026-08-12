import Image from "next/image";
import Link from "next/link";
import type { LoopEvent } from "@/lib/loop/hub";
import type { JournalData } from "@/lib/loop/journal-server";

/**
 * The Loop Journal — one volume's issue, laid out as a printed object. It
 * renders in poster mode on purpose: sand is the paper, oxblood is the ink,
 * which is exactly the printed artefact the brand is built on. Zero client JS
 * (like the Lookbook) — a magazine should be readable, not interactive.
 *
 * Sections self-omit when their data doesn't exist yet, so a half-curated
 * issue still reads as a finished page, never a page of placeholders.
 */

function SectionRule({ index, label }: { index: string; label: string }) {
  return (
    <div className="mt-16 flex items-baseline gap-3">
      <span className="text-xs font-bold tabular-nums opacity-50">№ {index}</span>
      <h2 className="text-xs font-bold uppercase tracking-[0.3em]">{label}</h2>
      <span className="h-px flex-1 self-center bg-ink/25" aria-hidden />
    </div>
  );
}

function issueDate(event: LoopEvent): string {
  return new Date(event.date).toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    dateStyle: "long",
  });
}

export function JournalIssueView({
  event,
  data,
  draftPreview = false,
}: {
  event: LoopEvent;
  data: JournalData;
  draftPreview?: boolean;
}) {
  const { issue, moments, anthem, runOfShow } = data;
  const headline = issue?.headline?.trim() || `The ${event.theme} Issue`;
  const [spotlight, ...rest] = moments;
  let section = 0;
  const nextIndex = () => String(++section).padStart(2, "0");

  return (
    <main className="mx-auto w-full max-w-xl px-6 pb-24">
      {draftPreview && (
        <p className="mt-4 rounded-full border border-ink/30 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">
          Draft preview — only admins can see this
        </p>
      )}

      {/* ── Cover ── */}
      <header className="pt-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] opacity-70">
          The Loop Journal
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] opacity-50">
          {event.title} · {issueDate(event)}
        </p>

        <h1 className="mt-8 text-5xl font-black leading-[0.95] tracking-tight">
          {headline}
        </h1>
        <p className="font-script mt-4 text-3xl" style={{ fontFamily: "var(--font-script)" }}>
          the night, kept.
        </p>

        {issue?.standfirst?.trim() ? (
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed opacity-80">
            {issue.standfirst}
          </p>
        ) : null}

        <div className="relative mx-auto mt-8 h-56 w-full max-w-sm">
          <Image
            src="/loop/figures/listen.png"
            alt="Loop Soul figure in silhouette"
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      </header>

      {/* ── The Anthem ── */}
      {anthem && (
        <section>
          <SectionRule index={nextIndex()} label="The Anthem" />
          <div className="mt-6 overflow-hidden rounded-3xl bg-ink text-sand">
            <div className="flex items-center gap-5 p-6">
              {anthem.champion.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={anthem.champion.artworkUrl}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">
                  Crowned by the room
                </p>
                <p className="mt-1 truncate text-2xl font-black leading-tight">
                  {anthem.champion.title}
                </p>
                <p className="truncate text-sm opacity-80">{anthem.champion.artist}</p>
              </div>
            </div>
            {anthem.runnerUp && (
              <p className="border-t border-sand/20 px-6 py-4 text-sm opacity-80">
                Took the final{" "}
                <span className="font-bold tabular-nums">
                  {anthem.votesFor}–{anthem.votesAgainst}
                </span>{" "}
                over {anthem.runnerUp.title} — then the Soul Loop Line did the rest.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Iconic Moments ── */}
      {spotlight && (
        <section>
          <SectionRule index={nextIndex()} label="Iconic Moments" />
          <figure className="mt-6">
            <div className="overflow-hidden rounded-3xl bg-ink/10">
              {/* The Wall's featured set can include clips, so this is not
                  always a still. Plain <img>/<video> — the media route isn't in
                  next.config's image domains. */}
              {spotlight.kind === "video" ? (
                <video
                  src={spotlight.imageUrl}
                  className="aspect-[4/5] w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spotlight.imageUrl}
                  alt={spotlight.caption || "Iconic moment"}
                  className="aspect-[4/5] w-full object-cover"
                />
              )}
            </div>
            {(spotlight.caption || spotlight.credit) && (
              <figcaption className="mt-2 px-1 text-sm">
                <span className="font-bold">{spotlight.caption}</span>
                {spotlight.credit && (
                  <span className="opacity-60"> — {spotlight.credit}</span>
                )}
              </figcaption>
            )}
          </figure>

          {rest.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {rest.map((m) => (
                <figure key={m.id}>
                  <div className="overflow-hidden rounded-2xl bg-ink/10">
                    {m.kind === "video" ? (
                      <video
                        src={m.imageUrl}
                        className="aspect-square w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt={m.caption || "Iconic moment"}
                        className="aspect-square w-full object-cover"
                      />
                    )}
                  </div>
                  {(m.caption || m.credit) && (
                    <figcaption className="mt-1.5 px-1 text-xs">
                      <span className="font-bold">{m.caption}</span>
                      {m.credit && <span className="opacity-60"> — {m.credit}</span>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── The Night That Was ── */}
      {runOfShow.length > 0 && (
        <section>
          <SectionRule index={nextIndex()} label="The Night That Was" />
          <ol className="mt-4">
            {runOfShow.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-4 border-b border-ink/15 py-3.5 last:border-b-0"
              >
                <span className="w-11 shrink-0 text-sm font-bold tabular-nums opacity-60">
                  {item.time}
                </span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{item.title}</p>
                  {item.performer && (
                    <p className="text-sm opacity-70">
                      {item.performer}
                      {item.role ? ` · ${item.role}` : ""}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── The loop continues ── */}
      <section className="mt-16 rounded-3xl bg-ink px-6 py-10 text-center text-sand">
        <p className="font-script text-3xl" style={{ fontFamily: "var(--font-script)" }}>
          the loop continues.
        </p>
        <p className="mt-2 text-sm opacity-80">
          The next volume is already gathering.
        </p>
        <Link
          href="/loop"
          className="mt-6 inline-block rounded-full bg-sand px-8 py-3.5 text-sm font-bold text-ink transition-transform active:scale-95"
        >
          Join the next one
        </Link>
      </section>

      <footer className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] opacity-50">
        Loop Soul · The Rec Room · {event.venue}
      </footer>
    </main>
  );
}

export default JournalIssueView;
