import ArcedTagline from "@/components/loop/brand/ArcedTagline";
import Lookbook from "@/components/loop/gathering/Lookbook";
import PortalGate from "@/components/loop/portal/PortalGate";
import WallGallery from "@/components/loop/wall/WallGallery";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { isHolder } from "@/lib/loop/event-codes";

/**
 * STATE 3 — Legacy (persistent content hub), rendered in "vault mode"
 * (oxblood field, sand ink).
 *
 * Iconic Moments — the admin-curated shots — are public: they're the series'
 * outward face. The full Vault (every Wall shot from the night) is for
 * attendees: media sharing is an in-the-room privilege, so it unlocks with the
 * same event code that opened the Portal.
 */
export async function LegacyHome() {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  const attendee = await isHolder(event.id, voterId);

  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">
        Loop Soul Legacy · The soul of Kamloops, kept
      </p>

      <div className="mt-10">
        <ArcedTagline text="What do you remember?" className="text-sand" />
      </div>

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
