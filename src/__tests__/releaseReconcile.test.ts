/**
 * Reconciling a folder of audio against a tracklist.
 *
 * The cases that matter are the ones where a filename is CONFIDENTLY wrong.
 * On this record `newspeak.wav` is the song "News Peak" and `rap.wav` is the
 * song "Please" — a sync that trusted filenames would rename both, forever,
 * on every DSP. So the load-bearing assertions here are about what the module
 * REFUSES to decide on its own.
 */
import {
  autoApplicable,
  needsReview,
  reconcile,
  titleFromFilename,
  type ReconcileTrack,
} from '@/lib/release/reconcile';

const TRACKS: ReconcileTrack[] = [
  'Welcome', '1984', 'The No End Theory', 'In The Court', 'News Peak',
  'Every Generation', 'Please', 'Makunahea', 'The Other Side',
  'The Mind Pt 1', 'Midnight Marauders', 'The Mind Pt 2', 'Ghost World',
].map((title, i) => ({ id: `t${i + 1}`, title, track_number: i + 1 }));

const f = (...paths: string[]) => paths.map((path) => ({ path }));
const forFile = (plan: ReturnType<typeof reconcile>, name: string) =>
  plan.actions.find((a) => a.file?.endsWith(name));
const forTrack = (plan: ReturnType<typeof reconcile>, title: string) =>
  plan.actions.find((a) => a.currentTitle === title);

describe('titleFromFilename', () => {
  it('un-snakes and title-cases every word, the way this album is written', () => {
    // Conventional title case gives "In the Court"; the owner writes
    // "In The Court" and "The No End Theory". Follow the owner.
    expect(titleFromFilename('in_the_court.wav')).toBe('In The Court');
    expect(titleFromFilename('ghost_world.wav')).toBe('Ghost World');
  });

  it('strips a bounce counter', () => {
    expect(titleFromFilename('the_no_end_theory_1.wav')).toBe('The No End Theory');
    expect(titleFromFilename('every_generation_1.wav')).toBe('Every Generation');
  });

  it("strips Logic's export clock", () => {
    expect(titleFromFilename('the_other_side 15.00.13.wav')).toBe('The Other Side');
  });

  it('strips words that describe the file rather than the song', () => {
    expect(titleFromFilename('ghost_world_master.wav')).toBe('Ghost World');
    expect(titleFromFilename('welcome_final.wav')).toBe('Welcome');
  });

  it('leaves a numeric title alone', () => {
    expect(titleFromFilename('1984.wav')).toBe('1984');
  });

  it('keeps a number that belongs to the title', () => {
    // The trap: stripping these collapses two different songs into one name.
    expect(titleFromFilename('the_mind_pt_1.wav')).toBe('The Mind Pt 1');
    expect(titleFromFilename('the_mind_pt_2.wav')).toBe('The Mind Pt 2');
    expect(titleFromFilename('the_mind_pt_1.wav')).not.toBe(titleFromFilename('the_mind_pt_2.wav'));
  });

  it('cannot invent a word boundary that was never written', () => {
    // This is the whole reason a derived title is only ever a proposal.
    expect(titleFromFilename('newspeak.wav')).toBe('Newspeak');
    expect(titleFromFilename('newspeak.wav')).not.toBe('News Peak');
  });
});

