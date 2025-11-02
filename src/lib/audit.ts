import { executeQuery } from '@/lib/db';
import type { AuthTokenPayload } from '@/lib/auth';

function getClientIp(req: Request): string | null {
  try {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const cfip = (req.headers.get('cf-connecting-ip') || '').trim();
    return cfip || null;
  } catch {
    return null;
  }
}

export async function writeAuditLog(req: Request, user: AuthTokenPayload | null, action: string, target: string, meta?: Record<string, any>) {
  try {
    const ip = getClientIp(req);
    const ua = req.headers.get('user-agent') || null;
    const actorId = user?.userId || null;
    const actorEmail = user?.email || null;
    const metaJson = meta ? JSON.stringify(meta) : null;
    await executeQuery(
      'INSERT INTO audit_logs (actor_user_id, actor_email, action, target, ip, user_agent, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [actorId, actorEmail, action, target, ip, ua, metaJson]
    );
  } catch (e) {
    // Never block on audit failures
    console.warn('Audit log write failed:', e);
  }
}
