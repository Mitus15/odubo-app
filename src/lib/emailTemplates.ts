import { getSiteUrl } from '@/lib/env';

export function brandedEmailHTML({
  title,
  minutes,
  startsAt,
  galleryId,
  email,
}: { title: string; minutes: number; startsAt: string; galleryId: number; email: string }) {
  const serif = "'Baskerville', 'Times New Roman', Times, serif";
  const primary = '#171616';
  const text = '#1a1716';
  const accent = '#6b4c3b';
  const bg = '#f6f3ee';
  const site = getSiteUrl();
  const logoUrl = `${site}/brand-logos/baad-logo.png`;
  const manageUrl = `${site}/moments/rsvp/${encodeURIComponent(String(galleryId))}?prefillEmail=${encodeURIComponent(email)}`;
  return `
      <div style="background:${bg};padding:24px 0;">
        <div style="display:none;visibility:hidden;opacity:0;max-height:0;max-width:0;overflow:hidden">${title} starts soon. You're getting this ${minutes} minute reminder.</div>
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
          <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
            <img src="${logoUrl}" alt="Odubo Logo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
          </div>
          <div style="padding:22px 22px 8px 22px;color:${text};font-family:${serif};">
            <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${primary}">${title} starts soon</h1>
            <p style="margin:0 0 10px;font-size:16px;color:${text}">You're getting this <strong>${minutes} minute</strong> reminder.</p>
            <p style="margin:0 0 16px;font-size:16px;color:${text}">Start time: <strong>${startsAt}</strong></p>
            <div style="margin:22px 0 6px">
              <a href="${site}/moments?galleryId=${galleryId}"
                 style="display:inline-block;padding:12px 18px;background:${primary};color:#fff;border-radius:999px;text-decoration:none;font-weight:700">
                Open Moments
              </a>
            </div>
          </div>
          <div style="padding:14px 22px 20px 22px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:${serif};">
            <p style="margin:0 0 8px">You're receiving this because you RSVP’d via email for <em>${title}</em>.</p>
            <p style="margin:0">Prefer fewer emails? <a href="${manageUrl}" style="color:${accent}">Manage reminders or unsubscribe</a>.</p>
          </div>
        </div>
      </div>
    `;
}
