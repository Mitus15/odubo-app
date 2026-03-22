'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';

// ============================================================================
// Aurora — The Expanse
// The sky that separates the waters above from the waters below.
// Warm brand tones. Breathing. Reactive to sound.
// ============================================================================

const AURORA_BANDS = [
  { baseY: 0.12, color: [237, 232, 223] as [number, number, number], idleOpacity: 0.06, loudOpacity: 0.18, speed: 0.18, wavelength: 0.7, amplitude: 28 },
  { baseY: 0.28, color: [196, 120,  90] as [number, number, number], idleOpacity: 0.08, loudOpacity: 0.22, speed: 0.11, wavelength: 0.5, amplitude: 38 },
  { baseY: 0.44, color: [132,  60,  45] as [number, number, number], idleOpacity: 0.05, loudOpacity: 0.15, speed: 0.22, wavelength: 0.9, amplitude: 22 },
  { baseY: 0.60, color: [237, 232, 223] as [number, number, number], idleOpacity: 0.04, loudOpacity: 0.12, speed: 0.14, wavelength: 0.6, amplitude: 18 },
];

function drawAurora(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  frequencyData: Uint8Array,
) {
  // Bass energy: average of lowest 8 bins (roughly 0–170Hz)
  let bassSum = 0;
  const bassBins = Math.min(8, frequencyData.length);
  for (let i = 0; i < bassBins; i++) bassSum += frequencyData[i];
  const bassEnergy = bassBins > 0 ? bassSum / bassBins / 255 : 0; // 0–1

  ctx.save();
  ctx.filter = 'blur(22px)';

  for (const band of AURORA_BANDS) {
    const [r, g, b] = band.color;
    const opacity = band.idleOpacity + (band.loudOpacity - band.idleOpacity) * bassEnergy;
    const amplitude = band.amplitude * (1 + bassEnergy * 1.4);
    const centerY = band.baseY * h;

    ctx.beginPath();

    // Build a smooth wave across the full width using bezier curves
    const segments = 6;
    const segW = w / segments;

    const yAt = (x: number) =>
      centerY +
      Math.sin(x / (band.wavelength * w) * Math.PI * 2 + time * band.speed) * amplitude +
      Math.sin(x / (band.wavelength * w * 0.6) * Math.PI * 2 - time * band.speed * 0.7) * amplitude * 0.4;

    ctx.moveTo(0, yAt(0));
    for (let i = 0; i < segments; i++) {
      const x0 = i * segW;
      const x1 = (i + 1) * segW;
      const cx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0 + segW * 0.25, yAt(x0 + segW * 0.25), cx, yAt(cx));
      ctx.quadraticCurveTo(x1 - segW * 0.25, yAt(x1 - segW * 0.25), x1, yAt(x1));
    }

    // Stroke the band as a thick glowing line
    ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
    ctx.lineWidth = 60 + bassEnergy * 40;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.filter = 'none';
  ctx.restore();
}

// ============================================================================
// World geometry constants
// ============================================================================

/** Horizon sits at 36% from top — sky above, earth below */
const HORIZON_Y = 0.36;

/** Path width at the bottom edge (fraction of canvas width) */
const PATH_WIDTH_BOTTOM = 0.72;

/** Path width at the horizon (fraction of canvas width) — perspective pinch */
const PATH_WIDTH_HORIZON = 0.06;

// ============================================================================
// Land & Sea
// ============================================================================

