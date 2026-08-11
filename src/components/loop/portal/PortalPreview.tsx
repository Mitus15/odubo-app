import type { RunOfShowItem } from "@/lib/loop/content";

/**
 * What someone WITHOUT a pass sees, under the code gate.
 *
 * A code prompt on its own is a closed door with no sign on it: whoever landed
 * here from a poster, a QR code or a friend's story has no idea what a pass
 * buys. So the night itself is shown in full — the programme, the anthem,
 * Danceyokey, the camera — and only the surfaces you have to be in the room to
 * use stay locked.
 *
 * Nothing here is sensitive. The programme is what's on the poster, the anthem
 * longlist is already public-safe, and the count of who's coming is the point
 * rather than a secret. What stays behind the gate is participation: voting,
 * signing up, shooting, and the Wall.
 */
export function PortalPreview({
  runOfShow,
  sold,
  capacity,
  nominations,
  anthemStage,
  danceyokeySpots,
}: {
  runOfShow: RunOfShowItem[];
  sold: number;
  capacity: number;
  /** Songs nominated so far — evidence the room is already choosing. */
  nominations: number;
  anthemStage: "nominating" | "seeding" | "bracket" | "champion";
  danceyokeySpots: number;
}) {
  const remaining = Math.max(0, capacity - sold);
  const anthemLine =
    anthemStage === "champion"
      ? "The anthem has been chosen."
      : anthemStage === "bracket"
        ? "The final rounds are running now."
        : nominations > 0
          ? `${nominations} song${nominations === 1 ? "" : "s"} in so far.`
          : "Nominations are open.";

  return (
    <section className="mt-14 w-full max-w-md text-left">
      <h2 className="text-center text-xs font-bold uppercase tracking-[0.3em] opacity-60">
        What a pass gets you
      </h2>

      {/* The room is finite and that is the whole pitch — say it plainly. */}
      <div className="mt-5 rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4 text-center">
        <div className="font-sans text-5xl font-extrabold leading-none tabular-nums">
          {remaining}
        </div>
        <div className="loop-muted mt-1 text-xs font-semibold uppercase tracking-widest">
          {remaining === 1 ? "Pass left" : "Passes left"} of {capacity}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <PreviewCard
          title="The programme"
          body="One night, run like a show — not a playlist. Here's the shape of it."
        >
          {runOfShow.length > 0 ? (
            <ul className="mt-3 grid gap-1.5">
              {runOfShow.map((item) => (
                <li key={item.id} className="flex gap-3 text-sm">
                  <span className="loop-muted w-12 shrink-0 font-mono text-xs tabular-nums">
                    {item.time}
                  </span>
                  <span>
                    <span className="font-semibold">{item.title}</span>
                    {item.performer ? (
                      <span className="loop-muted"> · {item.performer}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </PreviewCard>

        <PreviewCard
          title="The anthem"
          body="The room decides what we all dance to. Nominate a song, then vote it through the rounds until one is left standing."
          foot={anthemLine}
        />

        <PreviewCard
          title="Danceyokey"
          body={`Karaoke, but for dancing. Pick your song, take the floor for the length of it. ${
            danceyokeySpots > 0
              ? `${danceyokeySpots} spot${danceyokeySpots === 1 ? "" : "s"} a night`
              : "A handful of spots a night"
          } — sign up in advance or in the room, alone or with as many people as you want.`}
        />

        <PreviewCard
          title="The camera"
          body="Shoot the night through the Loop Soul filter and everyone comes out a figure — ink on sand, no faces. Your shots stay credited to you, and the good ones become the artwork for the volumes after this one."
        />

        <PreviewCard
          title="The Wall"
          body="Everything shot in the room, in one place, as it fills up. After the night it becomes the record of it — the issue for this volume."
        />
      </div>

      {/* The point of the app, stated before anyone buys — so nobody arrives
          expecting to spend the night on their phone. */}
      <p className="loop-muted mt-6 px-1 text-center text-xs leading-relaxed">
        The app is for specific moments — getting in, taking your turn, shooting
        a shot. The rest of the night it stays in your pocket.
      </p>
    </section>
  );
}

function PreviewCard({
  title,
  body,
  foot,
  children,
}: {
  title: string;
  body: string;
  foot?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4">
      <div className="font-bold">{title}</div>
      <p className="mt-1 text-sm leading-relaxed opacity-75">{body}</p>
      {children}
      {foot ? (
        <p className="loop-muted mt-3 text-xs font-semibold uppercase tracking-widest">{foot}</p>
      ) : null}
    </div>
  );
}

export default PortalPreview;
