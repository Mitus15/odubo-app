import { isMissingColumnError, writeWithOptionalColumn, type OptionalColumnState } from '@/lib/optionalColumn';

// What lib/db.ts throws when D1 refuses a statement.
const d1Error = (message: string) =>
  new Error(
    'Database query failed: ' +
      JSON.stringify({ result: [], success: false, errors: [{ code: 7500, message: `${message}: SQLITE_ERROR` }] }),
  );

describe('isMissingColumnError', () => {
  it("catches SQLite's two wordings for a column that does not exist", () => {
    expect(isMissingColumnError(d1Error('table commerce_orders has no column named source'), 'source')).toBe(true);
    expect(isMissingColumnError(d1Error('no such column: source'), 'source')).toBe(true);
    expect(isMissingColumnError(d1Error('no such column: commerce_orders.source'), 'source')).toBe(true);
    expect(isMissingColumnError(d1Error('no such column: excluded.source'), 'source')).toBe(true);
  });

  it('ignores other columns, longer names and other failures', () => {
    expect(isMissingColumnError(d1Error('no such column: source_name'), 'source')).toBe(false);
    expect(isMissingColumnError(d1Error('table commerce_orders has no column named entry_path'), 'source')).toBe(false);
    expect(isMissingColumnError(d1Error('UNIQUE constraint failed: commerce_orders.shopify_id'), 'source')).toBe(false);
    expect(isMissingColumnError(new Error('network down'), 'source')).toBe(false);
    expect(isMissingColumnError(undefined, 'source')).toBe(false);
  });
});

describe('writeWithOptionalColumn', () => {
  it('writes with the column when it exists', async () => {
    const state: OptionalColumnState = { missing: false };
    const write = jest.fn(async (withColumn: boolean) => (withColumn ? 'with' : 'without'));
    const onMissing = jest.fn();

    await expect(writeWithOptionalColumn('source', state, write, onMissing)).resolves.toBe('with');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(true);
    expect(onMissing).not.toHaveBeenCalled();
    expect(state.missing).toBe(false);
  });

  it('falls back without the column, logs once, and stops trying for the run', async () => {
    const state: OptionalColumnState = { missing: false };
    const write = jest.fn(async (withColumn: boolean) => {
      if (withColumn) throw d1Error('table commerce_orders has no column named source');
      return 'without';
    });
    const onMissing = jest.fn();

    await expect(writeWithOptionalColumn('source', state, write, onMissing)).resolves.toBe('without');
    await expect(writeWithOptionalColumn('source', state, write, onMissing)).resolves.toBe('without');
    await expect(writeWithOptionalColumn('source', state, write, onMissing)).resolves.toBe('without');

    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(state.missing).toBe(true);
    // One doomed attempt with the column, then only the fallback.
    expect(write.mock.calls.map(([withColumn]) => withColumn)).toEqual([true, false, false, false]);
  });

  it('rethrows any other failure without a fallback write', async () => {
    const state: OptionalColumnState = { missing: false };
    const write = jest.fn(async () => {
      throw d1Error('UNIQUE constraint failed: commerce_orders.id');
    });
    const onMissing = jest.fn();

    await expect(writeWithOptionalColumn('source', state, write, onMissing)).rejects.toThrow('UNIQUE constraint');
    expect(write).toHaveBeenCalledTimes(1);
    expect(onMissing).not.toHaveBeenCalled();
    expect(state.missing).toBe(false);
  });
});
