/**
 * Camera capture helpers — framework-agnostic (operate on a <video> element the
 * caller owns). Ported/distilled from the odubo "moments" capture flow
 * (src/app/moments/capture/page.tsx): same getUserMedia + waitForVideoReady +
 * draw-to-canvas + dataURL→Blob approach that's been battle-tested on mobile
 * Safari/Chrome. Kept dependency-free so it's reusable across Pose Studio and a
 * future moments port.
 */

export type CameraFacing = "user" | "environment";

/** base64 dataURL → Blob (avoids Safari canvas.toBlob quirks; mirrors odubo). */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

/** Resolve once the video has real dimensions (with a safety timeout). */
export async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.removeEventListener("loadedmetadata", done);
        video.removeEventListener("canplay", done);
        resolve();
      }
    };
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("canplay", done);
    setTimeout(() => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("canplay", done);
      resolve();
    }, 2500);
  });
}

/**
 * Start the camera into the given <video>. Throws a human-readable Error on the
 * common failure modes (insecure context, unsupported, permission/no-device) so
 * the caller can surface a clear message. Returns the live MediaStream.
 */
export async function startCamera(
  video: HTMLVideoElement,
  facing: CameraFacing = "user",
): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Camera needs a secure connection (HTTPS or localhost).");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser doesn't support camera access.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing } },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error("Camera permission was blocked. Allow it and try again.");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new Error("No camera found on this device.");
    }
    throw new Error(`Couldn't start the camera: ${(err as Error)?.message ?? err}`);
  }
  video.srcObject = stream;
  video.muted = true;
  await waitForVideoReady(video);
  await video.play();
  return stream;
}

/** Stop all tracks and detach from the video element. */
export function stopStream(stream: MediaStream | null, video?: HTMLVideoElement | null): void {
  try {
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
  } catch {
    /* noop */
  }
}

/**
 * Draw the current video frame into a fresh canvas at full resolution. `mirror`
 * flips horizontally so a front-camera (selfie) capture matches the preview.
 */
export function captureFrame(video: HTMLVideoElement, mirror: boolean): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Camera isn't ready yet — give it a second.");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  if (mirror) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  if (mirror) ctx.restore();
  return canvas;
}
