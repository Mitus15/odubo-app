import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase, insertUser, updateUser } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, token, password, first_name, last_name } = await req.json() as any;
    if (!email || !token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const rows = await queryDatabase('SELECT * FROM admin_invites WHERE email = ? ORDER BY created_at DESC LIMIT 1', [email.toLowerCase()]);
    if (!rows.length) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    const invite = rows[0];
    if (invite.accepted_at) return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    if (Date.now() / 1000 > Number(invite.expires_at)) return NextResponse.json({ error: 'Invite expired' }, { status: 400 });

    // Verify token
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hashHex !== invite.token_hash) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    // Create or update user
    const userRows = await queryDatabase('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    const password_hash = await bcrypt.hash(password, 10);
    if (!userRows.length) {
      await insertUser({
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        username: email.toLowerCase(),
        password_hash,
        first_name: first_name || 'Admin',
        last_name: last_name || '',
        is_admin: true,
      });
      // set role=admin and verified
      const rows2 = await queryDatabase('SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
      if (rows2.length) await updateUser(rows2[0].id, { role: 'admin' as any, email_verified: true });
    } else {
      const u = userRows[0];
      await updateUser(u.id, { password_hash, role: 'admin' as any, email_verified: true });
    }

    // Mark invite accepted
    await executeQuery('UPDATE admin_invites SET accepted_at = strftime("%s","now") WHERE id = ?', [invite.id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Accept invite failed:', e);
    return NextResponse.json({ error: 'Accept invite failed' }, { status: 500 });
  }
}


