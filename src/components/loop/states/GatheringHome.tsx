import type { LoopEvent } from "@/lib/loop/hub";
import { currentVoterId, getAnthemState } from "@/lib/loop/anthem-server";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getRunOfShow } from "@/lib/loop/content-store";
import GatheringPoster from "@/components/loop/gathering/GatheringPoster";

/**
 * STATE 1 — The Gathering. A single non-scrolling poster (real logo, silhouette
 * hero, Scott's Inn footer) with Anthem / The Night opening as modules. Data is
 * read from the lib layer server-side, then handed to the client poster.
 * (The Lookbook component is built but not yet rendered anywhere — see
 * docs/TODO.md; intended for the Legacy vault.)
 */
export async function GatheringHome({ event }: { event: LoopEvent }) {
  const voterId = await currentVoterId();
  const [anthem, capacity, runOfShow, passSettings] = await Promise.all([
    getAnthemState(event, voterId),
    getPassCapacity(),
    getRunOfShow(event.id),
    getPassSettings(),
  ]);

  return (
    <GatheringPoster
      event={event}
      capacity={capacity}
      anthem={anthem}
      runOfShow={runOfShow}
      checkoutUrl={passSettings.checkoutUrl}
    />
  );
}

export default GatheringHome;
