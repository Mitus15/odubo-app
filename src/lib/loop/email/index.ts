/**
 * Email provider — behind an interface so the app never depends on a specific
 * sender. `EMAIL_MODE=mock` (default) logs to an in-memory outbox so flows are
 * testable with no account; `EMAIL_MODE=live` (with `RESEND_API_KEY`) sends via
 * Resend. Flipping the env var is the only change at handover.
 */

import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { PRODUCT_NAME } from "@/lib/loop/brand";
import { factsLine } from "@/lib/loop/eventFacts";
import { renderPassEmail, type PassEmailFacts, type PassForEmail } from "@/lib/loop/email/passEmail";

export type EmailAttachment = {
  filename: string;
  /** Base64. */
  content: string;
  /** Set to embed it in the HTML as `cid:<id>`; it stays saveable as a file. */
  contentId?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  /** The plain part: every fact and every link, so a text-only client loses nothing. */
  text: string;
  /** The designed part, optional. */
  html?: string;
  /** Only the live provider sends them; the mock keeps them for inspection. */
  attachments?: EmailAttachment[];
};

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
          ...(msg.html ? { html: msg.html } : {}),
          ...(this.replyTo ? { reply_to: this.replyTo } : {}),
          ...(msg.attachments?.length
            ? {
                attachments: msg.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content,
                  ...(a.contentId ? { content_id: a.contentId } : {}),
                })),
              }
            : {}),
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
 * The pass email: the ticket, the night, the record.
 *
 * Four things, in that order, and nothing else (see passEmail.ts for the
 * words). The ticket is a real picture, inline, one per guest. The record is
 * one button whose link binds the phone that opens it, so there is nothing to
 * type. Every fact about the night is read from the event record; nothing is
 * spelled out in a literal here, because an email is the one artefact nobody
 * can correct after it is sent.
 */
export type PassToSend = Omit<PassForEmail, "cid">;

async function passFacts(): Promise<PassEmailFacts> {
  const base = (await getPublicBaseUrl()) ?? "";
  let line = "";
  let earlyCount: number | null = null;
  try {
    const [{ getCurrentEvent }, { earlyRule }] = await Promise.all([
      import("@/lib/loop/hub"),
      import("@/lib/loop/album"),
    ]);
    const [event, rule] = await Promise.all([getCurrentEvent(), earlyRule()]);
    line = factsLine(event);
    earlyCount = rule.enabled ? rule.extra + 1 : 0;
  } catch (err) {
    console.error("[loop:email] event unreadable, the email goes without the facts line:", err);
  }
  return { line, earlyCount, recordUrl: `${base}/loop/album` };
}

export async function sendPassEmail(to: string, passes: PassToSend[]): Promise<{ ok: boolean }> {
  const facts = await passFacts();
  const attachments = await ticketAttachments(passes);
  const withCids: PassForEmail[] = passes.map((p) => ({
    ...p,
    cid: attachments.find((a) => a.forCode === p.code)?.contentId ?? null,
  }));
  const { subject, text, html } = renderPassEmail(withCids, facts);
  return (await sender()).send({
    to,
    subject,
    text,
    html,
    attachments: attachments.map(({ filename, content, contentId }) => ({ filename, content, contentId })),
  });
}

/** The pass email as a buyer reads it, without sending. Used by the admin preview. */
export async function previewPassEmail(passes: PassToSend[]): Promise<{ subject: string; text: string; html: string }> {
  const facts = await passFacts();
  return renderPassEmail(
    passes.map((p) => ({ ...p, cid: null })),
    facts,
  );
}

/**
 * One ticket per pass, as a picture worth keeping.
 *
 * A code in a paragraph is not a ticket. This renders the real object: the
 * wordmark, the number, the night, the code large enough to read in a dark
 * courtyard, and the QR the door scans. It goes inline (the email shows it)
 * and stays a file (the phone saves it).
 *
 * Never fatal. If the render fails the email still goes with the number and
 * the code in the text, and a bare QR is attached instead so the door still
 * has something to scan. A missing picture is a disappointment; a missing
 * email is a guest at a door with nothing.
 */
