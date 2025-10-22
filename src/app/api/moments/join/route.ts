import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const rows = await queryDatabase('SELECT id, code, title, starts_at, ends_at FROM galleries WHERE code = ? LIMIT 1', [code]);
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const g = rows[0];
    return NextResponse.json({ gallery: g });
  } catch (e: any) {
    console.error('Join gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
