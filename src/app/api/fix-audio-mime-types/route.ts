import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { S3Client, CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Initialize R2 client
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

export async function GET() {
  return handleRequest();
}

export async function POST(request: NextRequest) {
  return handleRequest();
}

async function handleRequest() {
  try {
    console.log('Starting MIME type fix process...');
    
    // Get all tracks from database
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
    const albumsResponse = await fetch(`${baseUrl}/api/albums`);
    if (!albumsResponse.ok) {
      throw new Error('Failed to fetch albums');
    }
    
    const albumsData = await albumsResponse.json() as any;
    const albums = albumsData.albums || [];
    
    console.log(`Found ${albums.length} albums`);
    
    const allTracks: any[] = [];
    
    // Get tracks for each album
    for (const album of albums) {
      const tracksResponse = await fetch(`${baseUrl}/api/tracks?album_id=${album.id}`);
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json() as any;
        const tracks = tracksData.result?.[0]?.results || [];
        allTracks.push(...tracks);
      }
    }
    
    console.log(`Found ${allTracks.length} total tracks`);
    
    const updates = [];
    
    for (const track of allTracks) {
      if (!track.audio_url) continue;
      
      try {
        // Extract the R2 object key from the URL
        const url = new URL(track.audio_url);
        const key = decodeURIComponent(url.pathname.substring(1)); // Remove leading slash and decode URL encoding
        
        console.log(`Checking track: ${track.title} (${key})`);
        
        // Get current object metadata
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        
        const headResponse = await r2.send(headCommand);
        const currentContentType = headResponse.ContentType;
        
        console.log(`Current content type: ${currentContentType}`);
        
        // Determine the correct content type based on file extension
        const extension = key.split('.').pop()?.toLowerCase();
        let correctContentType = currentContentType;
        
        if (extension === 'm4a' && currentContentType === 'audio/x-m4a') {
          correctContentType = 'audio/mp4';
        } else if (extension === 'mp3' && currentContentType !== 'audio/mpeg') {
          correctContentType = 'audio/mpeg';
        } else if (extension === 'wav' && currentContentType !== 'audio/wav') {
          correctContentType = 'audio/wav';
        }
        
        // If content type needs updating
        if (currentContentType !== correctContentType) {
          console.log(`Updating content type from ${currentContentType} to ${correctContentType}`);
          
          const copyCommand = new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURIComponent(`${bucketName}/${key}`),
            Key: key,
            ContentType: correctContentType,
            MetadataDirective: 'REPLACE',
          });
          
          await r2.send(copyCommand);
          
          updates.push({
            track: track.title,
            key,
            from: currentContentType,
            to: correctContentType,
          });
          
          console.log(`✅ Updated ${track.title}`);
        } else {
          console.log(`✅ ${track.title} already has correct content type`);
        }
      } catch (error) {
        console.error(`Error processing track ${track.title}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `MIME type fix completed. Updated ${updates.length} files.`,
      updates,
    });
    
  } catch (error) {
    console.error('Error in MIME type fix:', error);
    return NextResponse.json(
      { error: 'Failed to fix MIME types', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
