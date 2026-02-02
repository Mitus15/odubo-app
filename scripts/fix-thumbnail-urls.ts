import 'dotenv/config';
import { queryDatabase, executeQuery } from '../src/lib/db';

async function fixThumbnails() {
  console.log('Fixing thumbnail URLs...');
  
  // Find videos with broken poster_url (empty UID)
  const videos = await queryDatabase(
    `SELECT id, uid, title, poster_url FROM videos WHERE poster_url LIKE '%videodelivery.net//%' OR poster_url LIKE '%?%'`
  );
  
  console.log(`Found ${videos.length} videos with broken poster_url`);
  
  for (const video of videos) {
    const id = video.id;
    const uid = video.uid as string;
    const oldUrl = video.poster_url as string;
    const newUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
    
    console.log(`\nFixing video ${id}: ${video.title}`);
    console.log(`  UID: ${uid}`);
    console.log(`  Old URL: ${oldUrl}`);
    console.log(`  New URL: ${newUrl}`);
    
    // Update poster_url
    await executeQuery(
      `UPDATE videos SET poster_url = ? WHERE id = ?`,
      [newUrl, id]
    );
  }
  
  console.log('\n✅ Thumbnail URLs fixed!');
}

fixThumbnails().catch(console.error);
