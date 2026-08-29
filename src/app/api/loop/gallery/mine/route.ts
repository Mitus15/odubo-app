import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { attendeeForVoter } from "@/lib/loop/identity";
import { ensureLoopGallery, listCreditedPhotos } from "@/lib/loop/wall/server";

/**
 * Your own shots, from the server.
 *
 * Deliberately NOT behind `hasRoomAccess`: this returns only rows already
 * credited to the caller's own attendee record, so the credit ledger IS the
 * authorisation — there is nothing here to gate that isn't already yours. It
 * also means your entries stay visible after the room closes, which is when
 * you most want to look at them.
 *
 * A device with no attendee (never redeemed a code) gets an empty list rather
 * than a 403: that is the honest answer, and the client merges it with the
 * on-device gallery either way.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "48", 10) || 48, 1), 60);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const attendee = await attendeeForVoter(voterId);
  if (!attendee) {
    return NextResponse.json(
      { photos: [], hasMore: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const gallery = await ensureLoopGallery(event);
  const photos = await listCreditedPhotos({
    attendeeId: attendee.id,
    galleryId: gallery.id,
    limit,
    offset,
  });

  return NextResponse.json(
    { photos, hasMore: photos.length >= limit },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
