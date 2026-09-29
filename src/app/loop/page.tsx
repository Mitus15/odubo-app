import { redirect } from "next/navigation";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getFeaturedSingle } from "@/lib/loop/single";
import { isThisSingle, SINGLE_PATH } from "@/lib/loop/singlePage";
import HubNav from "@/components/loop/shell/HubNav";
import GatheringHome from "@/components/loop/states/GatheringHome";
import PortalHome from "@/components/loop/states/PortalHome";
import LegacyHome from "@/components/loop/states/LegacyHome";
import VaultMode from "@/components/loop/shell/VaultMode";

/**
 * The single-URL home. Renders the experience for the current event phase.
 * The Gathering is a full-bleed poster (its own header + logo, no nav chrome).
 * Tonight/Legacy keep the persistent nav. Legacy is always reachable.
 */
export default async function Home() {
  const event = await getCurrentEvent();

  if (event.phase === "pre") {
    return <GatheringHome event={event} />;
  }

  // Archived before it happened (2026-09-29: the Oct 10 night was called off,
  // the album rolls out on film instead). Legacy speaks to people who were in
  // the room, and nobody was, so the front door is the single. Guarded: the
  // single page sends an unplayable single back here.
  if (event.phase === "archived") {
    const single = await getFeaturedSingle().catch(() => null);
    if (single && isThisSingle(single.title)) redirect(SINGLE_PATH);
  }

  return (
    <>
      <HubNav phase={event.phase} />
      {event.phase === "live" && <PortalHome event={event} />}
      {event.phase === "archived" && (
        <>
          {/* /loop/legacy renders the same page in vault mode; without the
              flip here the archived front door was sand text on a sand field. */}
          <VaultMode />
          <LegacyHome />
        </>
      )}
    </>
  );
}
