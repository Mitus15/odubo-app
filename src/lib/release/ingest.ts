/**
 * Folder ingest — read the album the way it is actually organised on disk.
 *
 * The owner does not name files for a computer. A master is called
 * `master.wav`, and what makes it track 5's master is that it sits in
 * `News Peak/masters/`. So the FOLDER is authoritative, not the filename:
 * a generic `masters/final.wav` classifies correctly, and a stray file called
 * `master_mix_final.wav` sitting in `mixes/` is still a mix.
 *
 * Two independent questions, answered from different parts of the path:
 *
 *   WHAT IS IT?  — from the category segment (masters, mixes, logic, cover…)
 *   WHICH SONG?  — from the remaining segments, which is where a song title
 *                  or a track number lives.
 *
 * Pure. No filesystem, no upload, no network — the caller owns all of that,
 * so the matcher can be tested against a whole album tree in milliseconds.
 */
import type { FileCategory, FileClass, PieceKind } from './types';

export interface IngestTrack {
  id: string;
  title: string;
  track_number: number;
}

export interface PlannedFile {
  /** The path as given, so the caller can find the File object again. */
  path: string;
  filename: string;
  /** null when no song could be identified — it lands in the inbox. */
  trackId: string | null;
  trackTitle: string | null;
  pieceKind: PieceKind;
  fileClass: FileClass;
  fileCategory: FileCategory;
  /** Auto-flag this as the commercial master that ships. */
  ship: boolean;
  /** Plain-language account of the decision, shown in the plan table. */
  reason: string;
}

export interface IngestPlan {
  files: PlannedFile[];
  /** Songs with no shipping master in this folder. */
  tracksWithoutMaster: IngestTrack[];
  skipped: Array<{ path: string; reason: string }>;
}

const LOSSLESS = ['wav', 'aiff', 'aif', 'flac', 'alac'];
const LOSSY = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wma'];
const IMAGE = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'];
const ARTWORK_SOURCE = ['psd', 'ai', 'indd', 'sketch', 'fig', 'afdesign', 'afphoto'];
const DAW = ['logicx', 'als', 'flp', 'ptx', 'cpr', 'band', 'song', 'rpp', 'aup3'];
const VIDEO = ['mp4', 'mov', 'm4v', 'avi', 'mkv'];
const DOCUMENT = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'];

/** Junk every macOS folder carries. Never worth uploading. */
const IGNORED_NAMES = ['.ds_store', 'thumbs.db', 'desktop.ini', 'icon\r', '.localized'];

type CategoryKind =
  | 'masters'
  | 'mixes'
  | 'working'
  | 'cover'
  | 'packaging'
  | 'promo'
  | 'documents';

/**
 * Folder names that declare what a file is.
 *
 * Order matters: the FIRST entry whose keywords appear wins, so `masters` is
 * checked before `mixes` — but a segment matching both ("mixes and masters")
 * is genuinely ambiguous and the caller can override it in the plan table.
 */
const CATEGORY_RULES: Array<{ kind: CategoryKind; keywords: string[] }> = [
  { kind: 'working', keywords: ['logic', 'session', 'sessions', 'stems', 'project', 'projects', 'daw', 'multitrack', 'tracking'] },
  { kind: 'masters', keywords: ['master', 'masters', 'mastered', 'final', 'finals', 'delivery', 'deliverables'] },
  { kind: 'mixes', keywords: ['mix', 'mixes', 'mixdown', 'mixdowns', 'rough', 'roughs', 'bounce', 'bounces', 'reference'] },
  { kind: 'cover', keywords: ['cover', 'covers', 'artwork', 'art', 'sleeve art', 'front'] },
  { kind: 'packaging', keywords: ['packaging', 'sleeve', 'vinyl', 'insert', 'inserts', 'booklet', 'label', 'print'] },
  { kind: 'promo', keywords: ['promo', 'promos', 'press', 'social', 'marketing', 'visualizer', 'visualiser'] },
  { kind: 'documents', keywords: ['docs', 'documents', 'notes', 'lyrics', 'admin', 'contracts', 'splits'] },
];

const CATEGORY_SEGMENTS = new Set(CATEGORY_RULES.flatMap((r) => r.keywords));

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

/** "News Peak" and "news-peak_01" both squash toward the same core. */
export function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function classifySegment(segment: string): CategoryKind | null {
  const lower = segment.toLowerCase().trim();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower === k || lower.includes(k))) return rule.kind;
  }
  return null;
}

