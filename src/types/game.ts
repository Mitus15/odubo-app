// ============================================================================
// Game Mode Types — Tetris & Catching Light over Clips
// ============================================================================

/** Available game types */
export type GameType = 'tetris' | 'catching-light';

/** Cell value: 0 = empty, 1-7 = piece type (maps to color) */
export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The game grid: 20 rows x 10 columns */
export type Grid = Cell[][];

/** A tetromino piece */
export interface Piece {
  /** Shape matrix (true = filled cell) */
  shape: boolean[][];
  /** Column position on the grid */
  x: number;
  /** Row position on the grid */
  y: number;
  /** Piece type (1-7, maps to tetromino + color) */
  type: number;
  /** Current rotation state (0-3) */
  rotation: number;
}

/** Full game state snapshot for rendering */
export interface GameState {
  grid: Grid;
  currentPiece: Piece | null;
  nextPiece: Piece | null;
  score: number;
  level: number;
  linesCleared: number;
  gameOver: boolean;
  /** Ghost piece Y position (preview of where piece will land) */
  ghostY: number | null;
}

/** Game phase in the overlay state machine */
export type GamePhase = 'ready' | 'playing' | 'paused' | 'gameOver' | 'submitted';

/** Score entry for the leaderboard */
export interface GameScore {
  id: string;
  email: string;
  instagram_handle: string | null;
  display_name: string | null;
  score: number;
  level: number;
  lines_cleared: number;
  game_duration_seconds: number | null;
  device_type: string | null;
  created_at: string;
  /** Rank position (computed, not stored) */
  rank?: number;
}

/** Score submission payload */
export interface ScoreSubmission {
  email: string;
  instagram_handle?: string;
  score: number;
  level: number;
  lines_cleared: number;
  game_duration_seconds: number;
}

/** Leaderboard API response */
export interface LeaderboardResponse {
  scores: GameScore[];
  total: number;
}

/** Score submission API response */
export interface ScoreSubmitResponse {
  success: boolean;
  rank: number;
  total: number;
  error?: string;
}

/** Tetromino color palette — Odubo brand tones */
export const PIECE_COLORS: Record<number, string> = {
  1: '#ede8df', // I - Cream (primary text color)
  2: '#843c2d', // J - Terracotta (brand accent)
  3: '#b2a491', // L - Warm tan
  4: '#6d3224', // O - Deep terracotta
  5: '#c4785a', // S - Copper
  6: '#a07860', // T - Sienna
  7: '#4a3530', // Z - Dark brown
};

/** Ghost piece opacity */
export const GHOST_OPACITY = 0.2;

// ============================================================================
// Catching Light Types
// ============================================================================

/** Clothing slot on the stick figure */
export type ClothingSlot = 'top' | 'bottom' | 'layer';

/** What type of top the character is wearing */
export type TopVariant = 'tee' | 'hoodie';

/** Clothing state on the character */
export interface ClothingState {
  top: { variant: TopVariant; color: string; productHandle: string | null } | null;
  bottom: { color: string; productHandle: string | null } | null;
  layer: { color: string; productHandle: string | null } | null;
  accessory: boolean;
}

/** Orb type — light (good) or shadow (hazard) */
export type OrbKind = 'light' | 'shadow';

/** A falling orb in the game world */
export interface Orb {
  id: number;
  kind: OrbKind;
  /** Clothing slot this orb fills (null for shadow orbs) */
  slot: ClothingSlot | null;
  /** World-space X position (0-1 normalized) */
  x: number;
  /** World-space Y position (absolute, increases upward) */
  y: number;
  /** Orb radius */
  radius: number;
  /** Brand color for light orbs, dark purple for shadow */
  color: string;
  /** Associated Shopify product handle (light orbs only) */
  productHandle: string | null;
  /** Whether this orb has been collected or passed */
  consumed: boolean;
}

/** A visual particle (burst on catch, shatter on miss) */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  radius: number;
}

/** Full Catching Light game state snapshot */
export interface CatchingLightState {
  /** Character horizontal position (0-1 normalized) */
  characterX: number;
  /** Camera Y offset — increases as character ascends */
  cameraY: number;
  /** Current ascend speed (px/sec, increases over time) */
  ascendSpeed: number;
  /** All orbs in the world */
  orbs: Orb[];
  /** Active visual particles */
  particles: Particle[];
  /** Lives remaining (starts at 3) */
  lives: number;
  /** Current score */
  score: number;
  /** Consecutive light catches without shadow hit */
  combo: number;
  /** Max combo achieved this game */
  maxCombo: number;
  /** Clothing currently on the character */
  clothing: ClothingState;
  /** Glow intensity (0-1, derived from combo) */
  glowIntensity: number;
  /** Whether the game has ended */
  gameOver: boolean;
  /** Elapsed time in seconds */
  elapsed: number;
  /** Total light orbs caught */
  totalCatches: number;
}

/** Catching Light orb color palette */
export const ORB_COLORS = {
  top: '#ede8df',      // Cream — tops
  bottom: '#843c2d',   // Terracotta — bottoms
  layer: '#c4785a',    // Copper — layers
  shadow: '#2a1525',   // Dark purple — hazards
} as const;

// ============================================================================
// Street Runner Types (3D Infinite Runner)
// ============================================================================

/** Runner lane position */
export type RunnerLane = -1 | 0 | 1;

/** Obstacle types the antagonist places */
export type ObstacleType = 'barrier' | 'car' | 'shadow_pool' | 'shadow_pillar' | 'fallen_pole' | 'scaffolding';

/** An obstacle in the runner world */
export interface RunnerObstacle {
  id: number;
  type: ObstacleType;
  lane: RunnerLane;
  /** World-space Y position (distance along the road) */
  y: number;
  /** Whether this obstacle has been passed or hit */
  consumed: boolean;
}

/** A collectible orb in the runner world */
export interface RunnerOrb {
  id: number;
  kind: 'light' | 'shadow' | 'clothing';
  slot: ClothingSlot | null;
  lane: RunnerLane;
  y: number;
  color: string;
  productHandle: string | null;
  consumed: boolean;
}

/** Full Street Runner state snapshot */
export interface StreetRunnerState {
  /** Distance traveled along the road */
  playerY: number;
  /** Current lane: -1 (left), 0 (center), 1 (right) */
  playerLane: RunnerLane;
  /** Target lane (for smooth transitions) */
  targetLane: RunnerLane;
  /** Jump height (0 = on ground) */
  playerJumpZ: number;
  /** Whether player is sliding */
  isSliding: boolean;
  /** Current speed (units per second) */
  speed: number;
  /** Lives remaining */
  lives: number;
  /** Current score */
  score: number;
  /** Consecutive catches without hit */
  combo: number;
  /** Max combo this game */
  maxCombo: number;
  /** Clothing on the character */
  clothing: ClothingState;
  /** Light radius around player (narrative mechanic) */
  lightRadius: number;
  /** All active obstacles */
  obstacles: RunnerObstacle[];
  /** All active orbs */
  orbs: RunnerOrb[];
  /** Whether the game has ended */
  gameOver: boolean;
  /** Elapsed time in seconds */
  elapsed: number;
  /** Total orbs caught */
  totalCatches: number;
  /** Whether player was just hit (for flash effect) */
  hitFlash: boolean;
}
