/**
 * Telling the owner a message arrived.
 *
 * Gmail is the doorbell, not the desk: the alert carries the first lines and
 * a link straight into the thread. The fan-out is a list of channel functions
 * so push (the owner's ask, once there is push infrastructure) and SMS slot in
 * as one function each.
 */

import { sendEmail } from '@/lib/email';
import { getSiteUrl } from '@/lib/env';
import { inboxAlertChannels, inboxAlertTo, inboxFrom, type AlertChannel } from './settings';
import { escapeHtml, snippet } from './text';
import type { InboxContact, InboxMessage, InboxThread } from './types';

export function adminThreadLink(thread: InboxThread): string {
  return `${getSiteUrl()}/admin/inbox?t=${thread.id}`;
}

type ChannelFn = (thread: InboxThread, contact: InboxContact, message: InboxMessage) => Promise<void>;

const email: ChannelFn = async (thread, contact, message) => {
  const to = await inboxAlertTo();
  if (!to) return;
  const who = contact.name ? `${contact.name} <${contact.email}>` : contact.email;
  const link = adminThreadLink(thread);
  const preview = snippet(message.body_text, 400);
  // Sent as the inbox address, which is on the verified domain. The app's
  // default sender (RESEND_FROM_EMAIL) still points at odubo.studio, which
  // Resend refuses, so the alert would silently fail from there.
  const res = await sendEmail({
    to,
    from: await inboxFrom(),
    subject: `${contact.name || contact.email}: ${snippet(message.body_text, 60)}`,
    text: `${who}\n${thread.subject ? `${thread.subject}\n` : ''}\n${message.body_text}\n\nAnswer it here:\n${link}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1716;max-width:560px;">
      <p style="margin:0 0 4px;font-size:13px;color:#6d6459;">${escapeHtml(who)}${thread.order_number ? ` · order #${escapeHtml(thread.order_number)}` : ''}</p>
      ${thread.subject ? `<p style="margin:0 0 12px;font-size:15px;font-weight:600;">${escapeHtml(thread.subject)}</p>` : ''}
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(preview)}</p>
      <p style="margin:0;"><a href="${link}" style="display:inline-block;padding:12px 22px;background:#843c2d;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">Answer in the inbox</a></p>
    </div>`,
  });
  if (!res.success) console.error('[inbox] owner alert failed:', res.error);
};

// Phase 2. Named now so the settings key already means something.
const push: ChannelFn = async () => {};
const sms: ChannelFn = async () => {};

const CHANNELS: Record<AlertChannel, ChannelFn> = { email, push, sms };

/** Never throws: an alert that fails must not fail the message that caused it. */
export async function notifyOwner(thread: InboxThread, contact: InboxContact, message: InboxMessage): Promise<void> {
  try {
    const channels = await inboxAlertChannels();
    await Promise.all(channels.map((c) => CHANNELS[c]?.(thread, contact, message)));
  } catch (err) {
    console.error('[inbox] notifyOwner:', err);
  }
}
