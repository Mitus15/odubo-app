import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery } from '@/lib/db';

export const runtime = 'edge';

function hex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  try {
    const actor = getUserFromRequest(req);
    if (!isAdminUser(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { email } = await req.json() as { email: string };
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

    const token = hex(32);
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hashHex = Array.from(new Uint8Array(tokenHash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h
    const id = crypto.randomUUID();

    await executeQuery(
      'INSERT INTO admin_invites (id, email, token_hash, expires_at, invited_by) VALUES (?, ?, ?, ?, ?)',
      [id, email.toLowerCase(), hashHex, expiresAt, actor?.userId || null]
    );

    // For MVP: return the token to copy/paste (later: send email)
    return NextResponse.json({ success: true, invite: { id, email, token, expiresAt } });
  } catch (e) {
    console.error('Invite admin failed:', e);
    return NextResponse.json({ error: 'Invite failed' }, { status: 500 });
  }
}


