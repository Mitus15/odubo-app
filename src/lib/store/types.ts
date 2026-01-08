/**
 * Unified Store Types
 * Single source of truth for all e-commerce data structures
 */

// ============================================
// Product Types
// ============================================

export interface ProductImage {
  url: string;
  altText?: string;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  available: boolean;
  quantityAvailable: number;
  selectedOptions: Record<string, string>;
  image: ProductImage | null;
}

/** Minimal product data for grid/browse view */
export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  image: ProductImage | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  available: boolean;
  collection?: string;
}

/** Full product data for detail view */
export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  available: boolean;
  createdAt: string;
}

// ============================================
// Cart Types
// ============================================

export interface CartItem {
  variantId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  price: number;
  currency: string;
  quantity: number;
  image: ProductImage | null;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
}

// ============================================
// Filter & Sort Types
// ============================================

export type SortOption = 
  | 'newest'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'title-asc'
  | 'title-desc';

export interface ProductFilters {
  collection?: string;
  priceMin?: number;
  priceMax?: number;
  available?: boolean;
  search?: string;
}

// ============================================
// Store UI State
// ============================================

export type StoreView = 'closed' | 'browse' | 'detail';

export interface StoreState {
  view: StoreView;
  selectedProductIndex: number | null;
  filters: ProductFilters;
  sort: SortOption;
}

// ============================================
// API Response Types
// ============================================

export interface ProductsResponse {
  products: ProductSummary[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

export interface ProductResponse {
  product: Product | null;
  error?: string;
}

// ============================================
// Shopify GraphQL Response Mapping
// ============================================

export interface ShopifyEdge<T> {
  node: T;
  cursor?: string;
}

export interface ShopifyConnection<T> {
  edges: ShopifyEdge<T>[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}
