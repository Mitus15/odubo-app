import { NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

// Lazy import to avoid throwing if envs are missing; guarded in try/catch
let StreamAPI: any = null;

async function checkD1() {
  const out: any = { ok: false, tables: {}, error: null };
  try {
    // lightweight reachability
    await queryDatabase('SELECT 1 as ok');

    // verify key tables exist
    const rows = await queryDatabase(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('galleries','gallery_photos','audit_logs')"
    );
    const names = new Set((rows || []).map((r: any) => r.name));
    out.tables = {
      galleries: names.has('galleries'),
      gallery_photos: names.has('gallery_photos'),
      audit_logs: names.has('audit_logs'),
    };
    out.ok = true;
  } catch (e: any) {
    out.error = e?.message || String(e);
  }
  return out;
}

async function checkR2() {
  const out: any = { ok: false, error: null, base: null, http: null };
  try {
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    out.base = base || null;
    if (!base) {
      out.error = 'CLOUDFLARE_R2_PUBLIC_URL not set';
      return out;
    }
    // We can’t list bucket here; just verify domain is reachable (2xx/3xx/404 are treated as reachable)
    const res = await fetch(base, { method: 'HEAD' }).catch(() => null);
    if (!res) {
      // Some providers block HEAD; try GET of a nonsense key to expect 404
      const res2 = await fetch(base.replace(/\/$/, '') + '/__health_check_object__');
      out.http = { status: res2.status };
      out.ok = res2.ok || res2.status === 404;
    } else {
      out.http = { status: res.status };
      out.ok = res.ok || res.status === 404 || (res.status >= 200 && res.status < 500);
    }
  } catch (e: any) {
    out.error = e?.message || String(e);
  }
  return out;
}

async function checkStream() {
  const out: any = { ok: false, error: null, accountId: null };
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    const token = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
    out.accountId = accountId || null;
    if (!accountId || !token) {
      out.error = 'Stream credentials not configured';
      return out;
    }
    if (!StreamAPI) {
      const mod = await import('@/lib/cloudflareStream');
      StreamAPI = mod.default;
    }
    const api = new StreamAPI();
    // Low-impact call: list 1 video
    const res = (await api.listVideos({})) as any;
    out.ok = !!res;
  } catch (e: any) {
    out.error = e?.message || String(e);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const user = await verifyUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const rl = await rateLimit({ key: `health:cloudflare:${user!.userId}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const [d1, r2, stream] = await Promise.all([checkD1(), checkR2(), checkStream()]);
    const ok = !!(d1.ok && r2.ok && (stream.ok || stream.error === 'Stream credentials not configured'));
    return NextResponse.json({ ok, d1, r2, stream, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
