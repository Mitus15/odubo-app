import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// Lightweight DB schema health check for critical extended video columns
// Returns which expected columns are present/missing without throwing if table absent.
// Useful for startup diagnostics and CI smoke tests.
const EXPECTED_COLUMNS = [
  'short_description',
  'long_description',
  'tags',
  'duration_seconds',
  'ai_description',
  'publication_status'
];

export async function GET() {
  try {
    // PRAGMA table_info gives column metadata rows with 'name'
    const info: any = await queryDatabase(`PRAGMA table_info(videos)`);
    const cols: string[] = Array.isArray(info?.results)
      ? info.results.map((r: any) => r.name).filter(Boolean)
      : [];
    const missing = EXPECTED_COLUMNS.filter(c => !cols.includes(c));
    const ok = missing.length === 0 && cols.length > 0;
    return NextResponse.json({ ok, missing, columns: cols, expected: EXPECTED_COLUMNS, timestamp: new Date().toISOString() });
  } catch (e: any) {
    // Do not throw; provide error flag and message
    return NextResponse.json({ ok: false, error: e.message, missing: EXPECTED_COLUMNS, columns: [], expected: EXPECTED_COLUMNS }, { status: 200 });
  }
}
