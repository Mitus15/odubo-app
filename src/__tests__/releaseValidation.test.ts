/**
 * The gate in front of the delivery sheet.
 *
 * The album ships 3 Oct on a spreadsheet — there is no distributor API to
 * catch a mistake downstream. The cases that matter most are the ones where
 * something LOOKS valid: the placeholder UPC passes the digit check, and a
 * duplicated ISRC passes the format check while quietly merging two songs'
 * royalties.
 */
import {
  ISRC_PATTERN,
  PLACEHOLDER_UPCS,
  normalizeIsrc,
  validateRelease,
  type ReleaseForValidation,
  type TrackForValidation,
} from '@/lib/release/releaseValidation';

const goodRelease: ReleaseForValidation = {
  title: 'Loop Soul',
  artist_name: 'Mani Odubo',
  upc: '602445790012',
  distribution_release_date: '2026-10-03',
  genre: 'Hip-Hop',
  copyright_line: '© 2026 Mani Odubo',
  phonographic_line: '℗ 2026 Mani Odubo',
};

function track(overrides: Partial<TrackForValidation> = {}): TrackForValidation {
  return {
    id: overrides.id ?? 'row-1',
    track_number: 1,
    title: 'Welcome',
    artist_name: 'Mani Odubo',
    isrc: 'CAU652600001',
    duration_seconds: 210,
    audio_r2_key: 'warehouse/welcome.wav',
    ...overrides,
  };
}

const errorsOn = (r: ReturnType<typeof validateRelease>, field: string) =>
  r.issues.filter((i) => i.severity === 'error' && i.field === field);
const warnsOn = (r: ReturnType<typeof validateRelease>, field: string) =>
  r.issues.filter((i) => i.severity === 'warn' && i.field === field);

