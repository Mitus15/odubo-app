import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The store is the gear now (/gear, every piece in its own room). Every old
 * link to /store (a menu, a footer, an email, a bio) lands there with its
 * query, so a link's utm tags still say where the visitor came from. The
 * pieces' pages and the bag keep their addresses under /store.
 */
export default async function StorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  const rest = query.toString();
  redirect(`/gear${rest ? `?${rest}` : ''}`);
}
