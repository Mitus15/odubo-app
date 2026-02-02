import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkRecentVideos() {
  console.log('Checking recent videos...\n');
  
  const result = await client.execute(
    'SELECT id, title, type, parent_video_id, uid, created_at FROM videos ORDER BY created_at DESC LIMIT 5'
  );
  
  console.log('Most recent videos:');
  result.rows.forEach((row, i) => {
    console.log(`\n${i + 1}. Video ID: ${row.id}`);
    console.log(`   Title: ${row.title}`);
    console.log(`   Type: ${row.type || 'NULL'}`);
    console.log(`   Parent ID: ${row.parent_video_id || 'NULL'}`);
    console.log(`   UID: ${row.uid}`);
    console.log(`   Created: ${row.created_at}`);
  });
}

checkRecentVideos().catch(console.error);
