// Test R2 upload directly
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

async function testR2Upload() {
  try {
    console.log('🎬 Testing direct R2 upload...');
    console.log('Using bucket:', process.env.CLOUDFLARE_R2_BUCKET_NAME);
    console.log('Using endpoint:', process.env.CLOUDFLARE_R2_ENDPOINT);

    const videoPath = './tmp/test-video.mp4';
    const posterPath = './tmp/test-poster.jpg';

    if (!fs.existsSync(videoPath) || !fs.existsSync(posterPath)) {
      console.error('❌ Test files not found');
      return;
    }

    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (!bucket) {
      console.error('❌ CLOUDFLARE_R2_BUCKET_NAME is not set!');
      return;
    }

    const videoFileName = `test_video_${Date.now()}.mp4`;
    const posterFileName = `test_poster_${Date.now()}.jpg`;

    // Upload video
    const videoBuffer = fs.readFileSync(videoPath);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: videoFileName,
      Body: videoBuffer,
      ContentType: "video/mp4",
    }));

    // Upload poster
    const posterBuffer = fs.readFileSync(posterPath);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: posterFileName,
      Body: posterBuffer,
      ContentType: "image/jpeg",
    }));

    const videoUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${videoFileName}`;
    const posterUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${posterFileName}`;

    console.log('✅ R2 upload successful!');
    console.log('📹 Video URL:', videoUrl);
    console.log('🖼️ Poster URL:', posterUrl);

  } catch (error) {
    console.error('❌ R2 upload failed:', error);
  }
}

testR2Upload();
