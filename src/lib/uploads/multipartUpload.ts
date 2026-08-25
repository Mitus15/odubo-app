/**
 * Direct-to-R2 multipart upload, driven from the browser.
 *
 * Extracted from the inline implementation in ArsenalTab.tsx (~L2251-2384),
 * which is the only path in this app that can move files larger than the
 * 100MB request-body limit. Arsenal's copy is deliberately left in place —
 * it is welded to video (forced .mp4, a Cloudflare Stream step) and carries
 * guards from the 2026-02-11 crisis that broke 112 deployments. This is the
 * general-purpose version: it keeps the real file extension, knows nothing
 * about Stream, and takes its endpoint as an argument.
 *
 * Two bugs from the original are fixed here:
 *   - progress counted every part as a full chunk, so the reported MB
 *     overshot on the final (short) part;
 *   - the retry loop only retried non-ok responses, so a dropped connection
 *     (fetch rejecting) failed the whole upload on the first blip. Uploading
 *     a 1GB WAV over a venue's wifi makes that the common case, not the edge.
 *
 * The server contract (four actions on one endpoint):
 *   start     → { uploadId, key, ... }
 *   get-urls  → { urls: string[] }
 *   complete  → whatever the caller's endpoint returns
 *   abort     → best-effort cleanup
 */

export interface MultipartProgress {
  /** Bytes confirmed uploaded. */
  loaded: number;
  /** Total bytes in the file. */
  total: number;
  /** 0-100, one decimal place of useful resolution. */
  percent: number;
  completedParts: number;
  totalParts: number;
}

export interface UploadMultipartOptions {
  file: File;
  /** Endpoint implementing start / get-urls / complete / abort. */
  endpoint: string;
  /** Extra fields merged into the `start` request. */
  startPayload?: Record<string, unknown>;
  /** Extra fields merged into the `complete` request. */
  completePayload?: Record<string, unknown>;
  /** Default 50MB — R2's minimum part size is 5MB, and S3 caps at 10k parts. */
  chunkSize?: number;
  /** Simultaneous part uploads. Default 5. */
  concurrency?: number;
  /** Attempts per part before giving up. Default 3. */
  maxRetries?: number;
  signal?: AbortSignal;
  onProgress?: (progress: MultipartProgress) => void;
}

export interface MultipartResult<TComplete = unknown> {
  key: string;
  uploadId: string;
  /** The parsed body of the `complete` call. */
  complete: TComplete;
}

const DEFAULT_CHUNK_SIZE = 50 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_RETRIES = 3;

class AbortedError extends Error {
  constructor() {
    super('Upload aborted');
    this.name = 'AbortedError';
  }
}

