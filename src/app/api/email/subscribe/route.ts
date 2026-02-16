import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';
import { getDiscountEnv } from '@/lib/env';

interface SubscribeBody {
  email?: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await rateLimit({ key: `subscribe:${ip}`, limit: 5, windowMs: 60_000 });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { discountCode: WELCOME_DISCOUNT_CODE } = getDiscountEnv();
    const body = (await request.json()) as SubscribeBody;
    const { email, name } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const existingProfiles = await queryDatabase(
      `SELECT id, notification_preferences FROM fan_profiles WHERE email = ?`,
      [emailLower]
    ) as Array<{ id: string; notification_preferences: string | null }>;

    if (existingProfiles.length > 0) {
      const existing = existingProfiles[0];
      const prefs = existing.notification_preferences
        ? JSON.parse(existing.notification_preferences)
        : {};

      if (prefs.email === true) {
        // Already subscribed
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          discountCode: WELCOME_DISCOUNT_CODE,
        });
      }

      // Update existing profile to enable email
      prefs.email = true;
      await executeQuery(
        `UPDATE fan_profiles
         SET notification_preferences = ?,
             display_name = COALESCE(display_name, ?),
             updated_at = datetime('now')
         WHERE id = ?`,
        [JSON.stringify(prefs), name || null, existing.id]
      );

      // Log the newsletter signup activity
      await logNewsletterSignup(existing.id, emailLower);

      // Send welcome email
      await sendWelcomeEmail({ email: emailLower, name: name || '' });

      return NextResponse.json({
        success: true,
        alreadySubscribed: false,
        discountCode: WELCOME_DISCOUNT_CODE,
      });
    }

    // Create new fan profile
    const newId = generateId();
    const notificationPrefs = JSON.stringify({ email: true, sms: false, push: false });

    await executeQuery(
      `INSERT INTO fan_profiles (
        id, email, display_name, notification_preferences,
        stage, first_seen_at, last_active_at,
        acquisition_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'new', datetime('now'), datetime('now'), 'newsletter', datetime('now'), datetime('now'))`,
      [newId, emailLower, name || null, notificationPrefs]
    );

    // Log the newsletter signup activity
    await logNewsletterSignup(newId, emailLower);

    // Send welcome email with discount code
    const emailResult = await sendWelcomeEmail({
      email: emailLower,
      name: name || '',
      discountCode: WELCOME_DISCOUNT_CODE,
    });

    if (emailResult.success) {
      // Log the day0 email send for sequence tracking
      await logEmailSequenceSend(newId, emailLower, 'day0', emailResult.id);
    } else {
      console.warn('[SUBSCRIBE] Failed to send welcome email:', emailResult.error);
      // Don't fail the subscription if email fails
    }

    return NextResponse.json({
      success: true,
      alreadySubscribed: false,
      discountCode: WELCOME_DISCOUNT_CODE,
    });

  } catch (error: any) {
    console.error('[SUBSCRIBE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper to log newsletter signup activity
async function logNewsletterSignup(fanProfileId: string, email: string) {
  try {
    await executeQuery(
      `INSERT INTO fan_activity (
        id, fan_profile_id, event_type, event_data, created_at
      ) VALUES (?, ?, 'newsletter_signup', ?, datetime('now'))`,
      [generateId(), fanProfileId, JSON.stringify({ email })]
    );
  } catch (error) {
    console.warn('[SUBSCRIBE] Failed to log activity:', error);
    // Don't fail the subscription if logging fails
  }
}

// Helper to log email sequence send
async function logEmailSequenceSend(
  fanProfileId: string,
  email: string,
  emailStep: string,
  resendId: string
) {
  try {
    await executeQuery(
      `INSERT INTO email_sequence_sends (
        id, fan_profile_id, email, sequence_type, email_step, status, resend_id, sent_at, created_at
      ) VALUES (?, ?, ?, 'welcome', ?, 'sent', ?, datetime('now'), datetime('now'))`,
      [generateId(), fanProfileId, email, emailStep, resendId]
    );
  } catch (error) {
    console.warn('[SUBSCRIBE] Failed to log email send:', error);
    // Don't fail the subscription if logging fails
  }
}

// Generate a random ID (matches pattern used in fan_profiles)
function generateId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
