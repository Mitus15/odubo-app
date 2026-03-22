// ============================================================================
// StickFigure.ts — Canvas drawing for the Catching Light character
//
// Fashion croquis proportions (8-head tall, elongated legs).
// Clothing rendered as colored overlays on the stick body.
// Glow aura intensity driven by combo multiplier.
// ============================================================================

import type { ClothingState } from '@/types/game';

/** Total character height in design units (scaled at render time) */
const FIGURE_HEIGHT = 200;

/** Body anchor points relative to feet position (0,0) — Y goes up */
const BODY = {
  head:        { y: -185, radius: 12 },
  neck:        { y: -170 },
  shoulderL:   { x: -16, y: -162 },
  shoulderR:   { x: 16,  y: -162 },
  torsoBottom: { y: -100 },
  waist:       { y: -95 },
  hipL:        { x: -10, y: -90 },
  hipR:        { x: 10,  y: -90 },
  kneeL:       { x: -12, y: -48 },
  kneeR:       { x: 12,  y: -48 },
  ankleL:      { x: -10, y: 0 },
  ankleR:      { x: 10,  y: 0 },
  elbowL:      { x: -26, y: -135 },
  elbowR:      { x: 26,  y: -135 },
  handL:       { x: -22, y: -108 },
  handR:       { x: 22,  y: -108 },
} as const;

/** Line width for the stick body */
const LINE_WIDTH = 2;

/** Body color — cream */
const BODY_COLOR = '#ede8df';

/**
 * Draw the full stick figure with clothing and glow.
 *
 * @param ctx        Canvas 2D context
 * @param centerX    Center X position on canvas
 * @param feetY      Y position of the character's feet on canvas
 * @param scale      Scale factor (1 = design size)
 * @param clothing   Current clothing state
 * @param glowIntensity  0-1 for combo aura brightness
 */
export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  scale: number,
  clothing: ClothingState,
  glowIntensity: number,
): void {
  ctx.save();
  ctx.translate(centerX, feetY);
  ctx.scale(scale, scale);

  // --- Glow aura (behind everything) ---
  if (glowIntensity > 0) {
    drawGlowAura(ctx, glowIntensity);
  }

  // --- Clothing: bottom (pants) — drawn first, behind legs ---
  if (clothing.bottom) {
    drawPants(ctx, clothing.bottom.color);
  }

  // --- Stick body ---
  drawBody(ctx);

  // --- Clothing: top (tee or hoodie) — over torso ---
  if (clothing.top) {
    if (clothing.top.variant === 'hoodie') {
      drawHoodie(ctx, clothing.top.color);
    } else {
      drawTee(ctx, clothing.top.color);
    }
  }

  // --- Clothing: layer (vest/jacket) — semi-transparent over top ---
  if (clothing.layer) {
    drawVest(ctx, clothing.layer.color);
  }

  // --- Head (always on top) ---
  drawHead(ctx);

  // --- Accessory glow ring ---
  if (clothing.accessory) {
    drawAccessoryGlow(ctx);
  }

  ctx.restore();
}

/**
 * Get the total height of the figure at a given scale.
 */
export function getFigureHeight(scale: number): number {
  return FIGURE_HEIGHT * scale;
}

// ============================================================================
// Internal drawing functions
// ============================================================================

