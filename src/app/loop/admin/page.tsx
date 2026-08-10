import { getCurrentEvent, getCurrentPhase, type EventPhase } from "@/lib/loop/hub";
import { currentVoterId, resolveSeedTracks } from "@/lib/loop/anthem-server";
import { bracketSchedule, effectiveSchedule, getSeeds, stageNow } from "@/lib/loop/anthem-rounds";
import { leaderboard } from "@/lib/loop/anthem-candidates";
import { buildBracket, type Bracket } from "@/lib/loop/anthem";
import { voteStore } from "@/lib/loop/votes";
import { countRedeemed, gateMode } from "@/lib/loop/event-codes";
import { getRunOfShow } from "@/lib/loop/content-store";
import { getJournalIssue, getJournalMoments } from "@/lib/loop/journal-store";
import { mockOutbox } from "@/lib/loop/email";
import PhaseSwitcher from "./PhaseSwitcher";
import AdminLogout from "./AdminLogout";
import EventDetails from "./EventDetails";
import AnthemControls from "./AnthemControls";
import AnthemSim from "./AnthemSim";
import ContentEditor from "./ContentEditor";
import JournalEditor from "./JournalEditor";

/**
 * /admin — control surface for the (non-technical) marketing team. Gated by the
 * `ls_admin` session cookie in middleware (see admin-auth.ts); unauthenticated
 * hits are redirected to /admin/login. It flips the event phase, edits event
 * details + the Run of Show, and manages the anthem; it will grow into the full
 * dashboard (capacity, codes, moderation, curation) backed by D1.
 */
export default async function AdminPage() {
  const phase: EventPhase = await getCurrentPhase();
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  const now = Date.now();
  const outbox = mockOutbox();
  const emailMode = process.env.EMAIL_MODE === "live" ? "live" : "mock";

  // Every read the dashboard needs, issued together rather than in series.
  const [stage, schedule, rows, lockedSeedIds, gate, codeStats, runOfShow, journalIssue, journalMoments] = await Promise.all([
    stageNow(event, now),
    effectiveSchedule(event),
    leaderboard(event.id, voterId),
    getSeeds(event.id),
    gateMode(event.id),
    countRedeemed(event.id),
    getRunOfShow(event.id),
    getJournalIssue(event.id),
    getJournalMoments(event.id),
  ]);

  // Build the live bracket so the team can watch standings + the champion from
  // /admin (it's the same pure derivation the public page uses).
  let bracket: Bracket | null = null;
  if (stage === "bracket" || stage === "champion") {
    const [seeds, tallies, bracketAt] = await Promise.all([
      resolveSeedTracks(event.id),
      voteStore.getTallies(event.id),
      bracketSchedule(event),
    ]);
    bracket = buildBracket(seeds, tallies, bracketAt, now);
  }

  const anthemAdmin = {
    stage,
    schedule,
    rows,
    lockedSeedIds,
    gate,
    codeStats,
    serverNow: now,
    bracket,
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Loop Soul · Admin</h1>
        <AdminLogout />
      </div>
      <p className="mt-2 text-sm opacity-70">Marketing control surface.</p>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Event phase
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Switches what every visitor sees. Legacy stays reachable in all phases.
        </p>
        <PhaseSwitcher current={phase} />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Event details
        </h2>
        <p className="mt-1 text-sm opacity-70">
          The volume, theme, and venue shown on the poster. Changes show for every
          visitor on their next load.
        </p>
        <EventDetails
          initial={{ title: event.title, theme: event.theme, venue: event.venue }}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Soul Loop Anthem
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Lock the 8 seeds the crowd surfaced, manage round cutoffs, hide off-brand picks.
        </p>
        <AnthemControls {...anthemAdmin} />
      </section>

      {process.env.ENABLE_ANTHEM_SIM === "1" ? (
        <section className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
            Testing — simulate a session
          </h2>
          <p className="mt-1 text-sm opacity-70">
            Run a full 75-participant cycle (nominate → like → lock 8 → vote → champion) to watch
            the mechanism end-to-end. Reset when done. (Dev-only; hidden unless ENABLE_ANTHEM_SIM=1.)
          </p>
          <AnthemSim />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Night — Run of Show
        </h2>
        <p className="mt-1 text-sm opacity-70">
          One timeline = the program + the lineup. Edit times, segments, and the
          performer/links for each slot. Changes show on the page.
        </p>
        <ContentEditor runOfShow={runOfShow} />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Loop Journal {journalIssue?.published ? "(published)" : "(draft)"}
        </h2>
        <p className="mt-1 text-sm opacity-70">
          The volume&apos;s magazine at /loop/journal. The anthem result and the
          night recap print themselves; you curate the photography and the
          headline, then publish.{" "}
          <a href="/loop/journal" className="underline">
            Preview the issue ↗
          </a>
        </p>
        <JournalEditor initialIssue={journalIssue} initialMoments={journalMoments} />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Email outbox {emailMode === "live" ? "(live · Resend)" : "(mock)"}
        </h2>
        <p className="mt-1 text-sm opacity-70">
          {emailMode === "live"
            ? "Live mode — sends via Resend. This shows only what this server instance also captured locally."
            : "Mock mode — event-code emails are captured here instead of being sent, so you can watch the issue → email → redeem chain end-to-end."}
        </p>
        {outbox.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4 text-sm opacity-70">
            No emails yet. Use “Simulate a ticket purchase” (or a real checkout) to
            issue a code — it’ll appear here.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {outbox
              .slice()
              .reverse()
              .map((mail, i) => (
                <li
                  key={`${mail.at}-${i}`}
                  className="rounded-2xl border border-ink/15 bg-ink/5 px-5 py-3 text-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold">{mail.subject}</span>
                    <span className="shrink-0 text-xs opacity-60">
                      {new Date(mail.at).toLocaleString("en-CA", {
                        timeZone: "America/Vancouver",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs opacity-70">to {mail.to}</div>
                  <div className="mt-1 whitespace-pre-wrap opacity-80">{mail.text}</div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mt-12 text-sm opacity-60">
        <h2 className="text-sm font-bold uppercase tracking-widest">Coming here</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>Capacity & Get-Pass settings</li>
          <li>Event codes — generate & issue</li>
          <li>Portal photo submissions → Journal moderation queue</li>
          <li>Waitlist & reminders</li>
        </ul>
      </section>
    </main>
  );
}
