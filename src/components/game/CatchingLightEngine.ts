// ============================================================================
// CatchingLightEngine — Pure TypeScript game logic (no React)
//
// The character auto-ascends through a vertical world. Light orbs are
// scattered in the space above; shadow orbs are hazards. The player
// controls horizontal movement to catch light (dress the figure) and
// dodge shadows. 3 shadow hits = game over.
//
// Follows the same callback pattern as TetrisEngine.
// ============================================================================

import type {
  CatchingLightState,
  ClothingState,
  ClothingSlot,
  TopVariant,
  Orb,
  Particle,
} from '@/types/game';
import { ORB_COLORS } from '@/types/game';
import {
  spawnOrbBatch,
  resetOrbIds,
  checkCollision,
  createCatchBurst,
  createShadowHitBurst,
  updateParticles,
} from './LightOrb';
import {
  loadClothingSlots,
  getRandomProduct,
  getNextSlot,
} from './clothingSlots';
import type { SlotProduct } from './clothingSlots';

// ============================================================================
// Constants
// ============================================================================

/** Starting lives */
const MAX_LIVES = 3;

/** Initial ascend speed (world units per second) */
const BASE_ASCEND_SPEED = 0.08;

/** How much ascend speed increases per second */
const ASCEND_ACCELERATION = 0.002;

/** Max ascend speed */
const MAX_ASCEND_SPEED = 0.25;

/** Character movement speed (normalized units per second) */
const MOVE_SPEED = 0.6;

/** Smooth lerp factor for character movement (0-1 per frame) */
const MOVE_LERP = 0.15;

/** How far ahead to spawn orbs (in world units above camera) */
const SPAWN_LOOKAHEAD = 2.0;

/** Vertical band size for each spawn batch */
const SPAWN_BAND_HEIGHT = 0.8;

/** Orbs per spawn batch */
const ORBS_PER_BATCH = 8;

/** Starting shadow ratio */
const BASE_SHADOW_RATIO = 0.15;

/** Shadow ratio increase per second */
const SHADOW_RATIO_GROWTH = 0.003;

/** Max shadow ratio */
const MAX_SHADOW_RATIO = 0.45;

/** Points per light orb catch */
const BASE_CATCH_POINTS = 100;

/** Max combo multiplier */
const MAX_COMBO = 4;

/** How far below camera an orb can be before it's cleaned up */
const ORB_CLEANUP_MARGIN = 0.5;

/** Visible world height (normalized) */
const WORLD_VIEW_HEIGHT = 1.0;

/** Knockback on shadow hit (world units downward) */
const SHADOW_KNOCKBACK = 0.03;

// ============================================================================
// Engine Class
// ============================================================================

export class CatchingLightEngine {
  // --- Callbacks ---
  onStateChange: ((state: CatchingLightState) => void) | null = null;
  onGameOver: ((score: number, totalCatches: number, durationSeconds: number) => void) | null = null;

  // --- Internal state ---
  private characterX = 0.5;
  private targetX = 0.5;
  private cameraY = 0;
  private ascendSpeed = BASE_ASCEND_SPEED;
  private orbs: Orb[] = [];
  private particles: Particle[] = [];
  private lives = MAX_LIVES;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private totalCatches = 0;
  private clothing: ClothingState = {
    top: null,
    bottom: null,
    layer: null,
    accessory: false,
  };
  private glowIntensity = 0;
  private gameOver = false;
  private elapsed = 0;
  private nextSpawnY = 0;
  private running = false;

  /** Products caught during this game (for "Shop This Look") */
  public caughtProducts: SlotProduct[] = [];

  // --- Product pools ---
  private productPools: Awaited<ReturnType<typeof loadClothingSlots>> | null = null;

  // --- Movement state ---
  private moveDirection: -1 | 0 | 1 = 0;

  // ========================================================================
  // Public API
  // ========================================================================

  async start(): Promise<void> {
    // Reset all state
    this.characterX = 0.5;
    this.targetX = 0.5;
    this.cameraY = 0;
    this.ascendSpeed = BASE_ASCEND_SPEED;
    this.orbs = [];
    this.particles = [];
    this.lives = MAX_LIVES;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalCatches = 0;
    this.clothing = { top: null, bottom: null, layer: null, accessory: false };
    this.glowIntensity = 0;
    this.gameOver = false;
    this.elapsed = 0;
    this.nextSpawnY = SPAWN_BAND_HEIGHT;
    this.running = true;
    this.moveDirection = 0;
    this.caughtProducts = [];
    resetOrbIds();

    // Load product pools (cached after first load)
    this.productPools = await loadClothingSlots();

    // Spawn initial orbs
    this.spawnNextBatch();
    this.spawnNextBatch();

    this.emitState();
  }

  stop(): void {
    this.running = false;
  }

  /** Set horizontal movement direction: -1 (left), 0 (stop), 1 (right) */
  setMoveDirection(dir: -1 | 0 | 1): void {
    this.moveDirection = dir;
  }

  /** Set an absolute target X position (for touch drag) */
  setTargetX(x: number): void {
    this.targetX = Math.max(0.05, Math.min(0.95, x));
  }

