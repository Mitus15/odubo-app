import type { LoopEvent } from "@/lib/loop/hub";
import { currentVoterId, getAnthemState } from "@/lib/loop/anthem-server";
import { getSettings as getDanceyokeySettings } from "@/lib/loop/danceyokey";
import { hasRoomAccess } from "@/lib/loop/doors";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getRunOfShow } from "@/lib/loop/content-store";
import PortalGate from "@/components/loop/portal/PortalGate";
import PortalPreview from "@/components/loop/portal/PortalPreview";
import InRoom from "@/components/loop/portal/InRoom";

/**
 * STATE 2 — The Portal (live, event-code gated).
 *
 * Locked: a ticket-holder redeems their event code (see PortalGate). Unlocked:
 * the in-room home (InRoom) — occupancy, what's on now, and the two full
 * surfaces the night runs on: the camera and the Wall.
 */
export async function PortalHome({ event }: { event: LoopEvent }) {
  const voterId = await currentVoterId();
  const unlocked = await hasRoomAccess(event.id, voterId);

  if (!unlocked) {
    // Someone arriving from a poster, a QR code or a friend's story lands
    // here. A bare code prompt tells them nothing about what they'd be buying,
    // so the night is shown in full underneath it — only participation is
    // gated, never the pitch.
    const [pass, cap, runOfShow, anthem, dy] = await Promise.all([
      getPassSettings(),
      getPassCapacity(),
      getRunOfShow(event.id),
      getAnthemState(event, voterId),
      getDanceyokeySettings(),
    ]);
    return (
      <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
        <p className="loop-muted text-xs uppercase tracking-[0.3em]">Live · {event.venue}</p>
        <PortalGate
          checkoutUrl={pass.checkoutUrl}
          priceLabel={pass.price ? `$${Number(pass.price).toFixed(0)}` : null}
        />
        <PortalPreview
          runOfShow={runOfShow}
          sold={cap.sold}
          capacity={event.capacity}
          nominations={anthem.leaderboard.length}
          anthemStage={anthem.stage}
          danceyokeySpots={dy.spots}
        />
      </main>
    );
  }

  const [cap, runOfShow] = await Promise.all([getPassCapacity(), getRunOfShow(event.id)]);

  // What's on now: the last slot whose start time has passed, in venue time.
  const toMinutes = (t: string): number => {
    const m = t.match(/(\d{1,2})[:h.](\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (!m) return -1;
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    const mer = m[3]?.toLowerCase();
    if (mer?.startsWith("p") && h < 12) h += 12;
    if (mer?.startsWith("a") && h === 12) h = 0;
    // Bare times on an evening run of show mean p.m. (6:00 → 18:00).
    if (!mer && h < 12) h += 12;
    return h * 60 + min;
  };
  const venueNow = new Date().toLocaleTimeString("en-CA", {
    timeZone: "America/Vancouver",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowMin = Number(venueNow.slice(0, 2)) * 60 + Number(venueNow.slice(3, 5));
  const current = runOfShow
    .filter((i) => toMinutes(i.time) >= 0 && toMinutes(i.time) <= nowMin)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
    .at(-1);
  const nowLabel = current ? `${current.time} · ${current.title}` : null;

  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="loop-muted text-xs uppercase tracking-[0.3em]">Live · {event.venue}</p>
      <InRoom sold={cap.sold} runOfShow={runOfShow} nowLabel={nowLabel} />
    </main>
  );
}

export default PortalHome;
