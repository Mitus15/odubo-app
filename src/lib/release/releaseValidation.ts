/**
 * Release Control — what a distributor will and will not accept.
 *
 * This is the gate in front of the delivery sheet. It is pure and has no
 * imports so it can run identically in the grid (live, as the owner types)
 * and in a test.
 *
 * The severity split is the whole design, and it is not cosmetic:
 *
 *   ERROR — the sheet is wrong. Something is present and malformed, or two
 *           rows claim the same identifier. Export is blocked.
 *   WARN  — the sheet is incomplete but not wrong. An identifier is BLANK
 *           because the distributor has not issued it yet, which is the
 *           normal state before delivery. Export is allowed.
 *
 * Blocking on blank identifiers would be wrong: DistroKid/TuneCore assign
 * ISRCs and the UPC at submission, so a correct pre-delivery sheet has empty
 * cells. Blocking on a MALFORMED one is right — a typo'd ISRC silently
 * detaches a recording from its royalties, and nothing downstream catches it.
 */

/** ISRC: CC-XXX-YY-NNNNN — country(2), registrant(3), year(2), designation(5). */
export const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

/** UPC/EAN: 12 (UPC-A) or 13 (EAN-13) digits. */
export const UPC_PATTERN = /^\d{12,13}$/;

/**
 * The UPC that has been sitting in production since the album was seeded.
 * It is a textbook check-digit example, not an identifier anyone issued.
 * It passes UPC_PATTERN, so it must be caught by VALUE or it ships.
 */
export const PLACEHOLDER_UPCS: readonly string[] = ['012345678905', '000000000000'];

/** Registrant codes that only appear in documentation examples. */
const PLACEHOLDER_ISRC_REGISTRANTS: readonly string[] = ['ABC', 'XXX', '000'];

export type Severity = 'error' | 'warn';

export interface ValidationIssue {
  severity: Severity;
  /** null for release-level issues, else the release-track row id. */
  trackId: string | null;
  /** The column this is about, so the grid can highlight the right cell. */
  field: string;
  message: string;
}

export interface ReleaseForValidation {
  title: string | null;
  artist_name: string | null;
  upc: string | null;
  distribution_release_date: string | null;
  genre: string | null;
  copyright_line: string | null;
  phonographic_line: string | null;
}

export interface TrackForValidation {
  id: string;
  track_number: number | null;
  title: string | null;
  artist_name: string | null;
  isrc: string | null;
  duration_seconds: number | null;
  /** Set iff a commercial master is flagged to ship for this song. */
  audio_r2_key: string | null;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warnCount: number;
  /** The CSV is only allowed out when nothing is actually wrong. */
  canExport: boolean;
}

/** Trim to null so "" and "   " are both treated as absent, never as a value. */
function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** ISRCs are conventionally written with dashes; compare without them. */
export function normalizeIsrc(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  return trimmed ? trimmed.toUpperCase().replace(/[\s-]/g, '') : null;
}

export function validateRelease(
  release: ReleaseForValidation,
  tracks: readonly TrackForValidation[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (severity: Severity, trackId: string | null, field: string, message: string) =>
    issues.push({ severity, trackId, field, message });

  // ---- release level ----------------------------------------------------
  if (!clean(release.title)) add('error', null, 'title', 'The release has no title.');
  if (!clean(release.artist_name)) {
    add('error', null, 'artist_name', 'The release has no artist name.');
  }
  if (!clean(release.distribution_release_date)) {
    add('error', null, 'distribution_release_date', 'No release date is set.');
  }

  const upc = clean(release.upc);
  if (!upc) {
    add('warn', null, 'upc', 'No UPC yet — most distributors issue one at submission.');
  } else if (PLACEHOLDER_UPCS.includes(upc)) {
    add('error', null, 'upc', `${upc} is a placeholder, not a real UPC. Clear it or replace it.`);
  } else if (!UPC_PATTERN.test(upc)) {
    add('error', null, 'upc', `"${upc}" is not a UPC — it must be 12 or 13 digits.`);
  }

  if (!clean(release.genre)) add('warn', null, 'genre', 'No genre set. Every DSP asks for one.');
  if (!clean(release.copyright_line)) {
    add('warn', null, 'copyright_line', 'No © line (composition).');
  }
  if (!clean(release.phonographic_line)) {
    add('warn', null, 'phonographic_line', 'No ℗ line (recording).');
  }

  // ---- track level ------------------------------------------------------
  if (tracks.length === 0) {
    add('error', null, 'tracks', 'The release has no tracks.');
  }

  const isrcSeen = new Map<string, string[]>();
  const numberSeen = new Map<number, string[]>();

  for (const track of tracks) {
    const label = clean(track.title) ?? 'Untitled';

    if (!clean(track.title)) add('error', track.id, 'title', 'This track has no title.');
    if (!clean(track.artist_name)) {
      add('error', track.id, 'artist_name', `"${label}" has no artist name.`);
    }

    if (track.track_number === null || !Number.isInteger(track.track_number) || track.track_number < 1) {
      add('error', track.id, 'track_number', `"${label}" has no valid track number.`);
    } else {
      const list = numberSeen.get(track.track_number) ?? [];
      list.push(label);
      numberSeen.set(track.track_number, list);
    }

    const isrc = normalizeIsrc(track.isrc);
    if (!isrc) {
      add('warn', track.id, 'isrc', `"${label}" has no ISRC yet.`);
    } else if (!ISRC_PATTERN.test(isrc)) {
      add('error', track.id, 'isrc', `"${isrc}" is not a valid ISRC (needs CCXXXYYNNNNN).`);
    } else {
      if (PLACEHOLDER_ISRC_REGISTRANTS.includes(isrc.slice(2, 5))) {
        add('error', track.id, 'isrc', `"${isrc}" uses a placeholder registrant code.`);
      }
      const list = isrcSeen.get(isrc) ?? [];
      list.push(label);
      isrcSeen.set(isrc, list);
    }

    if (!track.duration_seconds || track.duration_seconds <= 0) {
      add('warn', track.id, 'duration_seconds', `"${label}" has no duration.`);
    }

    if (!clean(track.audio_r2_key)) {
      add('warn', track.id, 'audio_r2_key', `"${label}" has no master flagged to ship.`);
    }
  }

  // An ISRC identifies one recording. Two rows sharing one is not a typo the
  // distributor will fix — it silently merges two songs' royalties.
  for (const [isrc, labels] of isrcSeen) {
    if (labels.length > 1) {
      add('error', null, 'isrc', `ISRC ${isrc} is on ${labels.length} tracks: ${labels.join(', ')}.`);
    }
  }
  for (const [number, labels] of numberSeen) {
    if (labels.length > 1) {
      add('error', null, 'track_number', `Track ${number} is used ${labels.length} times: ${labels.join(', ')}.`);
    }
  }

  // A gap means a song is missing from the sheet, not that numbering is odd.
  const numbers = [...numberSeen.keys()].sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      add('error', null, 'track_number', `Track numbering jumps to ${numbers[i]} — ${i + 1} is missing.`);
      break;
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  return {
    issues,
    errorCount,
    warnCount: issues.length - errorCount,
    canExport: errorCount === 0,
  };
}

/** Issues for one row, for the grid's per-cell highlighting. */
export function issuesForTrack(
  result: ValidationResult,
  trackId: string
): ValidationIssue[] {
  return result.issues.filter((i) => i.trackId === trackId);
}
