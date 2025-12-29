// ============================================================================
// DISTRIBUTION TYPES
// Core types for music distribution system
// ============================================================================

// Release Types
export type ReleaseType = 'single' | 'ep' | 'album' | 'compilation';

export type ReleaseStatus =
  | 'draft'
  | 'pending_review'
  | 'ready'
  | 'submitted'
  | 'processing'
  | 'live'
  | 'takedown'
  | 'removed';

export type TrackStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

// DSP (Digital Service Provider) types
export type DSP =
  | 'spotify'
  | 'apple_music'
  | 'amazon_music'
  | 'youtube_music'
  | 'tidal'
  | 'deezer'
  | 'pandora'
  | 'soundcloud'
  | 'audiomack'
  | 'tiktok'
  | 'instagram'
  | 'facebook';

export type DSPStatus = 'pending' | 'submitted' | 'processing' | 'live' | 'rejected' | 'removed';

// ============================================================================
// RELEASE
// ============================================================================

export interface Release {
  id: string;

  // Core metadata
  title: string;
  releaseType: ReleaseType;
  artistName: string;
  labelName?: string;

  // Identifiers
  upc?: string;
  catalogNumber?: string;

  // Artwork
  coverArtUrl?: string;
  coverArtR2Key?: string;

  // Dates
  originalReleaseDate?: string;
  distributionReleaseDate?: string;

  // Distributor
  distributor: string;
  distributorReleaseId?: string;

  // Status
  status: ReleaseStatus;

  // Pricing & Rights
  priceTier?: string;
  territories: string[];
  explicitContent: boolean;

  // Metadata
  genre?: string;
  subgenre?: string;
  language: string;
  copyrightLine?: string;
  phonographicLine?: string;

  // Internal linking
  internalAlbumId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  liveAt?: string;

  // Tracks (when loaded)
  tracks?: Track[];
  dspTargets?: DSPTarget[];
}

// ============================================================================
// TRACK
// ============================================================================

export interface Track {
  id: string;
  releaseId: string;

  // Position
  discNumber: number;
  trackNumber: number;

  // Core metadata
  title: string;
  version?: string;
  artistName: string;
  featuringArtists?: string[];

  // Identifiers
  isrc?: string;

  // Audio
  audioUrl?: string;
  audioR2Key?: string;
  durationSeconds?: number;

  // Credits
  composers?: string[];
  producers?: string[];
  performers?: string[];

  // Royalty splits
  royaltySplits?: RoyaltySplit[];

  // Flags
  explicit: boolean;
  instrumental: boolean;

  // Lyrics
  lyrics?: string;
  lyricsLanguage?: string;

  // Internal linking
  internalTrackId?: string;

  // Status
  status: TrackStatus;
  rejectionReason?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface RoyaltySplit {
  name: string;
  role: 'writer' | 'performer' | 'producer' | 'publisher' | 'label';
  percent: number;
  email?: string;
  payeeId?: string;
}

// ============================================================================
// DSP TARGETING
// ============================================================================

export interface DSPTarget {
  id: string;
  releaseId: string;
  dsp: DSP;
  enabled: boolean;

  // External IDs (after live)
  externalId?: string;
  externalUrl?: string;

  // Status
  status: DSPStatus;
  liveAt?: string;

  createdAt: string;
}

// ============================================================================
// DISTRIBUTOR INTERFACE
// Abstract interface for distribution providers (LabelGrid, etc.)
// ============================================================================

export interface DistributorCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
}

