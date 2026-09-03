/**
 * Release Control — the shapes shared between the warehouse routes and the UI.
 *
 * These mirror the tables created by migrations 153/154/155. Where a column is
 * a soft reference into another subsystem (album_id, track_id, source_file_id)
 * it is typed as a plain string: the warehouse points at subsystems, never the
 * reverse, and no foreign key enforces it.
 */

export type ProjectType = 'album' | 'film' | 'fashion' | 'other';
export type ProjectStatus = 'active' | 'shipped' | 'archived';

export type PieceKind =
  | 'cover'
  | 'vinyl'
  | 'packaging'
  | 'track-master'
  | 'promo'
  | 'other';

/** The owner's three tiers: what you work on, what you keep, what ships. */
export type FileClass = 'working' | 'master' | 'commercial';

export type FileCategory =
  | 'preview-image'
  | 'audio-master'
  | 'daw-project'
  | 'artwork-source'
  | 'video'
  | 'document'
  | 'other';

export type FileStatus = 'uploading' | 'ready' | 'failed';

export type DocKind = 'note' | 'lore' | 'character' | 'story' | 'draft' | 'other';

export interface WarehouseProject {
  id: string;
  type: ProjectType;
  title: string;
  status: ProjectStatus;
  album_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehousePiece {
  id: string;
  project_id: string;
  kind: PieceKind;
  title: string;
  description: string | null;
  track_id: string | null;
  preview_file_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseFile {
  id: string;
  project_id: string;
  piece_id: string | null;
  class: FileClass;
  category: FileCategory;
  r2_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: FileStatus;
  uploaded_at: string;
}

export interface WarehouseDoc {
  id: string;
  project_id: string;
  track_id: string | null;
  kind: DocKind;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export const PROJECT_TYPES: readonly ProjectType[] = ['album', 'film', 'fashion', 'other'];
export const PIECE_KINDS: readonly PieceKind[] = [
  'cover',
  'vinyl',
  'packaging',
  'track-master',
  'promo',
  'other',
];
export const FILE_CLASSES: readonly FileClass[] = ['working', 'master', 'commercial'];
export const FILE_CATEGORIES: readonly FileCategory[] = [
  'preview-image',
  'audio-master',
  'daw-project',
  'artwork-source',
  'video',
  'document',
  'other',
];
export const DOC_KINDS: readonly DocKind[] = [
  'note',
  'lore',
  'character',
  'story',
  'draft',
  'other',
];

/** Human labels for the three tiers, used in every picker. */
export const CLASS_LABELS: Record<FileClass, string> = {
  working: 'Working',
  master: 'Master',
  commercial: 'Commercial — ships',
};
