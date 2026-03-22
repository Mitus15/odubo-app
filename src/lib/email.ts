/**
 * Central Email Service
 * Wraps Resend for transactional emails with B.A.A.D @ Odubo Studio branding
 */

import { Resend } from 'resend';
import { getEmailEnv, getSiteUrl } from '@/lib/env';

// Lazy-loaded Resend client
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const { resendKey } = getEmailEnv();
  if (!resendKey) {
    console.warn('[EMAIL] RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }
  resendClient = new Resend(resendKey);
  return resendClient;
}

// B.A.A.D @ Odubo Studio brand system
const BRAND = {
  serif: "'Baskerville', 'Times New Roman', Times, Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  primary: '#171616',
  text: '#1a1716',
  accent: '#843c2d',       // Terracotta
  accentLight: '#9a4a38',
  muted: '#6d6459',
  bg: '#f6f3ee',
  cardBg: '#ffffff',
  border: '#ece7df',
  warmBg: '#f9f7f4',
};

// Email wrapper — shared chrome for all emails
function emailWrapper(content: string, preheader?: string): string {
  const site = getSiteUrl();
  const logoUrl = `${site}/brand-logos/odubo-logo.png`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  ${preheader ? `<div style="display:none;visibility:hidden;opacity:0;max-height:0;max-width:0;overflow:hidden">${preheader}</div>` : ''}
  <div style="background:${BRAND.bg};padding:24px 16px;">
    <div style="max-width:560px;margin:0 auto;background:${BRAND.cardBg};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden">
      <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
        <img src="${logoUrl}" alt="Odubo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
      </div>
      <div style="padding:22px;color:${BRAND.text};font-family:${BRAND.serif};">
        ${content}
      </div>
      <div style="padding:14px 22px 20px;border-top:1px solid #f0ebe3;color:${BRAND.muted};font-size:12px;font-family:${BRAND.serif};text-align:center;">
        <p style="margin:0 0 4px;">Odubo Studio</p>
        <p style="margin:0;color:${BRAND.muted};">&copy; ${new Date().getFullYear()} Odubo. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// CTA button helper
function ctaButton(href: string, label: string, variant: 'primary' | 'outline' = 'primary'): string {
  if (variant === 'outline') {
    return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:transparent;color:${BRAND.accent};border:2px solid ${BRAND.accent};border-radius:999px;text-decoration:none;font-weight:600;font-family:${BRAND.serif};letter-spacing:0.02em;">${label}</a>`;
  }
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:${BRAND.accent};color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-family:${BRAND.serif};letter-spacing:0.02em;">${label}</a>`;
}

// ============================================================================
// Email Templates
// ============================================================================

export interface OrderConfirmationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    title: string;
    quantity: number;
    price: string;
    image?: string;
  }>;
  subtotal: string;
  shipping: string;
  total: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

function orderConfirmationHTML(data: OrderConfirmationData): string {
  const site = getSiteUrl();

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0ebe3;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" />` : ''}
          <div>
            <p style="margin:0;font-weight:600;">${item.title}</p>
            <p style="margin:4px 0 0;color:${BRAND.muted};font-size:14px;">Qty: ${item.quantity}</p>
          </div>
        </div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f0ebe3;text-align:right;vertical-align:top;">
        ${item.price}
      </td>
    </tr>
  `).join('');

  const addressHtml = data.shippingAddress ? `
    <div style="margin-top:20px;padding:16px;background:${BRAND.warmBg};border-radius:12px;">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Shipping to:</p>
      <p style="margin:0;font-size:14px;color:${BRAND.muted};">
        ${data.shippingAddress.line1}<br>
        ${data.shippingAddress.line2 ? data.shippingAddress.line2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zip}<br>
        ${data.shippingAddress.country}
      </p>
    </div>
  ` : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">Your Odubo piece is on its way.</h1>
    <p style="margin:0 0 20px;font-size:16px;color:${BRAND.text}">
      Hi ${data.customerName}, we&rsquo;ve received your order and are preparing it with care.
    </p>

    <div style="padding:16px;background:${BRAND.warmBg};border-radius:12px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:${BRAND.muted};">Order number</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:600;color:${BRAND.primary}">${data.orderNumber}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td style="padding:12px 0 4px;font-size:14px;">Subtotal</td>
          <td style="padding:12px 0 4px;text-align:right;font-size:14px;">${data.subtotal}</td>
        </tr>
        <tr>
          <td style="padding:4px 0 12px;font-size:14px;">Shipping</td>
          <td style="padding:4px 0 12px;text-align:right;font-size:14px;">${data.shipping}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;font-size:18px;font-weight:600;border-top:2px solid ${BRAND.primary};">Total</td>
          <td style="padding:12px 0;text-align:right;font-size:18px;font-weight:600;border-top:2px solid ${BRAND.primary};">${data.total}</td>
        </tr>
      </tfoot>
    </table>

    ${addressHtml}

    <div style="margin-top:24px;text-align:center;">
      ${ctaButton(`${site}/store`, 'Browse More Pieces', 'outline')}
    </div>
  `;

  return emailWrapper(content, `Order ${data.orderNumber} confirmed \u2014 your Odubo piece is on its way.`);
}

export interface WelcomeEmailData {
  name: string;
  email: string;
}

function welcomeEmailHTML(data: WelcomeEmailData): string {
  const site = getSiteUrl();

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">Welcome to Odubo Studio</h1>
    <p style="margin:12px 0 20px;font-size:16px;color:${BRAND.text}">
      Hey ${data.name || 'there'}, thanks for joining. You&rsquo;re now part of something being built with intention.
    </p>

    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};">
      Odubo Studio is where music, film, and art converge &mdash; new work dropping regularly.
    </p>

    <div style="margin:24px 0;text-align:center;">
      ${ctaButton(site, 'Visit the Studio')}
    </div>

    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.muted};text-align:center;">
      <a href="${site}" style="color:${BRAND.accent};text-decoration:none;">odubo.studio</a>
    </p>
  `;

  return emailWrapper(content, `Welcome to Odubo Studio \u2014 thanks for joining.`);
}

// Day 3 Email — what's been happening at the studio
export interface Day3EmailData {
  name: string;
  email: string;
}

function day3EmailHTML(data: Day3EmailData): string {
  const site = getSiteUrl();

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">What&rsquo;s New at the Studio</h1>
    <p style="margin:0 0 20px;font-size:16px;color:${BRAND.text}">
      Hey ${data.name || 'there'}, here&rsquo;s what&rsquo;s been happening at Odubo Studio.
    </p>

    <div style="margin:24px 0;padding:20px;background:${BRAND.warmBg};border-radius:12px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${BRAND.primary};">From the Studio</p>
      <p style="margin:0;font-size:14px;color:${BRAND.text};">
        New clips dropping daily &mdash; music, behind-the-scenes, the creative process unfiltered.
      </p>
    </div>

    <div style="margin:24px 0;text-align:center;">
      ${ctaButton(site, 'Enter the Studio')}
    </div>

    <div style="margin:24px 0;padding:20px;background:${BRAND.warmBg};border-radius:12px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${BRAND.primary};">From the Collection</p>
      <p style="margin:0;font-size:14px;color:${BRAND.text};">
        Pieces designed to be worn with conviction. Limited runs &mdash; once they&rsquo;re gone, they&rsquo;re gone.
      </p>
    </div>

    <div style="margin:24px 0;text-align:center;">
      ${ctaButton(`${site}/store`, 'Browse the Collection', 'outline')}
    </div>
  `;

  return emailWrapper(content, `New at Odubo Studio \u2014 clips, collection, and more.`);
}

