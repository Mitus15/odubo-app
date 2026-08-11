"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  composePoster,
  POSTER_SIZES,
  type PosterSize,
  type PosterSpec,
} from "@/lib/loop/poster/compose";
import type { WallPhotoDto } from "@/lib/loop/wall/client";

const BRAND_FIGURES = [
  { id: "dance", src: "/loop/figures/dance.png", label: "Dance" },
  { id: "spin", src: "/loop/figures/spin.png", label: "Spin" },
  { id: "listen", src: "/loop/figures/listen.png", label: "Listen" },
];

/** Never hardcode a host — the domain situation changes (see
 *  docs/decisions/loop-soul-product-architecture.md). Whatever origin this
 *  admin is being used from is the origin the poster should point at. */
const defaultQr = () =>
  typeof window === "undefined" ? "/loop" : `${window.location.origin}/loop`;

type SourceTab = "figures" | "upload" | "wall";

/**
 * Poster Studio — recreate the Legacy marketing posters from parts: a figure
 * (brand cut-outs, your own PNG, or a Wall shot), the arced question, the real
 * wordmark, optional event details, Scott's mark, and a QR code back to the
 * app. Live preview; exports print + feed + story PNGs.
 */
export function PosterStudio({
  eventDetails,
}: {
  eventDetails: { title: string; theme: string; venue: string; dateLabel: string };
}) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fontProbeRef = useRef<HTMLDivElement | null>(null);

  const [tab, setTab] = useState<SourceTab>("figures");
  const [figureSrc, setFigureSrc] = useState<string | null>(BRAND_FIGURES[0].src);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [wallPhotos, setWallPhotos] = useState<WallPhotoDto[]>([]);
  const [tagline, setTagline] = useState("What are you dancing to?");
  const [qrUrl, setQrUrl] = useState(defaultQr);
  const [showDetails, setShowDetails] = useState(true);
  const [size, setSize] = useState<PosterSize>("print");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wall shots for the picker (admin view — includes everything visible).
  useEffect(() => {
    if (tab !== "wall" || wallPhotos.length > 0) return;
    void (async () => {
      try {
        const res = await fetch("/api/loop/admin/gallery/list?filter=all", { cache: "no-store" });
        if (res.ok) setWallPhotos(((await res.json()).photos ?? []) as WallPhotoDto[]);
      } catch {
        /* picker just stays empty */
      }
    })();
  }, [tab, wallPhotos.length]);

  const buildSpec = useCallback(
    (forSize: PosterSize): PosterSpec => ({
      size: forSize,
      figureSrc,
      tagline,
      qrUrl,
      showDetails,
      details: eventDetails,
      fontSans: fontProbeRef.current
        ? getComputedStyle(fontProbeRef.current).fontFamily
        : "sans-serif",
    }),
    [figureSrc, tagline, qrUrl, showDetails, eventDetails],
  );

  // Live preview — debounced re-compose at the selected size.
  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          setError(null);
          const canvas = await composePoster(buildSpec(size));
          const preview = previewRef.current;
          if (!preview) return;
          preview.width = canvas.width;
          preview.height = canvas.height;
          preview.getContext("2d")?.drawImage(canvas, 0, 0);
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [buildSpec, size]);

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

  async function exportSize(s: PosterSize) {
    setBusy(s);
    setError(null);
    try {
      const canvas = await composePoster(buildSpec(s));
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Export failed — try again.");
      saveAs(blob, `loop-soul-poster-${s}-${canvas.width}x${canvas.height}.png`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const { w, h } = POSTER_SIZES[size];

  return (
    <div className="mt-4">
      {/* Hidden probe so the canvas uses the REAL loaded Inter face. */}
      <div ref={fontProbeRef} className="font-sans absolute h-0 w-0 overflow-hidden" aria-hidden />

      {/* Figure source */}
      <div className="flex rounded-full border border-ink/15 bg-ink/5 p-1">
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
          <div className="grid grid-cols-3 gap-2">
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
                <img src={f.src} alt={f.label} className="mx-auto h-20 object-contain" />
                <div className="mt-1 text-xs font-bold">{f.label}</div>
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

      {/* Words + QR */}
      <div className="mt-3 grid gap-2">
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="The arced question (e.g. What are you dancing to?)"
          maxLength={40}
          className="rounded-2xl border border-ink/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <input
          type="url"
          value={qrUrl}
          onChange={(e) => setQrUrl(e.target.value)}
          placeholder="QR link (where the poster sends people)"
          className="rounded-2xl border border-ink/20 bg-transparent px-4 py-3 font-mono text-xs outline-none focus:border-ink"
        />
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

      {/* Size + preview */}
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

      <div className="mt-3 overflow-hidden rounded-2xl border border-ink/15 bg-ink/5 p-3">
        <canvas
          ref={previewRef}
          style={{ width: "100%", height: "auto", aspectRatio: `${w} / ${h}` }}
          className="rounded-xl"
        />
        <p className="mt-1 text-center text-[11px] opacity-60">{POSTER_SIZES[size].label}</p>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(POSTER_SIZES) as PosterSize[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => exportSize(s)}
            disabled={busy !== null}
            className="rounded-full bg-ink py-3 text-xs font-bold capitalize text-sand transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy === s ? "Exporting…" : `Export ${s}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export default PosterStudio;
