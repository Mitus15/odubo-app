/**
 * Generative stylize provider — the exact-match upgrade to the on-device duotone.
 *
 * The on-device engine (stylize.ts) is fast, free, private and always-works, but
 * it can only APPROXIMATE the illustrated reference look in public/figures/
 * (Gemini invents line-art/patterns a filter can't). This provider is the
 * "Make it a poster" path: it sends the ORIGINAL photo to a generative model and
 * gets back a true Loop Soul poster.
 *
 * Behind an interface (same pattern as src/lib/email) so the app never depends on
 * a specific model. `POSE_STYLIZE_MODE`:
 *   - `mock` (default) — echoes the image back; the whole capture → upload →
 *      return → share round-trip is testable with NO key and NO cost.
 *   - `cf` — Cloudflare Workers AI img2img (default generative path: near-free,
 *      NOT a new third party since CF is the chosen stack). Needs
 *      `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN`.
 *   - `live` — Gemini 2.5 Flash Image (premium / max-fidelity). Needs
 *      `GEMINI_API_KEY`. (That model sunsets 2026-10-02 → set `GEMINI_IMAGE_MODEL`
 *      to its successor.)
 * Missing creds in any mode falls back to mock, so nothing ever breaks. Flipping
 * the env var is the only change at handover.
 */

export type StylizeInput = {
  /** The original captured photo (NOT the on-device duotone — the model needs
   *  full detail to illustrate from). */
  image: ArrayBuffer;
  mime: string;
};

export type StylizeResult = {
  image: ArrayBuffer;
  mime: string;
  /** Which provider produced it ("mock" | "gemini") — surfaced for debugging. */
  mode: string;
};

export interface StylizeProvider {
  stylize(input: StylizeInput): Promise<StylizeResult>;
}

/**
 * The LOCKED Loop Soul poster prompt. Keeping it here (versioned, one place) is
 * what makes the generative output CONSISTENT across any input photo. Tune the
 * wording once; every poster inherits it. Pair with public/figures/*.png as
 * style-reference images and a fixed seed when calling the model.
 */
export const POSE_STYLE_PROMPT =
  "Redraw this photo as a flat two-colour screen-print poster illustration — " +
  "ONLY solid black (#2a0f0a) and poster sand (#d9aa7a), no other colours, no " +
  "greys, no gradients, no photographic shading. Keep every person's exact pose, " +
  "proportions, hairstyle and expression. Render the people as bold solid-black " +
  "silhouettes with crisp negative-space line-art (thin poster-sand lines and " +
  "cut-outs) describing clothing folds, lapels, patterns and just enough facial " +
  "detail to read the expression — clean vector linework, not photographic. " +
  "Reinterpret the entire background as a single flat poster-sand (#d9aa7a) " +
  "field; stylise any signage or stage hardware into simple bold black graphic " +
  "shapes rather than removing meaning. High-contrast, sharp edges, poster/vector " +
  "aesthetic matching the reference images. No text, no watermark, no logos.";

class MockStylizeProvider implements StylizeProvider {
  async stylize(input: StylizeInput): Promise<StylizeResult> {
    // Echo the image straight back so the full round-trip (upload → provider →
    // download → share) is exercised with no API key or per-image cost. The
    // client already shows the on-device duotone, so the demo stays coherent.
    await new Promise((r) => setTimeout(r, 400)); // simulate model latency
    console.log(`[pose:mock] echoed ${input.image.byteLength}B (${input.mime})`);
    return { image: input.image, mime: input.mime, mode: "mock" };
  }
}

class GeminiStylizeProvider implements StylizeProvider {
  async stylize(input: StylizeInput): Promise<StylizeResult> {
    const key = process.env.GEMINI_API_KEY;
    // No key → never break; fall back to the mock echo.
    if (!key) return new MockStylizeProvider().stylize(input);

    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
    const source = Buffer.from(input.image).toString("base64");

    // The proven recipe (matches doing it by hand in the web app): the source
    // photo + the locked prompt. Reference images are an optional consistency
    // lever, off by default so the model doesn't copy their composition.
    const parts: Array<Record<string, unknown>> = [
      { text: POSE_STYLE_PROMPT },
      { inlineData: { mimeType: input.mime, data: source } },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          // Low temperature → run-to-run consistency across different photos.
          generationConfig: { temperature: 0.2, responseModalities: ["IMAGE"] },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!img?.data) throw new Error("Gemini returned no image part");

    const buf = Buffer.from(img.data, "base64");
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { image: ab, mime: img.mimeType || "image/png", mode: "gemini" };
  }
}

class CfWorkersAiStylizeProvider implements StylizeProvider {
  async stylize(input: StylizeInput): Promise<StylizeResult> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_AI_API_TOKEN;
    // No creds → never break; fall back to the mock echo.
    if (!account || !token) return new MockStylizeProvider().stylize(input);

    // Needs an img2img/editing-capable model (redraws a photo, not txt2img).
    const model = process.env.POSE_CF_IMAGE_MODEL || "@cf/runwayml/stable-diffusion-v1-5-img2img";
    // Workers AI img2img takes the source image as an array of 0..255 bytes.
    // NOTE: for live use, downscale the source to ~512–768px first — a full-res
    // phone photo makes this JSON array huge. Left as a TODO with the live wiring.
    const bytes = Array.from(new Uint8Array(input.image));

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          prompt: POSE_STYLE_PROMPT,
          image: bytes,
          strength: 0.85, // high → follow the redraw prompt; low → stays photographic
          guidance: 8,
          num_steps: 20,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Workers AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    // Image models usually return the raw PNG; some return a JSON base64 envelope.
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { result?: { image?: string }; image?: string };
      const b64 = j.result?.image || j.image;
      if (!b64) throw new Error("Workers AI returned no image");
      const buf = Buffer.from(b64, "base64");
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return { image: ab, mime: "image/png", mode: "cf" };
    }
    return { image: await res.arrayBuffer(), mime: ct || "image/png", mode: "cf" };
  }
}

export function getStylizeProvider(): StylizeProvider {
  const mode = process.env.POSE_STYLIZE_MODE;
  // cf → Cloudflare Workers AI (default generative: near-free, no new third party).
  // live → Gemini (premium/max-fidelity). Anything else → mock echo.
  if (mode === "cf") return new CfWorkersAiStylizeProvider();
  if (mode === "live" && process.env.GEMINI_API_KEY) return new GeminiStylizeProvider();
  return new MockStylizeProvider();
}
