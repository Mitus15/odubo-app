import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { leaderboard } from "@/lib/loop/anthem-candidates";
import { countRedeemed } from "@/lib/loop/event-codes";
import { getPassCapacity } from "@/lib/loop/pass";
import { listNotes } from "@/lib/loop/notes";
import StudioShell from "./StudioShell";

export const metadata = { title: "Loop Soul — Promoter Studio" };

/**
 * /loop/admin/studio — the promoter's whole workspace on one page: posters,
 * tickets, pricing, the numbers, and the thread, with the full written brief
 * tucked into the Playbook modal. Gated by middleware like every /loop/admin
 * path. This server shell does every read; the client shell does the rest.
 */
export default async function StudioPage() {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();

  const [capacity, codeStats, anthemRows, notes] = await Promise.all([
    getPassCapacity(),
    countRedeemed(event.id),
    leaderboard(event.id, voterId),
    listNotes(),
  ]);

  const dateLabel = new Date(event.date).toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <StudioShell
      facts={{
        title: event.title,
        theme: event.theme,
        venue: event.venue,
        dateLabel,
        capacity: capacity.total,
        sold: capacity.sold,
      }}
      stats={{
        sold: capacity.sold,
        total: capacity.total,
        redeemed: codeStats.redeemed,
        codes: codeStats.total,
        anthemEntries: anthemRows.length,
      }}
      notes={notes}
      eventDetails={{
        title: event.title,
        theme: event.theme,
        venue: event.venue,
        dateLabel: new Date(event.date).toLocaleDateString("en-CA", {
          timeZone: "America/Vancouver",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      }}
    />
  );
}
