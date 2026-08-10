import { ImageResponse } from "next/og";
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

export default function OgImage() {
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
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>
            loop
          </div>
          <div style={{ display: "flex", fontSize: 92, fontStyle: "italic", marginTop: -8 }}>
            Soul
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
            What are you dancing to?
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
    { ...size },
  );
}
