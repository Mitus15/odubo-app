import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, uploadFileOrganized } from '@/worker/upload';
import { FileOrganizationOptions, validateFileType, FileType } from '@/lib/fileOrganization';
import ffmpegPath from 'ffmpeg-static';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    // Organization options for the new system
    const fileType = formData.get('fileType') as FileType; // 'track', 'album-cover', 'video', etc.
    const albumId = formData.get('albumId') as string; // album ID for tracks/covers
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

    // Use new organized system if fileType is provided
    if (fileType && (albumId || videoId)) {
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

      // If uploading a track, transcode to a web-safe AAC variant immediately
      if (fileType === 'track') {
        if (!ffmpegPath) {
          console.warn('ffmpeg-static not available; uploading original track file');
          uploadResult = await uploadFileOrganized(
            uint8Array,
            file.name,
            file.type,
            organizationOptions
          );
        } else {
          // Write input to temp file
          const inPath = path.join(os.tmpdir(), `upload_in_${Date.now()}_${file.name}`);
          const baseName = path.parse(file.name).name.replace(/\.web$/i, '');
          const outPath = path.join(os.tmpdir(), `upload_out_${Date.now()}_${baseName}.web.m4a`);
          await fs.writeFile(inPath, Buffer.from(uint8Array));

          await new Promise<void>((resolve, reject) => {
            const args = [
              '-y',
              '-i', inPath,
              '-vn',
              '-acodec', 'aac',
              '-profile:a', 'aac_low',
              '-b:a', '256k',
              '-ar', '44100',
              '-ac', '2',
              '-movflags', '+faststart',
              outPath,
            ];
            const p = spawn(ffmpegPath as string, args, { stdio: 'inherit' });
            p.on('error', reject);
            p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
          });

          const webData = await fs.readFile(outPath);

          // Upload the web variant only
          uploadResult = await uploadFileOrganized(
            new Uint8Array(webData.buffer, webData.byteOffset, webData.byteLength),
            `${baseName}.web.m4a`,
            'audio/mp4',
            organizationOptions
          );

          // Cleanup temp files
          fs.unlink(inPath).catch(() => {});
          fs.unlink(outPath).catch(() => {});
        }
      } else {
        uploadResult = await uploadFileOrganized(
          uint8Array,
          file.name,
          file.type,
          organizationOptions
        );
      }
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
