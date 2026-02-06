-- Add Shopify customer fields to users table if they don't exist
-- Migration: 009_add_shopify_customer_fields.sql

-- Add shopify_customer_id column if it doesn't exist
ALTER TABLE users ADD shopify_customer_id NVARCHAR(MAX);

-- Add shopify_customer_token column if it doesn't exist  
ALTER TABLE users ADD shopify_customer_token NVARCHAR(MAX);

-- Add index for efficient Shopify customer lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_shopify_customer_id' AND object_id = OBJECT_ID('users'))
CREATE INDEX idx_users_shopify_customer_id ON users(shopify_customer_id);

-- Add unique constraint to prevent duplicate Shopify customers
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_shopify_customer_unique' AND object_id = OBJECT_ID('users'))
CREATE UNIQUE INDEX idx_users_shopify_customer_unique ON users(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;