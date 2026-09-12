import { redirect } from 'next/navigation';
import { requireStoreAccess } from '@/lib/storeAccess';
import { STORE_ACCOUNT_URL } from "@/lib/storeAccount";

/**
 * Account Page
 * Redirects to Shopify's hosted account portal.
 * Only accessible when store is enabled (tied to commerce).
 */
export default async function AccountPage() {
  // Check store access - redirects non-admins when store unpublished
  await requireStoreAccess();

  // If store is accessible, redirect to Shopify account portal
  redirect(STORE_ACCOUNT_URL);
}
