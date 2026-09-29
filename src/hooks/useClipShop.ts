'use client';

import { useCallback } from 'react';
import { useQuickShop } from '@/contexts/QuickShopContext';
import { postShopClick } from '@/lib/clipShop';
import type { ClipItem } from '@/types/clips';

/**
 * The shop tap on a clip: open QuickShop on the clip's product, then record a
 * `shop_click` for the clip. The sheet opens first and the event is fire and
 * forget, so nothing about analytics can slow or block the tap.
 *
 * A clip with no product has nothing to open (film clips never carry one), and
 * callers hide the shop affordance for it entirely. QuickShopProvider and the
 * modal are mounted once in the root layout, so every page's clips reach them.
 */
export function useClipShop(): (clip: Pick<ClipItem, 'id' | 'productHandle'>) => void {
  const { openQuickShop } = useQuickShop();

  return useCallback(
    (clip: Pick<ClipItem, 'id' | 'productHandle'>) => {
      const handle = clip.productHandle?.trim();
      if (!handle) return;
      openQuickShop(handle);
      postShopClick(clip.id, handle);
    },
    [openQuickShop],
  );
}
