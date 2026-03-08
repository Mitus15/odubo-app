import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { sendDay3Email, sendDay7Email } from '@/lib/email';

export const runtime = 'edge';

/**
 * GET /api/cron/email-sequences
 * Scheduled job to send welcome sequence emails (Day 3, Day 7)
 * Triggered by Vercel Cron daily
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-sequences",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      day3: { sent: 0, failed: 0, skipped: 0 },
      day7: { sent: 0, failed: 0, skipped: 0 },
    };

    // Process Day 3 emails
    const day3Subscribers = await findSubscribersForEmail('day3');
    for (const subscriber of day3Subscribers) {
      try {
        const emailResult = await sendDay3Email({
          email: subscriber.email,
          name: subscriber.display_name || '',
        });

        if (emailResult.success) {
          await logEmailSend(subscriber.id, subscriber.email, 'welcome', 'day3', emailResult.id);
          results.day3.sent++;
        } else {
          await logEmailSend(subscriber.id, subscriber.email, 'welcome', 'day3', null, 'failed');
          results.day3.failed++;
        }
      } catch (err) {
        console.error(`[EMAIL-SEQ] Day 3 failed for ${subscriber.email}:`, err);
        results.day3.failed++;
      }
    }

    // Process Day 7 emails
    const day7Subscribers = await findSubscribersForEmail('day7');
    for (const subscriber of day7Subscribers) {
      try {
        const emailResult = await sendDay7Email({
          email: subscriber.email,
          name: subscriber.display_name || '',
        });

        if (emailResult.success) {
          await logEmailSend(subscriber.id, subscriber.email, 'welcome', 'day7', emailResult.id);
          results.day7.sent++;
        } else {
          await logEmailSend(subscriber.id, subscriber.email, 'welcome', 'day7', null, 'failed');
          results.day7.failed++;
        }
      } catch (err) {
        console.error(`[EMAIL-SEQ] Day 7 failed for ${subscriber.email}:`, err);
        results.day7.failed++;
      }
    }

    console.log('[EMAIL-SEQ] Cron completed:', results);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[EMAIL-SEQ] Cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

interface Subscriber {
  id: string;
  email: string;
  display_name: string | null;
}

/**
 * Find subscribers who need a specific email in the sequence
 * - Day 3: signed up 3 days ago, email opt-in, hasn't received day3 email
 * - Day 7: signed up 7 days ago, email opt-in, hasn't received day7 email
 */
async function findSubscribersForEmail(step: 'day3' | 'day7'): Promise<Subscriber[]> {
  const daysAgo = step === 'day3' ? 3 : 7;

  // Find subscribers who:
  // 1. Signed up X days ago (within a 24-hour window)
  // 2. Have email opt-in enabled
  // 3. Haven't already received this email step
  const query = `
    SELECT fp.id, fp.email, fp.display_name
    FROM fan_profiles fp
    WHERE fp.email IS NOT NULL
      AND fp.notification_preferences LIKE '%"email":true%'
      AND fp.created_at >= datetime('now', '-${daysAgo + 1} days')
      AND fp.created_at < datetime('now', '-${daysAgo} days')
      AND NOT EXISTS (
        SELECT 1 FROM email_sequence_sends ess
        WHERE ess.fan_profile_id = fp.id
          AND ess.sequence_type = 'welcome'
          AND ess.email_step = ?
      )
    LIMIT 100
  `;

  try {
    const subscribers = await queryDatabase(query, [step]) as Subscriber[];
    return subscribers || [];
  } catch (err) {
    console.error(`[EMAIL-SEQ] Failed to find ${step} subscribers:`, err);
    return [];
  }
}

/**
 * Log an email send to the database
 */
async function logEmailSend(
  fanProfileId: string,
  email: string,
  sequenceType: string,
  emailStep: string,
  resendId: string | null | undefined,
  status: string = 'sent'
): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO email_sequence_sends (
        id, fan_profile_id, email, sequence_type, email_step, status, resend_id, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [generateId(), fanProfileId, email, sequenceType, emailStep, status, resendId || null]
    );
  } catch (err) {
    console.error('[EMAIL-SEQ] Failed to log send:', err);
  }
}

function generateId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
