/**
 * Outbound mail for the inbox: the acknowledgement when a thread opens, and
 * every reply the owner sends.
 *
 * Three headers do the work. `Reply-To` is the thread's plus-address, so a
 * plain reply in any mail app carries the thread key back. `Message-ID` is
 * ours, so `In-Reply-To` on the customer's reply can be matched. And
 * `In-Reply-To` / `References` point at what the customer last sent, so their
 * mail app files our reply under the same conversation.
 */

import { sendEmail, emailWrapper, ctaButton } from '@/lib/email';
import { getSiteUrl } from '@/lib/env';
import { inboxFrom } from './settings';
import { escapeHtml, outboundMessageId, plusAddress, textToHtml } from './text';
import { appendMessage, lastMessageIds, setMessageDelivery, updateThread } from './threads';
import type { InboxContact, InboxMessage, InboxThread } from './types';

export function threadLink(thread: InboxThread): string {
  return `${getSiteUrl()}/messages/${thread.token}`;
}

function firstName(contact: InboxContact): string {
  return (contact.name || '').trim().split(/\s+/)[0] || 'there';
}

/**
 * Sent once, when the store form opens a thread. Carries the customer's own
 * words back to them, the link to the conversation, and the reply key.
 */
export async function sendAcknowledgement(thread: InboxThread, contact: InboxContact, message: InboxMessage): Promise<void> {
  const from = await inboxFrom();
  const messageId = outboundMessageId(`ack-${thread.id}`, from);
  const link = threadLink(thread);
  const html = emailWrapper(
    `<h2 style="margin:0 0 12px;font-size:22px;color:#171616;">We have your message.</h2>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${escapeHtml(firstName(contact))}, it is in front of us. You will hear back within a day or two.</p>
     <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6d6459;">You wrote</p>
     <div style="margin:0 0 20px;padding:0 0 0 14px;border-left:2px solid #843c2d;color:#1a1716;">${textToHtml(message.body_text)}</div>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">Reply to this email, or keep the conversation here:</p>
     <p style="margin:0 0 8px;">${ctaButton(link, 'Open the conversation')}</p>`,
    'We have your message.',
  );
  const text = `Hi ${firstName(contact)},\n\nWe have your message. You will hear back within a day or two.\n\nYou wrote:\n${message.body_text}\n\nReply to this email, or keep the conversation here:\n${link}\n\nOdubo Studio`;

  const res = await sendEmail({
    to: contact.email,
    from,
    replyTo: plusAddress(from, thread.token),
    subject: thread.subject ? `Re: ${thread.subject}` : 'We have your message',
    html,
    text,
    headers: { 'Message-ID': messageId },
  });
  if (res.success) {
    await updateThread(thread.id, { ack_message_id: messageId });
  } else {
    console.error('[inbox] acknowledgement failed:', res.error);
  }
}

/**
 * A reply from the owner. The message row is written first with status
 * `queued`; the send then marks it `sent` or `failed`. A failed send is
 * visible in the thread rather than lost.
 */
export async function sendReply(
  thread: InboxThread,
  contact: InboxContact,
  bodyText: string,
  authorUserId: string | null,
): Promise<InboxMessage> {
  const from = await inboxFrom();
  const message = await appendMessage({
    threadId: thread.id,
    direction: 'out',
    channel: 'email',
    bodyText,
    fromEmail: from,
    authorUserId,
  });
  if (!message) throw new Error('reply was not recorded');

  const messageId = outboundMessageId(message.id, from);
  const { lastInbound, chain } = await lastMessageIds(thread.id);
  const references = Array.from(new Set([...(thread.ack_message_id ? [thread.ack_message_id] : []), ...chain]));
  const link = threadLink(thread);

  const html = emailWrapper(
    `${textToHtml(bodyText)}
     <p style="margin:24px 0 0;font-size:13px;color:#6d6459;line-height:1.5;">Reply to this email, or <a href="${link}" style="color:#843c2d;">continue the conversation here</a>.</p>`,
    bodyText.slice(0, 90),
  );
  const text = `${bodyText}\n\nReply to this email, or continue the conversation here:\n${link}`;

  const headers: Record<string, string> = { 'Message-ID': messageId };
  if (lastInbound) headers['In-Reply-To'] = lastInbound;
  if (references.length) headers['References'] = references.join(' ');

  const res = await sendEmail({
    to: contact.email,
    from,
    replyTo: plusAddress(from, thread.token),
    subject: thread.subject ? `Re: ${thread.subject}` : 'From Odubo Studio',
    html,
    text,
    headers,
  });

  if (res.success) {
    await setMessageDelivery(message.id, 'sent', { resendEmailId: res.id, providerMessageId: messageId });
    return { ...message, delivery_status: 'sent', resend_email_id: res.id, provider_message_id: messageId };
  }
  console.error('[inbox] reply send failed:', res.error);
  await setMessageDelivery(message.id, 'failed', { providerMessageId: messageId, error: res.error });
  return { ...message, delivery_status: 'failed', delivery_error: res.error, provider_message_id: messageId };
}
