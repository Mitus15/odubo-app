import 'dotenv/config';
import { queryDatabase, executeQuery } from '../src/lib/db';

async function fixSpecificVideo() {
  const videoId = 407;
  
  console.log(`Fixing video ${videoId}...`);
  
  const videos = await queryDatabase(
    `SELECT id, uid, title, poster_url FROM videos WHERE id = ?`,
    [videoId]
  );
  
  if (videos.length === 0) {
    console.log('Video not found');
    return;
  }
  
  const video = videos[0];
  const oldUid = video.uid as string;
  const oldPosterUrl = video.poster_url as string;
  
  // Extract UID from poster_url if uid field is empty
  const uidMatch = oldPosterUrl.match(/videodelivery\.net\/([a-f0-9]{32})/);
  const cleanUid = uidMatch ? uidMatch[1] : oldUid.split('?')[0];
  const newPosterUrl = `https://videodelivery.net/${cleanUid}/thumbnails/thumbnail.jpg`;
  
  console.log(`\nVideo: ${video.title}`);
  console.log(`  Old UID: ${oldUid}`);
  console.log(`  Clean UID: ${cleanUid}`);
  console.log(`  Old poster_url: ${oldPosterUrl}`);
  console.log(`  New poster_url: ${newPosterUrl}`);
  
  await executeQuery(
    `UPDATE videos SET uid = ?, poster_url = ? WHERE id = ?`,
    [cleanUid, newPosterUrl, videoId]
  );
  
  console.log('\n✅ Video fixed!');
}

fixSpecificVideo().catch(console.error);
