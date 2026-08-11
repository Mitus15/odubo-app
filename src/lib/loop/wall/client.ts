"use client";

/** Client helpers for the Wall — fetch, downscale, post. */

export type WallPhotoDto = {
  id: number;
  uid: string;
  r2_url: string;
  user_name: string | null;
  caption: string | null;
  media_type: "photo" | "video";
  moderated: number | null;
  featured: number;
  created_at: string;
};

export async function fetchWall(opts: {
  offset?: number;
  limit?: number;
  featuredOnly?: boolean;
}): Promise<{ photos: WallPhotoDto[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (opts.offset) params.set("offset", String(opts.offset));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.featuredOnly) params.set("featured", "1");
  const res = await fetch(`/api/loop/gallery/list?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't load the Wall (${res.status})`);
  return res.json();
}

const MAX_DIM = 2048;
const JPEG_QUALITY = 0.85;

/**
 * Downscale + re-encode a picked image to JPEG (max 2048px). Keeps venue-Wi-Fi
 * uploads small and normalizes formats the grid can't render (HEIC) — anything
 * the browser can decode comes out as a plain JPEG. Videos and undecodable
 * files pass through untouched.
 */
export async function normalizeForWall(file: File | Blob): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch {
    // Undecodable in this browser (e.g. raw HEIC in Chrome) — send as-is and
    // let the server's allowlist decide.
    return file;
  }
}

export async function postToWall(
  media: Blob,
  opts: { fileName?: string; userName?: string | null; caption?: string | null } = {},
): Promise<WallPhotoDto> {
  const form = new FormData();
  const name =
    opts.fileName ?? (media.type.startsWith("video/") ? "loop-wall.webm" : "loop-wall.jpg");
  form.set("file", new File([media], name, { type: media.type || "image/jpeg" }));
  if (opts.userName) form.set("userName", opts.userName);
  if (opts.caption) form.set("caption", opts.caption);

  const res = await fetch("/api/loop/gallery/post", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error ?? `Couldn't post to the Wall (${res.status})`);
  }
  return data.photo as WallPhotoDto;
}

const NAME_KEY = "loop-wall-name";

export function savedWallName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberWallName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    /* private mode — fine */
  }
}
