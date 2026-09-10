import { queryOne } from "@/lib/loop/db";
import { getSetting } from "@/lib/loop/loopSetting";
import {
  attendeeForVoter,
  CREDIT_EXPR,
  CREDIT_JOIN,
} from "@/lib/loop/identity";
import { getFeaturedSingle } from "@/lib/loop/single";
import { loopGalleryCode, publicUrlFor } from "@/lib/loop/wall/server";

/**
 * Which cover this person sees.
 *
 * The album's cover is FLUID (owner, 2026-09-08). The artwork that ships is the
 * owner's version and stays his version; anyone in the room can hold their own;
 * the ballot decides which one is OFFICIAL and goes to streaming. So there is
 * no single answer to "what is the cover" — there is an answer per person, and
 * this resolves it.
 *
 * Precedence, most personal first:
 *   1. mine     — a shot this attendee chose (survives a new phone: keyed on
 *                 the attendee, so it follows a claim across devices)
 *   2. official — what the room voted, once the owner sets it
 *   3. owner    — the artwork on the record today
 *
 * FAILS LOUD. If a chosen or official uid points at a photo that has been
 * hidden or deleted, this logs and falls back to the owner's version WITHOUT
 * the badge — never silently swapping in a different photo and still calling it
 * official. A cover that lies about whose it is would be worse than no cover:
 * the credit under it is what someone gets paid on.
 */

export type CoverKind = "mine" | "official" | "owner";

export type ResolvedCover = {
  url: string | null;
  kind: CoverKind;
  /** Who took it — null for the owner's own artwork. */
  credit: string | null;
  /** The Wall photo behind it, when it came from the room. */
  uid: string | null;
};

/** The loop_settings key holding the room's decision for a volume. */
export const officialCoverKey = (eventId: string) =>
  `official_cover:${eventId}`;

type Shot = { uid: string; r2_key: string; credit: string | null };

/** A Wall shot for this volume that is still visible. Null if it is not. */
async function visibleShot(eventId: string, uid: string): Promise<Shot | null> {
  return queryOne<Shot>(
    `SELECT p.uid, p.r2_key, ${CREDIT_EXPR} AS credit
       FROM gallery_photos p
       JOIN galleries g ON g.id = p.gallery_id
       ${CREDIT_JOIN}
      WHERE g.code = ?1 AND p.uid = ?2 AND (p.moderated != 2 OR p.moderated IS NULL)`,
    [loopGalleryCode(eventId), uid],
  );
}

export async function resolveCover(
  eventId: string,
  voterId: string,
): Promise<ResolvedCover> {
  const ownerArt = await getFeaturedSingle();
  const owner: ResolvedCover = {
    url: ownerArt?.coverUrl ?? null,
    kind: "owner",
    credit: null,
    uid: null,
  };

  // 1 — theirs, if they have chosen one.
  try {
    if (voterId && voterId !== "anonymous") {
      const me = await attendeeForVoter(voterId);
      if (me) {
        const choice = await queryOne<{ photo_uid: string }>(
          `SELECT photo_uid FROM loop_cover_choices WHERE attendee_id = ?1 AND event_id = ?2`,
          [me.id, eventId],
        );
        if (choice) {
          const shot = await visibleShot(eventId, choice.photo_uid);
          if (shot) {
            return {
              url: publicUrlFor(shot.r2_key),
              kind: "mine",
              credit: shot.credit,
              uid: shot.uid,
            };
          }
          console.error(
            `[loop:cover] attendee ${me.id} has chosen ${choice.photo_uid}, which is missing or hidden. ` +
              `Falling back to the owner's version.`,
          );
        }
      }
    }
  } catch (e) {
    console.error("[loop:cover] could not resolve a personal cover:", e);
  }

  // 2 — the room's, once it has decided.
  try {
    const officialUid = await getSetting(officialCoverKey(eventId));
    if (officialUid) {
      const shot = await visibleShot(eventId, officialUid);
      if (shot) {
        return {
          url: publicUrlFor(shot.r2_key),
          kind: "official",
          credit: shot.credit,
          uid: shot.uid,
        };
      }
      console.error(
        `[loop:cover] official_cover for ${eventId} is ${officialUid}, which is missing or hidden. ` +
          `Showing the owner's version and NOT calling it official.`,
      );
    }
  } catch (e) {
    console.error("[loop:cover] could not resolve the official cover:", e);
  }

  // 3 — his.
  return owner;
}

/** The line under the artwork. Says whose it is, which is the whole point. */
export function coverCaption(cover: ResolvedCover): string {
  if (cover.kind === "mine") {
    return cover.credit
      ? `Your cover · shot by ${cover.credit}`
      : "Your cover, from the room.";
  }
  if (cover.kind === "official") {
    return cover.credit
      ? `The official cover · shot by ${cover.credit}`
      : "The official cover, chosen by the room.";
  }
  // An invitation, not just a statement — this line is tappable and it is the
  // shortest route from hearing the record to entering the contest.
  return "This cover is mine. Make yours →";
}
