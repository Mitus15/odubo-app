/**
 * Email provider — behind an interface so the app never depends on a specific
 * sender. `EMAIL_MODE=mock` (default) logs to an in-memory outbox so flows are
 * testable with no account; `EMAIL_MODE=live` (with `RESEND_API_KEY`) sends via
 * Resend. Flipping the env var is the only change at handover.
 */

import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { RECORDING_NOTICE } from "@/lib/loop/content";

export type EmailMessage = {
  /** Base64 PNGs etc. Only the live provider sends them; the mock ignores them. */
  attachments?: { filename: string; content: string }[]; to: string; subject: string; text: string };

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
          ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
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
 * Written for somebody who has just paid and is looking at their phone for the
 * first time. The previous version told them to "enter it in the app to open
 * the room", which names two things that do not exist for a stranger — there
 * is no app, and "the room" is our word, not theirs — and then offered three
 * links for three different jobs without saying which one was for them now.
 * A buyer should never have to work out their own next step.
 *
 * So: ONE thing to do now, at the top, with the reward named. Then the night.
 * Then the ticket. Everything else is reference and sits underneath, quiet.
 *
 * Links are built from `public_base_url`, never typed: the printed URL has
 * moved once already and an email is the one artefact nobody can correct after
 * it is sent.
 */
async function codesBody(codes: string[], eventTitle: string, email: string | null): Promise<string> {
  const base = (await getPublicBaseUrl()) ?? "";
  const many = codes.length > 1;
  const site = base || "odubostudio.com";
  const listen = base ? `${base}/loop/album` : "odubostudio.com/loop/album";
  const lookup = base ? `${base}/loop/code` : "odubostudio.com/loop/code";
  const room = base ? `${base}/loop` : "odubostudio.com/loop";

  // Say how many songs they actually have, not a number that drifts from the
  // rule. Silent if the draw is off or the album cannot be read.
  let nowLine = `Some of the album is already yours to hear.`;
  try {
    const [{ earlyRule, earlySetFor, loadAlbum }, { getSetting }] = await Promise.all([
      import("@/lib/loop/album"),
      import("@/lib/loop/loopSetting"),
    ]);
    const [rule, album, featured] = await Promise.all([earlyRule(), loadAlbum(), getSetting("featured_track")]);
    if (rule.enabled && album && email) {
      const set = earlySetFor(email, album.tracks, featured, rule);
      const titles = album.tracks.filter((t) => set.includes(t.track_number));
      if (titles.length) {
        nowLine =
          titles.length === 1
            ? `${titles[0].title} is yours to hear right now.`
            : `${titles.length} songs are yours to hear right now: ${titles.map((t) => t.title).join(", ")}.`;
      }
    }
  } catch {
    /* the generic line is true either way */
  }

  return [
    `You're in for ${eventTitle}.`,
    ``,
    `START HERE`,
    ``,
    nowLine,
    `Open ${listen} and enter this email address. That's all it asks for.`,
    `The rest of the album lands in the same place after the night.`,
    ``,
    `YOUR TICKET`,
    ``,
    many
      ? `${codes.length} tickets are attached, one per guest. Send one to each person coming.`
      : `Your ticket is attached. Save it to your phone now, while you're thinking about it.`,
    `Show it at the door on the night and we scan it. ${many ? "Each one admits one guest, once." : "It admits one guest, once."}`,
    ``,
    many ? `Your passes:` : `If the picture ever goes missing, this is your pass:`,
    ...codes.map((c) => `    ${c}`),
    ``,
    `THE NIGHT`,
    ``,
    `Saturday 10 October, Scott's Inn & Suites, Kamloops. Outdoors, in the courtyard.`,
    ``,
    `From 6:30 it's a lounge. Fire pits, games, drinks, music. Come when you come.`,
    `At 8, the album. All fourteen tracks performed live, front to back, with Amen the DJ.`,
    `At 9, the floor opens. 80s until the lights come on.`,
    `Out by 10. 19+. Dress code is 80s.`,
    ``,
    `ON THE NIGHT, ON YOUR PHONE`,
    ``,
    `Type your pass in at ${room} and the night opens up: shoot through the Loop Soul`,
    `filter, put your shots on the gallery everyone in the room shares, and vote on the`,
    `album's cover and its running order. Nothing to install.`,
    ``,
    `IF YOU LOSE THIS EMAIL`,
    ``,
    `Everything above is findable at ${lookup} with this email address.`,
    `You don't need to keep this message.`,
    ``,
    `FILMING AND PHOTOGRAPHY`,
    ``,
    RECORDING_NOTICE.full,
    `If something of you is published and you want it down, write to us and we take it down.`,
    ``,
    site,
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
        ? `Your ${codes.length} Loop Soul passes for ${eventTitle}`
        : `Your Loop Soul pass for ${eventTitle}`,
    text: await codesBody(codes, eventTitle, to),
    attachments: await ticketAttachments(codes),
  });
}

