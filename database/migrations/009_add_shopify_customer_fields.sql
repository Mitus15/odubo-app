-- Add Shopify customer fields to users table if they don't exist
-- Migration: 009_add_shopify_customer_fields.sql

-- Add shopify_customer_id column if it doesn't exist
ALTER TABLE users ADD COLUMN shopify_customer_id TEXT;

-- Add shopify_customer_token column if it doesn't exist  
ALTER TABLE users ADD COLUMN shopify_customer_token TEXT;

-- Add index for efficient Shopify customer lookups
CREATE INDEX IF NOT EXISTS idx_users_shopify_customer_id ON users(shopify_customer_id);

-- Add unique constraint to prevent duplicate Shopify customers
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shopify_customer_unique ON users(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;