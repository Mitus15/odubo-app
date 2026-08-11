/**
 * Email provider — behind an interface so the app never depends on a specific
 * sender. `EMAIL_MODE=mock` (default) logs to an in-memory outbox so flows are
 * testable with no account; `EMAIL_MODE=live` (with `RESEND_API_KEY`) sends via
 * Resend. Flipping the env var is the only change at handover.
 */

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
  constructor(private fromOverride: string | null = null) {}

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

export function getEmail(from: string | null = null): EmailProvider {
  return process.env.EMAIL_MODE === "live" && process.env.RESEND_API_KEY
    ? new ResendEmailProvider(from)
    : new MockEmailProvider();
}

/** The admin-set sender, if any (loop_settings.email_from). Falls back to env
 *  inside the provider, so an unset value changes nothing. */
export async function configuredSender(): Promise<string | null> {
  try {
    const { queryOne } = await import("@/lib/loop/db");
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM loop_settings WHERE key = 'email_from'`,
    );
    return row?.value?.trim() || null;
  } catch {
    return null;
  }
}

/** Deliver several codes (a multi-pass order) in ONE email — one per guest. */
export async function sendEventCodesEmail(
  to: string,
  codes: string[],
  eventTitle: string,
): Promise<{ ok: boolean }> {
  if (codes.length === 1) return sendEventCodeEmail(to, codes[0], eventTitle);
  return getEmail(await configuredSender()).send({
    to,
    subject: `Your ${codes.length} Loop Soul codes for ${eventTitle}`,
    text:
      `You're in for ${eventTitle} — ${codes.length} passes.\n\n` +
      `Your event codes (one per guest):\n\n` +
      codes.map((c) => `  ${c}`).join("\n") +
      `\n\nEach code admits one guest and unlocks the app on the night. ` +
      `Share one with every guest and keep yours handy.\n\n` +
      `Lost them? Look them up any time with this email address on the ` +
      `"Find your event code" page.`,
  });
}

/** Deliver an auto-issued event code to a buyer. */
export async function sendEventCodeEmail(
  to: string,
  code: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  return getEmail(await configuredSender()).send({
    to,
    subject: `Your Loop Soul code for ${eventTitle}`,
    text:
      `You're in for ${eventTitle}.\n\n` +
      `Your event code is ${code}.\n\n` +
      `It's your ticket at the door and it unlocks the app on the night. ` +
      `Keep it handy — and if you lose it, you can look it up any time with ` +
      `this email address on the "Find your event code" page.`,
  });
}