/**
 * One ticket per pass, as a picture worth keeping.
 *
 * A code in a paragraph is not a ticket. This attaches the real object: the
 * wordmark, the night, the code large enough to read in a dark courtyard, and
 * the QR the door scans. An order for three passes gets three files, each
 * numbered "Guest 2 of 3", so the buyer knows which one to forward to whom.
 *
 * Never fatal. If the render fails the email still goes with the codes in the
 * text, and a bare QR is attached instead so the door still has something to
 * scan. A missing picture is a disappointment; a missing email is a guest at a
 * door with nothing.
 */
async function ticketAttachments(codes: string[]): Promise<{ filename: string; content: string }[]> {
  const base = await getPublicBaseUrl();
  const out: { filename: string; content: string }[] = [];

  let facts: { title: string; venue: string; theme: string; dateLabel: string; timeLabel: string } | null = null;
  try {
    const { getCurrentEvent } = await import("@/lib/loop/hub");
    const event = await getCurrentEvent();
    const when = new Date(event.date);
    const at = (opts: Intl.DateTimeFormatOptions) =>
      when.toLocaleString("en-CA", { timeZone: "America/Vancouver", ...opts });
    facts = {
      title: event.title,
      venue: event.venue,
      theme: event.theme,
      dateLabel: at({ weekday: "short", month: "short", day: "numeric" }),
      timeLabel: at({ hour: "numeric", minute: "2-digit" }),
    };
  } catch (err) {
    console.error("[loop:email] event unreadable, tickets fall back to a bare QR:", err);
  }

  for (const [i, code] of codes.entries()) {
    const filename = `loop-soul-ticket-${code}.png`;
    if (facts) {
      try {
        const { renderTicketPng } = await import("@/lib/loop/ticketImage");
        const png = await renderTicketPng({
          code,
          baseUrl: base,
          eventTitle: facts.title,
          dateLabel: facts.dateLabel,
          timeLabel: facts.timeLabel,
          venue: facts.venue,
          theme: facts.theme,
          index: i + 1,
          total: codes.length,
        });
        out.push({ filename, content: png.toString("base64") });
        continue;
      } catch (err) {
        console.error(`[loop:email] ticket art failed for ${code}, falling back to a bare QR:`, err);
      }
    }
    try {
      const [{ default: QRCode }, { doorUrlFor }] = await Promise.all([
        import("qrcode"),
        import("@/lib/loop/door"),
      ]);
      const buf = await QRCode.toBuffer(base ? doorUrlFor(code, base) : code, {
        margin: 2,
        width: 480,
        color: { dark: "#2a0f0a", light: "#ffffff" },
      });
      out.push({ filename, content: buf.toString("base64") });
    } catch (err) {
      console.error(`[loop:email] no attachment at all for ${code}:`, err);
    }
  }
  return out;
}

/** The pass email as a buyer reads it, without sending. Used by the admin preview. */
export async function previewCodesEmail(
  codes: string[],
  eventTitle: string,
  email: string | null,
): Promise<string> {
  return codesBody(codes, eventTitle, email);
}

/** Deliver an auto-issued event code to a buyer. */
export async function sendEventCodeEmail(
  to: string,
  code: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  return sendEventCodesEmail(to, [code], eventTitle);
}

/**
 * The six digits that prove an inbox. Sent when a buyer asks for their pass on
 * a device that has never held it; typing it back binds that device to them.
 * Short, because it is read on one phone and typed into another.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean }> {
  return (await sender()).send({
    to,
    subject: `${code} is your Loop Soul number`,
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

/** "It's out." Sent once per address that pre-ordered, by the release action. */
export async function sendAlbumReleaseEmail(to: string, albumTitle: string): Promise<{ ok: boolean }> {
  const base = (await getPublicBaseUrl()) ?? "";
  const link = base ? `${base}/loop/album` : "odubostudio.com/loop/album";
  return (await sender()).send({
    to,
    subject: `${albumTitle} is out. It's yours.`,
    text: [
      `${albumTitle} is out.`,
      ``,
      `You pre-ordered it with your pass, so it is yours: ${link}`,
      `Prove it's you with this email address and press play. No account, no password.`,
      ``,
      `Odubo Studio`,
    ].join("\n"),
  });
}
