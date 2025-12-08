
-- Add shopify product columns to videos table
ALTER TABLE videos ADD COLUMN shopify_product_id TEXT;
ALTER TABLE videos ADD COLUMN shopify_product_handle TEXT;
