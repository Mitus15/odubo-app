/**
 * Writing a column whose migration may not have been applied yet.
 *
 * Migrations run by hand against D1, so code can ship before its column
 * exists. D1 then refuses the whole statement: "table t has no column named c"
 * for an INSERT's column list, "no such column: c" anywhere else. Rather than
 * lose the row, the write is retried without the column, the gap is logged
 * once per run, and the rest of the run skips the doomed attempt.
 */

/** Did this error come from `column` not existing (yet)? Pure, for the tests. */
export function isMissingColumnError(err: unknown, column: string): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const name = column.replace(/[^A-Za-z0-9_]/g, '');
  if (!name) return false;
  return new RegExp(
    `has no column named ${name}\\b|no such column: (?:[A-Za-z0-9_]+\\.)?${name}\\b`,
    'i',
  ).test(message);
}

/** Per-run memory: once the column is known to be missing, stop trying it. */
export interface OptionalColumnState {
  missing: boolean;
}

/**
 * Run `write(true)`, which includes the column. If D1 says the column does not
 * exist, mark it missing, call `onMissing` (once per state), and run
 * `write(false)` instead; later calls with the same state go straight to
 * `write(false)`. Any other error is rethrown untouched.
 */
export async function writeWithOptionalColumn<T>(
  column: string,
  state: OptionalColumnState,
  write: (withColumn: boolean) => Promise<T>,
  onMissing?: () => void,
): Promise<T> {
  if (!state.missing) {
    try {
      return await write(true);
    } catch (err) {
      if (!isMissingColumnError(err, column)) throw err;
      state.missing = true;
      onMissing?.();
    }
  }
  return write(false);
}
