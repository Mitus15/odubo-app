import { lookupCode, orderUnitCount, takeCode } from "@/lib/loop/event-codes";
import { ensureAttendee, recordAttendance } from "@/lib/loop/identity";
import { parseUnitOrderId } from "@/lib/loop/passLink";
import { claimEmailIfUnowned, recoverForVerifiedOwner } from "@/lib/loop/recovery";

/**
 * What opening a claim link does to the phone that opened it.
 *
 * Two shapes of order, two bindings:
 *
 *   One pass on the address (nearly every order). The link is the buyer's, so
 *   it does exactly what the six digits do: bind this phone to the attendee
 *   who owns the email, hold every pass bought with it here, take back any of
 *   them a stranger is holding. `recoverForVerifiedOwner`, unchanged.
 *
 *   Several passes on one order. Each link is one ticket, and the tickets were
 *   bought for different people, so a link moves ONE code (take semantics, see
 *   `takeCode`) and never all of them. Only the buyer's own ticket, unit #1,
 *   may put the address on this phone's attendee: a friend's phone claiming
 *   the buyer's email would make the buyer unable to ever own it.
 *
 * Identity writes are best effort. A failure there must never cost somebody
 * the record they paid for.
 */
export async function claimPassOnDevice(eventId: string, code: string, voterId: string): Promise<boolean> {
  if (!voterId || voterId === "anonymous") return false;
  const row = await lookupCode(eventId, code);
  if (!row) return false;

  const unit = parseUnitOrderId(row.orderId);
  const units = unit ? await orderUnitCount(eventId, unit.order) : 1;

  if (row.email && units <= 1) {
    await recoverForVerifiedOwner(eventId, row.email, voterId);
    return true;
  }

  if (!(await takeCode(eventId, code, voterId))) return false;
  try {
    const me = await ensureAttendee(voterId);
    await recordAttendance(eventId, me.id, row.code);
    if (row.email && unit?.unit === 1) await claimEmailIfUnowned(row.email, voterId);
  } catch (e) {
    console.error("[loop:claim] pass held, identity not recorded:", e);
  }
  return true;
}