async function ticketAttachments(
  passes: PassToSend[],
): Promise<{ filename: string; content: string; contentId: string; forCode: string }[]> {
  const base = await getPublicBaseUrl();
  const out: { filename: string; content: string; contentId: string; forCode: string }[] = [];

  let facts: { venue: string; theme: string; dateLabel: string; timeLabel: string } | null = null;
  try {
    const [{ getCurrentEvent }, { shortDate, clockTime }] = await Promise.all([
      import("@/lib/loop/hub"),
      import("@/lib/loop/eventFacts"),
    ]);
    const event = await getCurrentEvent();
    facts = {
      venue: event.venue,
      theme: event.theme,
      dateLabel: shortDate(event.date),
      timeLabel: clockTime(event.date),
    };
  } catch (err) {
    console.error("[loop:email] event unreadable, tickets fall back to a bare QR:", err);
  }

  for (const p of passes) {
    const filename = `loop-soul-ticket-${p.code}.png`;
    const contentId = `ticket-${p.index}`;
    if (facts) {
      try {
        const { renderTicketPng } = await import("@/lib/loop/ticketImage");
        const png = await renderTicketPng({
          code: p.code,
          serial: p.serial,
          baseUrl: base,
          eventTitle: PRODUCT_NAME,
          dateLabel: facts.dateLabel,
          timeLabel: facts.timeLabel,
          venue: facts.venue,
          theme: facts.theme,
          index: p.index,
          total: p.total,
        });
        out.push({ filename, content: png.toString("base64"), contentId, forCode: p.code });
        continue;
      } catch (err) {
        console.error(`[loop:email] ticket art failed for ${p.code}, falling back to a bare QR:`, err);
      }
    }
    try {
      const [{ default: QRCode }, { doorUrlFor }] = await Promise.all([
        import("qrcode"),
        import("@/lib/loop/door"),
      ]);
      const buf = await QRCode.toBuffer(base ? doorUrlFor(p.code, base) : p.code, {
        margin: 2,
        width: 480,
        color: { dark: "#2a0f0a", light: "#ffffff" },
      });
      out.push({ filename, content: buf.toString("base64"), contentId, forCode: p.code });
    } catch (err) {
      console.error(`[loop:email] no attachment at all for ${p.code}:`, err);
    }
  }
  return out;
}

/**
 * The six digits that prove an inbox. Sent when a buyer asks for their pass on
 * a device that has never held it; typing it back binds that device to them.
 * Short, because it is read on one phone and typed into another.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean }> {
  return (await sender()).send({
    to,
    subject: `${code} is your ${PRODUCT_NAME} number`,
    text: [
      `Your six digits are ${code}.`,
      ``,
      `Type it on the phone that asked for it and your pass will open there too.`,
      `It works for fifteen minutes. If you did not ask for this, ignore it; nothing changes.`,
      ``,
      `Odubo Studio`,
    ].join("\n"),
  });
}

/**
 * "It's out." Sent once per address that pre-ordered, by the release action.
 * `link` is a claim link for one of that address's passes, so the phone that
 * taps it is bound and the record simply plays; the caller falls back to the
 * plain album page when no pass of theirs can carry a link.
 */
export async function sendAlbumReleaseEmail(to: string, albumTitle: string, link: string): Promise<{ ok: boolean }> {
  const font = "Jost, Futura, 'Helvetica Neue', Arial, sans-serif";
  const subject = `${albumTitle} is out.`;
  return (await sender()).send({
    to,
    subject,
    text: [`${albumTitle} is out. It's yours.`, ``, `Play: ${link}`, ``, `Odubo Studio`].join("\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#d9aa7a;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#d9aa7a;"><tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;">
<tr><td align="center" style="font-family:${font};font-size:26px;font-weight:700;line-height:1.2;color:#2a0f0a;padding-bottom:8px;">${albumTitle} is out.</td></tr>
<tr><td align="center" style="font-family:${font};font-size:15px;line-height:1.5;color:#2a0f0a;padding-bottom:26px;">It's yours.</td></tr>
<tr><td align="center" style="padding-bottom:36px;"><a href="${link}" style="display:inline-block;background:#2a0f0a;color:#d9aa7a;font-family:${font};font-size:16px;font-weight:700;line-height:1;padding:17px 40px;border-radius:999px;text-decoration:none;">Play</a></td></tr>
<tr><td align="center" style="font-family:${font};font-size:11px;line-height:1.7;letter-spacing:0.16em;text-transform:uppercase;color:#2a0f0a;opacity:0.55;">Odubo Studio</td></tr>
</table></td></tr></table></body></html>`,
  });
}
