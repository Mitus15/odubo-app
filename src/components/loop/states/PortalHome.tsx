import type { LoopEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { isHolder } from "@/lib/loop/event-codes";
import { getPassCapacity } from "@/lib/loop/pass";
import PortalGate from "@/components/loop/portal/PortalGate";
import PoseStudioShell from "@/components/loop/pose/PoseStudioShell";

/**
 * STATE 2 — The Portal (live, event-code gated).
 *
 * Locked: a ticket-holder redeems their event code (see PortalGate). Unlocked
 * (this `ls_voter` is a holder): the in-room experience — live occupancy and the
 * Pose Studio, with galleries/queue/live-program landing on top as they're built.
 */
export async function PortalHome({ event }: { event: LoopEvent }) {
  const voterId = await currentVoterId();
  const unlocked = await isHolder(event.id, voterId);

  if (!unlocked) {
    return (
      <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] opacity-70">Live · {event.venue}</p>
        <PortalGate />
      </main>
    );
  }

  const cap = await getPassCapacity();

  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">Live · {event.venue}</p>

      <div className="mt-10">
        <div className="font-sans text-6xl font-extrabold leading-none tabular-nums">
          {cap.sold}
        </div>
        <div className="mt-2 text-sm font-semibold uppercase tracking-widest opacity-70">
          In The Room
        </div>
      </div>

      <section className="mt-12 w-full">
        <PoseStudioShell wallEnabled />
      </section>
    </main>
  );
}

export default PortalHome;
