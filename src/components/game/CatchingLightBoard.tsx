'use client';

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { CatchingLightEngine } from './CatchingLightEngine';
import { drawStickFigure, getFigureHeight } from './StickFigure';
import { ORB_COLORS } from '@/types/game';
import type { CatchingLightState } from '@/types/game';

// ============================================================================
// Types
// ============================================================================

export interface CatchingLightBoardHandle {
  start: () => Promise<void>;
  stop: () => void;
}

interface CatchingLightBoardProps {
  onGameOver: (score: number, totalCatches: number, durationSeconds: number) => void;
  onStateChange: (state: CatchingLightState) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Dark gradient background stops */
const BG_TOP = '#0a0a0f';
const BG_BOTTOM = '#14101a';

/** How tall the visible world band is (normalized) */
const WORLD_VIEW_HEIGHT = 1.0;

/** Character sits at 40% from the bottom of the view (matches engine) */
const CHAR_VIEW_Y = 0.6; // 1 - 0.4 = 0.6 from top

/** Scale of the stick figure relative to canvas height */
const FIGURE_SCALE_FACTOR = 0.0028;

/** Orb glow radius multiplier */
const ORB_GLOW_MULT = 2.5;

// ============================================================================
// Component
// ============================================================================

const CatchingLightBoard = forwardRef<CatchingLightBoardHandle, CatchingLightBoardProps>(
  function CatchingLightBoard({ onGameOver, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CatchingLightEngine | null>(null);
    const stateRef = useRef<CatchingLightState | null>(null);
    const animFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const touchXRef = useRef<number | null>(null);

    // ======================================================================
    // Engine setup
    // ======================================================================

    useEffect(() => {
      const engine = new CatchingLightEngine();
      engineRef.current = engine;

      engine.onStateChange = (s) => {
        stateRef.current = s;
        onStateChange(s);
      };
      engine.onGameOver = (score, catches, duration) => {
        onGameOver(score, catches, duration);
      };

      return () => {
        engine.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ======================================================================
    // Expose engine controls via ref
    // ======================================================================

    useImperativeHandle(ref, () => ({
      start: async () => {
        const engine = engineRef.current;
        if (!engine) return;
        await engine.start();
        lastTimeRef.current = performance.now();
        startLoop();
      },
      stop: () => {
        engineRef.current?.stop();
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
      },
    }));

    // ======================================================================
    // Canvas sizing (DPR-aware)
    // ======================================================================

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

    // ======================================================================
    // Rendering
    // ======================================================================

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const state = stateRef.current;
      if (!canvas || !ctx || !state) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // --- Background gradient ---
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, BG_TOP);
      bgGrad.addColorStop(1, BG_BOTTOM);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // --- Subtle star field (static dots based on cameraY) ---
      drawStars(ctx, w, h, state.cameraY);

      // --- World-to-screen helpers ---
      const worldToScreenX = (wx: number) => wx * w;
      const worldToScreenY = (wy: number) => {
        // wy is world-space (Y up). Camera shows [cameraY, cameraY + WORLD_VIEW_HEIGHT].
        // Screen Y is inverted (Y down).
        const relY = (wy - state.cameraY) / WORLD_VIEW_HEIGHT;
        return h * (1 - relY);
      };

      // --- Draw orbs ---
      for (const orb of state.orbs) {
        if (orb.consumed) continue;
        const sx = worldToScreenX(orb.x);
        const sy = worldToScreenY(orb.y);

        // Skip if off-screen
        if (sy < -30 || sy > h + 30) continue;

        // Glow
        const glowRadius = orb.radius * ORB_GLOW_MULT;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
        if (orb.kind === 'light') {
          glow.addColorStop(0, orb.color + '60');
          glow.addColorStop(1, orb.color + '00');
        } else {
          glow.addColorStop(0, ORB_COLORS.shadow + '40');
          glow.addColorStop(1, ORB_COLORS.shadow + '00');
        }
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core circle
        ctx.fillStyle = orb.color;
        ctx.globalAlpha = orb.kind === 'shadow' ? 0.7 : 0.9;
        ctx.beginPath();
        ctx.arc(sx, sy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // --- Draw particles ---
      for (const p of state.particles) {
        const sx = worldToScreenX(p.x);
        const sy = worldToScreenY(p.y);
        if (sy < -20 || sy > h + 20) continue;

        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- Draw stick figure ---
      const charScreenX = worldToScreenX(state.characterX);
      const charScreenY = h * CHAR_VIEW_Y;
      const figScale = h * FIGURE_SCALE_FACTOR;
      const figHeight = getFigureHeight(figScale);

      // Feet position = charScreenY, figure draws upward from there
      drawStickFigure(
        ctx,
        charScreenX,
        charScreenY,
        figScale,
        state.clothing,
        state.glowIntensity,
      );

      // --- Draw ground shadow under character ---
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(charScreenX, charScreenY + 2, 14 * figScale, 3 * figScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }, []);

    // ======================================================================
    // Game loop
    // ======================================================================

    const startLoop = useCallback(() => {
      const loop = (time: number) => {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = time;

        engineRef.current?.tick(dt);
        render();

        if (engineRef.current && stateRef.current && !stateRef.current.gameOver) {
          animFrameRef.current = requestAnimationFrame(loop);
        } else {
          // One final render for game-over state
          render();
        }
      };
      animFrameRef.current = requestAnimationFrame(loop);
    }, [render]);

    // ======================================================================
    // Touch input
    // ======================================================================

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchXRef.current = touch.clientX;
        const normX = (touch.clientX - rect.left) / rect.width;
        engineRef.current?.setTargetX(normX);
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchXRef.current = touch.clientX;
        const normX = (touch.clientX - rect.left) / rect.width;
        engineRef.current?.setTargetX(normX);
      };

      const onTouchEnd = () => {
        touchXRef.current = null;
      };

      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);

      return () => {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
      };
    }, []);

    // ======================================================================
    // Keyboard input
    // ======================================================================

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          engineRef.current?.setMoveDirection(-1);
        } else if (e.key === 'ArrowRight') {
          engineRef.current?.setMoveDirection(1);
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          engineRef.current?.setMoveDirection(0);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, []);

    // ======================================================================
    // Mouse input (desktop drag)
    // ======================================================================

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let dragging = false;

      const onMouseDown = (e: MouseEvent) => {
        dragging = true;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        engineRef.current?.setTargetX(normX);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        engineRef.current?.setTargetX(normX);
      };

      const onMouseUp = () => {
        dragging = false;
      };

      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>
    );
  },
);

export default CatchingLightBoard;

// ============================================================================
// Helper: subtle star field
// ============================================================================

function drawStars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cameraY: number,
) {
  // Deterministic stars based on a seed derived from camera position
  const starCount = 40;
  ctx.fillStyle = 'rgba(237, 232, 223, 0.15)';

  for (let i = 0; i < starCount; i++) {
    // Pseudo-random but deterministic per star index
    const seed = i * 127.1 + 311.7;
    const sx = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
    const baseSy = ((Math.sin(seed * 1.3 + 7.9) * 43758.5453) % 1 + 1) % 1;

    // Parallax: stars scroll slower than the world
    const parallax = 0.05;
    const sy = ((baseSy - cameraY * parallax) % 1 + 1) % 1;

    const radius = 0.5 + ((Math.sin(seed * 2.1) * 43758.5453) % 1 + 1) % 1 * 0.8;

    ctx.beginPath();
    ctx.arc(sx * w, sy * h, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
