/**
 * Name a file after what it ACTUALLY is.
 *
 * The recorder picks the first supported type from a list that starts with
 * mp4/h264, so on iOS Safari a hardcoded ".webm" produced an MP4 with the
 * wrong extension — which some apps reject outright and others mis-handle
 * silently. The extension must follow the blob's type, never the media kind.
 */
export function extensionFor(blob: Blob, kind: "image" | "video"): string {
  if (kind === "image") return blob.type.includes("png") ? "png" : "jpg";
  if (blob.type.includes("mp4")) return "mp4";
  return "webm";
}

/** A stamped download name, so repeated takes don't collide in Downloads. */
export function downloadName(blob: Blob, kind: "image" | "video", stamp = Date.now()): string {
  return `loop-soul-${stamp}.${extensionFor(blob, kind)}`;
}
