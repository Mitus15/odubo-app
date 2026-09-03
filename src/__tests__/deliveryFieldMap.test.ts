/**
 * The regression that has already been paid for once.
 *
 * The lost code full-replaced distribution_release_tracks on every metadata
 * save. The ISRC grid does not know `audio_r2_key` exists, so saving a title
 * silently un-shipped every master — and with no transactions in D1 over
 * REST, a failure mid-replace would have destroyed 14 distributor-issued
 * ISRCs permanently.
 *
 * The route now diffs instead of replacing, and — the second, independent
 * defence — `audio_r2_key` and `audio_url` are simply not in its field map,
 * so no payload can reach them. Shipping is owned by /pieces/[id]/ship alone.
 *
 * This asserts the field map directly. It is the cheap half of the guarantee
 * and it cannot rot silently: adding the column back to the map fails here.
 */
import {
  EDITABLE_RELEASE_FIELDS,
  EDITABLE_TRACK_FIELDS,
} from '@/app/api/admin/release/delivery/route';

describe('the delivery route field map', () => {
  it('cannot write the ship pointer', () => {
    expect(EDITABLE_TRACK_FIELDS).not.toContain('audio_r2_key');
    expect(EDITABLE_TRACK_FIELDS).not.toContain('audio_url');
  });

  it('cannot repoint a row at a different release or a different song', () => {
    for (const field of ['id', 'release_id', 'internal_track_id'] as const) {
      expect(EDITABLE_TRACK_FIELDS).not.toContain(field);
    }
  });

  it('cannot rewrite the release identity or its album link', () => {
    for (const field of ['id', 'internal_album_id', 'created_at'] as const) {
      expect(EDITABLE_RELEASE_FIELDS).not.toContain(field);
    }
  });

  it('does write the identifiers the sheet is actually for', () => {
    expect(EDITABLE_TRACK_FIELDS).toEqual(
      expect.arrayContaining(['isrc', 'title', 'track_number', 'duration_seconds', 'composers'])
    );
    expect(EDITABLE_RELEASE_FIELDS).toEqual(
      expect.arrayContaining(['upc', 'genre', 'copyright_line', 'phonographic_line'])
    );
  });

  it('lists every field exactly once', () => {
    expect(new Set(EDITABLE_TRACK_FIELDS).size).toBe(EDITABLE_TRACK_FIELDS.length);
    expect(new Set(EDITABLE_RELEASE_FIELDS).size).toBe(EDITABLE_RELEASE_FIELDS.length);
  });
});
