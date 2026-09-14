/**
 * The Resend side of receiving mail.
 *
 * The installed SDK (4.8) predates the receiving API, so the two calls this
 * needs are made directly: verify the Svix signature on the webhook, then
 * fetch the message body, which the webhook deliberately does not carry.
 * No SDK upgrade touches the sending paths that already work.
 */

import { base64url } from './text';

const RESEND_API = 'https://api.resend.com';
const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * Svix signing: HMAC-SHA256 of `${id}.${timestamp}.${body}` with the secret
 * decoded from base64 after its `whsec_` prefix. The signature header may
 * carry several `v1,<base64>` entries (key rotation); any match passes.
 * Timestamps outside five minutes are refused, which is what makes a
 * captured request useless later.
 */
export async function verifySvix(
  headers: SvixHeaders,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = bytesToBase64(new Uint8Array(mac));

  const offered = signature
    .split(/\s+/)
    .map((entry) => entry.split(',', 2))
    .filter(([version]) => version === 'v1')
    .map(([, sig]) => sig)
    .filter(Boolean);

  return offered.some((sig) => timingSafeEqual(sig, expected));
}

export function svixHeadersFrom(get: (name: string) => string | null): SvixHeaders {
  return {
    id: get('svix-id'),
    timestamp: get('svix-timestamp'),
    signature: get('svix-signature'),
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** What the `email.received` webhook carries: metadata only. */
export interface ReceivedEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    received_for?: string[];
    message_id?: string;
    subject?: string;
    attachments?: { id: string; filename?: string; content_type?: string; content_disposition?: string; content_id?: string }[];
  };
}

/** What GET /emails/receiving/{id} returns: the message itself. */
export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[] | string | null;
  received_for?: string[];
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string | string[]> | { name: string; value: string }[] | null;
  message_id?: string | null;
  created_at: string;
  attachments?: { id: string; filename?: string; content_type?: string; size?: number; content_disposition?: string; content_id?: string }[];
}

export async function fetchReceivedEmail(emailId: string, apiKey: string): Promise<ReceivedEmail> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend receiving GET ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as ReceivedEmail;
}

export interface ReceivedAttachmentMeta {
  id: string;
  filename?: string;
  content_type?: string;
  size?: number;
  download_url?: string;
  expires_at?: string;
}

export async function fetchReceivedAttachment(
  emailId: string,
  attachmentId: string,
  apiKey: string,
): Promise<ReceivedAttachmentMeta | null> {
  const res = await fetch(
    `${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return null;
  return (await res.json()) as ReceivedAttachmentMeta;
}

/** Exposed for tests. */
export const __internal = { base64ToBytes, bytesToBase64, base64url };
