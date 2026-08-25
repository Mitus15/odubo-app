/**
 * readAudioDuration — the WAV header path.
 *
 * This is how a master gets a real length without anyone running ffmpeg. All
 * 13 tracks currently sit at duration = 0, and both the delivery sheet and
 * the album page read that number, so a wrong answer here is a wrong answer
 * on the distributor's spreadsheet.
 *
 * The fallback path (an <audio> element) is not covered: jsdom does not
 * decode audio, so a test of it would only assert that jsdom does nothing.
 */
import { readAudioDuration } from '@/lib/uploads/multipartUpload';

interface WavOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  seconds?: number;
  /** Chunks written between `fmt ` and `data`, as DAWs do. */
  extraChunks?: Array<{ id: string; bytes: number }>;
  /** Override the declared data size — 0xFFFFFFFF is the streaming sentinel. */
  declaredDataSize?: number;
  riffTag?: string;
  waveTag?: string;
}

function makeWav(options: WavOptions = {}): File {
  const {
    sampleRate = 44100,
    channels = 2,
    bitsPerSample = 16,
    seconds = 3,
    extraChunks = [],
    declaredDataSize,
    riffTag = 'RIFF',
    waveTag = 'WAVE',
  } = options;

  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataBytes = Math.round(byteRate * seconds);
  // RIFF chunks are word-aligned: an odd-sized chunk carries a pad byte.
  // The fixture must write it, because the parser expects it.
  const extraTotal = extraChunks.reduce((n, c) => n + 8 + c.bytes + (c.bytes % 2), 0);

  const size = 12 + 24 + extraTotal + 8 + dataBytes;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let o = 0;

  const writeTag = (tag: string) => {
    for (let i = 0; i < 4; i++) bytes[o + i] = tag.charCodeAt(i);
    o += 4;
  };
  const writeU32 = (n: number) => {
    view.setUint32(o, n, true);
    o += 4;
  };
  const writeU16 = (n: number) => {
    view.setUint16(o, n, true);
    o += 2;
  };

  writeTag(riffTag);
  writeU32(size - 8);
  writeTag(waveTag);

  writeTag('fmt ');
  writeU32(16);
  writeU16(1); // PCM
  writeU16(channels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(bitsPerSample);

  for (const chunk of extraChunks) {
    writeTag(chunk.id);
    writeU32(chunk.bytes);
    o += chunk.bytes + (chunk.bytes % 2); // payload zeroes + any pad byte
  }

  writeTag('data');
  writeU32(declaredDataSize ?? dataBytes);

  return new File([buf], 'master.wav', { type: 'audio/wav' });
}

// jsdom implements Blob/File but not their arrayBuffer(). file.slice()
// returns a plain Blob, so the parser reads through Blob.prototype — patch
// that and File inherits it. Built on FileReader because jsdom has no
// working Response(blob). This is a jsdom gap, not a source gap: real
// browsers have had Blob.arrayBuffer since 2020.
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Blob.prototype as any).arrayBuffer = function arrayBuffer(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe('readAudioDuration — WAV headers', () => {
  it('reads a plain 44.1k/16-bit stereo file', async () => {
    const duration = await readAudioDuration(makeWav({ seconds: 3 }));
    expect(duration).toBeCloseTo(3, 3);
  });

  it('handles mono', async () => {
    const duration = await readAudioDuration(makeWav({ channels: 1, seconds: 2.5 }));
    expect(duration).toBeCloseTo(2.5, 3);
  });

  it('handles 24-bit at 48k, which is what a mastering engineer sends back', async () => {
    const duration = await readAudioDuration(
      makeWav({ sampleRate: 48000, bitsPerSample: 24, seconds: 4 })
    );
    expect(duration).toBeCloseTo(4, 3);
  });

  it('walks past LIST and bext chunks that DAWs write before the audio', async () => {
    const duration = await readAudioDuration(
      makeWav({
        seconds: 1.5,
        extraChunks: [
          { id: 'bext', bytes: 602 },
          { id: 'LIST', bytes: 40 },
        ],
      })
    );
    expect(duration).toBeCloseTo(1.5, 3);
  });

  it('handles an odd-sized chunk, which must be word-aligned', async () => {
    const duration = await readAudioDuration(
      makeWav({ seconds: 1, extraChunks: [{ id: 'LIST', bytes: 13 }] })
    );
    expect(duration).toBeCloseTo(1, 3);
  });

  it('falls back to the real file length when the data size is the streaming sentinel', async () => {
    const duration = await readAudioDuration(
      makeWav({ seconds: 2, declaredDataSize: 0xffffffff })
    );
    expect(duration).toBeCloseTo(2, 2);
  });

  it('returns null for something that is not a WAV at all', async () => {
    const notAudio = new File([new Uint8Array(2048)], 'sleeve.psd', {
      type: 'image/vnd.adobe.photoshop',
    });
    await expect(readAudioDuration(notAudio)).resolves.toBeNull();
  });

  it('returns null rather than 0 for a truncated header', async () => {
    const stub = new File([new Uint8Array(20)], 'broken.wav', { type: 'audio/wav' });
    await expect(readAudioDuration(stub)).resolves.toBeNull();
  });

  it('never reports zero for a real file — zero is what we are fixing', async () => {
    const duration = await readAudioDuration(makeWav({ seconds: 0.25 }));
    expect(duration).not.toBe(0);
    expect(duration).toBeGreaterThan(0);
  });
});
