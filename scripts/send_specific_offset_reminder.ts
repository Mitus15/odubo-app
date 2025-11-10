import 'dotenv/config';
import { Resend } from 'resend';
import { queryDatabase } from '@/lib/db';
import { getSiteUrl, getEmailEnv, validateEmailEnv } from '@/lib/env';
import { isValidEmail } from '@/lib/validation';

/*
 Usage:
   npx tsx --env-file=.env.local scripts/send_specific_offset_reminder.ts --gallery=2 --offset=1440 --to=you@example.com
 Sends a single email reminder as if the dispatcher fired for the given offset (in minutes before start).
 Only uses email channel (no logging table write). This is for manual preview.
*/

function getArg(name: string, def?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const galleryIdStr = getArg('gallery');
  const offsetStr = getArg('offset');
  const to = getArg('to');
  if (!galleryIdStr || !offsetStr || !to) {
    console.error('Required: --gallery=<id> --offset=<minutes> --to=<email>');
    process.exit(1);
  }
  if (!isValidEmail(to)) {
    console.error('Invalid recipient email format');
    process.exit(1);
  }
  const galleryId = Number(galleryIdStr);
  const offsetMin = Number(offsetStr);
  if (!Number.isFinite(galleryId) || !Number.isFinite(offsetMin)) {
    console.error('Invalid numeric values for gallery or offset');
    process.exit(1);
  }

  const envCheck = validateEmailEnv();
  if (envCheck.warnings.length) {
    console.warn('[email env warnings]', envCheck.warnings.join('; '));
  }
  const { resendKey, fromEmail } = envCheck.values;
  if (!resendKey) { console.error('Missing RESEND_API_KEY'); process.exit(1); }

  // Load gallery start
  const rows = await queryDatabase('SELECT id, title, starts_at FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
  if (!rows[0]) { console.error('Gallery not found'); process.exit(1); }
  const g: any = rows[0];
  if (!g.starts_at) { console.error('Gallery has no starts_at, cannot send offset reminder'); process.exit(1); }
  const starts = Date.parse(g.starts_at);
  if (Number.isNaN(starts)) { console.error('Invalid starts_at date'); process.exit(1); }

  const scheduledAt = new Date(starts - offsetMin * 60_000);
  const humanStart = new Date(starts).toLocaleString();
  const humanScheduled = scheduledAt.toLocaleString();

  const hours = Math.round(offsetMin/60);
  const subject = `${g.title || 'Event'} reminder (${offsetMin}m before start)`;
  const serif = "'Baskerville', 'Times New Roman', Times, serif";
  const primary = '#171616';
  const accent = '#6b4c3b';
  const bg = '#f6f3ee';
  const site = getSiteUrl();
  const logoUrl = `${site}/brand-logos/danceman.png`;
  const manageUrl = `${site}/moments/rsvp/${encodeURIComponent(String(galleryId))}?prefillEmail=${encodeURIComponent(to)}`;
  const html = `
    <div style="background:${bg};padding:24px 0;">
  <div style="display:none;visibility:hidden;opacity:0;max-height:0;max-width:0;overflow:hidden">Preview ${offsetMin} minute reminder for ${g.title || 'Event'}</div>
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
        <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
          <img src="${logoUrl}" alt="Odubo Logo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
        </div>
        <div style="padding:22px 22px 8px 22px;color:#1a1716;font-family:${serif};">
          <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${primary}">${g.title || 'Event'} starts in ${hours} hours</h1>
          <p style="margin:0 0 10px;font-size:16px;color:#1a1716">You asked to be reminded ${offsetMin} minutes before start.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#1a1716">Start time: <strong>${humanStart}</strong></p>
          <p style="margin:0 0 12px; font-size:12px; color:#555">(Manual preview – scheduled send time would be ${humanScheduled}).</p>
          <div style="margin:22px 0 6px">
            <a href="${site}/moments?galleryId=${galleryId}"
               style="display:inline-block;padding:12px 18px;background:${primary};color:#fff;border-radius:999px;text-decoration:none;font-weight:700">
              Open Moments
            </a>
          </div>
        </div>
        <div style="padding:14px 22px 20px 22px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:${serif};">
          <p style="margin:0 0 8px">Preview email triggered for <em>${g.title || 'Event'}</em>.</p>
          <p style="margin:0">Manage or unsubscribe reminders: <a href="${manageUrl}" style="color:${accent}">Reminder settings</a>.</p>
        </div>
      </div>
    </div>
  `;
  const text = `${g.title || 'Event'} preview reminder ${offsetMin} minutes before start.\nStart: ${humanStart}\nScheduled send time (approx): ${humanScheduled}\nOpen Moments: ${site}/moments?galleryId=${galleryId}\nManage reminders: ${manageUrl}`;

  const resend = new Resend(resendKey);
  try {
    const { data, error } = await resend.emails.send({ from: fromEmail, to, subject, html, text });
    if (error) {
      console.error('Resend error:', error);
      process.exit(1);
    }
    console.log('Preview reminder queued:', data);
  } catch (e) {
    console.error('Send failed:', e);
    process.exit(1);
  }
}

main();
