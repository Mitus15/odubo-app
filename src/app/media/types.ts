export type Credit = {
  name: string;
  role: string;
};

export type Video = {
  id: number;
  uid?: string;                    // Stable unique id (Stream UID / internal)
  title: string;
  artist_name?: string;
  description: string;             // Legacy/general description
  short_description?: string | null;
  long_description?: string | null;
  ai_description?: string | null;  // Cached AI-generated summary
  url: string;                     // Embed or direct playback URL
  poster_url: string;              // Primary poster URL
  thumbnail: string;               // Legacy/alias
  duration: string;                // Formatted duration string (e.g. 3:45)
  duration_seconds?: number;       // Raw seconds (numeric)
  thumbnail_timestamp_pct?: number | null; // Selected thumbnail position (0..1)
  category: string;
  is_public: boolean;
  publication_status?: 'live' | 'archived';
  status?: 'draft' | 'published' | 'archived';
  type: string;                    // Free-form/sluggified type
  mood: string;                    // Free-form mood / tone
  tags?: string[];                 // Parsed from JSON field
  credits: Credit[];
  related_projects: string[];
  stream_video_id?: string;        // Underlying Stream video identifier (if separate)
  created_at?: string;
  updated_at?: string;
};
