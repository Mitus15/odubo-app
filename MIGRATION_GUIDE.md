# Video File Organization Migration Guide

This guide will help you migrate your existing video files from the root R2 storage to the new organized folder structure.

## Overview

**Current Structure (Disorganized):**
```
R2 Bucket Root:
├── video1.mp4
├── poster1.jpg
├── some_other_video.mp4
├── thumbnail.png
└── ... (all files in root)
```

**New Structure (Organized):**
```
R2 Bucket:
├── videos/
│   ├── music-video/
│   │   └── urban_rhythms_123/
│   │       ├── 1234567890_video1.mp4
│   │       └── poster_1234567890_poster1.jpg
│   ├── short-film/
│   │   └── midnight_chronicles_124/
│   │       ├── 1234567891_some_other_video.mp4
│   │       └── poster_1234567891_thumbnail.png
│   └── feature/
│       └── odubo_studio_showreel_125/
│           ├── 1234567892_showreel.mp4
│           └── poster_1234567892_thumbnail.png
└── temp/ (for processing)
```

## Prerequisites

1. **Environment Variables**: Ensure all required environment variables are set:
   ```bash
   CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint
   CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
   CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
   CLOUDFLARE_R2_PUBLIC_URL=your_public_url
   DATABASE_URL=your_d1_database_url
   ```

2. **Backup**: Create a backup of your R2 bucket and database before migration

3. **Dependencies**: Install required dependencies:
   ```bash
   npm install
   ```

## Migration Process

### Step 1: Dry Run (Preview)

First, run a dry run to see what will be migrated without making any changes:

```bash
npm run migrate:videos
```

This will:
- ✅ Analyze your current video files in the database
- ✅ Generate a migration plan
- ✅ Save the plan to `tmp/migration-plan-{timestamp}.json`
- ✅ Show what files will be moved and where
- ❌ **NOT** move any files or update the database

### Step 2: Review Migration Plan

Check the generated migration plan file in the `tmp/` directory:

```bash
cat tmp/migration-plan-*.json
```

The plan shows:
- Which videos will be migrated
- Current file locations (`oldVideoKey`, `oldPosterKey`)
- New organized locations (`newVideoKey`, `newPosterKey`)
- Updated URLs that will be stored in the database

### Step 3: Execute Migration

Once you're satisfied with the plan, execute the migration:

```bash
npm run migrate:videos -- --execute
```

This will:
- ✅ Copy files from old locations to new organized locations
- ✅ Update database URLs to point to new locations
- ✅ Verify all files were copied successfully
- ✅ Clean up old files (after 5-second countdown)

### Step 4: Execute Without Cleanup (Optional)

If you want to keep the old files for safety:

```bash
npm run migrate:videos -- --execute --skip-cleanup
```

This keeps the original files in place while creating the organized copies.

## Migration Script Features

### 🔍 **Analysis & Planning**
- Scans all videos in your database
- Maps video types (`music-video`, `short-film`, `feature`) based on category/type
- Generates unique video IDs for organized folder structure
- Creates comprehensive migration plan

### 📁 **File Organization**
- **Music Videos**: `videos/music-video/{sanitized_title}_{id}/`
- **Short Films**: `videos/short-film/{sanitized_title}_{id}/`
- **Feature Films**: `videos/feature/{sanitized_title}_{id}/`
- **Human-Readable Directories**: Folder names based on actual video titles from database
- **Title Sanitization**: Special characters removed, spaces converted to underscores
- **Timestamped Files**: All files get unique timestamps to prevent conflicts

### 🛡️ **Safety Features**
- **Dry Run Mode**: Preview changes before executing
- **File Verification**: Checks if source files exist before migration
- **Copy Before Delete**: Copies files to new locations before deleting originals
- **Database Backup**: Updates database only after successful file copy
- **Error Handling**: Detailed error reporting and rollback capabilities

