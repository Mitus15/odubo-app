/**
 * Send all branded email templates to a test address
 * Usage: tsx --env-file=.env.local scripts/send-all-test-emails.ts
 */

import { Resend } from 'resend';
import {
  sendWelcomeEmail,
  sendDay3Email,
  sendDay7Email,
  sendOrderConfirmation,
} from '../src/lib/email';
import { brandedEmailHTML } from '../src/lib/emailTemplates';

const TO = process.argv[2] || 'emorris508@gmail.com';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`\nSending all branded emails to: ${TO}\n`);

  // 1. Welcome Email
  console.log('1/6 Welcome email...');
  const welcome = await sendWelcomeEmail({
    name: 'Emmanuel',
    email: TO,
  });
  console.log(welcome.success ? '  ✓ Sent' : `  ✗ ${welcome.error}`);
  await sleep(1200);

  // 2. Day 3 Email
  console.log('2/6 Day 3 email...');
  const day3 = await sendDay3Email({
    name: 'Emmanuel',
    email: TO,
  });
  console.log(day3.success ? '  ✓ Sent' : `  ✗ ${day3.error}`);
  await sleep(1200);

  // 3. Day 7 Email
  console.log('3/6 Day 7 email...');
  const day7 = await sendDay7Email({
    name: 'Emmanuel',
    email: TO,
  });
  console.log(day7.success ? '  ✓ Sent' : `  ✗ ${day7.error}`);
  await sleep(1200);

  // 4. Order Confirmation
  console.log('4/6 Order confirmation...');
  const order = await sendOrderConfirmation({
    orderNumber: 'ODUBO-2026-0001',
    customerName: 'Emmanuel',
    customerEmail: TO,
    items: [
      { title: 'Odubo Essential Tee — Black', quantity: 1, price: '$45.00' },
      { title: 'Odubo Studio Cap — Terracotta', quantity: 1, price: '$35.00' },
    ],
    subtotal: '$80.00',
    shipping: 'Free',
    total: '$80.00',
    shippingAddress: {
      line1: '123 Studio Ave',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      country: 'United States',
    },
  });
  console.log(order.success ? '  ✓ Sent' : `  ✗ ${order.error}`);
  await sleep(1200);

  // 5. Contact Form Confirmation
  console.log('5/6 Contact form confirmation...');
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log('  ✗ RESEND_API_KEY not configured');
  } else {
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@odubo.studio';
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio';

    const contactResult = await resend.emails.send({
      from: fromEmail,
      to: TO,
      subject: 'We received your message \u2014 Odubo Studio',
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0;padding:0;background:#f6f3ee;">
            <div style="background:#f6f3ee;padding:24px 16px;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
                <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
                  <img src="${site}/brand-logos/odubo-logo.png" alt="Odubo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
                </div>
                <div style="padding:22px;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;color:#1a1716;">
                  <h2 style="margin:0 0 12px;font-size:22px;color:#171616;">Thanks for reaching out.</h2>
                  <p style="margin:0 0 16px;font-size:16px;">Hi Emmanuel, we&rsquo;ve received your message and will get back to you within 24&ndash;48 hours.</p>
                  <p style="margin:0 0 16px;font-size:16px;">In the meantime:</p>
                  <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#1a1716;">
                    <li style="margin-bottom:8px;"><a href="https://account.odubo.studio" style="color:#843c2d;text-decoration:none;">Check your order status</a></li>
                    <li><a href="${site}/store" style="color:#843c2d;text-decoration:none;">Browse the collection</a></li>
                  </ul>
                  <p style="margin:20px 0 0;font-size:15px;color:#6d6459;">&mdash; Odubo Studio</p>
                </div>
                <div style="padding:14px 22px 20px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;text-align:center;">
                  <p style="margin:0 0 4px;">Odubo Studio</p>
                  <p style="margin:0;">&copy; ${new Date().getFullYear()} Odubo. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    console.log(contactResult.data ? '  ✓ Sent' : `  ✗ ${contactResult.error?.message}`);
  }
  await sleep(1200);

  // 6. Moments Reminder
  console.log('6/6 Moments reminder...');
  if (!resendKey) {
    console.log('  ✗ RESEND_API_KEY not configured');
  } else {
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@odubo.studio';

    const reminderHtml = brandedEmailHTML({
      title: 'Odubo Studio Pop-Up',
      minutes: 30,
      startsAt: 'Saturday, February 15 at 7:00 PM EST',
      galleryId: 1,
      email: TO,
    });

    const reminderResult = await resend.emails.send({
      from: fromEmail,
      to: TO,
      subject: 'Odubo Studio Pop-Up is starting soon',
      html: reminderHtml,
    });
    console.log(reminderResult.data ? '  ✓ Sent' : `  ✗ ${reminderResult.error?.message}`);
  }

  console.log('\nDone! Check your inbox.\n');
}

main().catch(console.error);
