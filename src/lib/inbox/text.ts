/**
 * The pure parts of the inbox: tokens, addresses, headers and the scissors
 * that turn an email reply into something that reads like a text.
 *
 * Nothing here touches the database or the network, so all of it is under
 * test in src/__tests__/inboxText.test.ts.
 */

/** 32 random bytes, base64url. Unguessable is the whole security model. */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lowercase, trimmed. The one form an address is stored in. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Trim and lowercase the domain only. Local parts are case-sensitive in
 * principle and our thread token is base64url, so a plus-address must keep
 * its case until the token has been read out of it.
 */
function normalizeDomainOnly(raw: string): string {
  const s = raw.trim();
  const at = s.lastIndexOf('@');
  return at < 0 ? s : `${s.slice(0, at)}@${s.slice(at + 1).toLowerCase()}`;
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/**
 * "Odubo Studio <support@odubostudio.com>" → { name, address }.
 * A bare address comes back with name null.
 */
export function parseAddress(raw: string): { name: string | null; address: string } {
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: m[1]?.trim() || null, address: normalizeEmail(m[2]) };
  return { name: null, address: normalizeEmail(raw) };
}

/**
 * The plus-address a thread answers to: support+<token>@domain.
 * Every outbound email sets this as Reply-To so a plain "Reply" in any mail
 * app carries the thread key back to us without the customer doing anything.
 */
export function plusAddress(fromAddress: string, token: string): string {
  const { address } = parseAddress(fromAddress);
  const at = address.indexOf('@');
  if (at < 0) return address;
  return `${address.slice(0, at)}+${token}@${address.slice(at + 1)}`;
}

/**
 * Pull a thread token out of any recipient address. Tokens are base64url of
 * 32 bytes, so 43 characters; anything shorter than 16 is not ours.
 */
export function tokenFromAddress(address: string): string | null {
  const m = address.match(/^[^+@\s<]+\+([A-Za-z0-9_-]{16,})@/);
  return m ? m[1] : null;
}

export function tokenFromRecipients(recipients: string[]): string | null {
  for (const r of recipients) {
    const m = r.match(/<([^>]+)>/);
    const address = normalizeDomainOnly(m ? m[1] : r);
    const t = tokenFromAddress(address);
    if (t) return t;
  }
  return null;
}

/** The RFC Message-ID we stamp on every outbound message. */
export function outboundMessageId(messageId: string, fromAddress: string): string {
  const { address } = parseAddress(fromAddress);
  const domain = address.split('@')[1] || 'odubostudio.com';
  return `<inbox.${messageId}@${domain}>`;
}

/**
 * Message-IDs in In-Reply-To / References, each as `<...>`. Tolerates the
 * header being absent, a single id, or a space/comma separated list.
 */
export function parseMessageIds(header: string | null | undefined): string[] {
  if (!header) return [];
  const ids = header.match(/<[^<>\s]+>/g);
  return ids ? Array.from(new Set(ids)) : [];
}

/**
 * Email headers as Resend returns them may be an object or a name/value
 * list. Look one up case-insensitively either way.
 */
export type HeaderBag = Record<string, string | string[]> | { name: string; value: string }[] | null | undefined;

export function header(bag: HeaderBag, name: string): string | null {
  if (!bag) return null;
  const want = name.toLowerCase();
  if (Array.isArray(bag)) {
    const hit = bag.find((h) => h.name?.toLowerCase() === want);
    return hit?.value ?? null;
  }
  for (const [k, v] of Object.entries(bag)) {
    if (k.toLowerCase() === want) return Array.isArray(v) ? v.join(', ') : v;
  }
  return null;
}

/**
 * Bounces, vacation responders and list mail must never open a thread or
 * wake the owner. RFC 3834 and the two de-facto headers cover nearly all of
 * it; the sender check catches the daemons that set none.
 */
export function isAutomatedMail(bag: HeaderBag, fromAddress: string): boolean {
  const auto = header(bag, 'Auto-Submitted');
  if (auto && auto.trim().toLowerCase() !== 'no') return true;
  const prec = header(bag, 'Precedence')?.toLowerCase();
  if (prec && ['bulk', 'auto_reply', 'junk', 'list'].includes(prec)) return true;
  if (header(bag, 'X-Autoreply') || header(bag, 'X-Autorespond')) return true;
  const suppress = header(bag, 'X-Auto-Response-Suppress');
  if (suppress && /\b(all|autoreply|oof)\b/i.test(suppress)) return true;
  const { address } = parseAddress(fromAddress);
  return /^(mailer-daemon|postmaster)@/i.test(address);
}

/**
 * Cut the quoted history off a reply so the thread reads as a conversation,
 * not a stack of nested emails. Handles the common quote markers from Gmail,
 * Apple Mail, Outlook and plain `>` quoting, and trims signature rules.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cutAt = lines.findIndex((line, i) => {
    const t = line.trim();
    if (/^On .{0,200}wrote:\s*$/i.test(t)) return true;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) return true;
    if (/^_{8,}$/.test(t)) return true;
    if (/^(Le|Am|El) .{0,200}(a écrit|schrieb|escribió)\s*:$/i.test(t)) return true;
    if (/^From:\s.+/i.test(t) && /^(Sent|Date):\s/i.test(lines[i + 1]?.trim() || '')) return true;
    if (/^-- $/.test(line)) return true;
    return false;
  });
  const kept = cutAt >= 0 ? lines.slice(0, cutAt) : lines;
  // Drop trailing quoted lines and blank tail.
  while (kept.length && (/^\s*>/.test(kept[kept.length - 1]) || kept[kept.length - 1].trim() === '')) {
    kept.pop();
  }
  // Gmail sometimes puts "On … wrote:" across two lines; catch the orphan.
  if (kept.length && /^On .{0,200}$/i.test(kept[kept.length - 1].trim()) && cutAt >= 0) {
    kept.pop();
  }
  return kept.join('\n').trim();
}

/** A rough plain-text rendering for emails that only carry HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Escape for putting user text into an HTML email. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text → paragraphs, for the email body. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** First line of a message, for the list. */
export function snippet(text: string, max = 120): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/** Subject, without a pile of Re: prefixes. */
export function cleanSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const s = subject.replace(/^(\s*(re|fwd?|aw|sv)\s*:\s*)+/i, '').trim();
  return s || null;
}

/** "#1234", "1234", "Order 1234" → "1234". */
export function normalizeOrderNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\d{3,}/);
  return m ? m[0] : null;
}

/** Fill {name} and {order} in a canned reply. */
export function fillTemplate(body: string, vars: { name?: string | null; order?: string | null }): string {
  const first = (vars.name || '').trim().split(/\s+/)[0] || 'there';
  return body
    .replace(/\{name\}/g, first)
    .replace(/\{order\}/g, vars.order ? `#${vars.order}` : 'your order');
}