async function postAction<T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) detail = parsed.error;
    } catch {
      /* non-JSON error body — the status text is all we have */
    }
    throw new Error(`${body.action as string} failed: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function uploadMultipart<TComplete = unknown>(
  options: UploadMultipartOptions
): Promise<MultipartResult<TComplete>> {
  const {
    file,
    endpoint,
    startPayload = {},
    completePayload = {},
    chunkSize = DEFAULT_CHUNK_SIZE,
    concurrency = DEFAULT_CONCURRENCY,
    maxRetries = DEFAULT_MAX_RETRIES,
    signal,
    onProgress,
  } = options;

  const throwIfAborted = () => {
    if (signal?.aborted) throw new AbortedError();
  };
  throwIfAborted();

  // 1. Reserve the key and open the upload.
  const { uploadId, key } = await postAction<{ uploadId: string; key: string }>(
    endpoint,
    {
      action: 'start',
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      ...startPayload,
    },
    signal
  );

  // Everything past this point owns a live multipart upload on R2, so every
  // failure path must abort it or the parts linger and are billed.
  const abort = async () => {
    try {
      await postAction(endpoint, { action: 'abort', uploadId, key });
    } catch (err) {
      // Best effort. The real failure is the one we are already throwing.
      console.error('Failed to abort multipart upload', err);
    }
  };

  try {
    // 2. Slice. Each part remembers its own byte length so progress is exact
    //    on the final short part.
    const totalParts = Math.max(1, Math.ceil(file.size / chunkSize));
    const chunks: Array<{ blob: Blob; bytes: number }> = [];
    for (let i = 0; i < totalParts; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({ blob: file.slice(start, end), bytes: end - start });
    }

    // 3. Presign every part.
    const { urls } = await postAction<{ urls: string[] }>(
      endpoint,
      { action: 'get-urls', uploadId, key, parts: totalParts },
      signal
    );
    if (urls.length !== totalParts) {
      throw new Error(`Expected ${totalParts} presigned URLs, got ${urls.length}`);
    }

    // 4. Upload with bounded concurrency and per-part retry.
    const uploadedParts: Array<{ PartNumber: number; ETag: string }> = new Array(totalParts);
    let loaded = 0;
    let completedParts = 0;

    const uploadChunk = async (index: number): Promise<void> => {
      const partNumber = index + 1;
      const { blob, bytes } = chunks[index];
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        throwIfAborted();
        try {
          const response = await fetch(urls[index], {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            signal,
          });
          if (!response.ok) {
            throw new Error(`part ${partNumber}: HTTP ${response.status}`);
          }
          const etag = response.headers.get('ETag');
          if (!etag) {
            // R2 must expose ETag via CORS. If it does not, completing the
            // upload is impossible — say so rather than retrying blindly.
            throw new Error(
              `part ${partNumber}: no ETag in response — check the bucket's CORS ExposeHeaders`
            );
          }

          uploadedParts[index] = { PartNumber: partNumber, ETag: etag.replace(/"/g, '') };
          loaded += bytes;
          completedParts++;
          onProgress?.({
            loaded,
            total: file.size,
            percent: file.size ? (loaded / file.size) * 100 : 100,
            completedParts,
            totalParts,
          });
          return;
        } catch (err) {
          if (err instanceof AbortedError || (err as Error)?.name === 'AbortError') throw err;
          lastError = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s
          }
        }
      }
      // A CORS rejection surfaces as a TypeError with no status — identical
      // to a dead network from here. Say so, because the fix is completely
      // different: the bucket's allowed origins, not the connection.
      const message = (lastError as Error)?.message ?? 'unknown error';
      const looksLikeCors =
        lastError instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message);
      throw new Error(
        looksLikeCors
          ? `Part ${partNumber} could not reach storage (${message}). This is usually the ` +
            `bucket's CORS policy: it must allow this exact origin (${
              typeof location !== 'undefined' ? location.origin : 'this origin'
            }) for PUT and expose the ETag header.`
          : `Failed to upload part ${partNumber} after ${maxRetries} attempts: ${message}`
      );
    };

    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, totalParts) },
      async () => {
        while (cursor < totalParts) {
          await uploadChunk(cursor++);
        }
      }
    );
    await Promise.all(workers);

    // 5. Seal it.
    throwIfAborted();
    const complete = await postAction<TComplete>(
      endpoint,
      { action: 'complete', uploadId, key, parts: uploadedParts, ...completePayload },
      signal
    );

    return { key, uploadId, complete };
  } catch (err) {
    await abort();
    throw err;
  }
}

/**
 * Read an audio file's duration in the browser, so a master can carry a real
 * length without anyone running ffmpeg.
 *
 * WAV is parsed straight from the header — exact, instant, no decode, and it
 * works for the multi-hundred-MB masters where handing the whole file to an
 * <audio> element is wasteful. Everything else falls back to the element.
 *
 * Returns null when the duration cannot be determined; callers must treat
 * that as "unknown", never as zero.
 */
export async function readAudioDuration(file: File): Promise<number | null> {
  const fromHeader = await readWavDuration(file);
  if (fromHeader !== null) return fromHeader;

  // Outside a browser (SSR, tests, a worker without URL.createObjectURL)
  // there is no way to decode, and "unknown" is the honest answer.
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' ||
      typeof Audio === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/**
 * Parse duration out of a RIFF/WAVE header: bytes / byte-rate.
 * Reads only the first 64KB — enough to walk past any LIST/bext chunks that
 * DAWs put before `data`. Returns null for anything that is not a plain
 * PCM-style WAV, so the caller falls back to the audio element.
 */
async function readWavDuration(file: File): Promise<number | null> {
  try {
    const head = new DataView(await file.slice(0, 65536).arrayBuffer());
    if (head.byteLength < 44) return null;

    const tag = (offset: number) =>
      String.fromCharCode(
        head.getUint8(offset),
        head.getUint8(offset + 1),
        head.getUint8(offset + 2),
        head.getUint8(offset + 3)
      );

    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

    let byteRate = 0;
    let offset = 12;
    while (offset + 8 <= head.byteLength) {
      const id = tag(offset);
      const size = head.getUint32(offset + 4, true);

      if (id === 'fmt ' && offset + 8 + 16 <= head.byteLength) {
        byteRate = head.getUint32(offset + 16, true);
      } else if (id === 'data') {
        if (!byteRate) return null;
        // A streamed WAV can carry 0xFFFFFFFF as the data size; fall back to
        // the real file length in that case.
        const declared = size;
        const actual = file.size - (offset + 8);
        const dataBytes = declared > 0 && declared <= actual ? declared : actual;
        const seconds = dataBytes / byteRate;
        return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
      }

      offset += 8 + size + (size % 2); // chunks are word-aligned
    }
    return null;
  } catch {
    return null;
  }
}
