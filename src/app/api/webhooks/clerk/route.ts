import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { upsertClerkUser } from '@/lib/clerkSync';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    console.error('[Clerk Webhook] Missing CLERK_WEBHOOK_SECRET');
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
    console.error('[Clerk Webhook] Verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  const { type, data } = evt;

  console.log('[Clerk Webhook] Event:', type, 'for user:', data?.id || data?.user_id);

  switch (type) {
    case 'user.created':
    case 'user.updated': {
      try {
        const { id, email_addresses, first_name, last_name, image_url } = data;
        const result = await upsertClerkUser({
          id,
          emailAddresses: email_addresses || [],
          firstName: first_name,
          lastName: last_name,
          imageUrl: image_url,
        });
        console.log('[Clerk Webhook] User synced:', id, 'isNew:', result.isNew, 'user id:', result.user?.id);
      } catch (err) {
        console.error('[Clerk Webhook] Failed to sync user:', err);
      }
      break;
    }

    case 'session.created': {
      console.log('[Clerk Webhook] Session started for:', data?.user_id);
      break;
    }

    case 'session.ended': {
      console.log('[Clerk Webhook] Session ended for:', data?.user_id);
      break;
    }

    case 'user.deleted': {
      console.log('[Clerk Webhook] User deleted:', data?.id);
      break;
    }
  }

  return new Response('OK', { status: 200 });
}
