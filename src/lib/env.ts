// Centralized environment helpers for email/sms dispatch and site URL resolution

type EmailEnv = {
  resendKey: string | null;
  fromEmail: string;
};

// Prefer a single, reliable base URL for absolute links in emails
export function getSiteUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'https://odubo.studio';
  const withProto = site.startsWith('http') ? site : `https://${site}`;
  return withProto.replace(/\/$/, '');
}

// Gather email-related env vars with sane defaults and without throwing
export function getEmailEnv(): EmailEnv {
  const resendKey = process.env.RESEND_API_KEY || null;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    'B.A.A.D @ Odubo Studio <baad@odubo.studio>';
  return { resendKey, fromEmail };
}

// Validate presence/format of critical env for email sending. Returns warnings instead of throwing.
export function validateEmailEnv(): { ok: boolean; warnings: string[]; values: EmailEnv & { siteUrl: string } } {
  const warnings: string[] = [];
  const siteUrl = getSiteUrl();
  const { resendKey, fromEmail } = getEmailEnv();

  if (!resendKey) {
    warnings.push('RESEND_API_KEY is missing; email sending will be skipped.');
  }
  // Resend accepts "Display Name <email>" or plain email format
  const emailPart = fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)?.[1] || '' : fromEmail;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart)) {
    warnings.push(`RESEND_FROM_EMAIL/EMAIL_FROM seems invalid: ${fromEmail}`);
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL) {
    warnings.push(`No public site URL configured; defaulting to ${siteUrl}`);
  }

  return { ok: warnings.length === 0, warnings, values: { resendKey, fromEmail, siteUrl } };
}

export default {
  getSiteUrl,
  getEmailEnv,
  validateEmailEnv,
};
