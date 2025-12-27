/**
 * Shopify Order Webhook Handler
 * Receives order notifications and sends confirmation emails
 *
 * Setup in Shopify Admin:
 * Settings > Notifications > Webhooks > Create webhook
 * Topic: Order creation
 * URL: https://odubo.studio/api/shopify/webhooks/orders
 * Format: JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendOrderConfirmation, type OrderConfirmationData } from '@/lib/email';

export const runtime = 'nodejs';

// Verify Shopify webhook signature
function verifyWebhook(body: string, signature: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // In development, skip verification if secret not set
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[WEBHOOK] SHOPIFY_WEBHOOK_SECRET not configured');
      return false;
    }
    console.warn('[WEBHOOK] Skipping signature verification in development');
    return true;
  }

  if (!signature) {
    console.error('[WEBHOOK] No signature provided');
    return false;
  }

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hmac)
  );
}

// Format currency
function formatCurrency(amount: string | number, currency: string = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-shopify-hmac-sha256');

    // Verify webhook authenticity
    if (!verifyWebhook(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse order data
    const order = JSON.parse(rawBody);

    console.log('[WEBHOOK] Received order:', {
      id: order.id,
      name: order.name,
      email: order.email,
      total: order.total_price,
    });

    // Skip if no customer email
    if (!order.email) {
      console.log('[WEBHOOK] No customer email, skipping confirmation');
      return NextResponse.json({ success: true, message: 'No email to send to' });
    }

    // Extract order data for email
    const currency = order.currency || 'USD';

    const emailData: OrderConfirmationData = {
      orderNumber: order.name || `#${order.order_number}`,
      customerName: order.customer?.first_name || order.billing_address?.first_name || 'Customer',
      customerEmail: order.email,
      items: (order.line_items || []).map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        price: formatCurrency(item.price, currency),
        image: item.image?.src || undefined,
      })),
      subtotal: formatCurrency(order.subtotal_price || '0', currency),
      shipping: formatCurrency(
        order.total_shipping_price_set?.shop_money?.amount || '0',
        currency
      ),
      total: formatCurrency(order.total_price || '0', currency),
    };

    // Add shipping address if available
    if (order.shipping_address) {
      emailData.shippingAddress = {
        line1: order.shipping_address.address1,
        line2: order.shipping_address.address2 || undefined,
        city: order.shipping_address.city,
        state: order.shipping_address.province_code || order.shipping_address.province,
        zip: order.shipping_address.zip,
        country: order.shipping_address.country,
      };
    }

    // Send order confirmation email
    const result = await sendOrderConfirmation(emailData);

    if (result.success) {
      console.log('[WEBHOOK] Order confirmation email sent:', result.id);
      return NextResponse.json({
        success: true,
        message: 'Order confirmation sent',
        emailId: result.id,
      });
    } else {
      console.error('[WEBHOOK] Failed to send order confirmation:', result.error);
      // Still return 200 to acknowledge webhook receipt
      return NextResponse.json({
        success: false,
        message: 'Webhook received but email failed',
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('[WEBHOOK] Error processing order webhook:', error);
    // Return 200 to prevent Shopify from retrying
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}

// Handle webhook verification (GET request)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/shopify/webhooks/orders',
    description: 'Shopify order webhook endpoint',
  });
}
