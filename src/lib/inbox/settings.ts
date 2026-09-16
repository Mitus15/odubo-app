/**
 * Where the inbox reads its configuration.
 *
 * Values live in `global_settings` so the owner can change them from the
 * admin without a deploy; env vars are the fallback, and the last resort is
 * the house default. Nothing here guesses a domain that does not send.
 */

import { getGlobalSetting } from '@/lib/db';
import type { ReplyTemplate } from './types';

export const SETTING_KEYS = {
  from: 'inbox.from',
  alertTo: 'inbox.alert_to',
  autoAck: 'inbox.auto_ack',
  alertChannels: 'inbox.alert_channels_json',
  templates: 'inbox.templates_json',
} as const;

const DEFAULT_FROM = 'Odubo Studio <support@odubostudio.com>';

async function setting(key: string): Promise<string | null> {
  try {
    const row = await getGlobalSetting(key);
    const v = row?.value?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

/** The address customers see and reply to. */
export async function inboxFrom(): Promise<string> {
  return (await setting(SETTING_KEYS.from)) || process.env.INBOX_FROM || DEFAULT_FROM;
}

/** Where the owner is told a message arrived. Null means nobody is. */
export async function inboxAlertTo(): Promise<string | null> {
  return (await setting(SETTING_KEYS.alertTo)) || process.env.INBOX_ALERT_TO || process.env.SUPPORT_EMAIL || null;
}

export async function inboxAutoAck(): Promise<boolean> {
  const v = await setting(SETTING_KEYS.autoAck);
  if (v === null) return true;
  return !['0', 'false', 'off', 'no'].includes(v.toLowerCase());
}

export type AlertChannel = 'email' | 'push' | 'sms';

/** The fan-out. Push and SMS are named here so adding them later is one function, not a rewrite. */
export async function inboxAlertChannels(): Promise<AlertChannel[]> {
  const v = await setting(SETTING_KEYS.alertChannels);
  if (!v) return ['email'];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.filter((c): c is AlertChannel => ['email', 'push', 'sms'].includes(c));
  } catch {
    /* fall through */
  }
  return ['email'];
}

export const DEFAULT_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'order-status',
    topic: 'order',
    title: 'Where the order is',
    body: 'Hi {name},\n\nThanks for checking in on order {order}. It is in production now and ships in the window shown at checkout. You will get tracking the moment it leaves.\n\nMani',
  },
  {
    id: 'return',
    topic: 'refund',
    title: 'Return or exchange',
    body: 'Hi {name},\n\nSorry it was not right. Send it back unworn within 30 days and we will exchange or refund it. Reply here with what you would like and I will send the return address.\n\nMani',
  },
  {
    id: 'shipping',
    topic: 'shipping',
    title: 'Shipping times',
    body: 'Hi {name},\n\nPieces are made to order and ship about four weeks after payment. Canada arrives in a few days after that, the US in about a week, elsewhere two. Tracking goes out with the parcel.\n\nMani',
  },
  {
    id: 'thanks',
    topic: 'any',
    title: 'Thank you',
    body: 'Hi {name},\n\nThank you for the note, it means a lot. If there is anything else, reply here any time.\n\nMani',
  },
];

export async function inboxTemplates(): Promise<ReplyTemplate[]> {
  const v = await setting(SETTING_KEYS.templates);
  if (!v) return DEFAULT_TEMPLATES;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed) && parsed.length) return parsed as ReplyTemplate[];
  } catch {
    /* fall through */
  }
  return DEFAULT_TEMPLATES;
}

export { fillTemplate } from './text';
