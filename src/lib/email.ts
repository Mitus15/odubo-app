/**
 * Central Email Service
 * Wraps Resend for transactional emails with templates
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

// Brand styling constants
const BRAND = {
  serif: "'Baskerville', 'Times New Roman', Times, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  primary: '#171616',
  text: '#1a1716',
  accent: '#6b4c3b',
  bg: '#f6f3ee',
  cardBg: '#ffffff',
  border: '#ece7df',
};

// Email wrapper template
function emailWrapper(content: string, preheader?: string): string {
  const site = getSiteUrl();
  const logoUrl = `${site}/brand-logos/danceman.png`;

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
      <div style="padding:14px 22px 20px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:${BRAND.serif};text-align:center;">
        <p style="margin:0">&copy; ${new Date().getFullYear()} Odubo Studio. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
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
            <p style="margin:4px 0 0;color:#6d6459;font-size:14px;">Qty: ${item.quantity}</p>
          </div>
        </div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f0ebe3;text-align:right;vertical-align:top;">
        ${item.price}
      </td>
    </tr>
  `).join('');

  const addressHtml = data.shippingAddress ? `
    <div style="margin-top:20px;padding:16px;background:#f9f7f4;border-radius:12px;">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Shipping to:</p>
      <p style="margin:0;font-size:14px;color:#6d6459;">
        ${data.shippingAddress.line1}<br>
        ${data.shippingAddress.line2 ? data.shippingAddress.line2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zip}<br>
        ${data.shippingAddress.country}
      </p>
    </div>
  ` : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">Thank you for your order!</h1>
    <p style="margin:0 0 20px;font-size:16px;color:${BRAND.text}">
      Hi ${data.customerName}, we've received your order and are getting it ready.
    </p>

    <div style="padding:16px;background:#f9f7f4;border-radius:12px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#6d6459;">Order number</p>
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
      <a href="${site}/store" style="display:inline-block;padding:14px 28px;background:${BRAND.primary};color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-family:${BRAND.sans};">
        Continue Shopping
      </a>
    </div>
  `;

  return emailWrapper(content, `Order ${data.orderNumber} confirmed - Thank you for your purchase!`);
}

export interface WelcomeEmailData {
  name: string;
  email: string;
}

function welcomeEmailHTML(data: WelcomeEmailData): string {
  const site = getSiteUrl();

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND.primary}">Welcome to Odubo</h1>
    <p style="margin:0 0 20px;font-size:16px;color:${BRAND.text}">
      Hey ${data.name || 'there'}, thanks for joining the community.
    </p>

    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};">
      You now have access to exclusive drops, behind-the-scenes content, and first looks at new releases.
    </p>

    <div style="margin:24px 0;text-align:center;">
      <a href="${site}" style="display:inline-block;padding:14px 28px;background:${BRAND.primary};color:#fff;border-radius:999px;text-decoration:none;font-weight:600;font-family:${BRAND.sans};">
        Explore Odubo
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:14px;color:#6d6459;text-align:center;">
      Follow us for daily updates and exclusive content.
    </p>
  `;

  return emailWrapper(content, `Welcome to Odubo - You're in!`);
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
      subject: `Order Confirmed - ${data.orderNumber}`,
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
      subject: 'Welcome to Odubo',
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
