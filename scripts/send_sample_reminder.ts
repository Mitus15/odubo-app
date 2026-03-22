import 'dotenv/config';
import { Resend } from 'resend';

function getArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const idx = process.argv.findIndex(a => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'info@odubo.studio';
  const toArg = getArg('to') || getArg('email') || process.argv.slice(2).find(v => v.includes('@'));
  const to = toArg || (process.env.ADMIN_EMAILS?.split(',')[0]?.trim());

  if (!apiKey) {
    console.error('Missing RESEND_API_KEY in environment');
    process.exit(1);
  }
  if (!to) {
    console.error('Provide a recipient email via --to you@example.com');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const subject = 'Odubo Moments — Sample Reminder';
  const serif = "'Baskerville', 'Times New Roman', Times, serif";
  const primary = '#171616';
  const bg = '#f6f3ee';
  const accent = '#6b4c3b';
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio';
  const logoUrl = `${site}/brand-logos/danceman.png`;
  const manageUrl = `${site}/moments`;
  const html = `
    <div style="background:${bg};padding:24px 0;">
      <div style="display:none;visibility:hidden;opacity:0;max-height:0;max-width:0;overflow:hidden">Sample reminder — branding check</div>
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
        <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
            <img src="${logoUrl}" alt="Odubo Logo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
        </div>
        <div style="padding:22px 22px 8px 22px;color:#1a1716;font-family:${serif};">
          <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${primary}">Your Moments reminder</h1>
          <p style="margin:0 0 10px;font-size:16px;color:#1a1716">This is a sample reminder to confirm email delivery.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#1a1716">If this were live, you would receive it at your chosen offsets.</p>
          <div style="margin:22px 0 6px">
            <a href="${site}/moments"
               style="display:inline-block;padding:12px 18px;background:${primary};color:#fff;border-radius:999px;text-decoration:none;font-weight:700">
              Open Moments
            </a>
          </div>
        </div>
        <div style="padding:14px 22px 20px 22px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:${serif};">
          <p style="margin:0">Manage your reminders: <a href="${manageUrl}" style="color:${accent}">Moments</a>.</p>
        </div>
      </div>
    </div>
  `;
  const text = 'Sample reminder from Odubo Studio. Open Moments: https://odubo.studio/moments';

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('Resend error:', error);
      process.exit(1);
    }
    console.log('Email queued:', data);
  } catch (e) {
    console.error('Send failed:', e);
    process.exit(1);
  }
}

main();
