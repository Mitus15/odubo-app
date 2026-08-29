/**
 * The MediaRecorder wrapper, shared by both capture paths.
 *
 * Two things record in the Pose Studio and they tap different sources: the
 * filtered path records the engine's canvas (`captureStream`), and the long
 * raw take records the camera track directly. Everything AFTER the source is
 * identical — codec choice, audio muxing, chunking, error handling — so it
 * lives here rather than being written twice.
 */

/** Preferred recording mime types, best-first; picks the first supported. */
const REC_TYPES = [
  "video/mp4;codecs=h264",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** The same list with audio codecs. A type without an audio codec may still
 *  mux audio, but naming it is what makes the choice deterministic. */
const REC_TYPES_AV = [
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickRecordType(withAudio = false): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  const list = withAudio ? REC_TYPES_AV : REC_TYPES;
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function canRecord(): boolean {
  return pickRecordType(false) !== null;
}

/**
 * A 1s timeslice rather than 100ms: over a five-minute take 100ms means 3,000
 * chunk Blobs for no benefit, and 1s still leaves near-complete data behind if
 * the recorder errors mid-take.
 */
const TIMESLICE_MS = 1000;

/** How long to wait for `onstop` before giving up and returning what we have.
 *  Safari can error without ever firing stop, which would otherwise hang the
 *  UI in "recording" forever. */
const STOP_WATCHDOG_MS = 5000;

export type TakeOptions = {
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  /** Called if the recorder dies on its own (memory pressure, session
   *  interruption). The take is over; whatever was captured is kept. */
  onError?: (err: Error) => void;
};

/**
 * One recording in flight. Constructed started; `stop()` resolves the blob.
 */
export class Take {
  private chunks: Blob[] = [];
  private recorder: MediaRecorder;
  /** The mime the recorder ACTUALLY chose — see `mimeType` below. */
  private actualType: string;
  private settled = false;

  private constructor(recorder: MediaRecorder, requestedType: string) {
    this.recorder = recorder;
    this.actualType = requestedType;
  }

  /**
   * Start recording `stream`. Returns null when this browser cannot record at
   * all, so the caller can fall back to photo.
   */
  static start(stream: MediaStream, opts: TakeOptions = {}): Take | null {
    const withAudio = stream.getAudioTracks().length > 0;
    const type = pickRecordType(withAudio);
    if (!type) return null;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: type,
        ...(opts.videoBitsPerSecond ? { videoBitsPerSecond: opts.videoBitsPerSecond } : {}),
        ...(withAudio && opts.audioBitsPerSecond
          ? { audioBitsPerSecond: opts.audioBitsPerSecond }
          : {}),
      });
    } catch {
      return null;
    }

    const take = new Take(recorder, type);
    recorder.ondataavailable = (e) => {
      if (e.data.size) take.chunks.push(e.data);
    };
    recorder.onerror = (e) => {
      opts.onError?.(
        (e as unknown as { error?: Error })?.error ??
          new Error("The recording stopped unexpectedly."),
      );
    };
    recorder.start(TIMESLICE_MS);

    // `mimeType` is only populated once started, and Safari's isTypeSupported
    // is loose — it accepts a type then encodes whatever it likes. Reading the
    // real value back is what keeps the file extension and the stored mime
    // honest downstream.
    take.actualType = recorder.mimeType || type;
    return take;
  }

  /** What the recorder is actually producing. */
  get mimeType(): string {
    return this.actualType;
  }

  get active(): boolean {
    return this.recorder.state === "recording";
  }

  /**
   * Stop and resolve the recorded blob (null if nothing was captured).
   *
   * Never rejects and never hangs: if `onstop` doesn't arrive within the
   * watchdog window the chunks collected so far are returned, because a
   * partial take is worth more than a stuck viewfinder.
   */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const finish = () => {
        if (this.settled) return;
        this.settled = true;
        window.clearTimeout(watchdog);
        const blob = this.chunks.length
          ? new Blob(this.chunks, { type: this.actualType })
          : null;
        this.chunks = [];
        resolve(blob);
      };
      const watchdog = window.setTimeout(finish, STOP_WATCHDOG_MS);
      this.recorder.onstop = finish;
      try {
        if (this.recorder.state !== "inactive") this.recorder.stop();
        else finish();
      } catch {
        finish();
      }
    });
  }
}
