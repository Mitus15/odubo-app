import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { clerkClient } from '@/lib/clerk-client';
import { createClerkClient } from '@clerk/backend';
import { D1Database } from '@cloudflare/workers-types';

// Clerk webhook handler
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return new Response('Server configuration error', { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const svix = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = svix.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  const { type, data } = evt;
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  switch (type) {
    case 'user.created': {
      const { id, email_addresses, public_metadata } = data;
      const primaryEmail = email_addresses?.[0]?.email_address;
      
      console.log('New user created:', id, primaryEmail);
      
      // Link Shopify account if exists
      if (primaryEmail) {
        await linkShopifyAccount(id, primaryEmail);
      }
      break;
    }

    case 'user.updated': {
      const { id, email_addresses } = data;
      const primaryEmail = email_addresses?.[0]?.email_address;
      
      console.log('User updated:', id);
      
      // Re-check Shopify linking on email change
      if (primaryEmail) {
        await linkShopifyAccount(id, primaryEmail);
      }
      break;
    }

    case 'user.deleted': {
      const { id } = data;
      console.log('User deleted:', id);
      
      // Clean up user data from D1
      // (Would need D1 binding in this route)
      break;
    }

    case 'session.created': {
      const { user_id } = data;
      console.log('Session created for user:', user_id);
      break;
    }

    case 'session.ended': {
      const { user_id } = data;
      console.log('Session ended for user:', user_id);
      break;
    }
  }

  return new Response('OK', { status: 200 });
}

async function linkShopifyAccount(clerkUserId: string, email: string) {
  // This would need Shopify API integration
  // For now, just log the attempt
  console.log('Attempting to link Shopify account for:', email);
  
  // TODO: Implement Shopify customer lookup
  // const shopifyCustomer = await shopify.customers.list({ query: `email:${email}` });
  // if (shopifyCustomer.length > 0) {
  //   await clerkClient.users.updateUserMetadata(clerkUserId, {
  //     publicMetadata: {
  //       shopify_customer_id: shopifyCustomer[0].id,
  //       linked_at: new Date().toISOString(),
  //       link_source: 'auto',
  //     },
  //   });
  // }
}
