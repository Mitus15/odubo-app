/**
 * Email provider — behind an interface so the app never depends on a specific
 * sender. `EMAIL_MODE=mock` (default) logs to an in-memory outbox so flows are
 * testable with no account; `EMAIL_MODE=live` (with `RESEND_API_KEY`) sends via
 * Resend. Flipping the env var is the only change at handover.
 */

import { getPublicBaseUrl } from "@/lib/loop/publicUrl";

export type EmailMessage = { to: string; subject: string; text: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ ok: boolean }>;
}

type SentEmail = EmailMessage & { at: number };
const globalForOutbox = globalThis as unknown as { __loopOutbox?: SentEmail[] };
const outbox: SentEmail[] = globalForOutbox.__loopOutbox ?? (globalForOutbox.__loopOutbox = []);

/** Inspectable record of what mock email "sent" — handy for tests/demos. */
export function mockOutbox(): SentEmail[] {
  return outbox;
}

class MockEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<{ ok: boolean }> {
    outbox.push({ ...msg, at: Date.now() });
    console.log(`[email:mock] → ${msg.to} · ${msg.subject}`);
    return { ok: true };
  }
}

/**
 * Live sender via Resend (https://resend.com). Reached only when
 * `EMAIL_MODE=live` AND `RESEND_API_KEY` is set (see `getEmail`), so by the time
 * we're here the creds exist. A failed send returns `{ ok: false }` (honest —
 * the webhook reports `delivered: false`) rather than silently pretending; it
 * does NOT fall back to the mock outbox, so a real miss is visible.
 */
class ResendEmailProvider implements EmailProvider {
  constructor(
    private fromOverride: string | null = null,
    private replyTo: string | null = null,
  ) {}