/**
 * A leading 1–2 digit track number, e.g. "05 News Peak" or "5. News Peak".
 *
 * The separator is REQUIRED. Without it "1984" would read as track 19 with a
 * stray "84" — and 1984 is a song on this record, so this is not hypothetical.
 */
function leadingTrackNumber(segment: string): number | null {
  const match = /^(\d{1,2})[\s._)\-]+\S/.exec(segment.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 99 ? n : null;
}

/**
 * Which song does this path belong to?
 *
 * Every non-category segment is a candidate, nearest-to-the-file first — the
 * containing folder describes the file better than the album root does.
 * A track number is decisive; otherwise the LONGEST matching title wins, so
 * "The Mind Pt 2" is not swallowed by "The Mind Pt 1".
 */
export function matchTrack(
  path: string,
  tracks: readonly IngestTrack[]
): { track: IngestTrack; how: string } | null {
  const segments = path.split('/').filter(Boolean);
  const filename = segments[segments.length - 1] ?? '';
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;

  // Nearest first, filename last: a folder name is a stronger signal than a
  // file called "master.wav", but the filename still gets a turn.
  const candidates = [...segments.slice(0, -1).reverse(), stem].filter(
    (s) => !CATEGORY_SEGMENTS.has(s.toLowerCase().trim())
  );

  for (const segment of candidates) {
    const number = leadingTrackNumber(segment);
    if (number !== null) {
      const byNumber = tracks.find((t) => t.track_number === number);
      if (byNumber) return { track: byNumber, how: `track number ${number} in "${segment}"` };
    }
  }

  for (const segment of candidates) {
    const squashed = squash(segment);
    if (!squashed) continue;
    let best: IngestTrack | null = null;
    let bestLength = 0;
    for (const track of tracks) {
      const title = squash(track.title);
      if (title.length < 2 || !squashed.includes(title)) continue;
      if (title.length > bestLength) {
        best = track;
        bestLength = title.length;
      }
    }
    if (best) return { track: best, how: `title "${best.title}" in "${segment}"` };
  }

  return null;
}

interface Classification {
  pieceKind: PieceKind;
  fileClass: FileClass;
  fileCategory: FileCategory;
  shipCandidate: boolean;
  note: string;
}

function classify(path: string, extension: string): Classification | null {
  const segments = path.split('/').filter(Boolean).slice(0, -1);

  // Nearest folder wins: "News Peak/masters" is about mastering, not the album.
  let kind: CategoryKind | null = null;
  let via = '';
  for (const segment of [...segments].reverse()) {
    const found = classifySegment(segment);
    if (found) {
      kind = found;
      via = segment;
      break;
    }
  }

  const isAudio = LOSSLESS.includes(extension) || LOSSY.includes(extension);
  const isImage = IMAGE.includes(extension);
  const isSource = ARTWORK_SOURCE.includes(extension);
  const isDaw = DAW.includes(extension);

  switch (kind) {
    case 'masters':
      if (!isAudio) break;
      return {
        pieceKind: 'track-master',
        fileClass: 'commercial',
        fileCategory: 'audio-master',
        shipCandidate: true,
        note: `in "${via}" — a master`,
      };
    case 'mixes':
      if (!isAudio) break;
      return {
        pieceKind: 'track-master',
        fileClass: 'master',
        fileCategory: 'audio-master',
        // A mix is never what ships, however final the filename claims to be.
        shipCandidate: false,
        note: `in "${via}" — a mix, never ships`,
      };
    case 'working':
      return {
        pieceKind: 'track-master',
        fileClass: 'working',
        fileCategory: isDaw || isAudio ? 'daw-project' : 'other',
        shipCandidate: false,
        note: `in "${via}" — working material`,
      };
    case 'cover':
      return {
        pieceKind: 'cover',
        fileClass: isSource ? 'working' : 'commercial',
        fileCategory: isSource ? 'artwork-source' : 'preview-image',
        shipCandidate: false,
        note: `in "${via}" — cover art`,
      };
    case 'packaging':
      return {
        pieceKind: 'packaging',
        fileClass: isSource ? 'working' : 'commercial',
        fileCategory: isSource ? 'artwork-source' : 'preview-image',
        shipCandidate: false,
        note: `in "${via}" — packaging`,
      };
    case 'promo':
      return {
        pieceKind: 'promo',
        fileClass: 'commercial',
        fileCategory: VIDEO.includes(extension) ? 'video' : isImage ? 'preview-image' : 'other',
        shipCandidate: false,
        note: `in "${via}" — promo`,
      };
    case 'documents':
      return {
        pieceKind: 'other',
        fileClass: 'working',
        fileCategory: 'document',
        shipCandidate: false,
        note: `in "${via}" — document`,
      };
    default:
      break;
  }

  // No category folder — fall back to the file type alone. Deliberately
  // conservative: nothing reached this way is ever auto-shipped.
  if (isAudio) {
    return {
      pieceKind: 'track-master',
      fileClass: 'master',
      fileCategory: 'audio-master',
      shipCandidate: false,
      note: 'audio in no named folder — filed, not shipped',
    };
  }
  if (isDaw) {
    return { pieceKind: 'track-master', fileClass: 'working', fileCategory: 'daw-project', shipCandidate: false, note: 'a session file' };
  }
  if (isSource) {
    return { pieceKind: 'other', fileClass: 'working', fileCategory: 'artwork-source', shipCandidate: false, note: 'an artwork source' };
  }
  if (isImage) {
    return { pieceKind: 'other', fileClass: 'commercial', fileCategory: 'preview-image', shipCandidate: false, note: 'an image' };
  }
  if (VIDEO.includes(extension)) {
    return { pieceKind: 'promo', fileClass: 'commercial', fileCategory: 'video', shipCandidate: false, note: 'a video' };
  }
  if (DOCUMENT.includes(extension)) {
    return { pieceKind: 'other', fileClass: 'working', fileCategory: 'document', shipCandidate: false, note: 'a document' };
  }
  return null;
}

