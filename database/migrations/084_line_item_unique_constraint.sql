-- Enable UPSERT for line items by adding unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_order_items_upsert
ON commerce_order_items(order_id, shopify_line_item_id);
