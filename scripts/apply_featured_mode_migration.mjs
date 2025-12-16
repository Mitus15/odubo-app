#!/usr/bin/env node
/**
 * Manually apply migration 037 to add mode and product fields to featured_pages
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !DATABASE_ID) {
  console.error('❌ Missing required environment variables');
  console.error('   CLOUDFLARE_API_TOKEN:', CLOUDFLARE_API_TOKEN ? '✓' : '✗');
  console.error('   CLOUDFLARE_ACCOUNT_ID:', CLOUDFLARE_ACCOUNT_ID ? '✓' : '✗');
  console.error('   DATABASE_ID:', DATABASE_ID ? '✓' : '✗');
  process.exit(1);
}

const statements = [
  "ALTER TABLE featured_pages ADD COLUMN mode TEXT DEFAULT 'event'",
  "ALTER TABLE featured_pages ADD COLUMN product_handle TEXT",
  "ALTER TABLE featured_pages ADD COLUMN product_price TEXT",
  "ALTER TABLE featured_pages ADD COLUMN product_cta_text TEXT",
  // Migration 038: Restructure by mode
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_pages_mode_unique ON featured_pages(mode)",
  "DROP INDEX IF EXISTS idx_featured_pages_slug",
  "UPDATE featured_pages SET mode = 'event' WHERE mode IS NULL OR mode = ''",
  "CREATE INDEX IF NOT EXISTS idx_featured_pages_mode_published ON featured_pages(mode, is_published)"
];

async function applyMigration() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  
  console.log('🔧 Applying migration 037: Add mode and product fields to featured_pages');
  
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    console.log(`\n📝 Statement ${i + 1}/${statements.length}:`, sql);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql,
          params: []
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Check if error is "duplicate column" - that's OK, means already applied
        const errorMsg = JSON.stringify(data.errors || data);
        if (errorMsg.includes('duplicate column')) {
          console.log('   ⚠️  Column already exists (skipping)');
          continue;
        }
        throw new Error(`Failed: ${errorMsg}`);
      }
      
      console.log('   ✅ Success');
    } catch (err) {
      console.error('   ❌ Error:', err.message);
      throw err;
    }
  }
  
  console.log('\n✅ Migration 037 applied successfully!');
}

applyMigration().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
