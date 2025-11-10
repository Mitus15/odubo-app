import { executeQuery, queryDatabase } from '@/lib/db';
import { Resend } from 'resend';
import { getSiteUrl, getEmailEnv, validateEmailEnv } from '@/lib/env';
import { brandedEmailHTML } from '@/lib/emailTemplates';
import twilio from 'twilio';

export type DispatchResult = { sent: number; skipped: number; failures: number; now: string };

export async function dispatchDueReminders(now: Date = new Date()): Promise<DispatchResult> {
  // Basic self rate limit: if called too frequently within same runtime, short-circuit.
  // In distributed environment, consider using D1 rateLimit util keyed on hour/min.
  const globalAny = globalThis as any;
  const lastRun: number | undefined = globalAny.__momentsReminderLastRun;
  const nowMsTop = Date.now();
  if (lastRun && (nowMsTop - lastRun) < 60_000) {
    return { sent: 0, skipped: 0, failures: 0, now: now.toISOString() }; // silently skip
  }
  globalAny.__momentsReminderLastRun = nowMsTop;
  const nowMs = now.getTime();
  const envCheck = validateEmailEnv();
  if (envCheck.warnings.length) {
    console.warn('[dispatcher email env warnings]', envCheck.warnings.join('; '));
  }
  const { resendKey, fromEmail, siteUrl } = envCheck.values;
  const resend = resendKey ? new Resend(resendKey) : null as unknown as Resend | null;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioFrom = process.env.TWILIO_FROM_NUMBER || '';
  const twilioClient = (twilioSid && twilioToken) ? twilio(twilioSid, twilioToken) : null as unknown as ReturnType<typeof twilio> | null;

  // Load RSVPs joined with galleries that have a start time
  const rows = await queryDatabase(
    `SELECT r.id as rsvp_id, r.email, r.instagram_handle, r.reminder_offsets, r.phone, r.sms_opt_in,
            g.id as gallery_id, g.title, g.starts_at
     FROM gallery_rsvps r
     JOIN galleries g ON g.id = r.gallery_id
     WHERE g.starts_at IS NOT NULL`
  );

  let sent = 0, skipped = 0, failures = 0;

  for (const row of rows as any[]) {
    const startsAtStr = row.starts_at as string;
    if (!startsAtStr) continue;
    const startsAt = Date.parse(startsAtStr);
    if (Number.isNaN(startsAt)) continue;

    let offsets: number[] = [];
    try { offsets = JSON.parse(row.reminder_offsets || '[]') || []; } catch {}
    if (!Array.isArray(offsets) || offsets.length === 0) continue;

    const email: string | null = row.email || null;
    const ig: string | null = row.instagram_handle || null;
    const phone: string | null = row.phone || null;
    const smsOptIn: boolean = !!row.sms_opt_in;

    for (const offsetMin of offsets) {
      const scheduledAt = startsAt - offsetMin * 60_000;
      // Send when scheduledAt is within the last 90 seconds up to now
      if (scheduledAt > nowMs || scheduledAt < nowMs - 90_000) continue;

      const scheduledIso = new Date(scheduledAt).toISOString();
      // Prior existence checks
      const existingEmail = await queryDatabase(
        'SELECT id FROM gallery_rsvp_reminder_logs WHERE rsvp_id = ? AND offset_min = ? AND channel = ? LIMIT 1',
        [row.rsvp_id, offsetMin, 'email']
      );
      const existingSms = await queryDatabase(
        'SELECT id FROM gallery_rsvp_reminder_logs WHERE rsvp_id = ? AND offset_min = ? AND channel = ? LIMIT 1',
        [row.rsvp_id, offsetMin, 'sms']
      );

      // Nothing to contact: mark skipped (email channel log)
      if (!email && !(phone && smsOptIn)) {
        await executeQuery(
          'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, 'email', 'skipped']
        );
        skipped++;
        continue;
      }

      // Email branch
      if (email && !existingEmail[0]) {
        if (!resend) {
          await executeQuery(
            'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, 'email', 'queued']
          );
          skipped++;
        } else {
          try {
            const minutes = offsetMin;
            const when = new Date(startsAt).toLocaleString();
            const subject = `${row.title || 'Event'} is starting soon`;
            const site = siteUrl;
            const manageUrl = `${site}/moments/rsvp/${encodeURIComponent(String(row.gallery_id))}?prefillEmail=${encodeURIComponent(email)}`;
            const openUrl = `${site}/moments?galleryId=${row.gallery_id}`;
            const text = `${row.title || 'Event'} starts soon. You’re getting this ${minutes} minute reminder.\nStart time: ${when}\n\nOpen Moments: ${openUrl}\nManage reminders: ${manageUrl}`;
            const html = brandedEmailHTML({ title: row.title || 'Event', minutes, startsAt: when, galleryId: row.gallery_id, email });
            await (resend as Resend).emails.send({ from: fromEmail, to: email, subject, html, text } as any);
            await executeQuery(
              'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, sent_at, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, new Date().toISOString(), 'email', 'sent']
            );
            sent++;
          } catch (err: any) {
            await executeQuery(
              'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, channel, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, 'email', 'failed', String(err?.message || err)]
            );
            failures++;
          }
        }
      }

      // SMS branch
      if (phone && smsOptIn && !existingSms[0]) {
        if (!twilioClient || !twilioFrom) {
          await executeQuery(
            'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, 'sms', 'queued']
          );
          skipped++;
        } else {
          try {
            const minutes = offsetMin;
            const when = new Date(startsAt).toLocaleString();
            const body = `${row.title || 'Event'} starts in ${minutes}m. Start time: ${when}.`;
            await (twilioClient as any).messages.create({ from: twilioFrom, to: phone, body });
            await executeQuery(
              'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, sent_at, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, new Date().toISOString(), 'sms', 'sent']
            );
            sent++;
          } catch (err: any) {
            await executeQuery(
              'INSERT INTO gallery_rsvp_reminder_logs (rsvp_id, gallery_id, email, instagram_handle, offset_min, scheduled_at, channel, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [row.rsvp_id, row.gallery_id, email, ig, offsetMin, scheduledIso, 'sms', 'failed', String(err?.message || err)]
            );
            failures++;
          }
        }
      }
    }
  }

  return { sent, skipped, failures, now: now.toISOString() };
}
