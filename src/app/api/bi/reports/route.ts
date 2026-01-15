// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// GET /api/bi/reports - List generated reports
export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const url = new URL(req.url);

    const reportType = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let sql = 'SELECT id, report_type, period_start, period_end, status, generated_at, created_at FROM bi_reports WHERE 1=1';
    const params: (string | number)[] = [];

    if (reportType) {
      sql += ' AND report_type = ?';
      params.push(reportType);
    }

    sql += ' ORDER BY generated_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...params).all();

    return NextResponse.json({ success: true, reports: results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
