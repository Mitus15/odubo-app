"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  composePoster,
  composePrintWithBleed,
  composeTicket,
  composePassCard,
  composeTournament,
  POSTER_SIZES,
  TICKET_SIZE,
  PASS_CARD_SIZE,
  PRINT_BLEED,
  type PosterSize,
  type PosterSpec,
} from "@/lib/loop/poster/compose";
import { tournamentSpec } from "@/lib/loop/poster/tournament";
import { SLOGAN, ANTHEM_PHRASE } from "@/lib/loop/brand";
import type { AnthemState } from "@/lib/loop/anthem-server";
import type { WallPhotoDto } from "@/lib/loop/wall/client";

const BRAND_FIGURES = [
  { id: "crowd", src: "/loop/figures/crowd.png", label: "The crowd" },
  { id: "dance", src: "/loop/figures/dance.png", label: "Dance" },
  { id: "spin", src: "/loop/figures/spin.png", label: "Spin" },
  { id: "listen", src: "/loop/figures/listen.png", label: "Listen" },
];

/** Never hardcode a host — the domain situation changes (see
 *  docs/decisions/loop-soul-product-architecture.md). Whatever origin this
 *  admin is being used from is the origin the poster should point at.
 *  Resolved in an effect, not at render: the server can't know the origin, and
 *  rendering "/loop" there vs the full URL on the client was a guaranteed
 *  hydration mismatch on every page embedding this studio. */
const DEFAULT_QR_PATH = "/loop";

type SourceTab = "figures" | "upload" | "wall";
type Piece = "event" | "tournament" | "ticket" | "pass";
type SloganMode = "slogan" | "anthem" | "custom";

const PIECES: [Piece, string][] = [
  ["event", "Event"],
  ["tournament", "Tournament"],
  ["ticket", "Ticket"],
  ["pass", "Pass card"],
];

/** Editable in-session; deliberately never written back to the event. */
type Details = {
  title: string;
  theme: string;
  venue: string;
  dateLabel: string;
  doors: string;
  passes: string;
  price: string;
};

const DETAIL_FIELDS: [keyof Details, string][] = [
  ["title", "Volume"],
  ["theme", "Theme"],
  ["dateLabel", "Date"],
  ["doors", "Doors"],
  ["venue", "Venue"],
  ["passes", "Passes"],
  ["price", "Price"],
];

/** Export failures in words a promoter can act on. */
function humanError(e: unknown): string {
  const err = e as { name?: string; message?: string };
  if (err?.name === "SecurityError") {
    return "The artwork's host blocked exporting — the preview is fine, but the browser refuses to save a canvas containing it. Try again, or use the kit for this one.";
  }
  return err?.message || "Something went wrong — try again.";
}

/**
 * Poster Studio — every marketing piece from one workbench: the event poster
 * (figures, your art, or a Wall shot), the tournament poster (drawn live from
 * the anthem), the door ticket, and the pass card. One layout engine renders
 * all of them, so what previews here is what the print kit produces.
 */
