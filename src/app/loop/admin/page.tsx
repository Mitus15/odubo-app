import { getCurrentEvent, getCurrentPhase, type EventPhase } from "@/lib/loop/hub";
import { getRunOfShow } from "@/lib/loop/content-store";
import { guestStats } from "@/lib/loop/guests";
import { getJournalIssue, getJournalMoments } from "@/lib/loop/journal-store";
import { mockOutbox } from "@/lib/loop/email";
import PhaseSwitcher from "./PhaseSwitcher";
import AdminLogout from "./AdminLogout";
import EventDetails from "./EventDetails";
import ContentEditor from "./ContentEditor";
import DoorsToggle from "./DoorsToggle";
import EventCodes from "./EventCodes";
import JournalEditor from "./JournalEditor";
import PassSettings from "./PassSettings";
import BallotControls from "./BallotControls";
import WallModeration from "./WallModeration";
import AlbumRelease from "./AlbumRelease";

/**
 * /admin — control surface for the (non-technical) marketing team. Gated by the
 * `ls_admin` session cookie in middleware (see admin-auth.ts); unauthenticated
 * hits are redirected to /admin/login. It flips the event phase, edits event
 * details + the Run of Show; it will grow into the full
 * dashboard (capacity, codes, moderation, curation) backed by D1.
 */
export default async function AdminPage() {
  const phase: EventPhase = await getCurrentPhase();
  const event = await getCurrentEvent();
  const outbox = mockOutbox();
  const emailMode = process.env.EMAIL_MODE === "live" ? "live" : "mock";

  // Every read the dashboard needs, issued together rather than in series.
  const [runOfShow, journalIssue, journalMoments, guests] = await Promise.all([
    getRunOfShow(event.id),
    getJournalIssue(event.id),
    getJournalMoments(event.id),
    guestStats(event.id),
  ]);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Loop Soul · Admin</h1>
        <AdminLogout />
      </div>
      <p className="mt-2 text-sm opacity-70">
        The owner&apos;s console. Everything here changes the live site.
      </p>

      <a
        href="/loop/admin/studio"
        className="mt-4 block rounded-2xl border border-ink bg-ink px-5 py-4 text-sand"
      >
        <span className="block font-bold">Promoter Studio →</span>
        <span className="block text-sm opacity-80">
          The one-page workspace — posters, tickets, pricing, numbers, the Playbook,
          and the thread.
        </span>
      </a>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Event phase
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Switches what every visitor sees. Legacy stays reachable in all phases.
        </p>
        <PhaseSwitcher current={phase} />
        <DoorsToggle />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Event details
        </h2>
        <p className="mt-1 text-sm opacity-70">
          The volume, theme, venue and capacity shown on the poster. Changes show
          for every visitor on their next load.
        </p>
        <EventDetails
          initial={{
            title: event.title,
            theme: event.theme,
            venue: event.venue,
            capacity: String(event.capacity),
          }}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Pass sales
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Sell passes through the store checkout. Each paid pass emails the
          buyer an event code automatically — the code is the ticket.
        </p>
        <PassSettings />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">The ballots</h2>
        <p className="mt-1 text-sm opacity-70">
          The tracklist vote and the cover vote — the room&apos;s say in the record.
        </p>
        <div className="mt-4">
          <BallotControls />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Door
        </h2>
        <p className="mt-1 text-sm opacity-70">
          On the night, this is the phone at the door. It scans ticket QRs,
          admits a pass once, and counts heads against passes sold.
        </p>
        <a
          href="/loop/admin/door"
          className="mt-4 block rounded-2xl border border-ink bg-ink px-5 py-4 font-bold text-sand"
        >
          Open the door →
        </a>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Guests
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Your list, from your traffic. Built from the pass sheet, the ledger and
          the door, never from Shopify. Marketing consent is what people ticked;
          the pass and the album never needed it.
        </p>
        <dl className="mt-4 divide-y divide-ink/10 border-y border-ink/10 text-sm">
          {(
            [
              ["Passes sold", guests.sold],
              ["With an address", guests.withEmail],
              ["Said keep me posted", guests.list],
              ["Through the door", guests.admitted],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between py-2.5">
              <dt className="opacity-70">{k}</dt>
              <dd className="font-extrabold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <a
          href="/api/loop/admin/guests?format=csv"
          className="mt-4 block rounded-2xl border border-ink bg-ink px-5 py-4 text-center font-bold text-sand"
        >
          Export the list (CSV)
        </a>
        {/* The email is the only part of the product you cannot check by
            visiting a page, and it is the part a buyer reads first. */}
        <a
          href="/api/loop/admin/preview-pass"
          className="mt-2 block text-center text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4 opacity-60"
        >
          Read the pass email as a buyer gets it ↗
        </a>
        <p className="mt-2 text-xs opacity-60">
          One row per pass: code, email, order, bought, opened the app, admitted,
          marketing consent, album claimed. Only write marketing to the rows with
          consent.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Event codes
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Mint pass codes for the door. Each code unlocks the Portal (and the
          Wall) once, for one guest.
        </p>
        <EventCodes />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Wall — moderation &amp; Iconic Moments
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Approve or hide guest shots as they land; ✦ features a shot into
          Iconic Moments — the public face of Legacy.
        </p>
        <WallModeration />
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Poster Studio
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Marketing posters from the brand figures, your own art, or a Wall
          shot — with a QR back to the app. Print, feed, and story sizes.
        </p>
        <a
          href="/loop/admin/posters"
          className="mt-4 block rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4 font-bold"
        >
          Open Poster Studio →
        </a>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          The Record
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Every pass is a pre-order, written down here at purchase. When the
          album is out, release it: the page at /loop/album opens for everyone
          owed it, and each address is told once by email.
        </p>
        <AlbumRelease />
      </section>

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
          The volume&apos;s magazine at /loop/journal. The night recap prints
          itself; you curate the photography and the headline, then publish.{" "}
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
          <li>Portal photo submissions → Journal moderation queue</li>
          <li>Waitlist & reminders</li>
        </ul>
      </section>
    </main>
  );
}