  async send(msg: EmailMessage): Promise<{ ok: boolean }> {
    // Sender precedence: admin setting (loop_settings.email_from) → Loop env →
    // odubo's shared env. It's a setting first because the sending domain is
    // expected to change (see docs/decisions/loop-soul-product-architecture.md)
    // and shouldn't need a deploy.
    const from =
      this.fromOverride || process.env.LOOP_RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error(
        "[loop:email:resend] LOOP_RESEND_FROM_EMAIL / RESEND_FROM_EMAIL are unset — cannot send.",
      );
      return { ok: false };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          ...(this.replyTo ? { reply_to: this.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[email:resend] send failed ${res.status}: ${detail}`);
        return { ok: false };
      }
      console.log(`[email:resend] → ${msg.to} · ${msg.subject}`);
      return { ok: true };
    } catch (err) {
      console.error("[email:resend] network error:", err);
      return { ok: false };
    }
  }
}

export function getEmail(
  from: string | null = null,
  replyTo: string | null = null,
): EmailProvider {
  const live = process.env.EMAIL_MODE === "live";
  const key = Boolean(process.env.RESEND_API_KEY);

  // Asking for live and getting mock is the worst of the three outcomes: the
  // outbox reports ok, the pass webhook reports delivered: true, and nobody
  // receives anything. Somebody set EMAIL_MODE deliberately, so a missing key
  // is a misconfiguration, not a reason to quietly pretend.
  if (live && !key) {
    console.error(
      "[loop:email] EMAIL_MODE=live but RESEND_API_KEY is unset. Refusing to send " +
        "rather than silently falling back to the mock outbox.",
    );
    return new BrokenEmailProvider();
  }
  return live ? new ResendEmailProvider(from, replyTo) : new MockEmailProvider();
}

/** Configured to send and unable to. Reports failure so callers see the truth. */
class BrokenEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<{ ok: boolean }> {
    console.error(`[loop:email] NOT SENT to ${msg.to}: no RESEND_API_KEY.`);
    return { ok: false };
  }
}

/** Both settings in one round trip, for the senders below. */
async function sender(): Promise<EmailProvider> {
  const [from, replyTo] = await Promise.all([configuredSender(), configuredReplyTo()]);
  return getEmail(from, replyTo);
}

/** The admin-set sender, if any (loop_settings.email_from). Falls back to env
 *  inside the provider, so an unset value changes nothing. */
export async function configuredSender(): Promise<string | null> {
  return settingOrNull("email_from");
}

/**
 * Where a reply goes (loop_settings.email_reply_to).
 *
 * Sending from a branded domain does not mean anyone can receive at it: that
 * needs inbound MX on the apex, and there is none. Without a reply-to, a buyer
 * who answers the code email is writing into a hole. This routes those replies
 * to a mailbox that exists, so the From line can stay the brand.
 */
export async function configuredReplyTo(): Promise<string | null> {
  return settingOrNull("email_reply_to");
}

async function settingOrNull(key: string): Promise<string | null> {
  try {
    const { queryOne } = await import("@/lib/loop/db");
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM loop_settings WHERE key = ?1`,
      [key],
    );
    return row?.value?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * What a buyer gets for five dollars.
 *
 * One email carrying everything needed to turn up and get in: the code, when
 * and where, what the night actually is, and the link. Written as one body for
 * one or many codes because a buyer with two passes and a buyer with one should
 * not receive two differently-worded emails, and the multi-pass version used to
 * drift from the single.
 *
 * The link is built from `public_base_url`, never typed: the printed URL has
 * moved once already and an email is the one artefact nobody can correct after
 * it is sent.
 */
async function codesBody(codes: string[], eventTitle: string): Promise<string> {
  const base = (await getPublicBaseUrl()) ?? "";
  const many = codes.length > 1;
  const lookup = base ? `${base}/loop/code` : "the Find your event code page";

  return [
    `You're in for ${eventTitle}.`,
    ``,
    many
      ? `Your ${codes.length} event codes, one per guest:`
      : `Your event code:`,
    ``,
    ...codes.map((c) => `    ${c}`),
    ``,
    many
      ? `Each code admits one guest. Share one with everybody coming.`
      : `It admits one guest.`,
    `Show it at the door, then enter it in the app to unlock the room.`,
    ``,
    `THE NIGHT`,
    ``,
    `Saturday 10 October, Scott's Inn & Suites, Kamloops. Outdoors, in the courtyard.`,
    ``,
    `From 6:30 it's a lounge. Fire pits, games, drinks, music. Come when you come.`,
    `At 8, the album. All fourteen tracks performed live, front to back, with Amen the DJ.`,
    `At 9, the floor opens. 80s until the lights come on.`,
    `Out by 10:30. 19+. Dress code is 80s.`,
    ``,
    `Your ticket is also a pre-order. If you want the album, it's yours when it lands.`,
    ``,
    `LOST THE CODE`,
    ``,
    `Look it up any time with this email address at ${lookup}. You don't need this message.`,
    ``,
    `ONE MORE THING`,
    ``,
    `The night is filmed and recorded, for the record and for promotion, so you may appear in it.`,
    `If you would rather not, tell anyone on the door and we'll keep you out of shot.`,
    `The entertainment room is a no-camera area all night.`,
    ``,
    base || "odubostudio.com/loop",
  ].join("\n");
}

/** Deliver several codes (a multi-pass order) in ONE email, one per guest. */
export async function sendEventCodesEmail(
  to: string,
  codes: string[],
  eventTitle: string,
): Promise<{ ok: boolean }> {
  return (await sender()).send({
    to,
    subject:
      codes.length > 1
        ? `Your ${codes.length} Loop Soul codes for ${eventTitle}`
        : `Your Loop Soul code for ${eventTitle}`,
    text: await codesBody(codes, eventTitle),
  });
}

/** Deliver an auto-issued event code to a buyer. */
export async function sendEventCodeEmail(
  to: string,
  code: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  return sendEventCodesEmail(to, [code], eventTitle);
}

