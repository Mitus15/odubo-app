/**
 * The delivery sheet, as a file a distributor will accept.
 *
 * There is no public release-creation API at DistroKid, TuneCore or CD Baby —
 * the spreadsheet IS the deliverable. So this is not a debug export: it is the
 * artifact the album ships on, and it has to be right the first time.
 *
 * Pure and string-only. No DOM here — the caller owns the download — so this
 * is testable, and the same function could serve a server route later.
 */
import type { ReleaseForValidation, TrackForValidation } from './releaseValidation';
import { normalizeIsrc } from './releaseValidation';

export interface CsvRelease extends ReleaseForValidation {
  label_name: string | null;
  language: string | null;
  territories: string | null;
  explicit_content: number | boolean | null;
}

export interface CsvTrack extends TrackForValidation {
  version: string | null;
  featuring_artists: string | null;
  composers: string | null;
  producers: string | null;
  performers: string | null;
  explicit: number | boolean | null;
  instrumental: number | boolean | null;
  lyrics_language: string | null;
}

/** The column order distributors' importers expect: release, then track. */
export const CSV_COLUMNS: readonly string[] = [
  'release_title',
  'release_artist',
  'label',
  'upc',
  'release_date',
  'genre',
  'language',
  'territories',
  'copyright_line',
  'phonographic_line',
  'disc_number',
  'track_number',
  'track_title',
  'track_version',
  'track_artist',
  'featuring_artists',
  'isrc',
  'duration',
  'duration_seconds',
  'composers',
  'producers',
  'performers',
  'explicit',
  'instrumental',
  'lyrics_language',
  'audio_file',
];

/**
 * RFC 4180 quoting. Everything is quoted rather than only what needs it —
 * a title containing a comma is the common case here ("Please, Please"), and
 * conditional quoting is where CSV writers go wrong.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Stored as a JSON array; a distributor wants "A; B". */
function joinJsonList(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean).join('; ');
    }
  } catch {
    /* not JSON — a plain string is a reasonable thing to have typed */
  }
  return String(raw).trim();
}

function yesNo(value: number | boolean | null | undefined): string {
  return value ? 'Yes' : 'No';
}

/** Seconds as mm:ss — the human column, next to the machine one. */
function clock(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The filename from the shipped master's r2 key — its basename. */
function audioFileName(r2Key: string | null | undefined): string {
  if (!r2Key) return '';
  const parts = r2Key.split('/');
  return parts[parts.length - 1] ?? '';
}

export function buildDistributorCsv(
  release: CsvRelease,
  tracks: readonly CsvTrack[]
): string {
  const territories = joinJsonList(release.territories) || 'worldwide';

  const ordered = [...tracks].sort(
    (a, b) => (a.track_number ?? 0) - (b.track_number ?? 0)
  );

  const lines = [CSV_COLUMNS.map(cell).join(',')];

  for (const track of ordered) {
    lines.push(
      [
        release.title ?? '',
        release.artist_name ?? '',
        release.label_name ?? '',
        release.upc ?? '',
        release.distribution_release_date ?? '',
        release.genre ?? '',
        release.language ?? 'en',
        territories,
        release.copyright_line ?? '',
        release.phonographic_line ?? '',
        1,
        track.track_number ?? '',
        track.title ?? '',
        track.version ?? '',
        track.artist_name ?? '',
        joinJsonList(track.featuring_artists),
        normalizeIsrc(track.isrc) ?? '',
        clock(track.duration_seconds),
        track.duration_seconds ?? '',
        joinJsonList(track.composers),
        joinJsonList(track.producers),
        joinJsonList(track.performers),
        yesNo(track.explicit ?? release.explicit_content),
        yesNo(track.instrumental),
        track.lyrics_language ?? release.language ?? 'en',
        audioFileName(track.audio_r2_key),
      ]
        .map(cell)
        .join(',')
    );
  }

  // Trailing newline: some importers drop the final row without it.
  return `${lines.join('\r\n')}\r\n`;
}

/** "loop-soul-delivery-2026-10-03.csv" */
export function csvFilename(release: CsvRelease): string {
  const slug = (release.title ?? 'release')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'release';
  const date = release.distribution_release_date ?? 'undated';
  return `${slug}-delivery-${date}.csv`;
}
