/**
 * Reconcile a folder of audio against an album's tracklist.
 *
 * Two jobs, and which one runs depends only on whether the album already has
 * tracks:
 *
 *   EMPTY ALBUM  → propose creating a track per file, in a sensible order.
 *   EXISTING     → match each file to a track, and report where the two
 *                  disagree about the title.
 *
 * ── The rule this module exists to enforce ──────────────────────────────
 * A derived title is a GUESS, and it is never applied on its own. This album
 * proves why: `newspeak.wav` is the song "News Peak", and `rap.wav` is the
 * song "Please". No amount of string work gets there. If a sync silently
 * rewrote titles from filenames, the record would ship as "Newspeak" and
 * "Rap" — permanently, on every DSP.
 *
 * So every title difference comes back as a PROPOSAL carrying both sides and
 * a confidence, for a person to accept or reject. The only thing applied
 * without asking is a link between a file and a track that already agree.
 *
 * Pure: no filesystem, no network, no database. The caller supplies filenames
 * and rows, and gets a plan back.
 */
import { squash } from './ingest';

export interface ReconcileTrack {
  id: string;
  title: string;
  track_number: number;
}

export interface ReconcileFile {
  /** Path or bare filename — only the basename is read. */
  path: string;
  /** Seconds, when the caller knows it. Used to order a bulk create. */
  durationSeconds?: number | null;
}

export type ActionKind =
  | 'link'          // file and track agree; just record the pairing
  | 'retitle'       // they disagree — needs a human decision
  | 'create'        // no track for this file
  | 'missing';      // no file for this track

export interface ReconcileAction {
  kind: ActionKind;
  file: string | null;
  trackId: string | null;
  currentTitle: string | null;
  proposedTitle: string | null;
  /** 'exact' is safe to apply; anything else wants eyes on it. */
  confidence: 'exact' | 'strong' | 'weak' | 'none';
  reason: string;
}

export interface ReconcilePlan {
  actions: ReconcileAction[];
  /** True when the album had no tracks and this is a bulk create. */
  bulkCreate: boolean;
  counts: Record<ActionKind, number>;
}

const AUDIO_EXTENSIONS = ['wav', 'aiff', 'aif', 'flac', 'alac', 'mp3', 'm4a', 'aac', 'ogg'];

export function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

