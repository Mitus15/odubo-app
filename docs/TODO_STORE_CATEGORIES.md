# Store Category Filter — Setup Required

## Status: Code Complete, Awaiting Shopify Configuration

The category filter feature is fully implemented in code. It will automatically activate once product types are set in Shopify.

---

## What's Been Built

**Files Modified:**
- `/src/app/store/page.tsx` — Passes `category` field to client
- `/src/app/store/StorePageClient.tsx` — Filter UI, state, and grouping logic

**Features:**
- Sticky horizontal filter pills below store header
- Category groupings (Jeans+Trousers→Pants, Hoodies+Sweatshirts→Hoodies)
- Dynamic discovery of categories from product data
- Empty state with "View all products" fallback
- Mobile-friendly horizontal scroll

---

## Action Required: Set Product Types in Shopify

### Steps:
1. Log into [Shopify Admin](https://odubostudio.myshopify.com/admin)
2. Go to **Products**
3. Click on each product
4. In the right sidebar, find **"Product type"** field
5. Enter one of the supported types (see below)
6. Click **Save**

### Recommended Product Types:

| Product | Set productType to |
|---------|-------------------|
| Light Denim Jeans | `Jeans` |
| Catching Light Long T-Shirt | `T-Shirt` |
| Catching Light Performance Long T-Shirt | `T-Shirt` |
| Saint Zip-Up Hooded Tank | `Vest` |
| Logo Performance Long T-Shirt | `T-Shirt` |
| Barrel Dress Pant | `Pants` |
| Logo Classic Hoodie | `Hoodie` |
| Logo Long T-Shirt | `T-Shirt` |
| Bold One-Piece T-Shirt | `T-Shirt` |

### Supported Product Types (case-insensitive):

**Pants group** (displays as "Pants"):
- `Jeans`, `Trousers`, `Pants`

**Hoodies group** (displays as "Hoodies"):
- `Hoodie`, `Hoodies`, `Sweatshirt`, `Sweatshirts`

**T-Shirts** (displays as "T-Shirts"):
- `T-Shirt`, `T-Shirts`, `Tee`, `Tees`

**Vests** (displays as "Vests"):
- `Vest`, `Vests`

**Other types:**
- Any unlisted type will appear as-is in the filter

---

## How It Works

1. Products are fetched from Shopify with their `productType`
2. Types are normalized (lowercase) and mapped to display categories
3. Filter pills are generated from categories that have products
4. Selecting a category filters the product grid

---

## Adding New Categories

To add new category groupings, edit `/src/app/store/StorePageClient.tsx`:

```typescript
const CATEGORY_GROUPS: Record<string, string> = {
  // Add new mappings here
  'jacket': 'Outerwear',
  'coat': 'Outerwear',
  // ...
};

const CATEGORY_ORDER = ['All', 'T-Shirts', 'Pants', 'Hoodies', 'Vests', 'Outerwear'];
```

---

## Verification

After setting product types in Shopify:
1. Run `npm run dev`
2. Navigate to `/store`
3. Filter pills should appear below the header
4. Clicking a category should filter the grid
5. "All" should show all products
