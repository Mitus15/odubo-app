import Link from "next/link";
import ArcedTagline from "@/components/loop/brand/ArcedTagline";
import Lookbook from "@/components/loop/gathering/Lookbook";
import PortalGate from "@/components/loop/portal/PortalGate";
import WallGallery from "@/components/loop/wall/WallGallery";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { hasRoomAccess } from "@/lib/loop/doors";
import { isJournalPublished } from "@/lib/loop/journal-server";
// Used in the non-attendee branch below. It was missing, so /loop/legacy threw
// a ReferenceError for every visitor without a pass — i.e. the entire public,
// which is the audience the page exists for. `ignoreBuildErrors` + `--no-lint`
// meant the build never said a word.
import { getPassSettings } from "@/lib/loop/pass/settings";

/**
 * STATE 3 — Legacy (persistent content hub), rendered in "vault mode"
 * (oxblood field, sand ink).
 *
 * Three things live here, in order of how public they are. The Loop Journal
 * (the per-volume magazine) and Iconic Moments (the shots that became posters)
 * are the outward face. The full Vault — every Wall shot from the night — is
 * for attendees: media sharing is an in-the-room privilege, so it unlocks with
 * the same event code that opened the Portal.
 */
export async function LegacyHome() {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  const [attendee, published] = await Promise.all([
    hasRoomAccess(event.id, voterId),
    isJournalPublished(event.id),
  ]);

  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">
        Loop Soul Legacy · The soul of Kamloops, kept
      </p>

      <div className="mt-10">
        <ArcedTagline text="What do you remember?" className="text-sand" />
      </div>

      <section className="mt-12 w-full max-w-md text-left">
        <Link
          href="/loop/journal"
          className="block rounded-2xl border border-sand/40 bg-sand/10 px-5 py-4 transition-colors hover:bg-sand/15"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold">The Loop Journal</span>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              {published ? `Read ${event.title} ↗` : "In print ↗"}
            </span>
          </div>
          <div className="text-sm opacity-70">
            One issue per volume — the anthem, the iconic moments, the night that was.
          </div>
        </Link>
      </section>

      <section className="mt-12 w-full max-w-md text-left">
        <h2 className="text-xs uppercase tracking-[0.3em] opacity-70">Iconic Moments</h2>
        <p className="mt-1 text-sm opacity-70">The shots that became posters.</p>
        <div className="mt-4">
          <WallGallery featuredOnly />
        </div>
      </section>

      <section className="mt-14 w-full max-w-md text-left">
        <h2 className="text-xs uppercase tracking-[0.3em] opacity-70">The Vault</h2>
        <p className="mt-1 text-sm opacity-70">
          Every shot from the Wall — {event.title}.
        </p>
        {attendee ? (
          <div className="mt-4">
            <WallGallery />
          </div>
        ) : (
          <PortalGate
            tone="vault"
            title="Were you in the room?"
            copy="The Vault is for attendees. Your event code unlocks every shot from the night."
            cta="Unlock the Vault"
            checkoutUrl={(await getPassSettings()).checkoutUrl}
          />
        )}
      </section>

      <section className="mt-14 w-full max-w-2xl text-left">
        <Lookbook />
      </section>
    </main>
  );
}

export default LegacyHome;
