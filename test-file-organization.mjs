/**
 * Test file for the File Organization System
 * This can be run with Node.js to verify the system works correctly
 */

import { 
  generateFilePath, 
  validateFileType, 
  getMimeType, 
  sanitizeFileName,
  parseFilePath 
} from './src/lib/fileOrganization.js';

console.log('🧪 Testing File Organization System...\n');

// Test 1: Album track upload
console.log('📀 Test 1: Album Track Upload');
const trackPath = generateFilePath({
  fileType: 'track',
  albumId: 'album_12345',
  fileName: 'my-song.mp3'
});
console.log(`Generated path: ${trackPath}`);
console.log(`Valid MP3 for track: ${validateFileType('my-song.mp3', 'track')}`);
console.log(`MIME type: ${getMimeType('my-song.mp3')}\n`);

// Test 2: Album cover upload
console.log('🖼️  Test 2: Album Cover Upload');
const coverPath = generateFilePath({
  fileType: 'album-cover',
  albumId: 'album_12345',
  fileName: 'cover.jpg'
});
console.log(`Generated path: ${coverPath}`);
console.log(`Valid JPG for cover: ${validateFileType('cover.jpg', 'album-cover')}`);
console.log(`MIME type: ${getMimeType('cover.jpg')}\n`);

// Test 3: Video upload
console.log('🎬 Test 3: Video Upload');
const videoPath = generateFilePath({
  fileType: 'video',
  videoId: 'video_67890',
  videoType: 'music-video',
  fileName: 'music-video.mp4'
});
console.log(`Generated path: ${videoPath}`);
console.log(`Valid MP4 for video: ${validateFileType('music-video.mp4', 'video')}`);
console.log(`MIME type: ${getMimeType('music-video.mp4')}\n`);

// Test 4: File sanitization
console.log('🧹 Test 4: File Sanitization');
const unsafeFileName = 'My Song (feat. Artist) [2024].mp3';
const safeFileName = sanitizeFileName(unsafeFileName);
console.log(`Original: ${unsafeFileName}`);
console.log(`Sanitized: ${safeFileName}\n`);

// Test 5: File path parsing
console.log('📂 Test 5: File Path Parsing');
const albumTrackPath = '/music/albums/album_12345/tracks/track_1_my-song.mp3';
const parsedPath = parseFilePath(albumTrackPath);
console.log(`Path: ${albumTrackPath}`);
console.log(`Parsed:`, parsedPath);
console.log();

// Test 6: Error cases
console.log('❌ Test 6: Error Validation');
console.log(`Invalid audio for video: ${validateFileType('song.mp3', 'video')}`);
console.log(`Invalid video for track: ${validateFileType('video.mp4', 'track')}`);
console.log(`Unknown extension MIME: ${getMimeType('file.xyz') || 'null'}\n`);

console.log('✅ File Organization System tests completed!');
