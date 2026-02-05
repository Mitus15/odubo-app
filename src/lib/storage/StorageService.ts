/**
 * Unified Storage Service
 * Single source of truth for all R2 and Cloudflare Stream operations
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generatePath, toSlug } from './pathGenerators';
import type { UploadOptions, UploadResult, R2Object, PresignedUrlOptions, StreamVideoMetadata, PathMetadata } from './types';

/**
 * Storage Service Configuration
 */
interface StorageConfig {
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  streamAccountId?: string;
  streamApiToken?: string;
}

/**
 * Get MIME type from filename extension
 */
export function getMimeType(filename: string | undefined): string {
  if (!filename) return 'application/octet-stream';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    
    // Audio
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    
    // Documents
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  
  return ext ? (mimeMap[ext] || 'application/octet-stream') : 'application/octet-stream';
}

/**
 * Unified Storage Service
 */
export class StorageService {
  private s3Client: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }

  /**
   * Upload file to R2 storage
   */
  async uploadToR2(options: UploadOptions): Promise<UploadResult> {
    try {
      // Generate path or use custom key
      const key = options.customKey || generatePath(options.contentType, options.metadata);
      
      // Get file buffer
      let fileBuffer: Buffer;
      if (options.file instanceof Buffer) {
        fileBuffer = options.file;
      } else if (options.file instanceof Uint8Array) {
        fileBuffer = Buffer.from(options.file);
      } else {
        // Assume File object (browser)
        const arrayBuffer = await (options.file as File).arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }

      // Determine content type
      const contentType = getMimeType(options.filename || options.metadata.filename);

      // Upload to R2
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.r2BucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      const url = `${this.config.r2PublicUrl}/${key}`;

      return {
        success: true,
        key,
        url,
        backend: 'r2',
      };
    } catch (error) {
      console.error('StorageService uploadToR2 error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.config.r2BucketName,
          Key: key,
        })
      );
      return { success: true };
    } catch (error) {
      console.error('StorageService deleteFromR2 error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  /**
   * Move/rename file in R2 (copy + delete)
   */
  async moveInR2(source: string, destination: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Copy to new location
      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.config.r2BucketName,
          CopySource: `/${this.config.r2BucketName}/${source}`,
          Key: destination,
        })
      );

      // Delete original
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.config.r2BucketName,
          Key: source,
        })
      );

      return { success: true };
    } catch (error) {
      console.error('StorageService moveInR2 error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Move failed',
      };
    }
  }

  /**
   * List objects in R2 with optional prefix
   */
  async listR2(prefix?: string, maxKeys: number = 1000): Promise<R2Object[]> {
    try {
      const objects: R2Object[] = [];
      let continuationToken: string | undefined;

      do {
        const response = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: this.config.r2BucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: maxKeys,
          })
        );

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              objects.push({
                key: obj.Key,
                size: obj.Size || 0,
                lastModified: obj.LastModified || new Date(),
                eTag: obj.ETag,
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken && objects.length < maxKeys);

      return objects;
    } catch (error) {
      console.error('StorageService listR2 error:', error);
      return [];
    }
  }

  /**
   * Get presigned URL for R2 object (GET or PUT)
   */
  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    try {
      const command =
        options.operation === 'put'
          ? new PutObjectCommand({
              Bucket: this.config.r2BucketName,
              Key: options.key,
              ContentType: options.contentType,
            })
          : new GetObjectCommand({
              Bucket: this.config.r2BucketName,
              Key: options.key,
            });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: options.expiresIn || 900, // Default 15 minutes
      });

      return url;
    } catch (error) {
      console.error('StorageService getPresignedUrl error:', error);
      throw error;
    }
  }

  /**
   * Get Cloudflare Stream upload URL
   */
  async getStreamUploadUrl(metadata?: StreamVideoMetadata): Promise<string> {
    if (!this.config.streamAccountId || !this.config.streamApiToken) {
      throw new Error('Cloudflare Stream credentials not configured');
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.streamAccountId}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.streamApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds: 21600, // 6 hours
            meta: metadata?.meta || {},
          }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Failed to get Stream upload URL');
      }

      return data.result.uploadURL;
    } catch (error) {
      console.error('StorageService getStreamUploadUrl error:', error);
      throw error;
    }
  }

  /**
   * Delete video from Cloudflare Stream
   */
  async deleteFromStream(uid: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.streamAccountId || !this.config.streamApiToken) {
      return {
        success: false,
        error: 'Cloudflare Stream credentials not configured',
      };
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.streamAccountId}/stream/${uid}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.config.streamApiToken}`,
          },
        }
      );

      const data = await response.json();
      return {
        success: data.success,
        error: data.errors?.[0]?.message,
      };
    } catch (error) {
      console.error('StorageService deleteFromStream error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  /**
   * Generate path for a given content type and metadata (convenience method)
   */
  getPath(contentType: string, metadata: PathMetadata): string {
    return generatePath(contentType, metadata);
  }

  /**
   * Get public URL for an R2 key
   */
  getPublicUrl(key: string): string {
    return `${this.config.r2PublicUrl}/${key}`;
  }
}

/**
 * Create StorageService instance from environment variables
 */
export function createStorageService(): StorageService {
  const config: StorageConfig = {
    r2Endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    r2AccessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    r2BucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    r2PublicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL!,
    streamAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    streamApiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN,
  };

  return new StorageService(config);
}
