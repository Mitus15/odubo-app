import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { uploadFile, uploadFileOrganized, uploadWithKey } from '@/worker/upload';
import { FileOrganizationOptions, validateFileType, FileType } from '@/lib/fileOrganization';
import { music, toSlug, sanitizeFilename } from '@/lib/storage/pathGenerators';

// Note: Node-specific modules (ffmpeg-static, os, path, fs, child_process)
// are not available in the Edge runtime. Transcoding is handled by a
// separate Node-compatible worker/service. This endpoint only uploads.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    // Organization options for the new system
    const fileType = formData.get('fileType') as FileType; // 'track', 'album-cover', 'video', etc.
    const albumId = formData.get('albumId') as string; // album ID for tracks/covers
    const albumTitle = formData.get('albumTitle') as string; // for slug generation
    const trackTitle = formData.get('trackTitle') as string; // for track slug
    const trackNumber = formData.get('trackNumber') as string; // for track numbering
    const videoId = formData.get('videoId') as string; // video ID for videos/posters
    const videoType = formData.get('videoType') as string; // for videos only
    
    // Legacy support
    const type = formData.get('type') as string || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Uploading file:', file.name, 'Type:', type, 'Size:', file.size);

    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let uploadResult;

    // Handle music files with proper path generation
    if (fileType === 'album-cover' && albumTitle) {
      const ext = file.name.split('.').pop() || 'jpg';
      const albumSlug = toSlug(albumTitle);
      const key = music.albumCover(albumSlug, ext);
      
      uploadResult = await uploadWithKey(uint8Array, file.name, file.type, key);
      
    } else if (fileType === 'track' && albumTitle && trackTitle && trackNumber) {
      const ext = file.name.split('.').pop() || 'mp3';
      const albumSlug = toSlug(albumTitle);
      const trackSlug = toSlug(trackTitle);
      const trackNum = parseInt(trackNumber, 10);
      const key = music.track(albumSlug, trackNum, trackSlug, ext);
      
      uploadResult = await uploadWithKey(uint8Array, file.name, file.type, key);
      
    } else if (fileType && (albumId || videoId)) {
      // Use new organized system (legacy code path)
      // Validate file type
      const isValidFile = validateFileType(file.name, fileType);
      if (!isValidFile) {
        return NextResponse.json(
          { success: false, error: `Invalid file type for ${fileType}. Check file extension.` },
          { status: 400 }
        );
      }

      const organizationOptions: FileOrganizationOptions = {
        fileType,
        fileName: file.name,
        ...(albumId && { albumId }),
        ...(videoId && { videoId }),
        ...(videoType && { videoType: videoType as 'music-video' | 'short-film' | 'feature' })
      };

      // Direct upload only. Transcoding is deferred to a Node worker.
      uploadResult = await uploadFileOrganized(
        uint8Array,
        file.name,
        file.type,
        organizationOptions
      );
    } else {
      // Fall back to legacy system
      uploadResult = await uploadFile(
        uint8Array,
        file.name,
        file.type,
        type
      );
    }

    if (uploadResult.success) {
      console.log('File uploaded successfully:', uploadResult.url);
      return NextResponse.json({
        success: true,
        url: uploadResult.url,
        key: uploadResult.key
      });
    } else {
      console.error('File upload failed:', uploadResult.error);
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
