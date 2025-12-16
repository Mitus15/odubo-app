-- Add mode field to featured_pages to support different content types
-- Modes: 'event', 'product', 'music', 'video', 'app_update'

ALTER TABLE featured_pages ADD COLUMN mode TEXT DEFAULT 'event';

-- Add product-specific fields
ALTER TABLE featured_pages ADD COLUMN product_handle TEXT; -- Shopify product handle
ALTER TABLE featured_pages ADD COLUMN product_price TEXT; -- e.g., "$39.99"
ALTER TABLE featured_pages ADD COLUMN product_cta_text TEXT; -- e.g., "Shop Now", "Pre-order"
