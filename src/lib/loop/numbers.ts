import { queryOne } from "@/lib/loop/db";
import { loopGalleryCode } from "@/lib/loop/wall/server";

/**
 * The funnel, in six counts. Passes sold → claim links opened → records
 * claimed, and beside them the reach (gifts), the Wall, and the list. Real
 * sales only: simulated purchases (`sim:` orders) never count.
 */
export type LoopNumbers = {
  passesSold: number;
  linksOpened: number;
  recordsClaimed: number;
  giftsMinted: number;
  giftsOpened: number;
  wallShots: number;
  list: number;
};

const n = async (sql: string, params: (string | number)[] = []): Promise<number> =>
  (await queryOne<{ n: number }>(sql, params))?.n ?? 0;

export async function loopNumbers(eventId: string): Promise<LoopNumbers> {
  const real = `order_id IS NOT NULL AND order_id NOT LIKE 'sim:%'`;
  const [passesSold, linksOpened, recordsClaimed, giftsMinted, giftsOpened, wallShots, list] = await Promise.all([
    n(`SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND ${real}`, [eventId]),
    n(
      `SELECT COUNT(*) AS n FROM loop_pass_links l
         JOIN event_codes c ON c.event_id = l.event_id AND c.code = l.code
        WHERE l.event_id = ?1 AND l.first_opened_at IS NOT NULL AND c.${real}`,
      [eventId],
    ),
    n(
      `SELECT COUNT(*) AS n FROM loop_album_entitlements
        WHERE event_id = ?1 AND claimed_at IS NOT NULL AND (order_id IS NULL OR order_id NOT LIKE 'sim:%')`,
      [eventId],
    ),
    n(`SELECT COUNT(*) AS n FROM loop_gift_codes`),
    n(`SELECT COUNT(*) AS n FROM loop_gifts`),
    n(
      `SELECT COUNT(*) AS n FROM gallery_photos p JOIN galleries g ON g.id = p.gallery_id
        WHERE g.code = ?1 AND (p.moderated != 2 OR p.moderated IS NULL)`,
      [loopGalleryCode(eventId)],
    ),
    n(`SELECT COUNT(*) AS n FROM loop_marketing_consent WHERE withdrawn_at IS NULL`),
  ]);
  return { passesSold, linksOpened, recordsClaimed, giftsMinted, giftsOpened, wallShots, list };
}
