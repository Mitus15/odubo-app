#!/usr/bin/env node
import { generateThumbnailForVideo } from '../src/worker/generate_video_thumbnail.js';

const [,, r2Key, galleryId, uid] = process.argv;
if (!r2Key || !galleryId || !uid) {
  console.error('Usage: node generate_thumbnail_cli.js <r2Key> <galleryId> <uid>');
  process.exit(1);
}

(async () => {
  const res = await generateThumbnailForVideo(r2Key, galleryId, uid);
  console.log(res);
})();
