-- 032_create_odubo_commerce.sql

-- Drop existing tables to ensure clean slate for the new engine
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;

-- Products table (The core item)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- active, draft, archived
  price REAL, -- Base price (can be overridden by variants)
  compare_at_price REAL,
  images TEXT, -- JSON array of image URLs
  options TEXT, -- JSON array of options e.g. [{"name": "Size", "values": ["S", "M"]}, {"name": "Color", "values": ["Black"]}]
  seo_title TEXT,
  seo_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Variants table (The specific SKU)
CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL, -- e.g. "S / Black"
  sku TEXT,
  price REAL NOT NULL,
  compare_at_price REAL,
  inventory_quantity INTEGER DEFAULT 0,
  inventory_policy TEXT DEFAULT 'deny', -- 'deny' (stop selling), 'continue' (allow backorder)
  option1 TEXT, -- Value for option 1
  option2 TEXT,
  option3 TEXT,
  image_url TEXT, -- Specific image for this variant
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number INTEGER, -- Sequential human-readable ID (e.g. 1001)
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  shipping_address TEXT, -- JSON
  billing_address TEXT, -- JSON
  total_amount REAL NOT NULL,
  subtotal_amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  shipping_amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'pending', -- pending, paid, fulfilled, cancelled, refunded
  payment_intent_id TEXT, -- Stripe PaymentIntent ID
  payment_status TEXT DEFAULT 'unpaid',
  fulfillment_status TEXT DEFAULT 'unfulfilled',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  title TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  total_price REAL NOT NULL,
  image_url TEXT,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- Customers (Simple profile for now, can link to users later)
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  total_spent REAL DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
