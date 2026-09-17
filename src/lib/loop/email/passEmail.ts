import { INK, PRODUCT_NAME, SAND } from "@/lib/loop/brand";
import { publicPassNumber } from "@/lib/loop/passLink";

/**
 * The pass email, as words and as a page. Pure: what goes in is what the
 * sender already knows, what comes out is sent as is.
 *
 * It says four things, in this order, and nothing else: the ticket (the
 * picture, inline), the night (one line), the record (one button), and what
 * to do with the ticket. The previous version was 283 words under seven
 * headings and its first instruction sent the buyer to a page that told them
 * they had not bought anything. A buyer reads this on a phone, thirty seconds
 * after paying. Everything they might want later is one tap away on the site,
 * where it can be corrected; an email cannot.
 */

export type PassForEmail = {
  code: string;
  serial: number | null;
  /** The claim link. Null only when no public base URL is configured. */
  link: string | null;
  /** 1-based, of `total`, for an order that bought several. */
  index: number;
  total: number;
  /** The inline image's content id, when a ticket picture is attached. */
  cid: string | null;
};

export type PassEmailFacts = {
  /** "Saturday 10 October · Scott's Inn, Kamloops · from 6:30" */
  line: string;
  /** How many tracks a pass hears before release; null or 0 when none. */
  earlyCount: number | null;
  /** Where "your record" lives when a pass has no link. */
  recordUrl: string;
};

const FONT = "Jost, Futura, 'Helvetica Neue', Arial, sans-serif";
const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "Three tracks are yours now, the rest after the night." */
export function tracksNowLine(count: number | null): string {
  if (!count || count < 1) return "The record lands here after the night.";
  if (count === 1) return "One track is yours now, the rest after the night.";
  const n = count < WORDS.length ? WORDS[count] : String(count);
  return `${n} tracks are yours now, the rest after the night.`;
}

export function passEmailSubject(count: number): string {
  return count > 1 ? `Your ${PRODUCT_NAME} passes` : `Your ${PRODUCT_NAME} pass`;
}

function passLabel(p: PassForEmail): string {
  return [publicPassNumber(p.serial), p.code].filter(Boolean).join(" · ");
}

export function renderPassEmailText(passes: PassForEmail[], facts: PassEmailFacts): string {
  const many = passes.length > 1;
  const lines: string[] = [`${passEmailSubject(passes.length)}.`, ``, facts.line, ``];
  for (const p of passes) {
    if (many) lines.push(`Guest ${p.index} of ${p.total} · ${passLabel(p)}`);
    else lines.push(`${passLabel(p)}. Your ticket is attached.`);
    lines.push(`Open your record: ${p.link ?? facts.recordUrl}`);
    lines.push(``);
  }
  if (many) lines.push(`Your tickets are attached, one per guest. Send one to each person coming.`, ``);
  lines.push(`Show the ticket at the door. ${tracksNowLine(facts.earlyCount)}`, ``);
  lines.push(`19+ · Filmed and photographed throughout`, `Odubo Studio`);
  return lines.join("\n");
}

export function renderPassEmailHtml(passes: PassForEmail[], facts: PassEmailFacts): string {
  const many = passes.length > 1;
  const small = `font-family:${FONT};font-size:11px;line-height:1.7;letter-spacing:0.16em;text-transform:uppercase;color:${INK};`;
  const body = `font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};`;

  const tickets = passes
    .map((p) => {
      const eyebrow = many
        ? `<tr><td align="center" style="${small}opacity:0.7;padding:${p.index === 1 ? 0 : 28}px 0 8px;">Guest ${p.index} of ${p.total}</td></tr>`
        : "";
      const picture = p.cid
        ? `<tr><td align="center" style="padding-bottom:14px;"><img src="cid:${p.cid}" width="360" alt="Your ${PRODUCT_NAME} ticket, ${esc(passLabel(p))}" style="display:block;width:100%;max-width:360px;height:auto;border-radius:28px;" /></td></tr>`
        : `<tr><td align="center" style="${body}font-weight:700;padding-bottom:14px;">${esc(passLabel(p))}</td></tr>`;
      const button = `<tr><td align="center" style="padding-bottom:6px;"><a href="${esc(p.link ?? facts.recordUrl)}" style="display:inline-block;background:${INK};color:${SAND};font-family:${FONT};font-size:16px;font-weight:700;line-height:1;padding:17px 34px;border-radius:999px;text-decoration:none;">Open your record</a></td></tr>`;
      return eyebrow + picture + button;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(passEmailSubject(passes.length))}</title></head>
<body style="margin:0;padding:0;background:${SAND};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SAND};">
<tr><td align="center" style="padding:36px 20px 44px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;">
<tr><td align="center" style="${small}padding-bottom:18px;">${esc(facts.line)}</td></tr>
${tickets}
<tr><td align="center" style="${body}padding:22px 8px 30px;">Show the ticket at the door. ${esc(tracksNowLine(facts.earlyCount))}</td></tr>
<tr><td align="center" style="${small}opacity:0.55;">19+ · Filmed and photographed throughout · Odubo Studio</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function renderPassEmail(passes: PassForEmail[], facts: PassEmailFacts): { subject: string; text: string; html: string } {
  return {
    subject: passEmailSubject(passes.length),
    text: renderPassEmailText(passes, facts),
    html: renderPassEmailHtml(passes, facts),
  };
}