### 📊 **Progress Tracking**
- Real-time progress updates with colored output
- Detailed statistics (files migrated, skipped, errors)
- Migration plan saved to file for auditing
- Verification of successful migrations

## File Naming Convention

The new organized structure uses this naming pattern:

- **Videos**: `{timestamp}_{original_filename}`
- **Posters**: `poster_{timestamp}_{original_filename}`
- **Folders**: `videos/{type}/{sanitized_title}_{id}/`

### Title Sanitization Process

Video titles from the database are sanitized for use as directory names:

**Original Title** → **Sanitized Directory Name**
- `"Urban Rhythms: The Beat Goes On!"` → `urban_rhythms_the_beat_goes_on_123`
- `"Behind the Scenes (Studio Sessions)"` → `behind_the_scenes_studio_sessions_124`
- `"Midnight Chronicles - Part 1"` → `midnight_chronicles_part_1_125`

**Sanitization Rules:**
- Remove special characters (keep only letters, numbers, hyphens, underscores)
- Replace spaces with underscores
- Convert to lowercase
- Limit to 50 characters maximum
- Append database ID for uniqueness

### Examples

**Music Video:**
```
videos/music-video/urban_rhythms_123/
├── 1704067200_urban_rhythms.mp4
└── poster_1704067200_urban_poster.jpg
```

**Short Film:**
```
videos/short-film/midnight_chronicles_124/
├── 1704067201_midnight_film.mp4
└── poster_1704067201_midnight_poster.jpg
```

**Feature Film:**
```
videos/feature/odubo_studio_showreel_125/
├── 1704067202_showreel.mp4
└── poster_1704067202_showreel_thumb.jpg
```

## Database Updates

The migration updates these fields in your `videos` table:
- `url`: Updated to new organized path
- `poster_url`: Updated to new organized path  
- `updated_at`: Set to current timestamp

Original data is preserved, only the file URLs are updated.

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   ❌ Missing environment variable: CLOUDFLARE_R2_ENDPOINT
   ```
   **Solution**: Set all required environment variables in your `.env.local` file

2. **File Not Found**
   ```
   ❌ Video file not found: some_video.mp4
   ```
   **Solution**: The file may have been deleted or moved. Check your R2 bucket manually

3. **Permission Errors**
   ```
   Failed to copy file: Access Denied
   ```
   **Solution**: Verify your R2 access keys have read/write permissions

4. **Database Connection Issues**
   ```
   Database query failed
   ```
   **Solution**: Check your `DATABASE_URL` and D1 API token

### Recovery

If something goes wrong during migration:

1. **Before Database Update**: Stop the script (Ctrl+C) and restart with dry run
2. **After Database Update**: Use the saved migration plan to manually revert URLs
3. **File Conflicts**: The script uses timestamps to avoid conflicts, but check for duplicates

### Manual Verification

After migration, verify the results:

1. **Check R2 Bucket**: Browse your R2 bucket to see the new organized structure
2. **Test Videos**: Load a few videos in your app to ensure URLs work
3. **Database Check**: Query your database to see the updated URLs:
   ```sql
   SELECT id, title, url, poster_url FROM videos LIMIT 5;
   ```

## Post-Migration

### Update Upload Endpoints

After migration, ensure all new uploads use the organized system:
- ✅ Video uploads via `/api/videos/upload` already use organized structure
- ✅ File organization system is already in place
- ✅ New files will automatically be organized

### Cleanup Old Migration Files

After successful migration, you can clean up:
```bash
rm tmp/migration-plan-*.json
```

### Monitor Storage

The organized structure makes it easier to:
- Track storage usage by video type
- Implement automated cleanup scripts
- Optimize CDN delivery
- Manage file lifecycles

## Support

If you encounter issues during migration:

1. Check the migration plan file for details
2. Review the console output for specific error messages
3. Verify your environment variables and permissions
4. Consider running a smaller test migration first

The migration script is designed to be safe and reversible, but always backup your data before running any migration!
