// ============================================================================
// StreetRunnerEngine — Pure TypeScript game logic (no React/Three.js)
//
// Recoolman runs through a dark city bringing light. The game (antagonist)
// places obstacles to stop him. Catching light orbs fuels his glow,
// clothing orbs dress the figure. 3 shadow hits = darkness wins.
//
// Same callback pattern as CatchingLightEngine.
// ============================================================================

import type {
  StreetRunnerState,
  RunnerObstacle,
  RunnerOrb,
  RunnerLane,
  ObstacleType,
  ClothingState,
  ClothingSlot,
  TopVariant,
} from '@/types/game';
import { ORB_COLORS } from '@/types/game';
import {
  loadClothingSlots,
  getRandomProduct,
  getNextSlot,
} from './clothingSlots';
import type { SlotProduct } from './clothingSlots';

// ============================================================================
// Constants
// ============================================================================

const MAX_LIVES = 3;

/** Lane X positions in world units */
export const LANE_X: Record<RunnerLane, number> = { [-1]: -3, [0]: 0, [1]: 3 };

/** Lane width for collision */
const LANE_WIDTH = 2.5;

/** Initial speed (units per second) */
const BASE_SPEED = 12;

/** Speed increase per second */
const SPEED_ACCELERATION = 0.15;

/** Max speed */
const MAX_SPEED = 35;

/** Jump duration (seconds) */
const JUMP_DURATION = 0.6;

/** Jump peak height */
const JUMP_HEIGHT = 3.0;

/** Slide duration */
const SLIDE_DURATION = 0.5;

/** How far ahead to spawn objects */
const SPAWN_LOOKAHEAD = 80;

/** Min distance between obstacle groups */
const MIN_OBSTACLE_GAP = 8;

/** Max distance between obstacle groups */
const MAX_OBSTACLE_GAP = 16;

/** Points per meter traveled */
const DISTANCE_POINTS = 1;

/** Points per light orb */
const ORB_POINTS = 100;

/** Max combo multiplier */
const MAX_COMBO = 8;

/** Collision Y range (how close player must be to obstacle) */
const COLLISION_RANGE = 1.5;

/** How far behind player to clean up objects */
const CLEANUP_BEHIND = 10;

/** Light radius base */
const BASE_LIGHT_RADIUS = 15;

/** Light radius per catch bonus */
const LIGHT_PER_CATCH = 2;

/** Light radius max */
const MAX_LIGHT_RADIUS = 40;

/** Light radius decay per second */
const LIGHT_DECAY = 0.5;

/** Light radius lost on shadow hit */
const LIGHT_HIT_PENALTY = 8;

/** Hit flash duration */
const HIT_FLASH_DURATION = 0.3;

/** Orbs per obstacle gap (roughly) */
const ORBS_PER_SECTION = 3;

/** Shadow orb ratio (increases over time) */
const BASE_SHADOW_RATIO = 0.1;
const MAX_SHADOW_RATIO = 0.35;
const SHADOW_RATIO_GROWTH = 0.002;

// ============================================================================
// ID generator
// ============================================================================

let nextId = 0;
function genId(): number {
  return nextId++;
}

// ============================================================================
// Engine
// ============================================================================

export class StreetRunnerEngine {
  // --- Callbacks ---
  onStateChange: ((state: StreetRunnerState) => void) | null = null;
  onGameOver: ((score: number, totalCatches: number, durationSeconds: number) => void) | null = null;

  // --- State ---
  private playerY = 0;
  private playerLane: RunnerLane = 0;
  private targetLane: RunnerLane = 0;
  private playerJumpZ = 0;
  private isSliding = false;
  private speed = BASE_SPEED;
  private lives = MAX_LIVES;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private totalCatches = 0;
  private clothing: ClothingState = { top: null, bottom: null, layer: null, accessory: false };
  private lightRadius = BASE_LIGHT_RADIUS;
  private obstacles: RunnerObstacle[] = [];
  private orbs: RunnerOrb[] = [];
  private gameOver = false;
  private elapsed = 0;
  private running = false;

