/**
 * Odubo and Loop Soul are two storefronts over ONE Shopify store, so something
 * has to say which products belong to which.
 *
 * Tags do it. The Storefront API's product search supports `tag` and `tag_not`
 * natively, which means the Odubo grid excludes the pass inside the same query
 * that fetches it — there is no post-filter to leak on page two of an infinite
 * scroll, and no second round trip. (`collection:` is NOT a supported field on
 * the Storefront `products` connection — only on the Admin API — so filtering
 * the grid by collection silently returns everything. Collections are read
 * through the dedicated `collection(handle:)` query instead.)
 *
 * The rule, per the owner: the Odubo store carries everything EXCEPT passes.
 * Loop Soul merch is deliberately in both — it lives in the `loop-soul`
 * collection for the Loop store, and still appears in the Odubo grid.
 */

/** Tag the pass product with this in Shopify. Keeps it out of the Odubo store. */
export const LOOP_PASS_TAG = 'loop-pass';

/** Shopify collection the Loop Soul store reads: the pass plus Loop merch. */
export const LOOP_COLLECTION_HANDLE = 'loop-soul';

/**
 * Tags no Odubo storefront surface should ever show. Passes are event
 * admission, not merchandise — they belong to the night, and they carry a
 * capacity the merch grid knows nothing about.
 */
export const ODUBO_EXCLUDED_TAGS = [LOOP_PASS_TAG];

/**
 * Shopify search clause that drops the excluded tags. Returns undefined when
 * there is nothing to exclude, so callers can spread it without emitting an
 * empty `AND`.
 */
export function excludeTagsClause(tags: readonly string[] = ODUBO_EXCLUDED_TAGS): string | undefined {
  if (tags.length === 0) return undefined;
  return tags.map((t) => `tag_not:${t}`).join(' AND ');
}
