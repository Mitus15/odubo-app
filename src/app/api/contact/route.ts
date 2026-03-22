import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { rateLimit } from '@/lib/rateLimit';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'Odubo Studio <info@odubo.studio>';
const supportEmail = process.env.SUPPORT_EMAIL || 'info@odubo.studio';

interface ContactFormData {
  name: string;
  email: string;
  orderNumber?: string;
  inquiryType: 'order' | 'refund' | 'shipping' | 'general';
  message: string;
}

const inquirySubjects: Record<string, string> = {
  order: 'Order Inquiry',
  refund: 'Return/Refund Request',
  shipping: 'Shipping Question',
  general: 'General Inquiry',
};

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await rateLimit({ key: `contact:${ip}`, limit: 3, windowMs: 60_000 });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ContactFormData;
    const { name, email, orderNumber, inquiryType, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Build email content
    const subjectLabel = inquirySubjects[inquiryType] || inquirySubjects.general;
    const subject = `${subjectLabel} from ${name}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f6f3ee;">
          <div style="background:#f6f3ee;padding:24px 16px;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
              <div style="padding:20px 22px;background:linear-gradient(135deg, #843c2d, #6d3224);color:white;">
                <h2 style="margin:0;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;">New Contact Form Submission</h2>
                <p style="margin:5px 0 0;opacity:0.9;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;">${subjectLabel}</p>
              </div>
              <div style="padding:22px;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;color:#1a1716;">
                <div style="margin-bottom:15px;">
                  <div style="font-weight:600;color:#6d6459;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">From</div>
                  <div style="margin-top:4px;"><strong>${name}</strong> (${email})</div>
                </div>
                ${orderNumber ? `
                <div style="margin-bottom:15px;">
                  <div style="font-weight:600;color:#6d6459;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Order Number</div>
                  <div style="margin-top:4px;">${orderNumber}</div>
                </div>
                ` : ''}
                <div style="margin-bottom:15px;">
                  <div style="font-weight:600;color:#6d6459;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Inquiry Type</div>
                  <div style="margin-top:4px;">${inquiryType.charAt(0).toUpperCase() + inquiryType.slice(1)}</div>
                </div>
                <div style="margin-bottom:15px;">
                  <div style="font-weight:600;color:#6d6459;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message</div>
                  <div style="margin-top:10px;background:#f9f7f4;padding:15px;border-radius:8px;border-left:3px solid #843c2d;">${message.replace(/\n/g, '<br>')}</div>
                </div>
              </div>
              <div style="padding:14px 22px 20px;border-top:1px solid #f0ebe3;color:#6d6459;font-size:12px;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;">
                <p style="margin:0;">Reply directly to this email to respond to the customer.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
New Contact Form Submission
${subjectLabel}

From: ${name} (${email})
${orderNumber ? `Order Number: ${orderNumber}` : ''}
Inquiry Type: ${inquiryType}

Message:
${message}

---
Reply directly to this email to respond to the customer.
    `.trim();

    // If Resend is configured, send the email
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      await resend.emails.send({
        from: fromEmail,
        to: supportEmail,
        replyTo: email,
        subject,
        html: htmlContent,
        text: textContent,
      });

      // Also send confirmation to customer
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `We received your message \u2014 Odubo Studio`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0;padding:0;background:#f6f3ee;">
              <div style="background:#f6f3ee;padding:24px 16px;">
                <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #ece7df;overflow:hidden">
                  <div style="padding:20px 22px 0 22px;text-align:center;border-bottom:1px solid #f0ebe3">
                    <img src="https://odubo.studio/brand-logos/odubo-logo.png" alt="Odubo" style="height:40px;width:auto;margin:8px auto 14px;display:block" />
                  </div>
                  <div style="padding:22px;font-family:'Baskerville','Times New Roman',Times,Georgia,serif;color:#1a1716;">
                    <h2 style="margin:0 0 12px;font-size:22px;color:#171616;">Thanks for reaching out.</h2>
                    <p style="margin:0 0 16px;font-size:16px;">Hi ${name}, we&rsquo;ve received your message and will get back to you within 24&ndash;48 hours.</p>
                    <p style="margin:0 0 16px;font-size:16px;">In the meantime:</p>
                    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#1a1716;">
                      <li style="margin-bottom:8px;"><a href="https://account.odubo.studio" style="color:#843c2d;text-decoration:none;">Check your order status</a></li>
                      <li><a href="https://odubo.studio/store" style="color:#843c2d;text-decoration:none;">Browse the collection</a></li>
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
        text: `
Hi ${name},

We've received your message and will get back to you within 24-48 hours.

In the meantime:
- Check your order status: https://account.odubo.studio
- Browse the collection: https://odubo.studio/store

\u2014 Odubo Studio
        `.trim(),
      });
    } else {
      // Log for development/debugging when Resend isn't configured
      console.log('[EMAIL] Contact form submission (Resend not configured):');
      console.log({ name, email, orderNumber, inquiryType, message });
    }

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