/**
 * Plan an ingest.
 *
 * A file is auto-shipped only when the answer is unambiguous: it is in a
 * masters folder, it belongs to a known song, and it is the single best
 * candidate for that song. Anything else is filed with ship unset and left to
 * the owner — this writes the distributor's delivery record, so guessing is
 * worse than asking.
 */
export function planFolder(
  paths: readonly string[],
  tracks: readonly IngestTrack[]
): IngestPlan {
  const files: PlannedFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  for (const path of paths) {
    const filename = path.split('/').filter(Boolean).pop() ?? '';
    if (!filename || filename.startsWith('._')) {
      skipped.push({ path, reason: 'resource fork' });
      continue;
    }
    if (IGNORED_NAMES.includes(filename.toLowerCase())) {
      skipped.push({ path, reason: 'system file' });
      continue;
    }

    const extension = extensionOf(filename);
    if (!extension) {
      skipped.push({ path, reason: 'no file extension' });
      continue;
    }

    const classification = classify(path, extension);
    if (!classification) {
      skipped.push({ path, reason: `.${extension} is not a file type this handles` });
      continue;
    }

    const matched =
      classification.pieceKind === 'track-master' ? matchTrack(path, tracks) : null;

    files.push({
      path,
      filename,
      trackId: matched?.track.id ?? null,
      trackTitle: matched?.track.title ?? null,
      pieceKind: classification.pieceKind,
      fileClass: classification.fileClass,
      fileCategory: classification.fileCategory,
      ship: false,
      reason: matched
        ? `${classification.note}; matched by ${matched.how}`
        : classification.pieceKind === 'track-master'
          ? `${classification.note}; no song identified — goes to the inbox`
          : classification.note,
    });
  }

  // ---- pick one shipping master per song --------------------------------
  const byTrack = new Map<string, PlannedFile[]>();
  for (const file of files) {
    if (!file.trackId) continue;
    const classified = classify(file.path, extensionOf(file.filename));
    if (!classified?.shipCandidate) continue;
    const list = byTrack.get(file.trackId) ?? [];
    list.push(file);
    byTrack.set(file.trackId, list);
  }

  for (const [, candidates] of byTrack) {
    // Lossless is what a distributor wants; an mp3 next to a wav is a
    // convenience copy, not the deliverable.
    const lossless = candidates.filter((f) => LOSSLESS.includes(extensionOf(f.filename)));
    const pool = lossless.length > 0 ? lossless : candidates;

    if (pool.length === 1) {
      pool[0].ship = true;
      pool[0].reason += '; flagged to ship';
    } else {
      for (const file of pool) {
        file.reason += `; ${pool.length} masters for this song — pick one to ship`;
      }
    }
  }

  const shipped = new Set(files.filter((f) => f.ship).map((f) => f.trackId));
  return {
    files,
    tracksWithoutMaster: tracks.filter((t) => !shipped.has(t.id)),
    skipped,
  };
}
