import { changedRows } from '@/lib/db';

/**
 * D1's /query body for one UPDATE, as executeQuery hands it back (the envelope
 * lib/loop/db.ts types as D1Envelope).
 */
function updateResponse(changes: number) {
  return {
    result: [
      {
        results: [],
        success: true,
        meta: { changes, last_row_id: 0, rows_read: changes, rows_written: changes },
      },
    ],
    errors: [],
    messages: [],
    success: true,
  };
}

describe('changedRows', () => {
  it("reads the count from the statement's meta, where D1 puts it", () => {
    expect(changedRows(updateResponse(3))).toBe(3);
  });

  it('is 0 when the write matched no rows', () => {
    expect(changedRows(updateResponse(0))).toBe(0);
  });

  it('is 0, never a throw, when the response carries no count', () => {
    for (const response of [undefined, null, {}, { result: [] }, { result: [{ results: [] }] }, { result: [{ meta: {} }] }]) {
      expect(changedRows(response)).toBe(0);
    }
  });
});
