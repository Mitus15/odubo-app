import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GearRoom from '@/components/room/GearRoom';
import { generateSeoMetadata } from '@/lib/seo';
import { getFeaturedHandle } from '@/lib/featuredProduct';
import { fetchProducts } from '@/lib/store/api';
import { COUNTRY_COOKIE } from '@/lib/store/money';
import { isStorePublished } from '@/lib/storeSettings';
import type { ProductSummary } from '@/lib/store/types';
import { pieceLook } from '@/lib/store/pieceLook';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Gear',
  description: 'B.A.A.D Creative Wear, by Odubo.',
  path: '/gear',
});

/**
 * /gear: the clothes, each standing on the floor of a room of its own colour,
 * taken from the piece itself (lib/store/pieceLook): a new piece gets its
 * room the first time it is shown. Swipe along the row; a piece opens its
 * page in the store. The piece picked in /admin/linktree stands first. While
 * the store is closed there is no gear.
 */
export default async function GearPage() {
  if (!(await isStorePublished().catch(() => false))) notFound();
  const country = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const [products, featured] = await Promise.all([
    fetchProducts({ first: 40, country })
      .then((r) => r.products)
      .catch(() => [] as ProductSummary[]),
    getFeaturedHandle().catch(() => null),
  ]);
  const shown = products.filter((p) => p.image).sort((a, b) => Number(b.handle === featured) - Number(a.handle === featured));
  const pieces = await Promise.all(shown.map(async (p) => ({ ...p, ...(await pieceLook(p.image!.url)) })));
  return <GearRoom pieces={pieces} />;
}
