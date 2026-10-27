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

/** The house the brands belong to. Shown wherever a brand is named. */
export const PARENT_BRAND = 'Odubo Studio';

/**
 * The label's names, in three parts (owner, 2026-10-26; the Odubo Brand Kit,
 * "B.A.A.D's names"): the name, B.A.A.D; what it makes, Creative Wear; who it
 * comes from, by Odubo ("a natural byproduct of Odubo Studio work"). Which
 * parts a surface uses depends on the moment:
 *
 *   the full lockup  B.A.A.D Creative Wear, "by Odubo" on its own line under
 *                    it: where a stranger meets the label (a product page)
 *   the byline       "B.A.A.D by Odubo", one line: where the house is
 *                    speaking ("Shop B.A.A.D by Odubo" on /links)
 *   the name         "B.A.A.D": inside its own world (tags, eyebrows)
 *
 * Never "Creative Wear" alone, and never all three on one line.
 *
 * Shopify's `vendor` field holds the name ALONE: shopping feeds want a bare
 * brand token, so "B.A.A.D" is what belongs there. These are the reading
 * versions of the same fact, so every surface states it the same way.
 */

/** The house as it signs a label: "by Odubo". */
export const LABEL_BYLINE = 'Odubo';

/** The label the clothes are made under, as Shopify's vendor holds it. */
export const STORE_LABEL = 'B.A.A.D';

/** What each label makes, after its name: B.A.A.D Creative Wear. */
const LABEL_DESCRIPTOR: Record<string, string> = { [STORE_LABEL]: 'Creative Wear' };

/**
 * The byline: "B.A.A.D by Odubo". A product whose vendor already IS the
 * house (the Loop Soul pass, which Odubo Studio sells directly) says the name
 * once rather than twice.
 */
export function brandLockup(vendor?: string | null): string {
  const v = (vendor || '').trim();
  if (!v || v === PARENT_BRAND) return PARENT_BRAND;
  return `${v} by ${LABEL_BYLINE}`;
}

/**
 * The full lockup, as two lines: the full name ("B.A.A.D Creative Wear") and
 * the signature under it ("by Odubo"). The house's own products have no
 * signature: Odubo Studio is already the house.
 */
export function labelLockup(vendor?: string | null): { name: string; signature?: string } {
  const v = (vendor || '').trim();
  if (!v || v === PARENT_BRAND) return { name: PARENT_BRAND };
  const descriptor = LABEL_DESCRIPTOR[v];
  return { name: descriptor ? `${v} ${descriptor}` : v, signature: `by ${LABEL_BYLINE}` };
}

/**
 * Who designs a label's pieces, for the credits (owner, 2026-10-26): the
 * house signs ("by Odubo"), the person is credited, where people look for
 * who made a piece (a product's details, inside a hang tag, About, the press
 * kit), never in the lockup.
 */
const LABEL_DESIGNER: Record<string, string> = { [STORE_LABEL]: 'Mani Odubo' };

/** "Designed by Mani Odubo", or null where the label names no designer (the house's own products). */
export function labelCredit(vendor?: string | null): string | null {
  const designer = LABEL_DESIGNER[(vendor || '').trim()];
  return designer ? `Designed by ${designer}` : null;
}

/** The label's full name: "B.A.A.D Creative Wear". */
export const STORE_FULL_NAME = labelLockup(STORE_LABEL).name;

/** The store as the house names it, one line: "B.A.A.D by Odubo". */
export const STORE_BYLINE = brandLockup(STORE_LABEL);
