/**
 * planFolder — reading the album the way it sits on the owner's disk.
 *
 * The tracklist here is the real one, because the hard cases are real: "1984"
 * must not read as track 19, "The Mind Pt 2" must not be swallowed by "The
 * Mind Pt 1", and a file called `master.wav` has nothing in its name to
 * identify it — only the folder above it does.
 */
import {
  matchTrack,
  planFolder,
  squash,
  type IngestTrack,
} from '@/lib/release/ingest';

const TRACKS: IngestTrack[] = [
  'Welcome',
  '1984',
  'The No End Theory',
  'In The Court',
  'News Peak',
  'Every Generation',
  'Please',
  'Makunahia',
  'The Other Side',
  'The Mind Pt 1',
  'Midnight Marauders',
  'The Mind Pt 2',
  'Ghost World',
].map((title, i) => ({ id: `t${i + 1}`, title, track_number: i + 1 }));

const byPath = (plan: ReturnType<typeof planFolder>, path: string) =>
  plan.files.find((f) => f.path === path);

describe('matchTrack', () => {
  it('identifies the song from the folder when the filename says nothing', () => {
    const m = matchTrack('News Peak/masters/master.wav', TRACKS);
    expect(m?.track.title).toBe('News Peak');
  });

  it('reads a leading track number', () => {
    expect(matchTrack('05 News Peak/masters/final.wav', TRACKS)?.track.track_number).toBe(5);
  });

  it('does NOT read 1984 as track 19', () => {
    // A bare number with no separator is a title, not a position.
    const m = matchTrack('1984/masters/1984_master.wav', TRACKS);
    expect(m?.track.title).toBe('1984');
    expect(m?.track.track_number).toBe(2);
  });

  it('prefers the longest matching title', () => {
    // "The Mind Pt 1" is a substring risk for "The Mind Pt 2".
    expect(matchTrack('The Mind Pt 2/masters/m.wav', TRACKS)?.track.title).toBe('The Mind Pt 2');
    expect(matchTrack('The Mind Pt 1/masters/m.wav', TRACKS)?.track.title).toBe('The Mind Pt 1');
  });

  it('ignores category folders when looking for the song', () => {
    // "masters" must never be tried as a title.
    expect(matchTrack('Loop Soul/masters/Ghost World.wav', TRACKS)?.track.title).toBe('Ghost World');
  });

  it('prefers the nearer folder over the album root', () => {
    expect(matchTrack('Please/mixes/Welcome to the session.wav', TRACKS)?.track.title).toBe('Please');
  });

  it('matches through punctuation and case', () => {
    expect(matchTrack('the-no-end-theory/masters/x.wav', TRACKS)?.track.title).toBe('The No End Theory');
  });

  it('returns null when nothing identifies a song', () => {
    expect(matchTrack('masters/untitled bounce.wav', TRACKS)).toBeNull();
  });
});

describe('planFolder — the folder decides, not the filename', () => {
  it('classifies a generic master by its folder', () => {
    const plan = planFolder(['News Peak/masters/final.wav'], TRACKS);
    const file = byPath(plan, 'News Peak/masters/final.wav');
    expect(file?.fileClass).toBe('commercial');
    expect(file?.fileCategory).toBe('audio-master');
    expect(file?.ship).toBe(true);
  });

  it('never ships a mix, however final its name claims to be', () => {
    const plan = planFolder(['Please/mixes/master_final_FINAL.wav'], TRACKS);
    const file = byPath(plan, 'Please/mixes/master_final_FINAL.wav');
    expect(file?.fileClass).toBe('master');
    expect(file?.ship).toBe(false);
  });

  it('files a Logic session as working material', () => {
    const plan = planFolder(['1984/logic files/1984.logicx'], TRACKS);
    const file = byPath(plan, '1984/logic files/1984.logicx');
    expect(file?.fileClass).toBe('working');
    expect(file?.fileCategory).toBe('daw-project');
    expect(file?.ship).toBe(false);
  });

  it('routes cover art to a cover piece, and its PSD to working', () => {
    const plan = planFolder(
      ['cover art/loop soul cover.jpg', 'cover art/loop soul cover.psd'],
      TRACKS
    );
    expect(byPath(plan, 'cover art/loop soul cover.jpg')?.pieceKind).toBe('cover');
    expect(byPath(plan, 'cover art/loop soul cover.jpg')?.fileClass).toBe('commercial');
    expect(byPath(plan, 'cover art/loop soul cover.psd')?.fileClass).toBe('working');
  });

  it('routes a sleeve to packaging', () => {
    const plan = planFolder(['packaging/vinyl sleeve.pdf'], TRACKS);
    expect(byPath(plan, 'packaging/vinyl sleeve.pdf')?.pieceKind).toBe('packaging');
  });

  it('uses the nearest category folder, not the outermost', () => {
    const plan = planFolder(['masters/News Peak/mixes/rough.wav'], TRACKS);
    expect(byPath(plan, 'masters/News Peak/mixes/rough.wav')?.ship).toBe(false);
  });
});

