import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import GearRoom from '@/components/room/GearRoom';
import { generateSeoMetadata } from '@/lib/seo';
import { GEAR_TAG, getFeaturedHandle } from '@/lib/featuredProduct';
import { fetchProducts } from '@/lib/store/api';
import { COUNTRY_COOKIE } from '@/lib/store/money';
import { requireStoreAccess } from '@/lib/storeAccess';
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
 * page, in the same room (store/product/[handle]), and that page's hanger
 * comes back here on that piece (?piece=). The piece picked in
 * /admin/linktree stands first. While the store is closed there is no gear.
 */
/** How long the gear is kept on the server before it is read again: a new piece, a sold-out size, a new pick shows within this */
const GEAR_KEPT_S = 60;

/**
 * Everything the room shows, read together and kept a minute (Next's data
 * cache, shared by every server), so a visitor never waits on Shopify and the
 * database in a row: the pieces, the one picked to stand first, and each
 * piece's look (kept 30 days on its own). A read that fails is not kept.
 */
const gearKept = unstable_cache(
  async (country: string | undefined) => {
    const [products, featured] = await Promise.all([fetchProducts({ first: 40, country }).then((r) => r.products), getFeaturedHandle()]);
    const shown = products.filter((p) => p.image).sort((a, b) => Number(b.handle === featured) - Number(a.handle === featured));
    return Promise.all(shown.map(async (p) => ({ ...p, ...(await pieceLook(p.image!.url)) })));
  },
  ['gear-v1'],
  { revalidate: GEAR_KEPT_S, tags: [GEAR_TAG] },
);

export default async function GearPage({ searchParams }: { searchParams: Promise<{ piece?: string }> }) {
  // Closed: the visitor goes home and an admin still sees it, as the store's own pages do
  await requireStoreAccess();
  const country = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const pieces = await gearKept(country).catch(() => [] as Awaited<ReturnType<typeof gearKept>>);
  // Back from a piece's page: the row opens on that piece
  const piece = (await searchParams).piece;
  const start = Math.max(0, pieces.findIndex((p) => p.handle === piece));
  return <GearRoom pieces={pieces} start={start} />;
}
