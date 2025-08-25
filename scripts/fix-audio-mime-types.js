import { S3Client, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export async function fixAudioMimeTypes() {
  try {
    // Get all tracks from the database
    const response = await fetch('http://localhost:3000/api/tracks');
    const data = await response.json();
    const tracks = data.result[0].results;

    console.log(`Found ${tracks.length} tracks to process`);

    for (const track of tracks) {
      if (track.audio_url && track.audio_url.includes('.m4a')) {
        // Extract the key from the URL (everything after the domain)
        const urlParts = track.audio_url.split('/');
        const key = urlParts.slice(3).join('/'); // Skip https:, '', domain
        
        console.log(`Fixing MIME type for: ${key}`);
        
        try {
          // Copy the object to itself with the correct content type
          const copyCommand = new CopyObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            CopySource: `${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${key}`,
            Key: key,
            ContentType: 'audio/mp4',
            MetadataDirective: 'REPLACE'
          });

          await s3Client.send(copyCommand);
          console.log(`✅ Fixed: ${key}`);
        } catch (error) {
          console.error(`❌ Failed to fix ${key}:`, error);
        }
      }
    }

    console.log('MIME type fix complete!');
  } catch (error) {
    console.error('Error fixing MIME types:', error);
  }
}

// Run the fix
fixAudioMimeTypes();