// Day 7 Email — check back in, nudge to explore
export interface Day7EmailData {
  name: string;
  email: string;
}

function day7EmailHTML(data: Day7EmailData): string {
  const site = getSiteUrl();

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">Still Building</h1>
    <p style="margin:0 0 20px;font-size:16px;color:${BRAND.text}">
      Hey ${data.name || 'there'}, just a reminder &mdash; new work is always dropping at the Studio.
    </p>

    <div style="margin:24px 0;padding:20px;background:${BRAND.warmBg};border-radius:12px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${BRAND.primary};">Don&rsquo;t Miss Out</p>
      <p style="margin:0;font-size:14px;color:${BRAND.text};">
        Fresh clips, new pieces in the collection, and moments you won&rsquo;t find anywhere else.
      </p>
    </div>

    <div style="margin:24px 0;text-align:center;">
      ${ctaButton(site, 'Visit the Studio')}
    </div>
  `;

  return emailWrapper(content, `New work dropping at Odubo Studio.`);
}

// ============================================================================
// Send Functions
// ============================================================================

export type SendResult = { success: true; id: string } | { success: false; error: string };

export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail } = getEmailEnv();

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.customerEmail,
      subject: `Order Confirmed \u2014 ${data.orderNumber}`,
      html: orderConfirmationHTML(data),
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id || 'sent' };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send order confirmation:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail } = getEmailEnv();

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: 'Welcome to Odubo Studio',
      html: welcomeEmailHTML(data),
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id || 'sent' };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send welcome email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function sendDay3Email(data: Day3EmailData): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail } = getEmailEnv();

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: 'New at Odubo Studio',
      html: day3EmailHTML(data),
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id || 'sent' };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send Day 3 email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function sendDay7Email(data: Day7EmailData): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail } = getEmailEnv();

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: 'Still Building \u2014 Odubo Studio',
      html: day7EmailHTML(data),
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id || 'sent' };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send Day 7 email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// Generic send function for custom emails
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail } = getEmailEnv();

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id || 'sent' };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
