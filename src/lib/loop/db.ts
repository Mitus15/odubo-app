/**
 * Cloudflare D1 over HTTP.
 *
 * We talk to D1 through its REST API rather than a Worker binding, because the
 * app is hosted on Vercel (Node/serverless), not on Cloudflare. That keeps the
 * data in the handover-ready Cloudflare account while the app runs anywhere —
 * the same portability rule the rest of the codebase follows.
 *
 * Everything here is async: that is the one shape change the in-memory stores
 * had to absorb when they moved to D1.
 *
 * Params are bound positionally with `?1`, `?2`, … (D1's flavour of SQLite
 * placeholders). NEVER interpolate values into the SQL string.
 */

/** One row's worth of D1 metadata — how many rows a write actually touched. */
export type D1Meta = {
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
};

type D1Result<T> = {
  results: T[];
  success: boolean;
  meta: D1Meta;
};

/** The envelope D1's REST API actually returns (verified against live D1). */
type D1Envelope<T> = {
  result: D1Result<T>[];
  errors: { code: number; message: string }[];
  messages: unknown[];
  success: boolean;
};

export type SqlParam = string | number | null;

/**
 * D1 binds at most 100 variables per statement — NOT SQLite's usual 999. Exceed
 * it and you get `variable number must be between ?1 and ?100 (SQLITE_ERROR)`.
 *
 * Any multi-row write must therefore be chunked by PARAMETER count, not row
 * count: a 7-column INSERT tops out at ~14 rows per statement.
 */
export const D1_MAX_PARAMS = 100;

/**
 * How many rows fit in one statement, given each row binds `paramsPerRow` and
 * the statement also carries `fixedParams` shared values (an event id, a
 * timestamp). Always ≥ 1, so a caller can't spin forever on an impossible chunk.
 */
export function maxRowsPerStatement(paramsPerRow: number, fixedParams = 1): number {
  return Math.max(1, Math.floor((D1_MAX_PARAMS - fixedParams) / paramsPerRow));
}

/** Split `items` into chunks that will each fit inside D1's parameter cap. */
export function chunkForParams<T>(
  items: T[],
  paramsPerRow: number,
  fixedParams = 1,
): T[][] {
  const size = maxRowsPerStatement(paramsPerRow, fixedParams);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function getConfig(): { url: string; token: string } {
  const url = process.env.DATABASE_URL;
  const token = process.env.CLOUDFLARE_D1_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "D1 is not configured — set DATABASE_URL and CLOUDFLARE_D1_API_TOKEN. " +
        "(Copy .env.example to .env.local; see CLAUDE.md.)",
    );
  }
  return { url, token };
}

/**
 * Send SQL to D1 and hand back every statement's result.
 *
 * `sql` may contain several statements separated by `;` — D1 returns one result
 * entry per statement, which is what makes the migration files work.
 */
async function send<T>(sql: string, params: SqlParam[] = []): Promise<D1Result<T>[]> {
  const { url, token } = getConfig();

  const res = await fetch(`${url}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
    // Never let Next's data cache serve a stale read — this is a database.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as D1Envelope<T>;
  if (!body.success) {
    const detail = body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || "unknown error";
    throw new Error(`D1 query failed — ${detail}`);
  }
  return body.result;
}

/** Run a SELECT and get the rows back. Returns `[]` when nothing matches. */
export async function queryDatabase<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T[]> {
  const result = await send<T>(sql, params);
  return result[0]?.results ?? [];
}

/** Run a SELECT expected to match at most one row. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T | null> {
  const rows = await queryDatabase<T>(sql, params);
  return rows[0] ?? null;
}

/** Run a write (INSERT/UPDATE/DELETE). Returns D1's metadata, so callers can
 *  check `changes` to tell "updated" from "no such row". */
export async function executeQuery(sql: string, params: SqlParam[] = []): Promise<D1Meta> {
  const result = await send(sql, params);
  return (
    result[0]?.meta ?? { changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 }
  );
}

/**
 * Run several statements in one round-trip.
 *
 * D1's REST API binds ONE param list across the whole request, so this is for
 * statements that carry their own literals or need no params — migrations,
 * mostly. For parameterised multi-row writes, build a single INSERT with
 * several VALUES tuples instead; that keeps it to one round-trip too.
 */
export async function executeBatch(sql: string): Promise<D1Meta[]> {
  const result = await send(sql);
  return result.map((r) => r.meta);
}
