// Fix the featured_pages table to ensure only app_update is published
import { config } from 'dotenv';
config({ path: '.env.local' });

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

async function query(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  );
  return response.json();
}

console.log('Current state:');
const current = await query('SELECT mode, is_published, title FROM featured_pages ORDER BY mode');
console.log(current.result?.[0]?.results || []);

console.log('\nUnpublishing all modes except app_update...');
await query("UPDATE featured_pages SET is_published = 0 WHERE mode != 'app_update'");

console.log('\nNew state:');
const after = await query('SELECT mode, is_published, title FROM featured_pages ORDER BY mode');
console.log(after.result?.[0]?.results || []);
