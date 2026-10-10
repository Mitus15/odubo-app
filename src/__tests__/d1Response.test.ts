import { changedRows, lastRowId } from '@/lib/db';

/**
 * D1's /query body for one write, as executeQuery hands it back (the envelope
 * lib/loop/db.ts types as D1Envelope).
 */
function writeResponse(changes: number, last_row_id = 0) {
  return {
    result: [
      {
        results: [],
        success: true,
        meta: { changes, last_row_id, rows_read: changes, rows_written: changes },
      },
    ],
    errors: [],
    messages: [],
    success: true,
  };
}

const CARRIES_NOTHING = [undefined, null, {}, { result: [] }, { result: [{ results: [] }] }, { result: [{ meta: {} }] }];

describe('changedRows', () => {
  it("reads the count from the statement's meta, where D1 puts it", () => {
    expect(changedRows(writeResponse(3))).toBe(3);
  });

  it('is 0 when the write matched no rows', () => {
    expect(changedRows(writeResponse(0))).toBe(0);
  });

  it('is 0, never a throw, when the response carries no count', () => {
    for (const response of CARRIES_NOTHING) {
      expect(changedRows(response)).toBe(0);
    }
  });

  it('ignores the places routes used to look: changes or meta at the top', () => {
    expect(changedRows({ changes: 5, meta: { changes: 5 } })).toBe(0);
  });
});

describe('lastRowId', () => {
  it("reads the new row's id from the statement's meta", () => {
    expect(lastRowId(writeResponse(1, 42))).toBe(42);
  });

  it('is null, never a throw, when the response carries no id', () => {
    for (const response of CARRIES_NOTHING) {
      expect(lastRowId(response)).toBeNull();
    }
  });

  it('ignores the places routes used to look: lastRowId, lastInsertRowid, meta at the top', () => {
    expect(lastRowId({ lastRowId: 7, lastInsertRowid: 7, meta: { last_row_id: 7 } })).toBeNull();
  });
});
