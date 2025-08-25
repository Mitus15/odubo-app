# File Organization System Documentation

## Overview
This document describes the organized file upload system implemented for R2 storage in the Odubo app. The system provides structured folder hierarchies for different content types, replacing the previous flat folder structure.

## File Structure

### Music Albums
```
/music/albums/{albumId}/
├── cover_{filename}           # Album cover art
└── tracks/
    └── track_{number}_{filename}  # Individual tracks
```

### Videos
```
/videos/{videoType}/{sanitized_title}_{id}/
├── {timestamp}_{filename}           # Main video file
├── poster_{timestamp}_{filename}    # Video poster/thumbnail
└── thumbnails/
    └── thumb_{timestamp}_{filename} # Additional thumbnails
```

**Note**: Directory names use sanitized video titles from the database for human-readable organization.

### Legacy/Temporary Files
```
/uploads/{timestamp}_{filename}  # Fallback for unorganized uploads
```

## File Types

### Supported File Types
- **Tracks**: `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.ogg`, `.webm`
- **Videos**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### Video Types
- `music-video`: Music videos and promotional content
- `short-film`: Short films and artistic content
- `feature`: Feature-length films and longer content

## API Usage

### Upload API Endpoint: `/api/upload`

#### Organized Upload (New System)
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('fileType', 'track'); // or 'album-cover', 'video', 'video-poster'
formData.append('albumId', 'album_123'); // for album-related files
formData.append('videoId', 'video_456'); // for video-related files
formData.append('videoType', 'music-video'); // for videos only
```

#### Legacy Upload (Backward Compatibility)
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'uploads'); // falls back to flat structure
```

## Implementation Details

### Core Files
- `/src/lib/fileOrganization.ts` - Main utility functions
- `/src/worker/upload.ts` - Upload worker with organized system
- `/src/app/api/upload/route.ts` - Upload API endpoint
- `/src/app/api/videos/upload/route.ts` - Video-specific upload endpoint

### Key Functions

#### `generateFilePath(options: FileOrganizationOptions)`
Generates the appropriate file path based on content type and metadata.

#### `validateFileType(fileName: string, expectedType: FileType)`
Validates that file extensions match the expected content type.

#### `getMimeType(fileName: string)`
Returns the correct MIME type for proper content handling.

#### `sanitizeFileName(fileName: string)`
Ensures file names are safe for storage and URL usage.

## Usage Examples

### Album Track Upload
```javascript
// Create album first
const albumResponse = await fetch('/api/albums', {
  method: 'POST',
  body: JSON.stringify({ title: 'My Album', artist_name: 'Artist' })
});
const { id: albumId } = await albumResponse.json();

// Upload track with organized structure
const formData = new FormData();
formData.append('file', audioFile);
formData.append('fileType', 'track');
formData.append('albumId', albumId);

const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

### Album Cover Upload
```javascript
const formData = new FormData();
formData.append('file', imageFile);
formData.append('fileType', 'album-cover');
formData.append('albumId', albumId);

const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

### Video Upload
```javascript
const formData = new FormData();
formData.append('file', videoFile);
formData.append('poster', posterFile); // optional
formData.append('type', 'music-video');
formData.append('title', 'Video Title');
formData.append('artist_name', 'Artist Name');

const uploadResponse = await fetch('/api/videos/upload', {
  method: 'POST',
  body: formData
});
```

## Benefits

1. **Organization**: Clear folder structure makes content management easier
2. **Scalability**: Dedicated folders prevent flat-directory performance issues
3. **Type Safety**: File validation ensures proper content types
4. **Backward Compatibility**: Legacy upload system still works
5. **Consistency**: Standardized naming conventions across all uploads

## Migration Notes

- Existing files in flat structure remain accessible
- New uploads automatically use organized structure
- Album and video creation workflows updated to use new system
- Test components provided for validation

## Test Components

- `TestTrackUpload.tsx` - Test organized track uploads
- `TestAlbumCoverUpload.tsx` - Test album cover uploads
- Album creation form updated to use organized uploads

## Future Enhancements

1. **Batch Operations**: Support for multiple file uploads in single request
2. **Storage Analytics**: Track usage by folder structure
3. **Migration Tools**: Scripts to reorganize existing flat-structure files
4. **CDN Integration**: Optimized delivery based on file organization