  // --- Internal ---
  private nextSpawnY = 20; // First spawn distance
  private jumpTimer = -1; // < 0 means not jumping
  private slideTimer = -1;
  private hitFlash = false;
  private hitFlashTimer = 0;
  private invincibleTimer = 0; // Brief invincibility after hit

  // --- Product pools ---
  private productPools: Awaited<ReturnType<typeof loadClothingSlots>> | null = null;
  public caughtProducts: SlotProduct[] = [];

  // ========================================================================
  // Public API
  // ========================================================================

  async start(): Promise<void> {
    nextId = 0;
    this.playerY = 0;
    this.playerLane = 0;
    this.targetLane = 0;
    this.playerJumpZ = 0;
    this.isSliding = false;
    this.speed = BASE_SPEED;
    this.lives = MAX_LIVES;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalCatches = 0;
    this.clothing = { top: null, bottom: null, layer: null, accessory: false };
    this.lightRadius = BASE_LIGHT_RADIUS;
    this.obstacles = [];
    this.orbs = [];
    this.gameOver = false;
    this.elapsed = 0;
    this.running = true;
    this.nextSpawnY = 20;
    this.jumpTimer = -1;
    this.slideTimer = -1;
    this.hitFlash = false;
    this.hitFlashTimer = 0;
    this.invincibleTimer = 0;
    this.caughtProducts = [];

    this.productPools = await loadClothingSlots();

    // Spawn initial content
    this.spawnAhead();
    this.emitState();
  }

  stop(): void {
    this.running = false;
  }

  /** Switch to a lane: -1 (left), 0 (center), 1 (right) */
  setLane(lane: RunnerLane): void {
    if (!this.running || this.gameOver) return;
    this.targetLane = lane;
  }

  /** Move one lane left */
  moveLeft(): void {
    if (this.targetLane > -1) {
      this.setLane((this.targetLane - 1) as RunnerLane);
    }
  }

  /** Move one lane right */
  moveRight(): void {
    if (this.targetLane < 1) {
      this.setLane((this.targetLane + 1) as RunnerLane);
    }
  }

  /** Jump */
  jump(): void {
    if (!this.running || this.gameOver) return;
    if (this.jumpTimer < 0 && this.playerJumpZ === 0) {
      this.jumpTimer = 0;
    }
  }

  /** Slide */
  slide(): void {
    if (!this.running || this.gameOver) return;
    if (this.slideTimer < 0 && this.playerJumpZ === 0) {
      this.slideTimer = 0;
      this.isSliding = true;
    }
  }

  /** Main tick — called every animation frame */
  tick(dt: number): void {
    if (!this.running || this.gameOver) return;

    const clampedDt = Math.min(dt, 0.1);
    this.elapsed += clampedDt;

    // --- Speed increase ---
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_ACCELERATION * this.elapsed);

    // --- Move forward ---
    this.playerY += this.speed * clampedDt;

    // --- Score from distance ---
    this.score += Math.round(this.speed * clampedDt * DISTANCE_POINTS);

    // --- Lane switching (instant snap for now) ---
    this.playerLane = this.targetLane;

    // --- Jump physics ---
    if (this.jumpTimer >= 0) {
      this.jumpTimer += clampedDt;
      const t = this.jumpTimer / JUMP_DURATION;
      if (t >= 1) {
        this.jumpTimer = -1;
        this.playerJumpZ = 0;
      } else {
        // Parabolic arc: 4h * t * (1-t)
        this.playerJumpZ = JUMP_HEIGHT * 4 * t * (1 - t);
      }
    }

    // --- Slide timer ---
    if (this.slideTimer >= 0) {
      this.slideTimer += clampedDt;
      if (this.slideTimer >= SLIDE_DURATION) {
        this.slideTimer = -1;
        this.isSliding = false;
      }
    }

    // --- Hit flash ---
    if (this.hitFlash) {
      this.hitFlashTimer -= clampedDt;
      if (this.hitFlashTimer <= 0) {
        this.hitFlash = false;
      }
    }

