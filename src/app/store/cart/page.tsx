import { requireStoreAccess } from '@/lib/storeAccess';
import CartPageClient from './CartPageClient';

export default async function CartPage() {
  // Check store access - redirects non-admins when unpublished
  await requireStoreAccess();

  return <CartPageClient />;
}
