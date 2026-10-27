import { Suspense } from 'react';
import { requireStoreAccess } from '@/lib/storeAccess';
import CartPageClient from './CartPageClient';

/**
 * The bag, in the room of the piece the visitor came from (?room=, the hex a
 * piece's page passes), so the store stays one place from the row to the
 * checkout; from anywhere else, the house's dark room.
 */
export default async function CartPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  // Check store access - redirects non-admins when unpublished
  await requireStoreAccess();
  const hex = (await searchParams).room;
  const room = hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;

  return (
    <Suspense>
      <CartPageClient room={room} />
    </Suspense>
  );
}
