import { queryOne } from "@/lib/loop/db";
import { countAdmitted, countRedeemed, isHolder } from "@/lib/loop/event-codes";

/**
 * "Open doors" — treat everyone as a pass-holder, no code required.
 *
 * Two reasons this exists: building and testing the in-room experience without
 * burning codes, and real nights that are open to the room (a free volume, a
 * private party, the door being run on trust). Toggled from /loop/admin, so it
 * never needs a deploy — and it's visible there, so it can't be left on by
 * accident unnoticed.
 */
export async function doorsOpen(): Promise<boolean> {
  try {
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM loop_settings WHERE key = 'doors_open'`,
    );
    return row?.value === "1";
  } catch {
    return false;
  }
}

/**
 * The single question every gated surface should ask: may this person be in
 * the room? Either they redeemed a code, or the doors are open tonight.
 */
export async function hasRoomAccess(eventId: string, voterId: string): Promise<boolean> {
  if (await doorsOpen()) return true;
  if (!voterId || voterId === "anonymous") return false;
  return isHolder(eventId, voterId);
}

/**
 * How many people are in the room, for the people in it.
 *
 * When the door is being run from a phone, a head is a scan. When the doors
 * are open (trust mode: nobody scans), a head is a pass that has been entered
 * on a device, which is the nearest honest number. It was `countAdmitted` in
 * both cases, so an open-doors night read 0 all night.
 */
export async function roomHeads(eventId: string): Promise<number> {
  if (await doorsOpen()) return (await countRedeemed(eventId)).redeemed;
  return (await countAdmitted(eventId)).admitted;
}
