# Storage Conventions

This document defines the official storage organization for all media assets in the Odubo platform.

## Storage Systems

### Cloudflare R2 (Object Storage)
- **Bucket**: `odubo-studio-media`
- **Public URL**: `https://media.odubo.studio`
- **Use for**: Images, thumbnails, static assets, uploaded videos for social

### Cloudflare Stream (Video Hosting)
- **Use for**: All playback-ready videos (clips, music videos)
- **Provides**: HLS streaming, adaptive bitrate, thumbnails

## Path Conventions

### Social Media Assets
```
social/{entity_slug}/{YYYY}/{MM}/{DD}/{uuid}.{ext}
```
**Examples**:
- `social/odubo/2025/01/15/a1b2c3d4-5678-90ab-cdef.mp4`
- `social/odubo-studio/2025/01/15/f9e8d7c6-5432-10ab-cdef.jpg`

**Organization**:
- Grouped by brand/entity first
- Then by date for easy archival
- UUID filenames prevent collisions

### Gallery/Moments Assets
```
galleries/{gallery_slug}/photos/{uuid}.{ext}
galleries/{gallery_slug}/videos/{uuid}.{ext}
```
**Examples**:
- `galleries/summer-concert-2025/photos/abc123.jpg`
- `galleries/summer-concert-2025/videos/def456.mp4`

### Album Assets
```
albums/{album_id}/cover.{ext}
albums/{album_id}/tracks/{track_id}.{ext}
```
**Examples**:
- `albums/abc123/cover.jpg`
- `albums/abc123/tracks/track-001.mp3`

### Video Thumbnails
```
thumbnails/videos/{video_id}/{uuid}.{ext}
```
**Examples**:
- `thumbnails/videos/v123/thumb-001.jpg`

### Featured Page Assets
```
featured/cover-{timestamp}.{ext}
featured/background-{timestamp}.{ext}
```
**Examples**:
- `featured/cover-1704067200000.jpg`
- `featured/background-1704067200000.mp4`

## Media Registry

All uploads are tracked in the `media_registry` table:

| Field | Description |
|-------|-------------|
| `id` | Unique registry ID |
| `storage_type` | `r2` or `stream` |
| `storage_key` | R2 key or Stream UID |
| `public_url` | Full public URL |
| `media_type` | `video`, `image`, `audio`, `document` |
| `content_type` | MIME type |
| `file_size_bytes` | Size in bytes |
| `original_filename` | User's original filename |
| `entity_id` | Associated brand/entity |
| `category` | `social`, `clips`, `gallery`, `album`, `featured`, `thumbnail` |
| `owner_type` | Type of owning record |
| `owner_id` | ID of owning record |
| `uploaded_by` | User ID or `system` |
| `upload_source` | `web`, `api`, `sync`, `migration` |
| `status` | `active`, `archived`, `deleted`, `orphaned` |

## Audit Trail

All media operations are logged in `media_audit_log`:

| Field | Description |
|-------|-------------|
| `action` | `upload`, `delete`, `archive`, `restore`, `update` |
| `media_id` | Reference to media_registry |
| `actor_id` | Who performed the action |
| `actor_ip` | IP address |
| `details` | JSON with additional context |

## R2 Object Metadata

Each R2 object includes custom metadata:
- `originalFilename`: User's original filename
- `uploadedAt`: ISO timestamp
- `entityId`: Associated entity ID
- `entitySlug`: Entity slug for path
- `mediaType`: `video` or `image`
- `fileSize`: Size in bytes

## HTTP Headers

All R2 objects are served with:
- `Content-Type`: Appropriate MIME type
- `Cache-Control`: `public, max-age=31536000, immutable`

## Best Practices

1. **Never expose user filenames in paths** - Use UUIDs
2. **Always register uploads** - Create media_registry entry
3. **Log all operations** - Use media_audit_log
4. **Include metadata** - Both R2 metadata and DB fields
5. **Use entity slugs** - Not IDs in paths (readable)
6. **Date organization** - Enables easy archival/cleanup