function drawWorld(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
) {
  const horizonY = h * HORIZON_Y;
  const vpX = w / 2; // vanishing point X — center

  // Path edges at bottom
  const pathHalfBottom = (w * PATH_WIDTH_BOTTOM) / 2;
  const pathLeftBottom  = vpX - pathHalfBottom;
  const pathRightBottom = vpX + pathHalfBottom;

  // Path edges at horizon
  const pathHalfHorizon = (w * PATH_WIDTH_HORIZON) / 2;
  const pathLeftHorizon  = vpX - pathHalfHorizon;
  const pathRightHorizon = vpX + pathHalfHorizon;

  // --- Sea: fills the full width between horizon and bottom, outside the path ---
  // Left sea
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(pathLeftHorizon, horizonY);
  ctx.lineTo(pathLeftBottom, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const seaGradL = ctx.createLinearGradient(0, horizonY, 0, h);
  seaGradL.addColorStop(0, 'rgba(8, 14, 28, 0.95)');
  seaGradL.addColorStop(1, 'rgba(4,  8, 18, 1)');
  ctx.fillStyle = seaGradL;
  ctx.fill();

  // Right sea
  ctx.beginPath();
  ctx.moveTo(w, horizonY);
  ctx.lineTo(pathRightHorizon, horizonY);
  ctx.lineTo(pathRightBottom, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  const seaGradR = ctx.createLinearGradient(0, horizonY, 0, h);
  seaGradR.addColorStop(0, 'rgba(8, 14, 28, 0.95)');
  seaGradR.addColorStop(1, 'rgba(4,  8, 18, 1)');
  ctx.fillStyle = seaGradR;
  ctx.fill();

  // Sea shimmer — subtle moving highlight lines
  drawSeaShimmer(ctx, w, h, horizonY, pathLeftBottom, pathRightBottom, pathLeftHorizon, pathRightHorizon, time);

  // --- Land: the path itself, warm earth tones ---
  ctx.beginPath();
  ctx.moveTo(pathLeftHorizon, horizonY);
  ctx.lineTo(pathRightHorizon, horizonY);
  ctx.lineTo(pathRightBottom, h);
  ctx.lineTo(pathLeftBottom, h);
  ctx.closePath();

  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0,   'rgba(30, 18, 12, 1)');   // Dark at horizon
  groundGrad.addColorStop(0.4, 'rgba(58, 32, 18, 1)');   // Terracotta mid
  groundGrad.addColorStop(1,   'rgba(42, 24, 14, 1)');   // Deep earth at bottom
  ctx.fillStyle = groundGrad;
  ctx.fill();

  // --- Lane dividers: 2 lines splitting path into 3, converging to vanishing point ---
  const laneOpacity = 0.18;
  ctx.strokeStyle = `rgba(196, 120, 90, ${laneOpacity})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([12, 24]);

  for (const t of [1/3, 2/3]) {
    const xBottom = pathLeftBottom + t * PATH_WIDTH_BOTTOM * w;
    const xHorizon = pathLeftHorizon + t * PATH_WIDTH_HORIZON * w;
    ctx.beginPath();
    ctx.moveTo(xHorizon, horizonY);
    ctx.lineTo(xBottom, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- Path edges (solid) ---
  ctx.strokeStyle = `rgba(196, 120, 90, 0.35)`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(pathLeftHorizon, horizonY);
  ctx.lineTo(pathLeftBottom, h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pathRightHorizon, horizonY);
  ctx.lineTo(pathRightBottom, h);
  ctx.stroke();

  // --- Horizon glow — where sky meets earth ---
  const horizonGlow = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 40);
  horizonGlow.addColorStop(0,   'rgba(196, 120, 90, 0)');
  horizonGlow.addColorStop(0.5, 'rgba(132,  60, 45, 0.18)');
  horizonGlow.addColorStop(1,   'rgba(196, 120, 90, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, horizonY - 40, w, 80);
}

function drawSeaShimmer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  horizonY: number,
  pathLeftBottom: number,
  pathRightBottom: number,
  pathLeftHorizon: number,
  pathRightHorizon: number,
  time: number,
) {
  // 5 shimmering horizontal lines on each side, scrolling slowly
  const lineCount = 5;
  ctx.save();

  for (let i = 0; i < lineCount; i++) {
    const progress = ((i / lineCount + time * 0.04) % 1);
    const y = horizonY + progress * (h - horizonY);
    const opacity = 0.04 * Math.sin(progress * Math.PI); // fade in/out

    // Left sea shimmer
    ctx.strokeStyle = `rgba(100, 130, 180, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(pathLeftHorizon + (pathLeftBottom - pathLeftHorizon) * progress, y);
    ctx.stroke();

    // Right sea shimmer
    ctx.beginPath();
    ctx.moveTo(w, y);
    ctx.lineTo(pathRightHorizon + (pathRightBottom - pathRightHorizon) * progress, y);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// Page
// ============================================================================

export default function CatchingLightPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const { getFrequencyData } = useAudioAnalyser();

  // Resize canvas DPR-aware
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Render loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const time = (performance.now() - startTimeRef.current) / 1000;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Void — the deep
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Land & sea — earth below the expanse
      drawWorld(ctx, w, h, time);

      // The expanse — sky above
      const freqData = getFrequencyData();
      drawAurora(ctx, w, h, time, freqData);

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [getFrequencyData]);

  return (
    <div ref={containerRef} className="fixed inset-0">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
