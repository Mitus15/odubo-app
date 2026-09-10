import { NextResponse } from "next/server";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { queryOne, executeQuery } from "@/lib/loop/db";
import { ensureAttendee } from "@/lib/loop/identity";
import { loopGalleryCode } from "@/lib/loop/wall/server";

/**
 * "Make this my cover."
 *
 * Keyed on the attendee rather than the device, so the choice follows a person
 * to a new phone once they've claimed — the same rule photo credits follow.
 *
 * The uid is validated against THIS volume's Wall and must still be visible: a
 * cover is a claim about a photograph, and it must not be possible to point one
 * at something hidden, deleted, or belonging to another volume.
 */

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { uid?: string } | null;
  const uid = body?.uid?.trim();
  if (!uid)
    return NextResponse.json({ error: "uid required" }, { status: 400 });

  const voterId = await currentVoterId();
  if (voterId === "anonymous") {
    return NextResponse.json(
      { error: "No device identity yet." },
      { status: 400 },
    );
  }

  const event = await getCurrentEvent();
  const shot = await queryOne<{ uid: string }>(
    `SELECT p.uid FROM gallery_photos p
       JOIN galleries g ON g.id = p.gallery_id
      WHERE g.code = ?1 AND p.uid = ?2 AND (p.moderated != 2 OR p.moderated IS NULL)`,
    [loopGalleryCode(event.id), uid],
  );
  if (!shot) {
    return NextResponse.json(
      { error: "That shot isn't on the Wall." },
      { status: 404 },
    );
  }

  const me = await ensureAttendee(voterId);
  await executeQuery(
    `INSERT INTO loop_cover_choices (attendee_id, event_id, photo_uid)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(attendee_id, event_id) DO UPDATE SET photo_uid = ?3, chosen_at = CURRENT_TIMESTAMP`,
    [me.id, event.id, uid],
  );
  return NextResponse.json({ success: true, uid });
}

/** Back to the owner's version. */
export async function DELETE() {
  const voterId = await currentVoterId();
  if (voterId === "anonymous") {
    return NextResponse.json(
      { error: "No device identity yet." },
      { status: 400 },
    );
  }
  const event = await getCurrentEvent();
  const me = await ensureAttendee(voterId);
  await executeQuery(
    `DELETE FROM loop_cover_choices WHERE attendee_id = ?1 AND event_id = ?2`,
    [me.id, event.id],
  );
  return NextResponse.json({ success: true });
}