describe('planFolder — choosing what ships', () => {
  it('prefers lossless over a convenience mp3', () => {
    const plan = planFolder(
      ['News Peak/masters/master.wav', 'News Peak/masters/master.mp3'],
      TRACKS
    );
    expect(byPath(plan, 'News Peak/masters/master.wav')?.ship).toBe(true);
    expect(byPath(plan, 'News Peak/masters/master.mp3')?.ship).toBe(false);
  });

  it('refuses to guess between two equal masters', () => {
    const plan = planFolder(
      ['Please/masters/take a.wav', 'Please/masters/take b.wav'],
      TRACKS
    );
    expect(plan.files.filter((f) => f.ship)).toHaveLength(0);
    expect(byPath(plan, 'Please/masters/take a.wav')?.reason).toContain('pick one');
  });

  it('never auto-ships audio found outside a named folder', () => {
    const plan = planFolder(['News Peak/News Peak.wav'], TRACKS);
    expect(byPath(plan, 'News Peak/News Peak.wav')?.ship).toBe(false);
  });

  it('reports the songs still without a master', () => {
    const plan = planFolder(['News Peak/masters/m.wav'], TRACKS);
    expect(plan.tracksWithoutMaster).toHaveLength(TRACKS.length - 1);
    expect(plan.tracksWithoutMaster.map((t) => t.title)).not.toContain('News Peak');
  });
});

describe('planFolder — noise', () => {
  it('skips macOS junk and resource forks', () => {
    const plan = planFolder(
      ['News Peak/masters/.DS_Store', 'News Peak/masters/._master.wav', 'News Peak/masters/master.wav'],
      TRACKS
    );
    expect(plan.files).toHaveLength(1);
    expect(plan.skipped).toHaveLength(2);
  });

  it('skips a file type it does not handle rather than guessing', () => {
    const plan = planFolder(['News Peak/masters/notes.xyz'], TRACKS);
    expect(plan.files).toHaveLength(0);
    expect(plan.skipped[0].reason).toContain('.xyz');
  });
});

describe('planFolder — a whole album tree with generic filenames', () => {
  const paths = [
    ...TRACKS.flatMap((t) => [
      `${t.title}/logic files/session.logicx`,
      `${t.title}/mixes/rough.wav`,
      `${t.title}/masters/master.wav`,
    ]),
    'cover art/front.jpg',
    'packaging/sleeve.pdf',
    '.DS_Store',
  ];

  const plan = planFolder(paths, TRACKS);

  it('finds a shipping master for every song', () => {
    expect(plan.files.filter((f) => f.ship)).toHaveLength(TRACKS.length);
    expect(plan.tracksWithoutMaster).toHaveLength(0);
  });

  it('assigns every audio file to the right song despite identical filenames', () => {
    for (const t of TRACKS) {
      const master = byPath(plan, `${t.title}/masters/master.wav`);
      expect(master?.trackId).toBe(t.id);
      expect(master?.ship).toBe(true);
    }
  });

  it('ships nothing from the mixes or logic folders', () => {
    const wrong = plan.files.filter(
      (f) => f.ship && (f.path.includes('/mixes/') || f.path.includes('/logic'))
    );
    expect(wrong).toEqual([]);
  });

  it('leaves the artwork unattached to any song', () => {
    expect(byPath(plan, 'cover art/front.jpg')?.trackId).toBeNull();
  });
});

describe('squash', () => {
  it('reduces a title to comparable letters', () => {
    expect(squash('News Peak')).toBe('newspeak');
    expect(squash('The Mind Pt. 2')).toBe('themindpt2');
  });
});
