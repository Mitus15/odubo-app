// Database setup script for likes system
// Run this to create the necessary tables for the likes/favorites system

import { executeQuery } from '@/lib/db';

export async function setupLikesSystem() {
  try {
    console.log('Creating likes system tables...');

    // User likes for tracks (foundation for playlists)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_track_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, track_id)
      )
    `);

    // User likes for videos/films (foundation for video playlists)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_video_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, video_id)
      )
    `);

    // User likes for albums (collection likes)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_album_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        album_id TEXT NOT NULL,
        liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, album_id)
      )
    `);

    // Check if playlists table already has user_id column
    try {
      await executeQuery(`ALTER TABLE playlists ADD COLUMN user_id TEXT`);
    } catch (error) {
      // Column might already exist, that's ok
      console.log('Playlists user_id column might already exist');
    }

    // User listening/viewing history (for recommendations)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_listening_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        play_duration INTEGER,
        completed BOOLEAN DEFAULT FALSE
      )
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_viewing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        view_duration INTEGER,
        completed BOOLEAN DEFAULT FALSE
      )
    `);

    // Create indexes for performance
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_track_likes_user_id ON user_track_likes(user_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_track_likes_track_id ON user_track_likes(track_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_video_likes_user_id ON user_video_likes(user_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_video_likes_video_id ON user_video_likes(video_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_album_likes_user_id ON user_album_likes(user_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_user_album_likes_album_id ON user_album_likes(album_id)`);

    console.log('Likes system tables created successfully!');
    return { success: true, message: 'Likes system setup complete' };
  } catch (error) {
    console.error('Error setting up likes system:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