export function PosterStudio({
  eventDetails,
}: {
  eventDetails: {
    title: string;
    theme: string;
    venue: string;
    dateLabel: string;
    /** e.g. "60 PASSES" — from the live capacity when the server knows it. */
    passes?: string;
  };
}) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const renderSeq = useRef(0);

  const [piece, setPiece] = useState<Piece>("event");
  const [tab, setTab] = useState<SourceTab>("figures");
  const [figureSrc, setFigureSrc] = useState<string | null>(BRAND_FIGURES[0].src);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [wallPhotos, setWallPhotos] = useState<WallPhotoDto[]>([]);
  const [sloganMode, setSloganMode] = useState<SloganMode>("slogan");
  const [customSlogan, setCustomSlogan] = useState("");
  const [showTriad, setShowTriad] = useState(true);
  const [qrUrl, setQrUrl] = useState(DEFAULT_QR_PATH);
  const [showDetails, setShowDetails] = useState(true);
  const [size, setSize] = useState<PosterSize>("print");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anthem, setAnthem] = useState<AnthemState | null>(null);
  const [anthemError, setAnthemError] = useState<string | null>(null);

  /** The session's baseline — edits are marked against this, never saved. */
  const initialDetails = useMemo<Details>(
    () => ({
      title: eventDetails.title,
      theme: eventDetails.theme,
      venue: eventDetails.venue,
      dateLabel: eventDetails.dateLabel,
      doors: "DOORS 9PM",
      passes: eventDetails.passes ?? "",
      price: "$20",
    }),
    [eventDetails],
  );
  const [details, setDetails] = useState<Details>(initialDetails);

  // Upgrade the QR target to the real origin once we're on the client.
  useEffect(() => {
    setQrUrl((prev) =>
      prev === DEFAULT_QR_PATH ? `${window.location.origin}${DEFAULT_QR_PATH}` : prev,
    );
  }, []);

  // Wall shots for the picker (admin view — includes everything visible).
  useEffect(() => {
    if (tab !== "wall" || wallPhotos.length > 0) return;
    void (async () => {
      try {
        const res = await fetch("/api/loop/admin/gallery/list?filter=all", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { photos?: WallPhotoDto[] };
          setWallPhotos(data.photos ?? []);
        }
      } catch {
        /* picker just stays empty */
      }
    })();
  }, [tab, wallPhotos.length]);

  // The tournament piece draws the LIVE anthem — fetched once per visit.
  useEffect(() => {
    if (piece !== "tournament" || anthem) return;
    void (async () => {
      try {
        setAnthemError(null);
        const res = await fetch("/api/loop/anthem", { cache: "no-store" });
        if (!res.ok) throw new Error(`anthem state unavailable (${res.status})`);
        setAnthem((await res.json()) as AnthemState);
      } catch (e) {
        setAnthemError(humanError(e));
      }
    })();
  }, [piece, anthem]);

  const tagline =
    sloganMode === "slogan" ? SLOGAN : sloganMode === "anthem" ? ANTHEM_PHRASE : customSlogan;

  const buildSpec = useCallback(
    (forSize: PosterSize): PosterSpec => ({
      size: forSize,
      figureSrc,
      tagline,
      qrUrl,
      showTriad,
      showDetails,
      details,
    }),
    [figureSrc, tagline, qrUrl, showTriad, showDetails, details],
  );

  /** One composer for every piece — preview and export share it. */
  const compose = useCallback(
    async (forSize: PosterSize): Promise<HTMLCanvasElement | null> => {
      switch (piece) {
        case "event":
          return composePoster(buildSpec(forSize));
        case "tournament": {
          if (!anthem) return null; // still loading — keep the last preview
          return composeTournament(
            tournamentSpec(anthem, { size: forSize, qrUrl: qrUrl.trim() || "/loop" }),
          );
        }
        case "ticket":
          return composeTicket(buildSpec(forSize));
        case "pass":
          return composePassCard(buildSpec(forSize));
      }
    },
    [piece, buildSpec, anthem, qrUrl],
  );

  // Live preview — debounced; a failed compose KEEPS the last good bitmap on
  // screen (the canvas is only drawn on success) and disables exports.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const seq = ++renderSeq.current;
      void (async () => {
        try {
          const canvas = await compose(size);
          if (!canvas || seq !== renderSeq.current) return;
          setError(null);
          const preview = previewRef.current;
          if (!preview) return;
          preview.width = canvas.width;
          preview.height = canvas.height;
          preview.getContext("2d")?.drawImage(canvas, 0, 0);
        } catch (e) {
          if (seq === renderSeq.current) setError(humanError(e));
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [compose, size]);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    const url = URL.createObjectURL(file);
    setUploadUrl(url);
    setFigureSrc(url);
    setTab("upload");
  }

  async function runExport(
    id: string,
    make: () => Promise<HTMLCanvasElement | null>,
    file: string,
  ) {
    setBusy(id);
    setError(null);
    try {
      const canvas = await make();
      if (!canvas) throw new Error("Still loading — try again in a second.");
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Export failed — try again.");
      saveAs(blob, `${file}-${canvas.width}x${canvas.height}.png`);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  // What the preview box should look like, per piece.
  const dims =
    piece === "ticket"
      ? TICKET_SIZE
      : piece === "pass"
        ? PASS_CARD_SIZE
        : POSTER_SIZES[size];
  const sizeLabel =
    piece === "ticket"
      ? "Door ticket · 8.5×3.33in 300dpi"
      : piece === "pass"
        ? "Pass card · square (store + socials)"
        : POSTER_SIZES[size].label;
  const hasSizes = piece === "event" || piece === "tournament";
  const showFigure = piece !== "tournament";
  const edited = DETAIL_FIELDS.filter(([k]) => details[k] !== initialDetails[k]);

  return (
    <div className="mt-4">
      {/* The piece — everything else adapts to it */}
      <div className="flex rounded-full border border-ink/15 bg-ink/5 p-1">
        {PIECES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPiece(id)}
            className={`flex-1 rounded-full py-2 text-xs font-bold ${
              piece === id ? "bg-ink text-sand" : "opacity-60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {piece === "tournament" && (
        <p className="mt-2 px-1 text-xs opacity-70">
          Drawn from the live anthem — {anthem ? `stage: ${anthem.stage}` : anthemError ?? "loading the room…"}.
          The poster follows the tournament; there is nothing to configure but the size.
        </p>
      )}

      {/* Figure source */}
      {showFigure && (
        <>
          <div className="mt-3 flex rounded-full border border-ink/15 bg-ink/5 p-1">
            {(
              [
                ["figures", "Figures"],
                ["upload", "Upload"],
                ["wall", "The Wall"],
              ] as [SourceTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-full py-2 text-xs font-bold ${
                  tab === id ? "bg-ink text-sand" : "opacity-60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {tab === "figures" && (
              <div className="grid grid-cols-4 gap-2">
                {BRAND_FIGURES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFigureSrc(f.src)}
                    className={`rounded-2xl border-2 bg-sand/60 p-2 ${
                      figureSrc === f.src ? "border-ink" : "border-ink/10"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.src} alt={f.label} className="mx-auto h-16 object-contain" />
                    <div className="mt-1 text-[11px] font-bold">{f.label}</div>
                  </button>
                ))}
              </div>
            )}
            {tab === "upload" && (
              <label className="block cursor-pointer rounded-2xl border border-dashed border-ink/30 px-5 py-6 text-center text-sm opacity-80">
                {uploadUrl ? "Change the uploaded figure" : "Drop in a transparent PNG (your Photoshop/Gemini art)"}
                <input type="file" accept="image/png,image/webp,image/jpeg" onChange={onUpload} className="hidden" />
              </label>
            )}
            {tab === "wall" && (
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                {wallPhotos.length === 0 ? (
                  <p className="col-span-4 py-6 text-center text-sm opacity-60">
                    No Wall shots yet — they appear here once guests post.
                  </p>
                ) : (
                  wallPhotos
                    .filter((p) => p.media_type === "photo")
                    .map((p) => {
                      const streamUrl = `${p.r2_url}?stream=1`;
                      return (
                        <button
                          key={p.uid}
                          type="button"
                          onClick={() => setFigureSrc(streamUrl)}
                          className={`aspect-[3/4] overflow-hidden rounded-xl border-2 ${
                            figureSrc === streamUrl ? "border-ink" : "border-ink/10"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.r2_url} alt="" className="h-full w-full object-cover" />
                        </button>
                      );
                    })
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Words + QR (the event poster's voice; ticket/pass take details only) */}
      {piece === "event" && (
        <div className="mt-3 grid gap-2">
          <div className="flex rounded-full border border-ink/15 bg-ink/5 p-1">
            {(
              [
                ["slogan", SLOGAN],
                ["anthem", ANTHEM_PHRASE],
                ["custom", "Custom…"],
              ] as [SloganMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSloganMode(id)}
                className={`flex-1 truncate rounded-full px-2 py-2 text-xs font-bold ${
                  sloganMode === id ? "bg-ink text-sand" : "opacity-60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {sloganMode === "custom" && (
            <input
              type="text"
              value={customSlogan}
              onChange={(e) => setCustomSlogan(e.target.value)}
              placeholder={`Your line (empty falls back to “${SLOGAN}”)`}
              maxLength={40}
              className="rounded-2xl border border-ink/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
            />
          )}
          <label className="flex items-center gap-2 px-1 text-sm">
            <input
              type="checkbox"
              checked={showTriad}
              onChange={(e) => setShowTriad(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            MUSIC · MODE · MOVEMENT under the slogan
          </label>
          <label className="flex items-center gap-2 px-1 text-sm">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            Show event details (volume · theme · date · venue)
          </label>
        </div>
      )}

      {piece !== "pass" && (
        <input
          type="url"
          value={qrUrl}
          onChange={(e) => setQrUrl(e.target.value)}
          placeholder="QR link (where the poster sends people)"
          className="mt-2 w-full rounded-2xl border border-ink/20 bg-transparent px-4 py-3 font-mono text-xs outline-none focus:border-ink"
        />
      )}

      {/* Session-only detail overrides, tucked away until needed */}
      {piece !== "tournament" && (
        <details className="mt-2 rounded-2xl border border-ink/15">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold">
            More controls — event lines on this piece
            {edited.length > 0 && (
              <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-sand">
                {edited.length} edited
              </span>
            )}
          </summary>
          <div className="grid gap-2 px-4 pb-4">
            <p className="text-xs opacity-60">
              These start from the live event and only change this session&apos;s posters —
              nothing here writes back to the event.
            </p>
            {DETAIL_FIELDS.map(([key, label]) => (
              <label key={key} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-xs">
                <span className="font-bold opacity-70">{label}</span>
                <input
                  type="text"
                  value={details[key]}
                  onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))}
                  className={`rounded-xl border bg-transparent px-3 py-2 outline-none focus:border-ink ${
                    details[key] !== initialDetails[key] ? "border-ink" : "border-ink/20"
                  }`}
                />
                {details[key] !== initialDetails[key] ? (
                  <button
                    type="button"
                    onClick={() => setDetails((d) => ({ ...d, [key]: initialDetails[key] }))}
                    className="rounded-full border border-ink/25 px-2 py-1 text-[10px] font-bold"
                    title="Back to the live event's value"
                  >
                    reset
                  </button>
                ) : (
                  <span className="w-10" />
                )}
              </label>
            ))}
          </div>
        </details>
      )}

      {/* Size + preview */}
      {hasSizes && (
        <div className="mt-3 flex rounded-full border border-ink/15 bg-ink/5 p-1">
          {(Object.keys(POSTER_SIZES) as PosterSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`flex-1 rounded-full py-2 text-xs font-bold capitalize ${
                size === s ? "bg-ink text-sand" : "opacity-60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-2xl border border-ink/15 bg-ink/5 p-3">
        <canvas
          ref={previewRef}
          style={{ width: "100%", height: "auto", aspectRatio: `${dims.w} / ${dims.h}` }}
          className="rounded-xl"
        />
        <p className="mt-1 text-center text-[11px] opacity-60">{sizeLabel}</p>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error} — the preview shows the last good version; exports are paused until this is fixed.
        </p>
      )}

      {/* Exports, per piece */}
      {(piece === "event" || piece === "tournament") && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(POSTER_SIZES) as PosterSize[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  runExport(s, () => compose(s), `loop-soul-${piece === "tournament" ? "anthem" : "poster"}-${s}`)
                }
                disabled={busy !== null || error !== null || (piece === "tournament" && !anthem)}
                className="rounded-full bg-ink py-3 text-xs font-bold capitalize text-sand transition-transform active:scale-95 disabled:opacity-50"
              >
                {busy === s ? "Exporting…" : `Export ${s}`}
              </button>
            ))}
          </div>
          {piece === "event" && (
            <button
              type="button"
              onClick={() =>
                runExport("print-bleed", () => composePrintWithBleed(buildSpec("print")), "loop-soul-poster-print-bleed")
              }
              disabled={busy !== null || error !== null}
              className="mt-2 w-full rounded-full border border-ink bg-transparent py-3 text-xs font-bold text-ink transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy === "print-bleed" ? "Exporting…" : `Export for the print shop — ${PRINT_BLEED.label}`}
            </button>
          )}
        </>
      )}
      {piece === "ticket" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => runExport("ticket", () => composeTicket(buildSpec(size)), "loop-soul-ticket")}
            disabled={busy !== null || error !== null}
            className="rounded-full bg-ink py-3 text-xs font-bold text-sand transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy === "ticket" ? "Exporting…" : "Export ticket"}
          </button>
          <button
            type="button"
            onClick={() =>
              runExport("ticket-bleed", () => composeTicket(buildSpec(size), { bleed: true }), "loop-soul-ticket-bleed")
            }
            disabled={busy !== null || error !== null}
            className="rounded-full border border-ink bg-transparent py-3 text-xs font-bold text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy === "ticket-bleed" ? "Exporting…" : "Print shop (bleed)"}
          </button>
        </div>
      )}
      {piece === "pass" && (
        <button
          type="button"
          onClick={() => runExport("pass", () => composePassCard(buildSpec(size)), "loop-soul-pass-card")}
          disabled={busy !== null || error !== null}
          className="mt-3 w-full rounded-full bg-ink py-3 text-xs font-bold text-sand transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy === "pass" ? "Exporting…" : "Export pass card"}
        </button>
      )}
    </div>
  );
}

export default PosterStudio;
