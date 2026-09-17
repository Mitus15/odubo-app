import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import { INK, PRODUCT_NAME, SAND } from "@/lib/loop/brand";
import { doorUrlFor } from "@/lib/loop/door";
import { publicPassNumber } from "@/lib/loop/passLink";

/**
 * The ticket, as a thing you keep.
 *
 * A code in a paragraph is not a ticket — nobody memorises LOOP-K7X2, and a
 * line of text in an email is not something anyone screenshots and shows at a
 * door. This renders the real object: the wordmark, the night, the code big
 * enough to read across a dark courtyard, and the QR the door scans.
 *
 * Rendered with Satori (next/og) rather than the sharp poster engine on
 * purpose. The poster engine reads fonts and artwork off disk through a path
 * derived from the script's own location, which is exactly the kind of thing
 * that works on a laptop and disappears in a serverless bundle. Satori is
 * already proven in this app's production OG card, needs only the one TTF, and
 * takes a size we choose.
 *
 * Portrait, phone-shaped: this lives in somebody's camera roll.
 */

export const TICKET_W = 1080;
export const TICKET_H = 1620;

export type TicketFacts = {
  code: string;
  /** The pass number, the human identity of the ticket. Null on door comps. */
  serial?: number | null;
  /** The origin the QR points at. Without it the QR carries the bare code, which the door also reads. */
  baseUrl: string | null;
  /** Kept for callers; the ticket names the product, never an edition. */
  eventTitle?: string;
  /** "Sat Oct 10" — already formatted in the venue's timezone by the caller. */
  dateLabel: string;
  /** "6:30 p.m." */
  timeLabel: string;
  venue: string;
  /** "80s" — the dress code. */
  theme: string;
  /** 1-based, for an order that bought several. */
  index?: number;
  total?: number;
};

let fontCache: Buffer | null = null;
async function jost(): Promise<Buffer> {
  if (!fontCache) fontCache = await readFile(join(process.cwd(), "public/loop/fonts/Jost-700.ttf"));
  return fontCache;
}

/** Ink on white, never on sand: a tinted QR is a QR that fails in bad light. */
async function qrDataUrl(t: TicketFacts): Promise<string> {
  return QRCode.toDataURL(t.baseUrl ? doorUrlFor(t.code, t.baseUrl) : t.code, {
    margin: 1,
    width: 640,
    errorCorrectionLevel: "M",
    color: { dark: INK, light: "#ffffff" },
  });
}

export async function renderTicketPng(t: TicketFacts): Promise<Buffer> {
  const [font, qr] = await Promise.all([jost(), qrDataUrl(t)]);
  const many = (t.total ?? 1) > 1;
  const serial = publicPassNumber(t.serial);

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: SAND,
          color: INK,
          padding: "84px 72px",
          fontFamily: "Jost",
        }}
      >
        {/* The mark, and who this admits */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
            loop
          </div>
          <div style={{ display: "flex", fontSize: 80, fontStyle: "italic", marginTop: -10, lineHeight: 1 }}>
            Soul
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 26,
              letterSpacing: 10,
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            {many ? `Admit one · Guest ${t.index} of ${t.total}` : "Admit one"}
          </div>
        </div>

        {/* The QR is the ticket. Everything else is so a human can read it. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#ffffff",
            borderRadius: 40,
            padding: 34,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" width={540} height={540} style={{ display: "flex" }} />
        </div>

        {/* The number is the ticket's name; the code, readable without a
            scanner, is how a dead phone at the door still gets in, because
            the host can type it. Door comps have no number and lead with the
            code as before. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              opacity: 0.6,
              marginBottom: 10,
            }}
          >
            Your pass
          </div>
          {serial ? (
            // A column of its own: Satori lays a fragment's children out in
            // a row, which put the number and the code on one line.
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>{serial}</div>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: 6, opacity: 0.7, marginTop: 14 }}>
                {t.code}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 78, fontWeight: 700, letterSpacing: 6 }}>{t.code}</div>
          )}
        </div>

        {/* The night */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderTop: `2px solid ${INK}`,
            paddingTop: 30,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, textTransform: "uppercase" }}>
            {t.dateLabel.replace(",", "")} · {t.timeLabel}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 5,
              textTransform: "uppercase",
              opacity: 0.8,
              marginTop: 14,
              textAlign: "center",
            }}
          >
            {t.venue}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: 0.6,
              marginTop: 18,
            }}
          >
            {PRODUCT_NAME} · Dress code {t.theme} · 19+
          </div>
        </div>
      </div>
    ),
    {
      width: TICKET_W,
      height: TICKET_H,
      fonts: [{ name: "Jost", data: font, weight: 700, style: "normal" }],
    },
  );

  return Buffer.from(await res.arrayBuffer());
}