    // --- Invincibility ---
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= clampedDt;
    }

    // --- Spawn objects ahead ---
    this.spawnAhead();

    // --- Check collisions ---
    this.checkCollisions();

    // --- Light radius decay ---
    this.lightRadius = Math.max(
      BASE_LIGHT_RADIUS * 0.5,
      this.lightRadius - LIGHT_DECAY * clampedDt,
    );

    // --- Cleanup passed objects ---
    const behind = this.playerY - CLEANUP_BEHIND;
    this.obstacles = this.obstacles.filter(o => !o.consumed && o.y > behind);
    this.orbs = this.orbs.filter(o => !o.consumed && o.y > behind);

    this.emitState();
  }

  getState(): StreetRunnerState {
    return {
      playerY: this.playerY,
      playerLane: this.playerLane,
      targetLane: this.targetLane,
      playerJumpZ: this.playerJumpZ,
      isSliding: this.isSliding,
      speed: this.speed,
      lives: this.lives,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      clothing: this.clothing,
      lightRadius: this.lightRadius,
      obstacles: this.obstacles,
      orbs: this.orbs,
      gameOver: this.gameOver,
      elapsed: this.elapsed,
      totalCatches: this.totalCatches,
      hitFlash: this.hitFlash,
    };
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private spawnAhead(): void {
    const spawnUntil = this.playerY + SPAWN_LOOKAHEAD;

    while (this.nextSpawnY < spawnUntil) {
      // Spawn an obstacle group
      this.spawnObstacleGroup(this.nextSpawnY);

      // Spawn orbs between this and next obstacle
      this.spawnOrbs(this.nextSpawnY - MIN_OBSTACLE_GAP * 0.5, this.nextSpawnY);

      // Advance to next spawn point
      const gap = MIN_OBSTACLE_GAP + Math.random() * (MAX_OBSTACLE_GAP - MIN_OBSTACLE_GAP);
      this.nextSpawnY += gap;
    }
  }

  private spawnObstacleGroup(y: number): void {
    const types: ObstacleType[] = ['barrier', 'car', 'shadow_pool', 'shadow_pillar', 'fallen_pole', 'scaffolding'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Block 1-2 lanes, always leave at least 1 open
    const lanes: RunnerLane[] = [-1, 0, 1];
    const numBlocked = Math.random() > 0.6 ? 2 : 1;
    const shuffled = lanes.sort(() => Math.random() - 0.5);
    const blocked = shuffled.slice(0, numBlocked);

    for (const lane of blocked) {
      this.obstacles.push({
        id: genId(),
        type,
        lane,
        y,
        consumed: false,
      });
    }
  }

  private spawnOrbs(yStart: number, yEnd: number): void {
    const shadowRatio = Math.min(
      MAX_SHADOW_RATIO,
      BASE_SHADOW_RATIO + SHADOW_RATIO_GROWTH * this.elapsed,
    );

    const lanes: RunnerLane[] = [-1, 0, 1];

    for (let i = 0; i < ORBS_PER_SECTION; i++) {
      const orbY = yStart + (yEnd - yStart) * ((i + 0.5) / ORBS_PER_SECTION);
      const lane = lanes[Math.floor(Math.random() * 3)];

      const isShadow = Math.random() < shadowRatio;

      if (isShadow) {
        this.orbs.push({
          id: genId(),
          kind: 'shadow',
          slot: null,
          lane,
          y: orbY,
          color: ORB_COLORS.shadow,
          productHandle: null,
          consumed: false,
        });
      } else {
        // Light or clothing orb
        const isClothing = Math.random() < 0.15; // 15% chance of clothing orb
        const slots: ClothingSlot[] = ['top', 'bottom', 'layer'];
        const slot = isClothing ? slots[Math.floor(Math.random() * 3)] : null;
        const color = slot ? ORB_COLORS[slot] : ORB_COLORS.top;

        let productHandle: string | null = null;
        if (slot && this.productPools) {
          const result = getRandomProduct(this.productPools, slot);
          if (result) productHandle = result.product.handle;
        }

        this.orbs.push({
          id: genId(),
          kind: isClothing ? 'clothing' : 'light',
          slot,
          lane,
          y: orbY,
          color,
          productHandle,
          consumed: false,
        });
      }
    }
  }

  private checkCollisions(): void {
    const py = this.playerY;
    const lane = this.playerLane;
    const jumping = this.playerJumpZ > 1.5; // High enough to clear ground obstacles
    const sliding = this.isSliding;

    // --- Obstacle collisions ---
    if (this.invincibleTimer <= 0) {
      for (const obs of this.obstacles) {
        if (obs.consumed) continue;
        if (obs.lane !== lane) continue;
        if (Math.abs(obs.y - py) > COLLISION_RANGE) continue;

        // Jump clears barriers, cars, scaffolding
        if (jumping && (obs.type === 'barrier' || obs.type === 'car' || obs.type === 'scaffolding')) {
          continue;
        }

        // Slide clears fallen poles and scaffolding
        if (sliding && (obs.type === 'fallen_pole' || obs.type === 'scaffolding')) {
          continue;
        }

        // Shadow pools can't be jumped (they're on the ground, you run through them)
        // Shadow pillars can't be dodged vertically

        // HIT!
        obs.consumed = true;
        this.onObstacleHit();
        break;
      }
    }

    // --- Orb collisions ---
    for (const orb of this.orbs) {
      if (orb.consumed) continue;
      if (orb.lane !== lane) continue;
      if (Math.abs(orb.y - py) > COLLISION_RANGE) continue;

      orb.consumed = true;

      if (orb.kind === 'shadow') {
        this.onShadowOrb();
      } else {
        this.onLightOrb(orb);
      }
    }
  }

  private onLightOrb(orb: RunnerOrb): void {
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const multiplier = Math.min(this.combo, MAX_COMBO);
    this.score += ORB_POINTS * multiplier;
    this.totalCatches++;

    // Grow light radius
    this.lightRadius = Math.min(MAX_LIGHT_RADIUS, this.lightRadius + LIGHT_PER_CATCH);

    // Fill clothing slot if clothing orb
    if (orb.kind === 'clothing' && orb.slot) {
      this.fillClothingSlot(orb);
    }
  }

  private onShadowOrb(): void {
    if (this.invincibleTimer > 0) return;

    this.lives--;
    this.combo = 0;
    this.lightRadius = Math.max(BASE_LIGHT_RADIUS * 0.3, this.lightRadius - LIGHT_HIT_PENALTY);
    this.hitFlash = true;
    this.hitFlashTimer = HIT_FLASH_DURATION;
    this.invincibleTimer = 1.0;

    if (this.lives <= 0) {
      this.gameOver = true;
      this.running = false;
      this.onGameOver?.(this.score, this.totalCatches, Math.round(this.elapsed));
    }
  }

  private onObstacleHit(): void {
    if (this.invincibleTimer > 0) return;

    this.lives--;
    this.combo = 0;
    this.lightRadius = Math.max(BASE_LIGHT_RADIUS * 0.3, this.lightRadius - LIGHT_HIT_PENALTY);
    this.hitFlash = true;
    this.hitFlashTimer = HIT_FLASH_DURATION;
    this.invincibleTimer = 1.5; // Longer invincibility after obstacle

    if (this.lives <= 0) {
      this.gameOver = true;
      this.running = false;
      this.onGameOver?.(this.score, this.totalCatches, Math.round(this.elapsed));
    }
  }

  private fillClothingSlot(orb: RunnerOrb): void {
    const nextSlot = getNextSlot(this.clothing);
    if (!nextSlot) return;

    if (nextSlot === 'accessory') {
      this.clothing.accessory = true;
      return;
    }

    if (nextSlot === 'top') {
      let variant: TopVariant = 'tee';
      if (this.productPools && orb.productHandle) {
        for (const item of this.productPools.top) {
          if (item.product.handle === orb.productHandle) {
            variant = item.variant;
            break;
          }
        }
      }
      this.clothing.top = { variant, color: orb.color, productHandle: orb.productHandle };
    } else if (nextSlot === 'bottom') {
      this.clothing.bottom = { color: ORB_COLORS.bottom, productHandle: orb.productHandle };
    } else if (nextSlot === 'layer') {
      this.clothing.layer = { color: ORB_COLORS.layer, productHandle: orb.productHandle };
    }

    // Track caught product
    if (orb.productHandle && this.productPools) {
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

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }
}