describe('validateRelease', () => {
  it('passes a complete sheet with no issues at all', () => {
    const result = validateRelease(goodRelease, [track()]);
    expect(result.issues).toEqual([]);
    expect(result.canExport).toBe(true);
  });

  describe('the blank-vs-malformed split', () => {
    it('allows export when identifiers are simply not issued yet', () => {
      // The normal pre-delivery state: the distributor assigns these.
      const result = validateRelease(
        { ...goodRelease, upc: null },
        [track({ isrc: null })]
      );
      expect(result.canExport).toBe(true);
      expect(warnsOn(result, 'upc')).toHaveLength(1);
      expect(warnsOn(result, 'isrc')).toHaveLength(1);
    });

    it('treats an empty string exactly like a missing value, never as malformed', () => {
      const result = validateRelease({ ...goodRelease, upc: '   ' }, [track({ isrc: '' })]);
      expect(result.errorCount).toBe(0);
      expect(result.canExport).toBe(true);
    });

    it('blocks export on a malformed ISRC', () => {
      const result = validateRelease(goodRelease, [track({ isrc: 'NOPE123' })]);
      expect(errorsOn(result, 'isrc')).toHaveLength(1);
      expect(result.canExport).toBe(false);
    });
  });

  describe('the placeholder UPC sitting in production', () => {
    it.each(PLACEHOLDER_UPCS)('blocks export on %s even though the digits are valid', (upc) => {
      expect(/^\d{12,13}$/.test(upc)).toBe(true); // it passes the format check…
      const result = validateRelease({ ...goodRelease, upc }, [track()]);
      expect(errorsOn(result, 'upc')).toHaveLength(1); // …and is still caught
      expect(result.canExport).toBe(false);
    });

    it('names the offending value so it can be found', () => {
      const result = validateRelease({ ...goodRelease, upc: '012345678905' }, [track()]);
      expect(errorsOn(result, 'upc')[0].message).toContain('012345678905');
    });

    it('rejects a UPC of the wrong length', () => {
      expect(validateRelease({ ...goodRelease, upc: '12345' }, [track()]).canExport).toBe(false);
    });
  });

  describe('ISRC uniqueness', () => {
    it('blocks two tracks sharing one ISRC', () => {
      const result = validateRelease(goodRelease, [
        track({ id: 'a', track_number: 1, title: '1984', isrc: 'CAU652600002' }),
        track({ id: 'b', track_number: 2, title: '1984 (Live)', isrc: 'CAU652600002' }),
      ]);
      const dupes = errorsOn(result, 'isrc');
      expect(dupes).toHaveLength(1);
      expect(dupes[0].message).toContain('1984 (Live)');
      expect(result.canExport).toBe(false);
    });

    it('catches the duplicate through dash formatting', () => {
      const result = validateRelease(goodRelease, [
        track({ id: 'a', track_number: 1, isrc: 'CA-U65-26-00002' }),
        track({ id: 'b', track_number: 2, isrc: 'CAU652600002' }),
      ]);
      expect(errorsOn(result, 'isrc')).toHaveLength(1);
    });

    it('rejects a documentation-example registrant code', () => {
      // The one ISRC in production today is USABC2600009.
      const result = validateRelease(goodRelease, [track({ isrc: 'USABC2600009' })]);
      expect(ISRC_PATTERN.test('USABC2600009')).toBe(true); // well-formed…
      expect(errorsOn(result, 'isrc')).toHaveLength(1); // …but not a real one
    });
  });

  describe('track numbering', () => {
    it('blocks a gap, because a gap means a missing song', () => {
      const result = validateRelease(goodRelease, [
        track({ id: 'a', track_number: 1, isrc: null }),
        track({ id: 'b', track_number: 3, isrc: null }),
      ]);
      expect(errorsOn(result, 'track_number')).toHaveLength(1);
    });

    it('blocks a duplicated position', () => {
      const result = validateRelease(goodRelease, [
        track({ id: 'a', track_number: 1, isrc: null }),
        track({ id: 'b', track_number: 1, isrc: null }),
      ]);
      expect(errorsOn(result, 'track_number').length).toBeGreaterThan(0);
    });
  });

  describe('incompleteness that must not block', () => {
    it('warns but still exports with no master flagged and no duration', () => {
      const result = validateRelease(goodRelease, [
        track({ audio_r2_key: null, duration_seconds: 0 }),
      ]);
      expect(warnsOn(result, 'audio_r2_key')).toHaveLength(1);
      expect(warnsOn(result, 'duration_seconds')).toHaveLength(1);
      expect(result.canExport).toBe(true);
    });

    it('warns on missing genre and © / ℗ lines', () => {
      const result = validateRelease(
        { ...goodRelease, genre: null, copyright_line: null, phonographic_line: null },
        [track()]
      );
      expect(result.warnCount).toBe(3);
      expect(result.canExport).toBe(true);
    });
  });

  describe('things that are simply wrong', () => {
    it('blocks a release with no tracks', () => {
      expect(validateRelease(goodRelease, []).canExport).toBe(false);
    });

    it('blocks a missing release date', () => {
      const result = validateRelease(
        { ...goodRelease, distribution_release_date: null },
        [track()]
      );
      expect(errorsOn(result, 'distribution_release_date')).toHaveLength(1);
    });

    it('blocks an untitled track and attributes it to that row', () => {
      const result = validateRelease(goodRelease, [track({ id: 'row-9', title: '  ' })]);
      const issue = errorsOn(result, 'title')[0];
      expect(issue.trackId).toBe('row-9');
    });
  });

  it('reproduces the state of the album in production today', () => {
    // Placeholder UPC, one placeholder ISRC, nothing else set.
    const tracks = Array.from({ length: 14 }, (_, i) =>
      track({
        id: `t${i + 1}`,
        track_number: i + 1,
        title: `Song ${i + 1}`,
        isrc: i === 0 ? 'USABC2600009' : null,
        duration_seconds: 0,
        audio_r2_key: null,
      })
    );
    const result = validateRelease({ ...goodRelease, upc: '012345678905' }, tracks);

    expect(result.canExport).toBe(false);
    expect(errorsOn(result, 'upc')).toHaveLength(1);
    expect(errorsOn(result, 'isrc')).toHaveLength(1);
    expect(warnsOn(result, 'isrc')).toHaveLength(13); // the 13 blanks only warn
  });
});

describe('normalizeIsrc', () => {
  it('strips dashes and spaces and upper-cases', () => {
    expect(normalizeIsrc(' ca-u65-26-00001 ')).toBe('CAU652600001');
  });

  it('returns null for blank input rather than an empty string', () => {
    expect(normalizeIsrc('   ')).toBeNull();
    expect(normalizeIsrc(null)).toBeNull();
  });
});
