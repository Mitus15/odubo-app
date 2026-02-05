import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { generateFilePath, getMimeType, FileOrganizationOptions } from '@/lib/fileOrganization';

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Upload file with explicit key path (for organized music/galleries)
 */
export async function uploadWithKey(
  fileData: Uint8Array,
  fileName: string,
  contentType: string,
  key: string
): Promise<UploadResult> {
  try {
    const finalContentType = getMimeType(fileName) || contentType;
    
    console.log(`Uploading ${fileName} to ${key} with content type: ${finalContentType}`);
    
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: fileData,
      ContentType: finalContentType,
    });

    await s3Client.send(command);
    
    const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    
    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function uploadFileOrganized(
  fileData: Uint8Array,
  fileName: string,
  contentType: string,
  organizationOptions: FileOrganizationOptions
): Promise<UploadResult> {
  try {
    const key = generateFilePath(organizationOptions);
    
    // Use the proper MIME type from our mapping
    const finalContentType = getMimeType(fileName) || contentType;
    
    console.log(`Uploading ${fileName} to ${key} with content type: ${finalContentType}`);
    
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: fileData,
      ContentType: finalContentType,
    });

    await s3Client.send(command);
    
    const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    
    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// Legacy function for backward compatibility
export async function uploadFile(
  fileData: Uint8Array,
  fileName: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  try {
    const key = `${folder}/${Date.now()}_${fileName}`;
    
    // Ensure proper MIME type for audio files
    let finalContentType = contentType;
    const extension = fileName.toLowerCase().split('.').pop();
    
    // Map audio file extensions to proper MIME types
    const audioMimeTypes: { [key: string]: string } = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm'
    };
    
    if (extension && audioMimeTypes[extension]) {
      finalContentType = audioMimeTypes[extension];
      console.log(`Mapped ${extension} to ${finalContentType} (original: ${contentType})`);
    } else {
      console.log(`Using original content type: ${contentType} for file: ${fileName}`);
    }
    
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: fileData,
      ContentType: finalContentType,
    });

    await s3Client.send(command);
    
    const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    
    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}