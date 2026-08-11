"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchWall,
  normalizeForWall,
  postToWall,
  rememberWallName,
  savedWallName,
  type WallPhotoDto,
} from "@/lib/loop/wall/client";

const POLL_MS = 15_000;
const PAGE_SIZE = 24;

/**
 * The Wall — the room's shared gallery. Near-live: polls while visible, new
 * shots slide in at the top. `canPost` adds the camera-roll uploader (posting
 * is still enforced server-side: live phase + redeemed code). `featuredOnly`
 * renders the Iconic Moments cut for Legacy.
 */
export function WallGallery({
  canPost = false,
  featuredOnly = false,
}: {
  canPost?: boolean;
  featuredOnly?: boolean;
}) {
  const [photos, setPhotos] = useState<WallPhotoDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [userName, setUserName] = useState("");

  const photosRef = useRef<WallPhotoDto[]>([]);
  photosRef.current = photos;

  useEffect(() => setUserName(savedWallName()), []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  /** Refresh the newest page and merge (dedupe by uid) — poll + post both use it. */
  const refresh = useCallback(async () => {
    const { photos: page, hasMore: more } = await fetchWall({
      limit: PAGE_SIZE,
      featuredOnly,
    });
    setPhotos((prev) => {
      const seen = new Set(page.map((p) => p.uid));
      return [...page, ...prev.filter((p) => !seen.has(p.uid))];
    });
    // Only trust hasMore on a fresh list; merged lists outgrow the page.
    if (photosRef.current.length <= PAGE_SIZE) setHasMore(more);
  }, [featuredOnly]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh()
      .catch(() => alive && setError("Couldn't load the Wall. Pull to retry."))
      .finally(() => alive && setLoading(false));

    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { photos: page, hasMore: more } = await fetchWall({
        offset: photos.length,
        limit: PAGE_SIZE,
        featuredOnly,
      });
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.uid));
        return [...prev, ...page.filter((p) => !seen.has(p.uid))];
      });
      setHasMore(more);
    } catch {
      flash("Couldn't load more just now.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    rememberWallName(userName);
    setError(null);
    setPosting({ done: 0, total: files.length });
    let posted = 0;
    try {
      for (const file of files) {
        const blob = await normalizeForWall(file);
        const photo = await postToWall(blob, {
          fileName: file.name,
          userName: userName.trim() || null,
        });
        posted += 1;
        setPosting({ done: posted, total: files.length });
        setPhotos((prev) => [photo, ...prev.filter((p) => p.uid !== photo.uid)]);
      }
      flash(posted === 1 ? "On the Wall ✦" : `${posted} on the Wall ✦`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(null);
    }
  }

  async function share(p: WallPhotoDto) {
    // r2_url is app-relative (the presigned-GET redirect) — absolutize for
    // share sheets and clipboards.
    const url = new URL(p.r2_url, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Loop Soul", url });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {canPost && (
        <div className="flex w-full items-center gap-2">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onBlur={() => rememberWallName(userName)}
            placeholder="Your name (optional)"
            maxLength={60}
            className="min-w-0 flex-1 rounded-full border border-sand/30 bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-sand"
          />
          <label
            className={`shrink-0 cursor-pointer rounded-full bg-sand px-5 py-3 text-sm font-bold text-ink transition-transform active:scale-95 ${
              posting ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {posting
              ? posting.total > 1
                ? `Posting ${posting.done + 1}/${posting.total}…`
                : "Posting…"
              : "+ Add to the Wall"}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm"
              multiple
              onChange={onPick}
              className="hidden"
              disabled={!!posting}
            />
          </label>
        </div>
      )}

      {error && (
        <p className="w-full rounded-2xl border border-sand/30 bg-sand/5 px-4 py-3 text-center text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-sand/10" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="rounded-2xl border border-sand/25 bg-sand/5 px-5 py-8 text-center text-sm opacity-70">
          {featuredOnly
            ? "Iconic Moments are being curated — check back."
            : canPost
              ? "The Wall is empty. Put the first shot up."
              : "Nothing on the Wall yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p, i) => (
            <button
              key={p.uid}
              type="button"
              onClick={() => setViewer(i)}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-sand/20 bg-black text-left"
            >
              {p.media_type === "video" ? (
                <>
                  <video
                    src={p.r2_url}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sand">
                    Clip
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.r2_url}
                  alt={p.caption ?? "Wall shot"}
                  loading={i < 8 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
              )}
              {p.featured === 1 && (
                <span className="absolute right-2 top-2 text-sand" aria-label="Iconic Moment">
                  ✦
                </span>
              )}
              {p.user_name && (
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent px-3 pb-2 pt-6 text-xs font-semibold text-bone">
                  {p.user_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="rounded-full border border-sand/40 py-3 text-sm font-bold uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "More"}
        </button>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-sand px-5 py-2 text-sm font-bold text-ink shadow-lg">
          {toast}
        </div>
      )}

      {viewer !== null && photos[viewer] && (
        <WallViewer
          photo={photos[viewer]}
          hasPrev={viewer > 0}
          hasNext={viewer < photos.length - 1}
          onPrev={() => setViewer((v) => (v !== null && v > 0 ? v - 1 : v))}
          onNext={() => setViewer((v) => (v !== null && v < photos.length - 1 ? v + 1 : v))}
          onShare={() => share(photos[viewer])}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

/** Full-screen viewer. X to close (no drag-to-close by design), blurred field. */
function WallViewer({
  photo,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onShare,
  onClose,
}: {
  photo: WallPhotoDto;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="min-w-0 text-sm font-semibold text-bone">
          {photo.user_name ?? ""}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-xl font-bold text-bone"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {photo.media_type === "video" ? (
          <video
            src={photo.r2_url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.r2_url}
            alt={photo.caption ?? "Wall shot"}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        )}
      </div>

      {photo.caption && (
        <p className="px-6 pt-2 text-center text-sm text-bone/80">{photo.caption}</p>
      )}

      <div className="flex items-center justify-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous"
          className="flex h-11 w-14 items-center justify-center rounded-full border border-bone/25 text-lg text-bone disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onShare}
          className="h-11 flex-1 rounded-full bg-sand text-sm font-bold text-ink transition-transform active:scale-95"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next"
          className="flex h-11 w-14 items-center justify-center rounded-full border border-bone/25 text-lg text-bone disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default WallGallery;