  /** Called once per animation frame with delta time in seconds */
  tick(dt: number): void {
    if (!this.running || this.gameOver) return;

    // Clamp dt to prevent physics explosions on tab-switch
    const clampedDt = Math.min(dt, 0.1);
    this.elapsed += clampedDt;

    // --- Ascend ---
    this.ascendSpeed = Math.min(
      MAX_ASCEND_SPEED,
      BASE_ASCEND_SPEED + ASCEND_ACCELERATION * this.elapsed,
    );
    this.cameraY += this.ascendSpeed * clampedDt;

    // --- Character horizontal movement ---
    if (this.moveDirection !== 0) {
      this.targetX += this.moveDirection * MOVE_SPEED * clampedDt;
      this.targetX = Math.max(0.05, Math.min(0.95, this.targetX));
    }
    this.characterX += (this.targetX - this.characterX) * MOVE_LERP;

    // --- Spawn orbs if needed ---
    while (this.nextSpawnY < this.cameraY + SPAWN_LOOKAHEAD) {
      this.spawnNextBatch();
    }

    // --- Collision detection ---
    const charWorldY = this.cameraY + 0.4; // Character sits at 40% from bottom of view
    this.checkCollisions(charWorldY);

    // --- Update particles ---
    this.particles = updateParticles(this.particles, clampedDt);

    // --- Clean up passed orbs ---
    this.orbs = this.orbs.filter(
      (orb) => !orb.consumed && orb.y > this.cameraY - ORB_CLEANUP_MARGIN,
    );

    // --- Glow decay/build ---
    const targetGlow = Math.min(this.combo / MAX_COMBO, 1);
    this.glowIntensity += (targetGlow - this.glowIntensity) * 0.1;

    this.emitState();
  }

  /** Get current state snapshot */
  getState(): CatchingLightState {
    return {
      characterX: this.characterX,
      cameraY: this.cameraY,
      ascendSpeed: this.ascendSpeed,
      orbs: this.orbs,
      particles: this.particles,
      lives: this.lives,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      clothing: this.clothing,
      glowIntensity: this.glowIntensity,
      gameOver: this.gameOver,
      elapsed: this.elapsed,
      totalCatches: this.totalCatches,
    };
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private spawnNextBatch(): void {
    const shadowRatio = Math.min(
      MAX_SHADOW_RATIO,
      BASE_SHADOW_RATIO + SHADOW_RATIO_GROWTH * this.elapsed,
    );

    const batch = spawnOrbBatch({
      yMin: this.nextSpawnY,
      yMax: this.nextSpawnY + SPAWN_BAND_HEIGHT,
      shadowRatio,
      count: ORBS_PER_BATCH,
      worldWidth: 1,
    });

    // Assign real Shopify products to light orbs
    if (this.productPools) {
      for (const orb of batch) {
        if (orb.kind === 'light' && orb.slot) {
          const result = getRandomProduct(this.productPools, orb.slot);
          if (result) {
            orb.productHandle = result.product.handle;
          }
        }
      }
    }

    this.orbs.push(...batch);
    this.nextSpawnY += SPAWN_BAND_HEIGHT;
  }

  private checkCollisions(charWorldY: number): void {
    for (const orb of this.orbs) {
      if (orb.consumed) continue;

      if (checkCollision(this.characterX, charWorldY, orb, WORLD_VIEW_HEIGHT)) {
        orb.consumed = true;

        if (orb.kind === 'light') {
          this.onLightCatch(orb);
        } else {
          this.onShadowHit(orb);
        }
      }
    }
  }

  private onLightCatch(orb: Orb): void {
    // Score
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const multiplier = Math.min(this.combo, MAX_COMBO);
    this.score += BASE_CATCH_POINTS * multiplier;
    this.totalCatches++;

    // Particles
    this.particles.push(...createCatchBurst(orb.x, orb.y, orb.color));

    // Fill clothing slot
    if (orb.slot) {
      this.fillClothingSlot(orb);
    }
  }

  private fillClothingSlot(orb: Orb): void {
    const nextSlot = getNextSlot(this.clothing);
    if (!nextSlot) return; // Fully dressed, bonus points only

    if (nextSlot === 'accessory') {
      this.clothing.accessory = true;
      return;
    }

    // Use the orb's actual slot type for the clothing visual,
    // but fill whichever slot is next in sequence
    if (nextSlot === 'top') {
      // Determine hoodie vs tee by checking product handle against pools
      let variant: TopVariant = 'tee';
      if (this.productPools && orb.productHandle) {
        for (const item of this.productPools.top) {
          if (item.product.handle === orb.productHandle) {
            variant = item.variant;
            break;
          }
        }
      }
      this.clothing.top = {
        variant,
        color: orb.color,
        productHandle: orb.productHandle,
      };
    } else if (nextSlot === 'bottom') {
      this.clothing.bottom = {
        color: ORB_COLORS.bottom,
        productHandle: orb.productHandle,
      };
    } else if (nextSlot === 'layer') {
      this.clothing.layer = {
        color: ORB_COLORS.layer,
        productHandle: orb.productHandle,
      };
    }

    // Track caught product
    if (orb.productHandle && this.productPools) {
      // Find the product info
      for (const slot of ['top', 'bottom', 'layer'] as const) {
        const pool = slot === 'top' ? this.productPools.top : this.productPools[slot];
        for (const item of pool) {
          const product = 'product' in item ? item.product : item;
          if (product.handle === orb.productHandle) {
            this.caughtProducts.push(product);
            break;
          }
        }
      }
    }
  }

  private onShadowHit(orb: Orb): void {
    this.lives--;
    this.combo = 0;
    this.particles.push(...createShadowHitBurst(orb.x, orb.y));

    // Knockback — push camera slightly back
    this.cameraY -= SHADOW_KNOCKBACK;

    if (this.lives <= 0) {
      this.gameOver = true;
      this.running = false;
      this.onGameOver?.(this.score, this.totalCatches, Math.round(this.elapsed));
    }
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }
}
