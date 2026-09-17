import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { priceLabel } from "@/lib/loop/priceLabel";
import { shareLine } from "@/lib/loop/eventFacts";
import { EVENT_CREDITS } from "@/lib/loop/content";

/**
 * The share card: what a pasted /loop link looks like in Messages, Instagram
 * and Facebook. It carries the facts and nothing else: the record's name, the
 * credit, the day, the venue, the age and the price, all read live from the
 * event and the pass settings. It said "Volume 1 · Come Dance" with no date
 * until 2026-09-16, from a mock event object.
 *
 * Satori (next/og) needs explicit display on multi-child nodes and only the
 * default Latin font offline, so the loop is drawn as type rather than ∞.
 */
export const alt = "Loop Soul, an album by Mani Odubo, live at Scott's Inn, Kamloops";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OgImage() {
  const [event, pass, jost] = await Promise.all([
    getCurrentEvent(),
    getPassSettings(),
    // The committed brand face — without it Satori falls back to its bundled
    // default and the share card wears a different typeface than the poster.
    readFile(join(process.cwd(), "public/loop/fonts/Jost-700.ttf")),
  ]);
  const line = shareLine(event, priceLabel(pass.price, pass.currency));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#d9aa7a",
          color: "#1c1a19",
          padding: "72px 80px",
          fontFamily: "Jost",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 128, fontWeight: 700, letterSpacing: -5, lineHeight: 1 }}>
            loop
          </div>
          <div style={{ display: "flex", fontSize: 96, fontStyle: "italic", marginTop: -10, lineHeight: 1 }}>
            Soul
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 9,
            }}
          >
            {EVENT_CREDITS.record}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 27,
              opacity: 0.72,
              marginTop: 18,
              textTransform: "uppercase",
              letterSpacing: 6,
            }}
          >
            {line}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Jost", data: jost, weight: 700, style: "normal" }],
    },
  );
}
