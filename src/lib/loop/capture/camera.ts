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

/** What to ask the camera for. All constraints are `ideal` — see below. */
export type CameraOptions = {
  facing?: CameraFacing;
  /** Long edge to request, in px. Omit to accept the UA default. */
  targetLongEdge?: number;
  targetFps?: number;
  /** Ask for a mic track. Never fatal — a refused mic still yields picture. */
  audio?: boolean;
};

/** What the browser actually granted, read after the first frame lands. */
export type GrantedSettings = {
  width: number;
  height: number;
  frameRate: number | null;
  facingMode: string | null;
};

export type CameraStart = {
  stream: MediaStream;
  granted: GrantedSettings;
  hasAudio: boolean;
  /** Set when audio was asked for and not delivered, so the UI can say so. */
  audioNote: string | null;
};

/**
 * Mic constraints for a performance take, not a phone call — the processing
 * chain that makes speech intelligible is exactly what ruins music.
 *
 * Caveat worth knowing: iOS largely ignores these. Activating a mic switches
 * the audio session to a voice-processing category, so expect mono with
 * aggressive AGC regardless. Treat the in-app track as a sync reference and
 * record the real audio separately.
 */
const MIC: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
  sampleRate: { ideal: 48000 },
};

/**
 * Build the video constraints.
 *
 * Every constraint is `ideal`, never `exact` or `min`. A `min` turns a
 * capability gap into OverconstrainedError, which the mapping below reports as
 * "No camera found on this device" — a flat lie on a working webcam that
 * simply doesn't do 1080p. With `ideal` the browser picks the nearest mode and
 * the read-back tells us what we got.
 *
 * Resolution is asked for along the LONG edge because orientation differs by
 * platform: iOS reports the track in the interface orientation (a portrait
 * phone gives 1080x1920), while desktop is always landscape. Asking for a
 * fixed width/height fights whichever one you didn't design for.
 */
function videoConstraints(o: CameraOptions): MediaTrackConstraints {
  const c: MediaTrackConstraints = { facingMode: { ideal: o.facing ?? "user" } };
  if (o.targetLongEdge) {
    const shortEdge = Math.round((o.targetLongEdge * 9) / 16);
    const portrait =
      typeof window === "undefined" ||
      (window.matchMedia?.("(orientation: portrait)").matches ?? true);
    c.width = { ideal: portrait ? shortEdge : o.targetLongEdge };
    c.height = { ideal: portrait ? o.targetLongEdge : shortEdge };
  }
  if (o.targetFps) c.frameRate = { ideal: o.targetFps };
  return c;
}

/**
 * Start the camera into the given <video>. Throws a human-readable Error on the
 * common failure modes (insecure context, unsupported, permission/no-device) so
 * the caller can surface a clear message.
 *
 * Returns the live stream alongside what was ACTUALLY granted — the previous
 * signature returned only the stream, which is how studio mode shipped a
 * resolution cap it could never reach without anyone noticing.
 */
export async function startCamera(
  video: HTMLVideoElement,
  opts: CameraOptions | CameraFacing = {},
): Promise<CameraStart> {
  const o: CameraOptions = typeof opts === "string" ? { facing: opts } : opts;

  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Camera needs a secure connection (HTTPS or localhost).");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser doesn't support camera access.");
  }

  const constraints = videoConstraints(o);
  let stream: MediaStream;
  let audioNote: string | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: constraints,
      audio: o.audio ? MIC : false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    // A refused or busy mic must never cost the take. Retry picture-only
    // rather than reporting a camera failure that didn't happen.
    const micMayBeTheProblem =
      o.audio &&
      (name === "NotAllowedError" ||
        name === "NotFoundError" ||
        name === "NotReadableError");
    if (micMayBeTheProblem) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: false,
        });
        audioNote = "Mic unavailable — recording picture only.";
      } catch (retryErr) {
        throw describeCameraError(retryErr);
      }
    } else {
      throw describeCameraError(err);
    }
  }

  video.srcObject = stream;
  video.muted = true;
  await waitForVideoReady(video);
  await video.play();

  return {
    stream,
    granted: readGranted(video, stream),
    hasAudio: stream.getAudioTracks().length > 0,
    audioNote,
  };
}

function describeCameraError(err: unknown): Error {
  const name = (err as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new Error("Camera permission was blocked. Allow it and try again.");
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new Error("No camera found on this device.");
  }
  if (name === "NotReadableError") {
    return new Error("The camera is in use by another app. Close it and try again.");
  }
  return new Error(`Couldn't start the camera: ${(err as Error)?.message ?? err}`);
}

/**
 * What the browser really gave us.
 *
 * MUST be called after `waitForVideoReady` — Safari returns width 0 (or
 * nothing at all) from getSettings() until the first frame has landed, so
 * reading it straight after getUserMedia reports a 0x0 camera. The element's
 * own videoWidth/Height is the ground truth anyway: it is what the canvas and
 * the recorder actually see.
 */
function readGranted(video: HTMLVideoElement, stream: MediaStream): GrantedSettings {
  const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
  return {
    width: video.videoWidth || settings.width || 0,
    height: video.videoHeight || settings.height || 0,
    frameRate: settings.frameRate ?? null,
    facingMode: (settings.facingMode as string | undefined) ?? null,
  };
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