describe('reconcile against an existing tracklist', () => {
  it('links a file whose name already agrees with the track', () => {
    const plan = reconcile(f('masters/in_the_court.wav'), TRACKS);
    const action = forFile(plan, 'in_the_court.wav');
    expect(action?.kind).toBe('link');
    expect(action?.confidence).toBe('exact');
  });

  it('links through a bounce counter and an export clock', () => {
    const plan = reconcile(
      f('masters/the_no_end_theory_1.wav', 'masters/the_other_side 15.00.13.wav'),
      TRACKS
    );
    expect(forFile(plan, 'the_no_end_theory_1.wav')?.kind).toBe('link');
    expect(forFile(plan, '15.00.13.wav')?.kind).toBe('link');
  });

  describe('the two the filenames get wrong', () => {
    it('links newspeak.wav to "News Peak" WITHOUT rewriting the title', () => {
      // Spacing is not a disagreement: both squash to "newspeak", so the file
      // is recognised as this song and the stored title is left exactly as
      // the owner wrote it. The derived "Newspeak" never reaches the record.
      const plan = reconcile(f('masters/newspeak.wav'), TRACKS);
      const action = forFile(plan, 'newspeak.wav');
      expect(action?.kind).toBe('link');
      expect(action?.currentTitle).toBe('News Peak');
      expect(plan.actions.some((a) => a.kind === 'retitle')).toBe(false);
    });

    it('leaves "Please" for a human rather than matching rap.wav', () => {
      const plan = reconcile(f('masters/rap.wav'), TRACKS);
      expect(forFile(plan, 'rap.wav')?.kind).toBe('create');
      expect(forTrack(plan, 'Please')?.kind).toBe('missing');
    });
  });

  it('flags a near-miss spelling instead of silently picking one', () => {
    // makunahea vs makunahia — the exact trap this album already contained.
    const plan = reconcile(f('mixes/makunahia.wav'), [
      { id: 't8', title: 'Makunahea', track_number: 8 },
    ]);
    const action = forFile(plan, 'makunahia.wav');
    expect(action?.kind).toBe('retitle');
    expect(action?.confidence).toBe('weak');
  });

  it('reports a track with no file as missing', () => {
    const plan = reconcile(f('masters/welcome.wav'), TRACKS);
    expect(plan.counts.missing).toBe(TRACKS.length - 1);
  });

  it('proposes creating a track for audio nothing matches', () => {
    const plan = reconcile(f('masters/hallucinogen.wav'), TRACKS);
    const action = forFile(plan, 'hallucinogen.wav');
    expect(action?.kind).toBe('create');
    expect(action?.proposedTitle).toBe('Hallucinogen');
  });

  it('never uses one file or one track twice', () => {
    const plan = reconcile(
      f('masters/the_mind_pt_1.wav', 'masters/the_mind_pt_2.wav'),
      TRACKS
    );
    const linked = plan.actions.filter((a) => a.kind === 'link');
    expect(new Set(linked.map((a) => a.trackId)).size).toBe(linked.length);
    expect(forFile(plan, 'the_mind_pt_1.wav')?.currentTitle).toBe('The Mind Pt 1');
    expect(forFile(plan, 'the_mind_pt_2.wav')?.currentTitle).toBe('The Mind Pt 2');
  });

  it('ignores files that are not audio', () => {
    const plan = reconcile(f('cover-art.png', 'notes.pdf', 'masters/welcome.wav'), TRACKS);
    expect(plan.actions.filter((a) => a.file).length).toBe(1);
  });

  it('reads back in album order', () => {
    const plan = reconcile(f('masters/ghost_world.wav', 'masters/welcome.wav'), TRACKS);
    const titles = plan.actions.filter((a) => a.currentTitle).map((a) => a.currentTitle);
    expect(titles[0]).toBe('Welcome');
  });
});

describe('reconcile against an empty album — bulk create', () => {
  const plan = reconcile(
    f('masters/welcome.wav', 'masters/1984.wav', 'masters/in_the_court.wav', 'cover.png'),
    []
  );

  it('proposes a track per audio file and nothing for the artwork', () => {
    expect(plan.bulkCreate).toBe(true);
    expect(plan.counts.create).toBe(3);
  });

  it('derives a title for each', () => {
    expect(plan.actions.map((a) => a.proposedTitle)).toEqual([
      'Welcome', '1984', 'In The Court',
    ]);
  });

  it('still applies nothing automatically — a created title is a guess too', () => {
    expect(autoApplicable(plan)).toHaveLength(0);
    expect(needsReview(plan)).toHaveLength(3);
  });
});

describe('the whole real folder against the real tracklist', () => {
  const plan = reconcile(
    f(
      'masters/welcome.wav', 'masters/1984.wav', 'masters/the_no_end_theory_1.wav',
      'masters/in_the_court.wav', 'masters/newspeak.wav', 'masters/every_generation_1.wav',
      'masters/rap.wav', 'masters/makunahea.wav', 'masters/the_other_side 15.00.13.wav',
      'masters/The_mind_pt_1.wav', 'masters/midnight_marauders.wav',
      'masters/The_mind_pt_2.wav', 'masters/ghost_world.wav', 'masters/hallucinogen.wav'
    ),
    TRACKS
  );

  it('links the 11 that agree and surfaces exactly the 3 real problems', () => {
    expect(plan.counts.link).toBe(12);
    // rap has no track; hallucinogen has no track; Please has no file.
    expect(forFile(plan, 'newspeak.wav')?.kind).toBe('link');
    expect(forFile(plan, 'rap.wav')?.kind).toBe('create');
    expect(forFile(plan, 'hallucinogen.wav')?.kind).toBe('create');
    expect(forTrack(plan, 'Please')?.kind).toBe('missing');
  });
});
