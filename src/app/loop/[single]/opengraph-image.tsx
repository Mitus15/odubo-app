import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getTrackAsSingle } from "@/lib/loop/single";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { createStorageService } from "@/lib/storage/StorageService";
import { shortDate, venueShort } from "@/lib/loop/eventFacts";
import { cardTitleSize } from "@/lib/loop/singlePage";
import { releaseLabel, sharePath, singleBySlug } from "@/lib/loop/singles";
import { songBySlug } from "@/lib/loop/songs";
import { ALBUM_NAME } from "@/lib/loop/albumName";
import { getSingleStatuses } from "@/lib/loop/singlesStore";

/**
 * The single's share card: the cover on the left, the song on the right. A
 * pasted /signsoflife/<song> (or /loop/<song>) reads as the song, not as the event poster.
 *
 * The cover lives in R2 behind a presigned route that 302s; Satori cannot
 * follow that from inside the renderer, so the bytes are fetched here, sized
 * down with sharp (the master is 2048 square and ~2 MB) and embedded. If that
 * fails the card is typographic, never broken.
 */
export const alt = `A single from ${ALBUM_NAME} by Mani Odubo`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAND = "#d9aa7a";
const INK = "#1c1a19";
const MEDIA_PREFIX = "/api/media/audio/";

async function coverDataUri(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl?.startsWith(MEDIA_PREFIX)) return null;
  try {
    const key = decodeURIComponent(coverUrl.slice(MEDIA_PREFIX.length));
    const url = await createStorageService().getPresignedUrl({ key, operation: "get", expiresIn: 300 });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cover fetch ${res.status}`);
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer())).resize(630, 630, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[loop:1984:og] cover not embedded, card goes typographic:", err);
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ single: string }> }) {
  const slug = (await params).single;
  // A single, or one of the other chapters of the flight.
  const def = singleBySlug(slug) ?? (songBySlug(slug) ? { slug, title: songBySlug(slug)!.title } : null);
  const chapterNumber = !singleBySlug(slug) ? songBySlug(slug)?.number ?? null : null;
  // Both weights must be listed in next.config's outputFileTracingIncludes:
  // Vercel does not bundle a file read at runtime unless told to, and this
  // card 500'd in production (ENOENT on the 500) while rendering locally.
  const [single, event, base, j500, j700] = await Promise.all([
    def ? getTrackAsSingle(def.title) : Promise.resolve(null),
    getCurrentEvent(),
    getPublicBaseUrl(),
    readFile(join(process.cwd(), "public/loop/fonts/Jost-500.ttf")),
    readFile(join(process.cwd(), "public/loop/fonts/Jost-700.ttf")),
  ]);
  const cover = await coverDataUri(single?.coverUrl ?? null);
  const host = (base ?? "https://www.odubostudio.com").replace(/^https?:\/\/(www\.)?/, "");
  const title = single?.title ?? def?.title ?? ALBUM_NAME;
  const status = (await getSingleStatuses().catch(() => [])).find((x) => x.slug === def?.slug);
  const out = status?.out ?? false;
  const when = releaseLabel(status?.releaseDate ?? null);
  const kicker = chapterNumber ? `${ALBUM_NAME} · Chapter ${chapterNumber}` : `${ALBUM_NAME} · The single`;
  const callToAction = chapterNumber ? "Enter the flight" : out ? "Listen free" : when ? `Out ${when}` : "Coming soon";
  const path = sharePath(def?.slug ?? "");
  const artist = single?.artistName ?? "Mani Odubo";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: SAND, color: INK, fontFamily: "Jost" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} width={630} height={630} alt="" style={{ width: 630, height: 630 }} />
        ) : null}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: cover ? "64px 56px" : "72px 80px",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7 }}>
            {kicker}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: cardTitleSize(title, !!cover), fontWeight: 700, letterSpacing: -4, lineHeight: 0.95 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 500, marginTop: 14 }}>{artist}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>{callToAction}</div>
            {event.phase !== "archived" && (
              <div style={{ display: "flex", fontSize: 22, fontWeight: 500, opacity: 0.72, marginTop: 8 }}>
                {`Live ${shortDate(event.date)} · ${venueShort(event.venue)}`}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 22, fontWeight: 500, opacity: 0.72, marginTop: 4 }}>{`${host}${path}`}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jost", data: j500, weight: 500, style: "normal" },
        { name: "Jost", data: j700, weight: 700, style: "normal" },
      ],
    },
  );
}