export interface DistributorClient {
  // Connection
  connect(credentials: DistributorCredentials): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Releases
  createRelease(release: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  updateRelease(id: string, updates: Partial<Release>): Promise<void>;
  submitRelease(id: string): Promise<{ success: boolean; error?: string }>;
  getReleaseStatus(id: string): Promise<ReleaseStatus>;

  // Tracks
  addTrack(releaseId: string, track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  updateTrack(trackId: string, updates: Partial<Track>): Promise<void>;
  removeTrack(trackId: string): Promise<void>;

  // Assets
  uploadArtwork(releaseId: string, file: File): Promise<{ url: string }>;
  uploadAudio(trackId: string, file: File): Promise<{ url: string; duration: number }>;

  // Analytics (if supported)
  getAnalytics?(releaseId: string, options: AnalyticsOptions): Promise<AnalyticsData>;
}

export interface AnalyticsOptions {
  startDate: string;
  endDate: string;
  platforms?: DSP[];
  territories?: string[];
}

export interface AnalyticsData {
  totalStreams: number;
  totalRevenue: number;
  byPlatform: Record<DSP, { streams: number; revenue: number }>;
  byTerritory: Record<string, { streams: number; revenue: number }>;
  dailyData: { date: string; streams: number; revenue: number }[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ReleasesResponse {
  releases: Release[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReleaseResponse {
  release: Release;
}

export interface CreateReleaseRequest {
  title: string;
  releaseType: ReleaseType;
  artistName: string;
  labelName?: string;
  genre?: string;
  distributionReleaseDate?: string;
  territories?: string[];
  internalAlbumId?: string;
}

export interface AddTrackRequest {
  title: string;
  artistName: string;
  trackNumber: number;
  discNumber?: number;
  isrc?: string;
  explicit?: boolean;
  instrumental?: boolean;
  internalTrackId?: string;
}

// ============================================================================
// GENRE LIST
// ============================================================================

export const GENRES = [
  'Alternative',
  'Blues',
  'Children\'s Music',
  'Classical',
  'Comedy',
  'Country',
  'Dance',
  'Electronic',
  'Folk',
  'Hip-Hop/Rap',
  'Holiday',
  'Indie',
  'Jazz',
  'Latin',
  'Metal',
  'New Age',
  'Pop',
  'R&B/Soul',
  'Reggae',
  'Rock',
  'Soundtrack',
  'Spoken Word',
  'World',
] as const;

export const TERRITORIES = [
  { code: 'WW', name: 'Worldwide' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
] as const;

export const DSPS: { id: DSP; name: string; icon: string }[] = [
  { id: 'spotify', name: 'Spotify', icon: '🟢' },
  { id: 'apple_music', name: 'Apple Music', icon: '🍎' },
  { id: 'amazon_music', name: 'Amazon Music', icon: '📦' },
  { id: 'youtube_music', name: 'YouTube Music', icon: '▶️' },
  { id: 'tidal', name: 'Tidal', icon: '🌊' },
  { id: 'deezer', name: 'Deezer', icon: '🎧' },
  { id: 'pandora', name: 'Pandora', icon: '📻' },
  { id: 'soundcloud', name: 'SoundCloud', icon: '☁️' },
  { id: 'audiomack', name: 'Audiomack', icon: '🎵' },
  { id: 'tiktok', name: 'TikTok', icon: '📱' },
  { id: 'instagram', name: 'Instagram/Facebook', icon: '📷' },
];

// ============================================================================
// VIDEO DISTRIBUTION TYPES
// ============================================================================

export type VideoType =
  | 'music_video'
  | 'lyric_video'
  | 'visualizer'
  | 'live_performance'
  | 'behind_the_scenes'
  | 'short_form';

export type VideoReleaseStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'uploading'
  | 'processing'
  | 'live'
  | 'unlisted'
  | 'private'
  | 'removed';

export type VideoPlatform =
  | 'youtube'
  | 'vevo'
  | 'facebook'
  | 'instagram_reels'
  | 'tiktok'
  | 'twitter'
  | 'vimeo';

export type VideoPlatformStatus =
  | 'pending'
  | 'scheduled'
  | 'uploading'
  | 'processing'
  | 'live'
  | 'unlisted'
  | 'private'
  | 'failed'
  | 'removed';

export type VideoAssetType =
  | 'master'
  | 'clean'
  | 'explicit'
  | 'extended'
  | 'radio_edit'
  | 'vertical'
  | 'square'
  | 'teaser';

export type ContentIdPolicy = 'monetize' | 'track' | 'block';

export interface VideoRelease {
  id: string;

  // Core metadata
  title: string;
  artistName: string;
  videoType: VideoType;
  description?: string;
  descriptionTemplate?: string;

  // Associated music
  linkedTrackId?: string;
  linkedReleaseId?: string;
  isrc?: string;

  // Primary asset
  primaryAssetId?: string;

  // Thumbnails
  thumbnailUrl?: string;
  thumbnailR2Key?: string;
  customThumbnails?: string[];

  // Premiere settings
  premiereEnabled: boolean;
  premiereDate?: string;
  premiereCountdownTheme?: string;

  // Content ID / Rights
  contentIdEnabled: boolean;
  contentIdPolicy: ContentIdPolicy;

  // Status
  status: VideoReleaseStatus;

  // Metadata
  genre?: string;
  tags?: string[];
  language: string;
  madeForKids: boolean;
  ageRestricted: boolean;

  // Credits
  director?: string;
  producer?: string;
  cinematographer?: string;
  editor?: string;
  creditsJson?: Record<string, string>;

  // Internal linking
  internalVideoId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  publishedAt?: string;

  // Related data (when loaded)
  assets?: VideoAsset[];
  platforms?: VideoPlatformTarget[];
}

export interface VideoAsset {
  id: string;
  releaseId: string;

  // Asset info
  label: string;
  versionType: VideoAssetType;

  // File info
  fileUrl?: string;
  r2Key?: string;
  cloudflareUid?: string;

  // Technical specs
  durationSeconds?: number;
  width?: number;
  height?: number;
  aspectRatio?: string;
  framerate?: number;
  codec?: string;
  bitrateKbps?: number;
  fileSizeBytes?: number;

  // Audio
  audioCodec?: string;
  audioBitrateKbps?: number;
  audioChannels?: number;

  // Status
  status: 'pending' | 'processing' | 'ready' | 'error';
  processingError?: string;

  // Primary flag
  isPrimary: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface VideoPlatformTarget {
  id: string;
  releaseId: string;

  // Platform
  platform: VideoPlatform;
  enabled: boolean;

  // Platform-specific settings
  assetId?: string;
  titleOverride?: string;
  descriptionOverride?: string;
  tagsOverride?: string[];

  // YouTube specific
  youtubeCategory?: string;
  youtubePlaylistId?: string;
  youtubeEndScreen?: Record<string, unknown>;
  youtubeCards?: Record<string, unknown>;

  // External IDs (after publish)
  externalId?: string;
  externalUrl?: string;

  // Status
  status: VideoPlatformStatus;
  statusMessage?: string;

  // Metrics (cached)
  views: number;
  likes: number;
  comments: number;
  metricsUpdatedAt?: string;

  // Timing
  scheduledAt?: string;
  publishedAt?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// VIDEO CONSTANTS
// ============================================================================

export const VIDEO_TYPES: { id: VideoType; name: string; description: string }[] = [
  { id: 'music_video', name: 'Music Video', description: 'Official music video' },
  { id: 'lyric_video', name: 'Lyric Video', description: 'Lyrics on screen' },
  { id: 'visualizer', name: 'Visualizer', description: 'Audio visualizer' },
  { id: 'live_performance', name: 'Live Performance', description: 'Live recording' },
  { id: 'behind_the_scenes', name: 'Behind the Scenes', description: 'BTS content' },
  { id: 'short_form', name: 'Short Form', description: 'Vertical/short clips' },
];

export const VIDEO_PLATFORMS: { id: VideoPlatform; name: string; icon: string }[] = [
  { id: 'youtube', name: 'YouTube', icon: '▶️' },
  { id: 'vevo', name: 'Vevo', icon: '🎬' },
  { id: 'facebook', name: 'Facebook', icon: '👤' },
  { id: 'instagram_reels', name: 'Instagram Reels', icon: '📷' },
  { id: 'tiktok', name: 'TikTok', icon: '📱' },
  { id: 'twitter', name: 'X/Twitter', icon: '🐦' },
  { id: 'vimeo', name: 'Vimeo', icon: '🎥' },
];

export const VIDEO_ASSET_TYPES: { id: VideoAssetType; name: string }[] = [
  { id: 'master', name: 'Master' },
  { id: 'clean', name: 'Clean Version' },
  { id: 'explicit', name: 'Explicit Version' },
  { id: 'extended', name: 'Extended Cut' },
  { id: 'radio_edit', name: 'Radio Edit' },
  { id: 'vertical', name: 'Vertical (9:16)' },
  { id: 'square', name: 'Square (1:1)' },
  { id: 'teaser', name: 'Teaser' },
];

export const YOUTUBE_CATEGORIES = [
  { id: '10', name: 'Music' },
  { id: '24', name: 'Entertainment' },
  { id: '22', name: 'People & Blogs' },
  { id: '1', name: 'Film & Animation' },
  { id: '17', name: 'Sports' },
  { id: '20', name: 'Gaming' },
];
