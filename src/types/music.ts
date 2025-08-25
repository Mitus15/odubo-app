export interface Album {
  id: string;
  title: string;
  artist_name: string;
  release_type: 'album' | 'ep' | 'single' | 'compilation' | 'mixtape';
  release_date?: string;
  record_label?: string;
  genre?: string;
  subgenre?: string;
  cover_art_url?: string;
  cover_art_key?: string;
  total_tracks?: number;
  total_duration?: number;
  explicit_content: boolean;
  featured: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  tracks?: Track[];
}

export interface Track {
  id: string;
  album_id?: string;
  title: string;
  track_number: number;
  disc_number: number;
  duration: number;
  duration_formatted?: string;
  audio_id?: string;
  audio_url?: string;
  preview_url?: string;
  waveform_url?: string;
  audio_status: 'pending' | 'ready' | 'error';
  isrc?: string;
  explicit_content: boolean;
  date_recorded?: string;
  recording_studio?: string;
  bpm?: number;
  key_signature?: string;
  language?: string;
  lyrics?: string;
  created_at?: string;
  updated_at?: string;
  credits?: TrackCredit[];
  genres?: TrackGenre[];
}

export interface TrackCredit {
  id?: number;
  track_id: string;
  role: string;
  name: string;
  is_featured: boolean;
}

export interface TrackGenre {
  id?: number;
  track_id: string;
  genre: string;
  is_primary: boolean;
}

export interface AlbumFormData {
  title: string;
  artist_name: string;
  release_type: Album['release_type'];
  release_date: string;
  record_label: string;
  genre: string;
  subgenre: string;
  explicit_content: boolean;
  featured: boolean;
  description: string;
}

export interface TrackFormData {
  title: string;
  album_id: string;
  track_number: number;
  disc_number: number;
  duration: number;
  explicit_content: boolean;
  date_recorded: string;
  recording_studio: string;
  bpm: number;
  key_signature: string;
  language: string;
  lyrics: string;
  isrc: string;
}
