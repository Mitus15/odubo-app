import type { LoopEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { hasRoomAccess, roomHeads } from "@/lib/loop/doors";
import { codesHeldBy } from "@/lib/loop/event-codes";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getPublicCapacity } from "@/lib/loop/pass";
import { getRunOfShow } from "@/lib/loop/content-store";
import { earlyRule } from "@/lib/loop/album";
import { clockTime, shortDate } from "@/lib/loop/eventFacts";
import PortalGate from "@/components/loop/portal/PortalGate";
import PortalPreview from "@/components/loop/portal/PortalPreview";
import InRoom from "@/components/loop/portal/InRoom";

/**
 * STATE 2 — Tonight (live, pass gated).
 *
 * Locked: a ticket-holder enters their pass (see PortalGate); someone without
 * one is shown the night and sold a pass from the same sheet the poster uses.
 * Unlocked: the in-room home (InRoom): their ticket, their record, the head
 * count, what's on now, and the two full surfaces the night runs on: the
 * camera and the Wall.
 */
export async function PortalHome({ event }: { event: LoopEvent }) {
  const voterId = await currentVoterId();
  const [unlocked, runOfShow] = await Promise.all([hasRoomAccess(event.id, voterId), getRunOfShow(event.id)]);

  if (!unlocked) {
    // Someone arriving from a poster, a QR code or a friend's story lands
    // here. A bare code prompt tells them nothing about what they'd be buying,
    // so the night is shown in full underneath it — only participation is
    // gated, never the pitch.
    const [pass, capacity, early] = await Promise.all([getPassSettings(), getPublicCapacity(), earlyRule()]);
    return (
      <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
        <p className="loop-muted text-xs uppercase tracking-[0.3em]">Live · {event.venue}</p>
        <PortalGate
          offer={{
            capacity,
            checkoutUrl: pass.checkoutUrl,
            price: pass.price,
            currency: pass.currency,
            theme: event.theme,
            venue: event.venue,
            dateLabel: shortDate(event.date),
            timeLabel: clockTime(event.date),
            runOfShow,
            earlyCount: early.enabled ? early.extra + 1 : 0,
          }}
        />
        <PortalPreview runOfShow={runOfShow} />
      </main>
    );
  }

  // The ticket(s) on this phone (none on an open-doors night without a pass),
  // and the honest head count, which InRoom keeps polling.
  const [held, heads] = await Promise.all([
    codesHeldBy(event.id, voterId).catch(() => []),
    roomHeads(event.id).catch(() => 0),
  ]);

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
      <InRoom
        heads={heads}
        runOfShow={runOfShow}
        nowLabel={nowLabel}
        held={held.map((h) => ({ code: h.code, serial: h.serial }))}
      />
    </main>
  );
}

export default PortalHome;
