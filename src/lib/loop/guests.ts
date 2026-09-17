import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { normEmail } from "@/lib/loop/album";

/**
 * The guest list: every real pass, who holds it, and what they agreed to.
 *
 * Built from what this site already holds, never from Shopify, so it does not
 * depend on a plan tier or on an API that strips the buyer out. The address
 * arrives through the pass sheet (see passIntent.ts); consent arrives through
 * the box beside it; admission arrives through the door.
 */

export type GuestRow = {
  code: string;
  email: string | null;
  orderId: string;
  mintedAt: string;
  redeemed: boolean;
  admittedAt: string | null;
  /** When they ticked "keep me posted". Null means no marketing to this address. */
  consentedAt: string | null;
  /** Where the consent came from: pass-sheet, waitlist. */
  consentSource: string | null;
  albumClaimedAt: string | null;
};

export async function listGuests(eventId: string): Promise<GuestRow[]> {
  const rows = await queryDatabase<{
    code: string;
    email: string | null;
    order_id: string;
    created_at: number;
    redeemed: number;
    admitted_at: string | null;
    consented_at: string | null;
    consent_source: string | null;
    claimed_at: string | null;
  }>(
    `SELECT c.code, c.email, c.order_id, c.created_at,
            (c.redeemed_by IS NOT NULL) AS redeemed, c.admitted_at,
            m.consented_at, m.source AS consent_source, e.claimed_at
       FROM event_codes c
       LEFT JOIN loop_marketing_consent m ON m.email = c.email AND m.withdrawn_at IS NULL
       LEFT JOIN loop_album_entitlements e ON e.email = c.email AND e.order_id = c.order_id
      WHERE c.event_id = ?1 AND c.order_id IS NOT NULL AND c.order_id NOT LIKE 'sim:%'
      ORDER BY c.created_at DESC`,
    [eventId],
  );
  return rows.map((r) => ({
    code: r.code,
    email: r.email,
    orderId: r.order_id,
    mintedAt: new Date(r.created_at).toISOString(),
    redeemed: r.redeemed === 1,
    admittedAt: r.admitted_at,
    consentedAt: r.consented_at,
    consentSource: r.consent_source,
    albumClaimedAt: r.claimed_at,
  }));
}

export type GuestStats = {
  /** Real passes sold. */
  sold: number;
  /** Of those, with an address we can reach. */
  withEmail: number;
  /** Let in at the door. */
  admitted: number;
  /** Addresses that may be written to: everyone who ticked the box, buyer or not. */
  list: number;
};

export async function guestStats(eventId: string): Promise<GuestStats> {
  const [c, m] = await Promise.all([
    queryOne<{ sold: number; with_email: number; admitted: number }>(
      `SELECT COUNT(*) AS sold, COUNT(email) AS with_email, COUNT(admitted_at) AS admitted
         FROM event_codes
        WHERE event_id = ?1 AND order_id IS NOT NULL AND order_id NOT LIKE 'sim:%'`,
      [eventId],
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM loop_marketing_consent WHERE withdrawn_at IS NULL`,
    ),
  ]);
  return { sold: c?.sold ?? 0, withEmail: c?.with_email ?? 0, admitted: c?.admitted ?? 0, list: m?.n ?? 0 };
}

/* ── consent ─────────────────────────────────────────────────────────────── */

/** First consent wins; a second tick keeps the earlier date, which is the one that matters. */
export async function recordConsent(eventId: string, email: string, source: string): Promise<void> {
  await executeQuery(
    `INSERT INTO loop_marketing_consent (email, event_id, source, consented_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(email) DO UPDATE SET withdrawn_at = NULL`,
    [normEmail(email), eventId, source, new Date().toISOString()],
  );
}

export type ConsentRow = { email: string; consentedAt: string; source: string | null };

/** Everyone who may be written to, buyer or not: the pass sheet's box and the waitlist. */
export async function listConsent(): Promise<ConsentRow[]> {
  const rows = await queryDatabase<{ email: string; consented_at: string; source: string | null }>(
    `SELECT email, consented_at, source FROM loop_marketing_consent
      WHERE withdrawn_at IS NULL ORDER BY consented_at DESC`,
  );
  return rows.map((r) => ({ email: r.email, consentedAt: r.consented_at, source: r.source }));
}

export async function withdrawConsent(email: string): Promise<void> {
  await executeQuery(
    `UPDATE loop_marketing_consent SET withdrawn_at = ?2 WHERE email = ?1 AND withdrawn_at IS NULL`,
    [normEmail(email), new Date().toISOString()],
  );
}

/* ── export ──────────────────────────────────────────────────────────────── */

/** RFC 4180: quote anything with a comma, quote, or newline; double the quotes. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function guestsCsv(rows: GuestRow[]): string {
  const head = ["code", "email", "order", "bought", "opened_app", "admitted", "marketing_consent", "source", "album_claimed"];
  const lines = rows.map((r) =>
    [r.code, r.email, r.orderId, r.mintedAt, r.redeemed, r.admittedAt, r.consentedAt, r.consentSource, r.albumClaimedAt]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}

/** The list a mail tool takes: one address per row, with when and where it was given. */
export function consentCsv(rows: ConsentRow[]): string {
  const head = ["email", "consented_at", "source"];
  const lines = rows.map((r) => [r.email, r.consentedAt, r.source].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
