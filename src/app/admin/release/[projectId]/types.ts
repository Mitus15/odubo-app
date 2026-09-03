import type {
  WarehouseDoc,
  WarehouseFile,
  WarehousePiece,
  WarehouseProject,
} from '@/lib/release/types';

export interface AlbumRow {
  id: string;
  title: string;
  artist_name: string | null;
  status: string;
  release_date: string | null;
  cover_art_url: string | null;
  total_tracks: number | null;
  total_duration: number | null;
}

export interface TrackRow {
  id: string;
  title: string;
  track_number: number;
  duration: number | null;
  audio_url: string | null;
  audio_status: string | null;
  isrc: string | null;
  status: string | null;
  source_file_id: string | null;
}

export interface ReleaseRow {
  id: string;
  status: string;
  distributor: string | null;
  upc: string | null;
  distribution_release_date: string | null;
}

/** Everything /api/admin/release/projects/[projectId] returns. */
export interface ProjectFloorData {
  project: WarehouseProject;
  album: AlbumRow | null;
  tracks: TrackRow[];
  release: ReleaseRow | null;
  pieces: WarehousePiece[];
  files: WarehouseFile[];
  docs: WarehouseDoc[];
  /** track_id → the r2_key currently flagged to ship. Derived, never stored. */
  shipped: Record<string, string>;
}
