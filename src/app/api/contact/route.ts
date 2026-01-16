import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@odubo.studio';
const supportEmail = process.env.SUPPORT_EMAIL || 'baad@odubo.studio';

interface ContactFormData {
  name: string;
  email: string;
  orderNumber?: string;
  inquiryType: 'order' | 'refund' | 'shipping' | 'general';
  message: string;
}

const inquirySubjects: Record<string, string> = {
  order: '📦 Order Inquiry',
  refund: '💰 Return/Refund Request',
  shipping: '🚚 Shipping Question',
  general: '💬 General Inquiry',
};

export async function POST(request: NextRequest) {
  try {
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
    const subjectPrefix = inquirySubjects[inquiryType] || inquirySubjects.general;
    const subject = `${subjectPrefix} from ${name}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #843c2d, #6d3224); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { margin-top: 4px; }
            .message-box { background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #843c2d; margin-top: 10px; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">New Contact Form Submission</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">${subjectPrefix}</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">From</div>
                <div class="value"><strong>${name}</strong> (${email})</div>
              </div>
              ${orderNumber ? `
              <div class="field">
                <div class="label">Order Number</div>
                <div class="value">${orderNumber}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="label">Inquiry Type</div>
                <div class="value">${inquiryType.charAt(0).toUpperCase() + inquiryType.slice(1)}</div>
              </div>
              <div class="field">
                <div class="label">Message</div>
                <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <div class="footer">
              <p>Reply directly to this email to respond to the customer.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
New Contact Form Submission
${subjectPrefix}

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
        subject: `We received your message - Odubo Studio`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #843c2d, #6d3224); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
                a { color: #843c2d; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2 style="margin: 0;">Thanks for reaching out!</h2>
                </div>
                <div class="content">
                  <p>Hi ${name},</p>
                  <p>We've received your message and will get back to you within 24-48 hours.</p>
                  <p>In the meantime, you can:</p>
                  <ul>
                    <li><a href="https://account.odubo.studio">Check your order status</a></li>
                    <li><a href="https://odubo.com">Continue shopping</a></li>
                  </ul>
                  <p>Thanks for being part of the Odubo community!</p>
                  <p style="margin-top: 20px;">— The Odubo Team</p>
                </div>
                <div class="footer">
                  <p>Odubo Studio | <a href="https://odubo.com">odubo.com</a></p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Hi ${name},

We've received your message and will get back to you within 24-48 hours.

In the meantime, you can:
- Check your order status: https://account.odubo.studio
- Continue shopping: https://odubo.com

Thanks for being part of the Odubo community!

— The Odubo Team
        `.trim(),
      });
    } else {
      // Log for development/debugging when Resend isn't configured
      console.log('📧 Contact form submission (Resend not configured):');
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
