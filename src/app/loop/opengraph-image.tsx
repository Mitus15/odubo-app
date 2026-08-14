import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MOCK_CURRENT_EVENT } from "@/lib/loop/hub";

/**
 * Branded share card for when the link is posted (July 11 promo). Sand
 * field, black wordmark + the signature tagline — matches the poster language.
 * Note: Satori (next/og) needs explicit display on multi-child nodes and only
 * the default Latin font offline, so we avoid the ∞ glyph and draw the loop.
 */
export const alt = "Loop Soul — The Rec Room at Scott's Inn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // The committed brand face — without it Satori falls back to its bundled
  // default and the share card wears a different typeface than the poster.
  const jost = await readFile(join(process.cwd(), "public/loop/fonts/Jost-700.ttf"));

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
          color: "#2a0f0a",
          padding: "72px 80px",
          fontFamily: "Jost",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            loop
          </div>
          <div style={{ display: "flex", fontSize: 92, fontStyle: "italic", marginTop: -8 }}>
            Soul
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
            Come Dance
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 27,
              opacity: 0.75,
              marginTop: 14,
              textTransform: "uppercase",
              letterSpacing: 6,
            }}
          >
            {MOCK_CURRENT_EVENT.title} · {MOCK_CURRENT_EVENT.venue}
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
