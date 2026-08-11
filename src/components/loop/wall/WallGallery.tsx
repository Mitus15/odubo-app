"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MediaGrid from "@/components/loop/media/MediaGrid";
import MediaViewer, { type ViewerAction } from "@/components/loop/media/MediaViewer";
import type { MediaItem } from "@/lib/loop/media/types";
import { deleteItem, listItems } from "@/lib/loop/pose/gallery";
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

type Tab = "everyone" | "yours";

/**
 * The Wall — the room's shared gallery, plus your own shots in the same place.
 * "Everyone" is the live wall (polls while visible); "Yours" is what's saved on
 * this device, so guests stop hunting through two separate galleries. Renders
 * through the shared MediaGrid/MediaViewer, so the Wall, the Vault and Iconic
 * Moments all behave identically.
 */
export function WallGallery({
  canPost = false,
  featuredOnly = false,
  deviceOnly = false,
}: {
  canPost?: boolean;
  featuredOnly?: boolean;
  /** Show only this device's saved shots — the public Pose page, where the
   *  Wall itself is attendee-gated and would only ever 403. */
  deviceOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(deviceOnly ? "yours" : "everyone");
  const [wall, setWall] = useState<WallPhotoDto[]>([]);
  const [mine, setMine] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [userName, setUserName] = useState("");

  const localUrls = useRef<string[]>([]);
  const wallRef = useRef<WallPhotoDto[]>([]);
  wallRef.current = wall;

  useEffect(() => setUserName(savedWallName()), []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refresh = useCallback(async () => {
    const { photos: page, hasMore: more } = await fetchWall({ limit: PAGE_SIZE, featuredOnly });
    setWall((prev) => {
      const seen = new Set(page.map((p) => p.uid));
      return [...page, ...prev.filter((p) => !seen.has(p.uid))];
    });
    if (wallRef.current.length <= PAGE_SIZE) setHasMore(more);
  }, [featuredOnly]);

  useEffect(() => {
    if (deviceOnly) {
      setLoading(false);
      return;
    }
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
  }, [refresh, deviceOnly]);

  /** Load this device's saved shots (object URLs revoked on refresh/unmount). */
  const loadMine = useCallback(async () => {
    const items = await listItems();
    localUrls.current.forEach((u) => URL.revokeObjectURL(u));
    localUrls.current = [];
    setMine(
      items.map((it) => {
        const url = URL.createObjectURL(it.blob);
        localUrls.current.push(url);
        return {
          id: it.id,
          src: url,
          kind: it.kind === "video" ? "video" : "image",
          local: true,
        } satisfies MediaItem;
      }),
    );
  }, []);

  useEffect(() => {
    if (tab === "yours") void loadMine();
  }, [tab, loadMine]);

  useEffect(() => () => localUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const wallItems: MediaItem[] = wall.map((p) => ({
    id: p.uid,
    src: p.r2_url,
    kind: p.media_type === "video" ? "video" : "image",
    author: p.user_name,
    caption: p.caption,
    featured: p.featured === 1,
    moderated: p.moderated,
    rowId: p.id,
  }));
  const items = tab === "yours" ? mine : wallItems;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { photos: page, hasMore: more } = await fetchWall({
        offset: wall.length,
        limit: PAGE_SIZE,
        featuredOnly,
      });
      setWall((prev) => {
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
        setWall((prev) => [photo, ...prev.filter((p) => p.uid !== photo.uid)]);
      }
      flash(posted === 1 ? "On the Wall ✦" : `${posted} on the Wall ✦`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(null);
    }
  }

  async function share(item: MediaItem) {
    if (item.local) {
      const a = document.createElement("a");
      a.href = item.src;
      a.download = `loop-soul.${item.kind === "video" ? "webm" : "jpg"}`;
      a.click();
      return;
    }
    const url = new URL(item.src, window.location.origin).toString();
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

  const viewerActions: ViewerAction[] = [
    { label: tab === "yours" ? "Save" : "Share", onClick: share, primary: true },
    ...(tab === "yours"
      ? [
          {
            label: "Delete",
            danger: true,
            onClick: async (item: MediaItem) => {
              await deleteItem(item.id);
              await loadMine();
              setViewer(null);
            },
          } satisfies ViewerAction,
        ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      {canPost && !deviceOnly && (
        <>
          <div className="flex rounded-full border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] p-1">
            {(
              [
                ["everyone", "Everyone"],
                ["yours", "Yours"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-widest ${
                  tab === id
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "loop-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "everyone" && (
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onBlur={() => rememberWallName(userName)}
                placeholder="Your name (optional)"
                maxLength={60}
                className="min-w-0 flex-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50"
              />
              <label
                className={`shrink-0 cursor-pointer rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-bold text-[var(--background)] transition-transform active:scale-95 ${
                  posting ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {posting
                  ? posting.total > 1
                    ? `Posting ${posting.done + 1}/${posting.total}…`
                    : "Posting…"
                  : "+ Add"}
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
        </>
      )}

      {error && (
        <p className="loop-panel rounded-2xl px-4 py-3 text-center text-sm">{error}</p>
      )}

      <MediaGrid
        items={items}
        loading={loading && tab === "everyone"}
        onOpen={setViewer}
        empty={
          tab === "yours"
            ? "Nothing saved on this device yet. Shots you keep land here."
            : featuredOnly
              ? "Iconic Moments are being curated — check back."
              : canPost
                ? "The Wall is empty. Put the first shot up."
                : "Nothing on the Wall yet."
        }
      />

      {tab === "everyone" && hasMore && !loading && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_35%,transparent)] py-3 text-sm font-bold uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "More"}
        </button>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--foreground)] px-5 py-2 text-sm font-bold text-[var(--background)] shadow-lg">
          {toast}
        </div>
      )}

      {viewer !== null && items[viewer] && (
        <MediaViewer
          items={items}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          actions={viewerActions}
        />
      )}
    </div>
  );
}

export default WallGallery;
