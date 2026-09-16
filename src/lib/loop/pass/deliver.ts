import { queryDatabase } from "@/lib/loop/db";
import { lookupCode } from "@/lib/loop/event-codes";
import { attendeeByEmail, attendeeForVoter } from "@/lib/loop/identity";
import { sendPassEmail, type PassToSend } from "@/lib/loop/email";
import { passLinkUrl } from "@/lib/loop/passLink";
import { mintPassLink, revokeLinksForCode } from "@/lib/loop/passLinks";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";

/**
 * Send somebody their pass: number, ticket, claim link, one email.
 *
 * Every send mints fresh links and revokes the old ones, so a resend from the
 * admin makes the previous email's buttons stop working. The webhook, the
 * admin's attach and resend, and the simulated purchase all come through
 * here, so there is exactly one place that decides what a pass email is.
 */
export async function deliverPassEmail(eventId: string, email: string, codes: string[]): Promise<{ ok: boolean }> {
  const base = await getPublicBaseUrl();
  if (!base) console.error("[loop:pass] public_base_url is unset; the claim links in this email will be relative.");

  const passes: PassToSend[] = [];
  for (const [i, code] of codes.entries()) {
    let link: string | null = null;
    try {
      await revokeLinksForCode(eventId, code);
      link = passLinkUrl(await mintPassLink(eventId, code), base ?? "");
    } catch (e) {
      console.error(`[loop:pass] no claim link for ${code}; the email carries the record's address instead:`, e);
    }
    const row = await lookupCode(eventId, code).catch(() => null);
    passes.push({ code, serial: row?.serial ?? null, link, index: i + 1, total: codes.length });
  }
  return sendPassEmail(email, passes);
}

/**
 * A claim link for the release email: the address's first pass that is either
 * unclaimed or already on one of this person's own phones. A pass a stranger
 * is holding is left alone here (the six digits are the way to take it back),
 * and when there is none to carry a link the caller sends the plain page.
 */
export async function releaseLinkFor(eventId: string, email: string): Promise<string | null> {
  const base = await getPublicBaseUrl();
  if (!base) return null;
  const rows = await queryDatabase<{ code: string; redeemed_by: string | null }>(
    `SELECT code, redeemed_by FROM event_codes WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2 ORDER BY created_at ASC`,
    [eventId, email.trim().toLowerCase()],
  );
  const owner = await attendeeByEmail(email);
  for (const r of rows) {
    if (r.redeemed_by) {
      const holder = await attendeeForVoter(r.redeemed_by);
      if (!owner || holder?.id !== owner) continue;
    }
    return passLinkUrl(await mintPassLink(eventId, r.code), base);
  }
  return null;
}
