/**
 * The delivery sheet is the deliverable.
 *
 * No distributor exposes a release-creation API, so this CSV is the artifact
 * the album ships on — a quoting bug here is a wrong track title on Spotify,
 * not a rendering glitch.
 */
import {
  CSV_COLUMNS,
  buildDistributorCsv,
  csvFilename,
  type CsvRelease,
  type CsvTrack,
} from '@/lib/release/distributorCsv';

const release: CsvRelease = {
  title: 'Loop Soul',
  artist_name: 'Mani Odubo',
  label_name: null,
  upc: '602445790012',
  distribution_release_date: '2026-10-03',
  genre: 'Hip-Hop',
  copyright_line: '© 2026 Mani Odubo',
  phonographic_line: '℗ 2026 Mani Odubo',
  language: 'en',
  territories: '["worldwide"]',
  explicit_content: 0,
};

function track(overrides: Partial<CsvTrack> = {}): CsvTrack {
  return {
    id: 't1',
    track_number: 1,
    title: 'Welcome',
    version: null,
    artist_name: 'Mani Odubo',
    featuring_artists: null,
    isrc: 'CAU652600001',
    duration_seconds: 210,
    composers: null,
    producers: null,
    performers: null,
    explicit: 0,
    instrumental: 0,
    lyrics_language: null,
    audio_r2_key: 'warehouse/proj/masters/welcome.wav',
    ...overrides,
  };
}

/** Split a quoted CSV line back into cells. */
function cells(line: string): string[] {
  return (line.match(/"(?:[^"]|"")*"/g) ?? []).map((c) =>
    c.slice(1, -1).replace(/""/g, '"')
  );
}

const rows = (csv: string) => csv.trimEnd().split('\r\n');
const col = (name: string) => CSV_COLUMNS.indexOf(name);

describe('buildDistributorCsv', () => {
  it('writes a header then one row per track', () => {
    const csv = buildDistributorCsv(release, [
      track({ id: 'a', track_number: 1 }),
      track({ id: 'b', track_number: 2, title: '1984' }),
    ]);
    const lines = rows(csv);
    expect(lines).toHaveLength(3);
    expect(cells(lines[0])).toEqual([...CSV_COLUMNS]);
  });

  it('ends with a newline, which some importers need to keep the last row', () => {
    expect(buildDistributorCsv(release, [track()]).endsWith('\r\n')).toBe(true);
  });

  it('orders by track number regardless of input order', () => {
    const csv = buildDistributorCsv(release, [
      track({ id: 'c', track_number: 3, title: 'Third' }),
      track({ id: 'a', track_number: 1, title: 'First' }),
      track({ id: 'b', track_number: 2, title: 'Second' }),
    ]);
    const titles = rows(csv).slice(1).map((l) => cells(l)[col('track_title')]);
    expect(titles).toEqual(['First', 'Second', 'Third']);
  });

  describe('quoting', () => {
    it('keeps a comma inside a title in one cell', () => {
      const csv = buildDistributorCsv(release, [track({ title: 'Please, Please' })]);
      const row = cells(rows(csv)[1]);
      expect(row).toHaveLength(CSV_COLUMNS.length);
      expect(row[col('track_title')]).toBe('Please, Please');
    });

    it('escapes a double quote by doubling it', () => {
      const csv = buildDistributorCsv(release, [track({ title: 'The "Real" Thing' })]);
      expect(rows(csv)[1]).toContain('""Real""');
      expect(cells(rows(csv)[1])[col('track_title')]).toBe('The "Real" Thing');
    });

    it('survives a newline inside a value without losing the column count', () => {
      const csv = buildDistributorCsv(release, [track({ title: 'Two\nLines' })]);
      expect(cells(csv.split('\r\n')[1])[col('track_title')]).toBe('Two\nLines');
    });
  });

  describe('shapes the DB stores vs. what a distributor reads', () => {
    it('renders a JSON array of writers as a semicolon list', () => {
      const csv = buildDistributorCsv(release, [
        track({ composers: '["Mani Odubo","Amen"]' }),
      ]);
      expect(cells(rows(csv)[1])[col('composers')]).toBe('Mani Odubo; Amen');
    });

    it('leaves an empty JSON array empty rather than writing "[]"', () => {
      const csv = buildDistributorCsv(release, [track({ composers: '[]' })]);
      expect(cells(rows(csv)[1])[col('composers')]).toBe('');
    });

    it('accepts a plain string that was never JSON', () => {
      const csv = buildDistributorCsv(release, [track({ producers: 'Mitus' })]);
      expect(cells(rows(csv)[1])[col('producers')]).toBe('Mitus');
    });

    it('writes duration both as mm:ss and as seconds', () => {
      const row = cells(rows(buildDistributorCsv(release, [track({ duration_seconds: 185 })]))[1]);
      expect(row[col('duration')]).toBe('3:05');
      expect(row[col('duration_seconds')]).toBe('185');
    });

    it('leaves duration blank rather than writing 0:00 when unknown', () => {
      const row = cells(rows(buildDistributorCsv(release, [track({ duration_seconds: 0 })]))[1]);
      expect(row[col('duration')]).toBe('');
    });

    it('writes flags as Yes/No', () => {
      const row = cells(rows(buildDistributorCsv(release, [track({ explicit: 1 })]))[1]);
      expect(row[col('explicit')]).toBe('Yes');
      expect(row[col('instrumental')]).toBe('No');
    });

    it('normalises a dashed ISRC', () => {
      const row = cells(rows(buildDistributorCsv(release, [track({ isrc: 'ca-u65-26-00001' })]))[1]);
      expect(row[col('isrc')]).toBe('CAU652600001');
    });

    it('names the audio file by its basename, not the whole r2 key', () => {
      const row = cells(rows(buildDistributorCsv(release, [track()]))[1]);
      expect(row[col('audio_file')]).toBe('welcome.wav');
    });

    it('defaults territories to worldwide when unset', () => {
      const csv = buildDistributorCsv({ ...release, territories: null }, [track()]);
      expect(cells(rows(csv)[1])[col('territories')]).toBe('worldwide');
    });

    it('falls back to the release explicit flag when the track does not set one', () => {
      const csv = buildDistributorCsv({ ...release, explicit_content: 1 }, [
        track({ explicit: null }),
      ]);
      expect(cells(rows(csv)[1])[col('explicit')]).toBe('Yes');
    });
  });

  it('repeats the release columns on every row', () => {
    const csv = buildDistributorCsv(release, [
      track({ id: 'a', track_number: 1 }),
      track({ id: 'b', track_number: 2 }),
    ]);
    const upcs = rows(csv).slice(1).map((l) => cells(l)[col('upc')]);
    expect(upcs).toEqual(['602445790012', '602445790012']);
  });

  it('writes empty cells, never the string "null"', () => {
    const csv = buildDistributorCsv(
      { ...release, label_name: null, upc: null },
      [track({ version: null, isrc: null, audio_r2_key: null })]
    );
    expect(csv).not.toContain('null');
    expect(csv).not.toContain('undefined');
  });
});

describe('csvFilename', () => {
  it('slugs the title and pins the release date', () => {
    expect(csvFilename(release)).toBe('loop-soul-delivery-2026-10-03.csv');
  });

  it('does not produce a leading or trailing dash from punctuation', () => {
    expect(csvFilename({ ...release, title: '  ...Loop Soul!  ' })).toBe(
      'loop-soul-delivery-2026-10-03.csv'
    );
  });

  it('still names a file when there is no date', () => {
    expect(csvFilename({ ...release, distribution_release_date: null })).toContain('undated');
  });
});
