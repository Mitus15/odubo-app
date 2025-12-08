
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { queryDatabase, executeQuery } from '../src/lib/db.js';
import CloudflareStreamAPI from '../src/lib/cloudflareStream.js';

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`\n🚨 Cleanup Clips (${execute ? 'EXECUTE' : 'DRY RUN'})`);

  // Find all clips
  // Assuming clips are identified by type='clip'
  const clips = await queryDatabase("SELECT id, uid, title, related_projects FROM videos WHERE type = 'clip'");
  console.log(`Found ${clips.length} clips in database`);

  const stream = new CloudflareStreamAPI();

  for (const clip of clips) {
    console.log(`\n• Clip ${clip.id} (${clip.title}) - UID: ${clip.uid}`);
    
    if (execute) {
      // Delete from Stream
      if (clip.uid) {
        try {
          await stream.deleteVideo(clip.uid);
          console.log(`  ✓ Deleted from Cloudflare Stream`);
        } catch (e: any) {
          console.error(`  ✗ Failed to delete from Stream: ${e.message}`);
        }
      }

      // Delete from DB
      try {
        await executeQuery("DELETE FROM videos WHERE id = ?", [clip.id]);
        console.log(`  ✓ Deleted from Database`);
      } catch (e: any) {
        console.error(`  ✗ Failed to delete from Database: ${e.message}`);
      }
    } else {
      console.log(`  [DRY RUN] Would delete from Stream and DB`);
    }
  }

  console.log(`\nDone.`);
}

main().catch(console.error);
