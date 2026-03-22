// ============================================================================
// LightOrb.ts — Orb spawning, collision, and particle effects
//
// Orbs exist in world-space (Y increases upward). The engine spawns them
// ahead of the camera and checks collisions as the character rises through.
// Light orbs dress the character; shadow orbs steal lives.
// ============================================================================

import type { Orb, OrbKind, Particle, ClothingSlot } from '@/types/game';
import { ORB_COLORS } from '@/types/game';

let nextOrbId = 0;

/** Reset the ID counter (call on new game) */
export function resetOrbIds(): void {
  nextOrbId = 0;
}

// ============================================================================
// Orb Spawning
// ============================================================================

/** Configuration for orb generation */
export interface SpawnConfig {
  /** World-space Y range to spawn orbs in (bottom, top) */
  yMin: number;
  yMax: number;
  /** Fraction of orbs that are shadows (0-1, increases over time) */
  shadowRatio: number;
  /** How many orbs to spawn in this batch */
  count: number;
  /** Canvas width in world units for X placement */
  worldWidth: number;
}

/**
 * Generate a batch of orbs spread across a vertical band.
 * Light orbs are assigned a random clothing slot.
 */
export function spawnOrbBatch(config: SpawnConfig): Orb[] {
  const { yMin, yMax, shadowRatio, count, worldWidth } = config;
  const orbs: Orb[] = [];
  const padding = 0.08; // Keep orbs away from screen edges

  for (let i = 0; i < count; i++) {
    const isShadow = Math.random() < shadowRatio;
    const kind: OrbKind = isShadow ? 'shadow' : 'light';

    // Random clothing slot for light orbs (weighted toward unfilled)
    const slot: ClothingSlot | null = isShadow
      ? null
      : pickRandomSlot();

    const color = isShadow
      ? ORB_COLORS.shadow
      : slot
        ? ORB_COLORS[slot]
        : ORB_COLORS.top;

    orbs.push({
      id: nextOrbId++,
      kind,
      slot,
      x: padding + Math.random() * (1 - 2 * padding),
      y: yMin + Math.random() * (yMax - yMin),
      radius: isShadow ? 10 : 12,
      color,
      productHandle: null, // Filled by engine from clothingSlots
      consumed: false,
    });
  }

  return orbs;
}

/** Pick a random clothing slot with equal probability */
function pickRandomSlot(): ClothingSlot {
  const slots: ClothingSlot[] = ['top', 'bottom', 'layer'];
  return slots[Math.floor(Math.random() * slots.length)];
}

// ============================================================================
// Collision Detection
// ============================================================================

/** Hitbox size for the character (normalized coordinates) */
const CHARACTER_HITBOX = {
  halfWidth: 0.06,
  halfHeight: 0.04,
};

/**
 * Check if the character overlaps with an orb.
 *
 * @param charX  Character X (0-1 normalized)
 * @param charY  Character Y in world-space
 * @param orb    The orb to test
 * @param worldHeight  Visible world height (for normalizing radius)
 * @returns true if colliding
 */
export function checkCollision(
  charX: number,
  charY: number,
  orb: Orb,
  worldHeight: number,
): boolean {
  if (orb.consumed) return false;

  const dx = Math.abs(charX - orb.x);
  const dy = Math.abs(charY - orb.y);

  // Orb radius in normalized units
  const orbRadiusNorm = orb.radius / worldHeight;

  return (
    dx < CHARACTER_HITBOX.halfWidth + orbRadiusNorm &&
    dy < CHARACTER_HITBOX.halfHeight + orbRadiusNorm
  );
}

// ============================================================================
// Particle Effects
// ============================================================================

/** Number of particles per burst */
const CATCH_PARTICLE_COUNT = 12;
const SHATTER_PARTICLE_COUNT = 6;

/**
 * Generate a burst of particles when a light orb is caught.
 * Warm, outward-radiating particles.
 */
export function createCatchBurst(orbX: number, orbY: number, color: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < CATCH_PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / CATCH_PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
    const speed = 0.02 + Math.random() * 0.03;
    particles.push({
      x: orbX,
      y: orbY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1,
      maxLife: 1,
      radius: 2 + Math.random() * 2,
    });
  }
  return particles;
}

/**
 * Generate shatter particles when a shadow orb is hit.
 * Dark, angular fragments.
 */
export function createShadowHitBurst(orbX: number, orbY: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < SHATTER_PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / SHATTER_PARTICLE_COUNT + (Math.random() - 0.5) * 0.8;
    const speed = 0.015 + Math.random() * 0.02;
    particles.push({
      x: orbX,
      y: orbY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: ORB_COLORS.shadow,
      life: 1,
      maxLife: 1,
      radius: 1.5 + Math.random() * 1.5,
    });
  }
  return particles;
}

/**
 * Update particle positions and decay their life.
 * Returns only particles that are still alive.
 */
export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const decayRate = 1.5; // life units per second
  const alive: Particle[] = [];

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= decayRate * dt;
    if (p.life > 0) {
      alive.push(p);
    }
  }

  return alive;
}
