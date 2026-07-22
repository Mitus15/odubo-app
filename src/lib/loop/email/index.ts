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
  async send(msg: EmailMessage): Promise<{ ok: boolean }> {
    // Prefer a Loop-Soul-specific sender; fall back to odubo's shared one so
    // event-code emails never silently stop when only the shared var is set.
    const from = process.env.LOOP_RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
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

export function getEmail(): EmailProvider {
  return process.env.EMAIL_MODE === "live" && process.env.RESEND_API_KEY
    ? new ResendEmailProvider()
    : new MockEmailProvider();
}

/** Deliver an auto-issued event code to a buyer. */
export async function sendEventCodeEmail(
  to: string,
  code: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  return getEmail().send({
    to,
    subject: `Your Loop Soul code for ${eventTitle}`,
    text:
      `You're in for ${eventTitle}.\n\n` +
      `Your event code is ${code}.\n\n` +
      `It unlocks the room on the night, and lets you suggest a song for the ` +
      `Soul Loop Anthem at loopsoul.ca. Keep it handy.`,
  });
}
