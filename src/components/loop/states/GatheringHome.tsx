import type { LoopEvent } from "@/lib/loop/hub";
import { currentVoterId, getAnthemState } from "@/lib/loop/anthem-server";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getRunOfShow } from "@/lib/loop/content-store";
import { isJournalPublished } from "@/lib/loop/journal-server";
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
  const [anthem, capacity, runOfShow, passSettings, journalPublished] = await Promise.all([
    getAnthemState(event, voterId),
    getPassCapacity(),
    getRunOfShow(event.id),
    getPassSettings(),
    isJournalPublished(event.id),
  ]);

  // Formatted server-side so the venue's timezone is authoritative — not the
  // visitor's phone.
  const when = new Date(event.date);
  const dateLabel = when.toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    month: "short",
    day: "numeric",
  });
  const timeLabel = when.toLocaleTimeString("en-CA", {
    timeZone: "America/Vancouver",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <GatheringPoster
      event={event}
      capacity={capacity}
      anthem={anthem}
      runOfShow={runOfShow}
      checkoutUrl={passSettings.checkoutUrl}
      price={passSettings.price}
      currency={passSettings.currency}
      dateLabel={dateLabel}
      timeLabel={timeLabel}
      journalPublished={journalPublished}
    />
  );
}

export default GatheringHome;
