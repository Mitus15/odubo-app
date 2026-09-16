import { executeQuery, queryOne } from "@/lib/loop/db";
import { otpPepper } from "@/lib/loop/recovery";
import { hashPassLinkToken, isPassLinkToken, newPassLinkToken } from "@/lib/loop/passLink";

/**
 * The claim link, the database part. See passLink.ts for the rule.
 *
 * `mintPassLink` is the ONLY place the plaintext token exists on the server,
 * for the duration of one function call; it is handed to the email and
 * forgotten. A link cannot be recovered afterwards, which is why a resend
 * revokes the old rows and mints again.
 */

export async function mintPassLink(eventId: string, code: string, now = Date.now()): Promise<string> {
  const token = newPassLinkToken();
  await executeQuery(
    `INSERT INTO loop_pass_links (token_hash, event_id, code, created_at) VALUES (?1, ?2, ?3, ?4)`,
    [await hashPassLinkToken(token, otpPepper()), eventId, code.trim().toUpperCase(), now],
  );
  return token;
}

export type PassLinkTarget = { eventId: string; code: string };

/** Resolve a token to its pass, counting the open. Null for anything unknown. */
export async function lookupPassLink(raw: string, now = Date.now()): Promise<PassLinkTarget | null> {
  if (!isPassLinkToken(raw)) return null;
  const hash = await hashPassLinkToken(raw, otpPepper());
  const row = await queryOne<{ event_id: string; code: string }>(
    `SELECT event_id, code FROM loop_pass_links WHERE token_hash = ?1`,
    [hash],
  );
  if (!row) return null;
  await executeQuery(
    `UPDATE loop_pass_links
        SET opens = opens + 1,
            first_opened_at = COALESCE(first_opened_at, ?2)
      WHERE token_hash = ?1`,
    [hash, now],
  ).catch(() => undefined);
  return { eventId: row.event_id, code: row.code };
}

/** Every link ever sent for this pass stops working. Called before a resend. */
export async function revokeLinksForCode(eventId: string, code: string): Promise<number> {
  const meta = await executeQuery(
    `DELETE FROM loop_pass_links WHERE event_id = ?1 AND code = ?2`,
    [eventId, code.trim().toUpperCase()],
  );
  return meta.changes;
}
