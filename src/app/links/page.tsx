import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import LinksPageClient from './LinksPageClient';
import { generateSeoMetadata } from '@/lib/seo';
import { getActiveLinks } from '@/lib/linktree';
import { getFeaturedProduct } from '@/lib/featuredProduct';
import { isStorePublished } from '@/lib/storeSettings';
import { COUNTRY_COOKIE } from '@/lib/store/money';

/**
 * /links: where the bio link lands. Someone saw the Odubo logo on TikTok,
 * Instagram or YouTube and tapped through; this is the first thing they see.
 *
 * Rendered on the server, links and featured product together, so the first
 * paint in an in-app browser is the page itself and not a spinner. Dynamic:
 * the price is in the visitor's currency (the country cookie).
 */
export const dynamic = 'force-dynamic';

async function getCountry(): Promise<string | undefined> {
  try {
    return (await cookies()).get(COUNTRY_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

async function load() {
  const [links, published] = await Promise.all([getActiveLinks().catch(() => []), isStorePublished()]);
  // While the store is closed, the landing sells nothing: no product, no store link.
  const featured = published ? await getFeaturedProduct(await getCountry()).catch(() => null) : null;
  return { links, published, featured };
}

export async function generateMetadata(): Promise<Metadata> {
  const featured = (await isStorePublished()) ? await getFeaturedProduct(await getCountry()).catch(() => null) : null;
  return generateSeoMetadata({
    title: 'Links',
    description: 'Odubo Studio: the clothes, the music, the clips.',
    path: '/links',
    ogImage: featured?.image ?? undefined,
  });
}

export default async function LinksPage() {
  const { links, published, featured } = await load();
  return <LinksPageClient links={links} storeOpen={published} featured={featured} />;
}
