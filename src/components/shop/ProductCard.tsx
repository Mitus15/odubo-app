'use client';

import { useState, useCallback, memo } from 'react';
import { formatMoney, getCountryFromCookie } from '@/lib/store/money';
import { useOmniShop, type ProductCard as ProductCardType } from '@/contexts/OmniShopContext';
import ProductVariantDrawer from './ProductVariantDrawer';
import { useImageLuminosity } from '@/hooks/useImageLuminosity';

interface ProductCardProps {
  product: ProductCardType;
  isActive: boolean;
  index: number;
}

/**
 * Full-screen swipeable product card (clips-style)
 * Features:
 * - Full-screen product image with glass overlay
 * - Tap to open variant selection drawer
 * - Swipe up/down navigation handled by parent
 * - Glass aesthetic with gradient overlays
 */
function ProductCardComponent({ product, isActive, index }: ProductCardProps) {
  const { addToCart } = useOmniShop();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Detect if background is dark or light for optimal text contrast
  const isDarkBackground = useImageLuminosity(product.image, imageLoaded, 'bottom');

  const handleOpenVariants = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDrawerOpen(true);
  }, []);

  const handleQuickAddToBag = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!product.available) return;
    
    try {
      // Fetch product details to get real variant IDs
      const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
      const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

      if (!PUBLIC_TOKEN) throw new Error('Store configuration error');

      const query = `#graphql
        query Product($handle: String!, $country: CountryCode!) @inContext(country: $country) {
          product(handle: $handle) {
            variants(first: 1) { edges { node {
              id title availableForSale
              price { amount currencyCode }
              image { url }
            }}}
          }
        }`;

      const res = await fetch(`${STORE_URL}/api/2024-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
        },
        body: JSON.stringify({ query, variables: { handle: product.handle, country: getCountryFromCookie() } }),
      });

      if (!res.ok) throw new Error('Failed to load product');
      const data: any = await res.json();
      const firstVariant = data?.data?.product?.variants?.edges?.[0]?.node;
      
      if (!firstVariant) throw new Error('No variants found');
      
      // Add the first available variant to cart
      addToCart({
        variantId: firstVariant.id,
        title: product.title,
        variantTitle: firstVariant.title,
        price: parseFloat(firstVariant.price.amount),
        currency: firstVariant.price.currencyCode,
        image: firstVariant.image?.url || product.image || undefined,
      });
    } catch (error) {
      console.error('Quick add failed:', error);
      // Fallback: open variant drawer instead
      setIsDrawerOpen(true);
    }
  }, [addToCart, product, setIsDrawerOpen]);

  // Format price
  const formattedPrice = product.price !== null
    ? formatMoney(product.price, (product as any).currency)
    : 'Price unavailable';

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ 
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Product Image - Full screen background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1817] via-[#252220] to-[#1a1817]">
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={() => setImageLoaded(true)}
            draggable={false}
            loading={index < 3 ? 'eager' : 'lazy'}
          />
        )}

        {/* Loading shimmer */}
        {!imageLoaded && product.image && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#302927]/50 to-[#1a1817]/50 animate-pulse" />
        )}

        {/* No image placeholder */}
        {!product.image && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[#b2a491]/20 text-center">
              <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={0.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-xs uppercase tracking-[0.2em]">No Image</span>
            </div>
          </div>
        )}
      </div>

      {/* Top gradient for header space */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none" />

      {/* Bottom gradient for text readability - adaptive */}
      <div
        className={`absolute inset-x-0 bottom-0 h-72 pointer-events-none transition-opacity duration-300 ${
          isDarkBackground
            ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent'
            : 'bg-gradient-to-t from-white/90 via-white/50 to-transparent'
        }`}
      />

      {/* Product Info - Bottom overlay */}
      <div
        className="absolute inset-x-0 bottom-0 p-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
      >
        {/* Product title - dynamic color based on background */}
        <h2
          className={`text-xl font-medium leading-tight mb-2 line-clamp-2 transition-colors duration-300 ${
            isDarkBackground
              ? 'text-[#ede8df]'
              : 'text-[#1a1817]'
          }`}
          style={{
            textShadow: isDarkBackground
              ? '0 2px 8px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)'
              : '0 2px 8px rgba(255, 255, 255, 0.8), 0 4px 16px rgba(255, 255, 255, 0.6)'
          }}
        >
          {product.title}
        </h2>

        {/* Price - dynamic color based on background */}
        <p
          className={`text-lg font-medium mb-4 transition-colors duration-300 ${
            isDarkBackground
              ? 'text-[#b2a491]'
              : 'text-[#302927]'
          }`}
          style={{
            textShadow: isDarkBackground
              ? '0 2px 4px rgba(0, 0, 0, 0.3)'
              : '0 2px 4px rgba(255, 255, 255, 0.6)'
          }}
        >
          {formattedPrice}
        </p>

        {/* Action button */}
        <button
          type="button"
          onClick={handleOpenVariants}
          className="w-full py-3.5 px-5 bg-[#ede8df] text-[#302927] rounded-xl text-sm font-medium uppercase tracking-[0.1em] active:scale-[0.98] transition-transform"
          style={{ touchAction: 'manipulation' }}
        >
          Select Options
        </button>
      </div>

      {/* Add to bag button - top right */}
      <div className="absolute top-4 right-4" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
        <button
          type="button"
          onClick={handleQuickAddToBag}
          disabled={!product.available}
          className={`w-12 h-12 flex items-center justify-center glass-surface-light border border-white/10 rounded-xl transition-all ${
            product.available 
              ? 'text-[#ede8df]/80 hover:text-[#ede8df] active:scale-95' 
              : 'text-[#ede8df]/30 cursor-not-allowed'
          }`}
          style={{ touchAction: 'manipulation' }}
          aria-label="Add to bag"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </button>
      </div>

      {/* Variant Selection Drawer */}
      <ProductVariantDrawer
        productHandle={product.handle}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

export const ProductCard = memo(ProductCardComponent);
export default ProductCard;