export function isAudioFile(path: string): boolean {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 && AUDIO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

/**
 * Turn a filename into a plausible title.
 *
 * Strips the things a DAW and a Finder leave behind — bounce counters
 * (`_1`), export timestamps (` 15.00.13`), `final`/`master` suffixes — then
 * un-snakes and title-cases what remains.
 *
 * It cannot invent a word boundary that was never written: "newspeak"
 * produces "Newspeak", not "News Peak". That is precisely why the result is
 * only ever a proposal.
 */
export function titleFromFilename(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  let stem = dot > 0 ? name.slice(0, dot) : name;

  stem = stem
    // " 15.00.13" — Logic's export clock
    .replace(/\s+\d{1,2}[.:]\d{2}([.:]\d{2})?$/, '')
    // Trailing bounce/version counters — but NOT a number that belongs to the
    // title. `the_mind_pt_1` and `the_mind_pt_2` are two different songs on
    // this record; stripping their counters collapses them into one name and
    // the wrong master ships.
    //
    // Written as capture-and-restore rather than a negative lookbehind: `\b`
    // does not match between `_` and `p`, because underscore is a word
    // character, so `(?<!\bpt...)` silently never fires on `the_mind_pt_1`.
    .replace(
      /(^|[_\s.-])((?:pt|part|vol|volume|no|num|chapter|act|side|disc)[_\s.-]{0,2}\d{1,2})$|[_\s-]+v?\d{1,2}$/i,
      '$1$2'
    )
    .replace(/[_\s-]+$/, '')
    // words that describe the FILE, not the song
    .replace(/[_\s-]+(final|master|mastered|mix|mixdown|bounce|export)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!stem) return basename(name);

  return stem
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Leave a token that is already mixed-case or all-caps alone — "1984",
      // "OK", "III" are written the way they are on purpose.
      if (/\d/.test(word) || (word.length > 1 && word === word.toUpperCase())) return word;
      // Every word capitalised, including "the" and "of". Conventional title
      // case would give "In the Court", but this album is written "In The
      // Court" and "The No End Theory" — follow the owner, not the style guide.
      void i;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Compare a filename stem to a track title, ignoring case and punctuation. */
function similarity(fileStem: string, trackTitle: string): 'exact' | 'strong' | 'weak' | 'none' {
  const a = squash(fileStem);
  const b = squash(trackTitle);
  if (!a || !b) return 'none';
  if (a === b) return 'exact';
  // One contains the other — "the_mind_pt_1" vs "The Mind Pt 1" after a
  // suffix strip, or a file carrying an extra qualifier.
  if (a.includes(b) || b.includes(a)) return 'strong';
  // Same opening run of characters: "makunahea" vs "makunahia" diverge at 7.
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  if (shared >= 5 && shared >= Math.min(a.length, b.length) * 0.7) return 'weak';
  return 'none';
}

/**
 * Match files to tracks and describe every difference.
 *
 * Matching is greedy by descending confidence so an exact match always claims
 * its track before a weaker candidate can. Each file and each track is used
 * at most once.
 */
export function reconcile(
  files: readonly ReconcileFile[],
  tracks: readonly ReconcileTrack[]
): ReconcilePlan {
  const audio = files.filter((f) => isAudioFile(f.path));
  const actions: ReconcileAction[] = [];

  // ---- bulk create ------------------------------------------------------
  if (tracks.length === 0) {
    audio.forEach((file, i) => {
      actions.push({
        kind: 'create',
        file: file.path,
        trackId: null,
        currentTitle: null,
        proposedTitle: titleFromFilename(file.path),
        confidence: 'none',
        reason: 'the album has no tracks yet — this would create one',
      });
      void i;
    });
    return { actions, bulkCreate: true, counts: tally(actions) };
  }

  // ---- score every pair, then take the best ones first ------------------
  type Pair = { file: ReconcileFile; track: ReconcileTrack; confidence: ReturnType<typeof similarity> };
  const RANK = { exact: 0, strong: 1, weak: 2, none: 3 } as const;

  const pairs: Pair[] = [];
  for (const file of audio) {
    const derived = titleFromFilename(file.path);
    for (const track of tracks) {
      const confidence = similarity(derived, track.title);
      if (confidence !== 'none') pairs.push({ file, track, confidence });
    }
  }
  pairs.sort((a, b) => RANK[a.confidence] - RANK[b.confidence]);

  const usedFiles = new Set<string>();
  const usedTracks = new Set<string>();

  for (const { file, track, confidence } of pairs) {
    if (usedFiles.has(file.path) || usedTracks.has(track.id)) continue;
    usedFiles.add(file.path);
    usedTracks.add(track.id);

    const derived = titleFromFilename(file.path);
    const agree = squash(derived) === squash(track.title);

    actions.push({
      kind: agree ? 'link' : 'retitle',
      file: file.path,
      trackId: track.id,
      currentTitle: track.title,
      proposedTitle: derived,
      confidence,
      reason: agree
        ? 'the filename and the track already agree'
        : `the file reads "${derived}", the track says "${track.title}" — pick one`,
    });
  }

  for (const file of audio) {
    if (usedFiles.has(file.path)) continue;
    actions.push({
      kind: 'create',
      file: file.path,
      trackId: null,
      currentTitle: null,
      proposedTitle: titleFromFilename(file.path),
      confidence: 'none',
      reason: 'no track resembles this file',
    });
  }

  for (const track of tracks) {
    if (usedTracks.has(track.id)) continue;
    actions.push({
      kind: 'missing',
      file: null,
      trackId: track.id,
      currentTitle: track.title,
      proposedTitle: null,
      confidence: 'none',
      reason: 'no file in this folder matches this track',
    });
  }

  // Read in album order, with the unmatched files after the tracklist.
  const position = new Map(tracks.map((t) => [t.id, t.track_number]));
  actions.sort(
    (a, b) =>
      (a.trackId ? (position.get(a.trackId) ?? 0) : Number.MAX_SAFE_INTEGER) -
      (b.trackId ? (position.get(b.trackId) ?? 0) : Number.MAX_SAFE_INTEGER)
  );
  return { actions, bulkCreate: false, counts: tally(actions) };
}

function tally(actions: readonly ReconcileAction[]): Record<ActionKind, number> {
  const counts: Record<ActionKind, number> = { link: 0, retitle: 0, create: 0, missing: 0 };
  for (const a of actions) counts[a.kind]++;
  return counts;
}

/** Only exact agreement is ever safe to write without a person looking. */
export function autoApplicable(plan: ReconcilePlan): ReconcileAction[] {
  return plan.actions.filter((a) => a.kind === 'link');
}

/** Everything that needs a decision, worst first. */
export function needsReview(plan: ReconcilePlan): ReconcileAction[] {
  const order: ActionKind[] = ['retitle', 'create', 'missing'];
  return plan.actions
    .filter((a) => a.kind !== 'link')
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
