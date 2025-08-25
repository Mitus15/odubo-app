import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { queryDatabase } from '@/lib/db';

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    console.log('Starting R2 cleanup process...');

    // Get all files from R2 bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    });

    const r2Response = await s3Client.send(listCommand);
    const r2Files = r2Response.Contents || [];
    
    console.log(`Found ${r2Files.length} files in R2 bucket`);

    // Get all video URLs from database
    let videoUrls: string[] = [];
    try {
      // Try with newer schema first
      const videos = await queryDatabase(
        'SELECT url, poster_url FROM videos'
      );
      videoUrls = videos.flatMap(video => [
        video.url,
        video.poster_url
      ]).filter(Boolean);
    } catch (error) {
      console.log('Trying fallback query for video URLs...');
      // Fallback to different column names
      const videos = await queryDatabase(
        'SELECT url, thumbnail_url, poster_url FROM videos'
      );
      videoUrls = videos.flatMap(video => [
        video.url,
        video.thumbnail_url,
        video.poster_url
      ]).filter(Boolean);
    }

    console.log(`Found ${videoUrls.length} video URLs in database`);

    // Extract keys from database URLs
    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      
      if (!url.startsWith('http')) {
        return url;
      }
      
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    };

    const dbFileKeys = new Set(
      videoUrls
        .map(extractKeyFromUrl)
        .filter(Boolean) as string[]
    );

    console.log(`Extracted ${dbFileKeys.size} unique file keys from database`);

    // Find orphaned files (files in R2 but not in database)
    const orphanedFiles: string[] = [];
    
    for (const file of r2Files) {
      if (file.Key && !dbFileKeys.has(file.Key)) {
        orphanedFiles.push(file.Key);
      }
    }

    console.log(`Found ${orphanedFiles.length} orphaned files to delete`);

    // Delete orphaned files
    const deleteResults = {
      attempted: orphanedFiles.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const fileKey of orphanedFiles) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: fileKey,
        });

        await s3Client.send(deleteCommand);
        deleteResults.successful++;
        console.log(`Deleted orphaned file: ${fileKey}`);
      } catch (error) {
        deleteResults.failed++;
        const errorMsg = `Failed to delete ${fileKey}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        deleteResults.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'R2 cleanup completed',
      summary: {
        totalR2Files: r2Files.length,
        totalDbUrls: videoUrls.length,
        uniqueDbKeys: dbFileKeys.size,
        orphanedFiles: deleteResults.attempted,
        deletedFiles: deleteResults.successful,
        failedDeletions: deleteResults.failed,
        errors: deleteResults.errors
      },
      orphanedFiles: orphanedFiles
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what would be deleted without actually deleting
export async function GET(req: NextRequest) {
  try {
    console.log('Starting R2 cleanup preview...');

    // Get all files from R2 bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    });

    const r2Response = await s3Client.send(listCommand);
    const r2Files = r2Response.Contents || [];

    // Get all video URLs from database
    let videoUrls: string[] = [];
    try {
      const videos = await queryDatabase(
        'SELECT url, poster_url FROM videos'
      );
      videoUrls = videos.flatMap(video => [
        video.url,
        video.poster_url
      ]).filter(Boolean);
    } catch (error) {
      const videos = await queryDatabase(
        'SELECT url, thumbnail_url, poster_url FROM videos'
      );
      videoUrls = videos.flatMap(video => [
        video.url,
        video.thumbnail_url,
        video.poster_url
      ]).filter(Boolean);
    }

    // Extract keys from database URLs
    const extractKeyFromUrl = (url: string): string | null => {
      if (!url) return null;
      
      if (url.startsWith('https://media.odubo.studio/')) {
        return url.replace('https://media.odubo.studio/', '');
      }
      
      if (!url.startsWith('http')) {
        return url;
      }
      
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    };

    const dbFileKeys = new Set(
      videoUrls
        .map(extractKeyFromUrl)
        .filter(Boolean) as string[]
    );

    // Find orphaned files
    const orphanedFiles: string[] = [];
    const validFiles: string[] = [];
    
    for (const file of r2Files) {
      if (file.Key) {
        if (dbFileKeys.has(file.Key)) {
          validFiles.push(file.Key);
        } else {
          orphanedFiles.push(file.Key);
        }
      }
    }

    return NextResponse.json({
      preview: true,
      summary: {
        totalR2Files: r2Files.length,
        totalDbUrls: videoUrls.length,
        uniqueDbKeys: dbFileKeys.size,
        validFiles: validFiles.length,
        orphanedFiles: orphanedFiles.length
      },
      orphanedFiles: orphanedFiles,
      validFiles: validFiles,
      dbUrls: videoUrls
    });

  } catch (error) {
    console.error('Error during cleanup preview:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup preview failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