function drawBody(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = BODY_COLOR;
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Spine: neck to waist
  ctx.beginPath();
  ctx.moveTo(0, BODY.neck.y);
  ctx.lineTo(0, BODY.torsoBottom.y);
  ctx.stroke();

  // Shoulders
  ctx.beginPath();
  ctx.moveTo(BODY.shoulderL.x, BODY.shoulderL.y);
  ctx.lineTo(BODY.shoulderR.x, BODY.shoulderR.y);
  ctx.stroke();

  // Left arm: shoulder → elbow → hand
  ctx.beginPath();
  ctx.moveTo(BODY.shoulderL.x, BODY.shoulderL.y);
  ctx.lineTo(BODY.elbowL.x, BODY.elbowL.y);
  ctx.lineTo(BODY.handL.x, BODY.handL.y);
  ctx.stroke();

  // Right arm: shoulder → elbow → hand
  ctx.beginPath();
  ctx.moveTo(BODY.shoulderR.x, BODY.shoulderR.y);
  ctx.lineTo(BODY.elbowR.x, BODY.elbowR.y);
  ctx.lineTo(BODY.handR.x, BODY.handR.y);
  ctx.stroke();

  // Hips
  ctx.beginPath();
  ctx.moveTo(BODY.hipL.x, BODY.hipL.y);
  ctx.lineTo(BODY.hipR.x, BODY.hipR.y);
  ctx.stroke();

  // Left leg: hip → knee → ankle
  ctx.beginPath();
  ctx.moveTo(BODY.hipL.x, BODY.hipL.y);
  ctx.lineTo(BODY.kneeL.x, BODY.kneeL.y);
  ctx.lineTo(BODY.ankleL.x, BODY.ankleL.y);
  ctx.stroke();

  // Right leg: hip → knee → ankle
  ctx.beginPath();
  ctx.moveTo(BODY.hipR.x, BODY.hipR.y);
  ctx.lineTo(BODY.kneeR.x, BODY.kneeR.y);
  ctx.lineTo(BODY.ankleR.x, BODY.ankleR.y);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = BODY_COLOR;
  ctx.lineWidth = LINE_WIDTH;
  ctx.fillStyle = 'transparent';
  ctx.beginPath();
  ctx.arc(0, BODY.head.y, BODY.head.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTee(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;

  // Torso rectangle — slightly wider than shoulders
  const left = BODY.shoulderL.x - 4;
  const right = BODY.shoulderR.x + 4;
  const top = BODY.shoulderL.y + 2;
  const bottom = BODY.torsoBottom.y;

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();

  // Short sleeves
  const sleeveLen = 8;
  const sleeveWidth = 10;

  // Left sleeve
  ctx.beginPath();
  ctx.moveTo(BODY.shoulderL.x, top);
  ctx.lineTo(BODY.shoulderL.x - sleeveLen, top + sleeveWidth);
  ctx.lineTo(BODY.shoulderL.x, top + sleeveWidth * 2);
  ctx.closePath();
  ctx.fill();

  // Right sleeve
  ctx.beginPath();
  ctx.moveTo(BODY.shoulderR.x, top);
  ctx.lineTo(BODY.shoulderR.x + sleeveLen, top + sleeveWidth);
  ctx.lineTo(BODY.shoulderR.x, top + sleeveWidth * 2);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawHoodie(ctx: CanvasRenderingContext2D, color: string): void {
  // Draw the base tee shape first
  drawTee(ctx, color);

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;

  // Hood — arc behind the head
  const hoodRadius = BODY.head.radius + 6;
  ctx.beginPath();
  ctx.arc(0, BODY.head.y, hoodRadius, Math.PI * 0.85, Math.PI * 0.15, true);
  ctx.lineTo(BODY.shoulderR.x + 2, BODY.shoulderL.y);
  ctx.lineTo(BODY.shoulderL.x - 2, BODY.shoulderL.y);
  ctx.closePath();
  ctx.fill();

  // Hood outline
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(0, BODY.head.y, hoodRadius, Math.PI * 0.85, Math.PI * 0.15, true);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawPants(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;

  const legWidth = 7;

  // Left leg fill: hip → knee → ankle
  ctx.beginPath();
  ctx.moveTo(BODY.hipL.x - legWidth, BODY.hipL.y);
  ctx.lineTo(BODY.kneeL.x - legWidth, BODY.kneeL.y);
  ctx.lineTo(BODY.ankleL.x - legWidth, BODY.ankleL.y);
  ctx.lineTo(BODY.ankleL.x + legWidth, BODY.ankleL.y);
  ctx.lineTo(BODY.kneeL.x + legWidth, BODY.kneeL.y);
  ctx.lineTo(BODY.hipL.x + legWidth, BODY.hipL.y);
  ctx.closePath();
  ctx.fill();

  // Right leg fill: hip → knee → ankle
  ctx.beginPath();
  ctx.moveTo(BODY.hipR.x - legWidth, BODY.hipR.y);
  ctx.lineTo(BODY.kneeR.x - legWidth, BODY.kneeR.y);
  ctx.lineTo(BODY.ankleR.x - legWidth, BODY.ankleR.y);
  ctx.lineTo(BODY.ankleR.x + legWidth, BODY.ankleR.y);
  ctx.lineTo(BODY.kneeR.x + legWidth, BODY.kneeR.y);
  ctx.lineTo(BODY.hipR.x + legWidth, BODY.hipR.y);
  ctx.closePath();
  ctx.fill();

  // Waistband connecting the two legs
  ctx.beginPath();
  ctx.moveTo(BODY.hipL.x - legWidth, BODY.hipL.y);
  ctx.lineTo(BODY.hipR.x + legWidth, BODY.hipR.y);
  ctx.lineTo(BODY.hipR.x + legWidth, BODY.hipR.y + 6);
  ctx.lineTo(BODY.hipL.x - legWidth, BODY.hipL.y + 6);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawVest(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55; // Semi-transparent layer

  // Slightly wider than tee to show layering
  const left = BODY.shoulderL.x - 7;
  const right = BODY.shoulderR.x + 7;
  const top = BODY.shoulderL.y;
  const bottom = BODY.torsoBottom.y + 5;

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();

  // V-neck opening
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(-6, top);
  ctx.lineTo(0, top + 18);
  ctx.lineTo(6, top);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.globalAlpha = 1;
}

function drawGlowAura(ctx: CanvasRenderingContext2D, intensity: number): void {
  const centerY = -FIGURE_HEIGHT / 2;
  const radius = FIGURE_HEIGHT * 0.6;

  const gradient = ctx.createRadialGradient(0, centerY, 0, 0, centerY, radius);
  gradient.addColorStop(0, `rgba(196, 120, 90, ${0.25 * intensity})`); // Copper core
  gradient.addColorStop(0.4, `rgba(132, 60, 45, ${0.12 * intensity})`); // Terracotta mid
  gradient.addColorStop(1, 'rgba(132, 60, 45, 0)'); // Fade out

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawAccessoryGlow(ctx: CanvasRenderingContext2D): void {
  const centerY = -FIGURE_HEIGHT / 2;
  const radius = FIGURE_HEIGHT * 0.45;

  // Pulsing ring effect
  ctx.strokeStyle = 'rgba(237, 232, 223, 0.15)'; // Cream, very subtle
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = 'rgba(196, 120, 90, 0.1)'; // Copper, even subtler
  ctx.beginPath();
  ctx.arc(0, centerY, radius * 0.8, 0, Math.PI * 2);
  ctx.stroke();
}
