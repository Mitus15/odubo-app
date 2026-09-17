import { getCurrentEvent } from "@/lib/loop/hub";
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

  return (
    <>
      <HubNav phaseLabel={event.phase === "live" ? "Tonight" : "Legacy"} />
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
