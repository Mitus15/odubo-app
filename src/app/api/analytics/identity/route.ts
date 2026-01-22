import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rate limit: 5 identity links per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

interface IdentityRequest {
  visitorId: string;
  email: string;
  fingerprint?: string;
  name?: string;
}

interface FanProfile {
  id: string;
  email: string | null;
  fingerprint_hash: string | null;
  display_name: string | null;
  stage: string;
}

/**
 * POST /api/analytics/identity
 * Links an anonymous visitor to a known fan profile after email capture.
 *
 * Flow:
 * 1. Check if fan profile exists by email
 * 2. If exists, update with fingerprint for cross-device linking
 * 3. If not exists, check for profile by fingerprint and update email
 * 4. If neither exists, create new profile
 * 5. Merge any duplicate anonymous profiles
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('x-real-ip') ||
               'unknown';

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json() as IdentityRequest;
    const { visitorId, email, fingerprint, name } = body;

    if (!visitorId || !email) {
      return NextResponse.json({ error: 'visitorId and email required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if fan profile exists by email
    const existingByEmail = await queryDatabase(
      `SELECT id, email, fingerprint_hash, display_name, stage FROM fan_profiles WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    ) as FanProfile[];

    if (existingByEmail.length > 0) {
      const profile = existingByEmail[0];

      // Update fingerprint if not set (for cross-device linking)
      if (!profile.fingerprint_hash && (fingerprint || visitorId)) {
        await executeQuery(
          `UPDATE fan_profiles SET
            fingerprint_hash = COALESCE(fingerprint_hash, ?),
            last_active_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?`,
          [fingerprint || visitorId, profile.id]
        );
      }

      // Merge any anonymous profiles with this visitorId into the known profile
      await mergeAnonymousActivity(visitorId, profile.id);

      return NextResponse.json({
        success: true,
        fanId: profile.id,
        merged: false,
        existingProfile: true,
      });
    }

    // 2. Check if fan profile exists by fingerprint/visitorId
    const existingByFingerprint = await queryDatabase(
      `SELECT id, email, fingerprint_hash, display_name, stage FROM fan_profiles
       WHERE fingerprint_hash = ? OR fingerprint_hash = ?
       LIMIT 1`,
      [visitorId, fingerprint || visitorId]
    ) as FanProfile[];

    if (existingByFingerprint.length > 0) {
      const profile = existingByFingerprint[0];

      // Update profile with email and name
      await executeQuery(
        `UPDATE fan_profiles SET
          email = ?,
          display_name = COALESCE(display_name, ?),
          stage = CASE WHEN stage = 'new' THEN 'engaged' ELSE stage END,
          last_active_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?`,
        [normalizedEmail, name || null, profile.id]
      );

      return NextResponse.json({
        success: true,
        fanId: profile.id,
        merged: true,
        existingProfile: false,
      });
    }

    // 3. Create new fan profile
    const newId = generateId();
    await executeQuery(
      `INSERT INTO fan_profiles (
        id, email, fingerprint_hash, display_name, stage,
        first_seen_at, last_active_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'engaged', datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
      [newId, normalizedEmail, fingerprint || visitorId, name || null]
    );

    return NextResponse.json({
      success: true,
      fanId: newId,
      merged: false,
      existingProfile: false,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Identity API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Merge anonymous fan activity into a known profile.
 * This updates any fan_activity records that were created with a temp ID
 * to point to the actual fan profile.
 */
async function mergeAnonymousActivity(visitorId: string, targetFanId: string): Promise<void> {
  try {
    // Find anonymous profile(s) with this visitorId
    const anonymousProfiles = await queryDatabase(
      `SELECT id FROM fan_profiles
       WHERE fingerprint_hash = ? AND id != ? AND email IS NULL`,
      [visitorId, targetFanId]
    ) as { id: string }[];

    for (const profile of anonymousProfiles) {
      // Update activity records to point to the known profile
      await executeQuery(
        `UPDATE fan_activity SET fan_id = ? WHERE fan_id = ?`,
        [targetFanId, profile.id]
      );

      // Optionally delete the anonymous profile (or keep for audit)
      // For now, we'll mark it as merged by setting a special tag
      await executeQuery(
        `UPDATE fan_profiles SET
          tags = json_insert(COALESCE(tags, '[]'), '$[#]', ?),
          updated_at = datetime('now')
        WHERE id = ?`,
        [`merged_into:${targetFanId}`, profile.id]
      );
    }

    // Also update any activity that used the visitorId directly as fan_id
    await executeQuery(
      `UPDATE fan_activity SET fan_id = ?
       WHERE fan_id = ? OR fan_id LIKE ?`,
      [targetFanId, visitorId, `temp-${visitorId.slice(0, 8)}%`]
    );
  } catch (err) {
    console.error('Error merging anonymous activity:', err);
    // Non-fatal, activity will still exist with old ID
  }
}

/**
 * Generate a random ID for fan profiles.
 */
function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
