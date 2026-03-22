'use client';

import { useEffect, useRef, useCallback } from 'react';
import { TetrisEngine, COLS, ROWS } from './TetrisEngine';
import { PIECE_COLORS, GHOST_OPACITY } from '@/types/game';
import type { GameState } from '@/types/game';

interface TetrisBoardProps {
  onGameOver: (score: number, level: number, lines: number, durationSeconds: number) => void;
  onStateChange: (state: GameState) => void;
  /** Ref to expose engine controls */
  engineRef: React.MutableRefObject<TetrisEngine | null>;
}

const BORDER_COLOR = 'rgba(255,255,255,0.08)';
const BG_COLOR = 'rgba(0,0,0,0.3)';
const GRID_LINE_COLOR = 'rgba(255,255,255,0.03)';

export default function TetrisBoard({ onGameOver, onStateChange, engineRef }: TetrisBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const stateRef = useRef<GameState | null>(null);

  // Calculate cell size based on container
  const getCellSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return Math.floor(canvas.width / dpr / COLS);
  }, []);

  // Render the game to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const state = stateRef.current;
    if (!canvas || !ctx || !state) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cellSize = getCellSize();
    const boardWidth = cellSize * COLS;
    const boardHeight = cellSize * ROWS;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Board background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, boardWidth, boardHeight);

    // Grid lines
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(boardWidth, r * cellSize);
      ctx.stroke();
    }
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, boardHeight);
      ctx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = state.grid[r][c];
        if (cell !== 0) {
          drawCell(ctx, c, r, cellSize, PIECE_COLORS[cell] || '#fff', 1);
        }
      }
    }

    // Ghost piece
    if (state.currentPiece && state.ghostY !== null) {
      const { shape, x, type } = state.currentPiece;
      const color = PIECE_COLORS[type] || '#fff';
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const gy = state.ghostY + r;
          if (gy >= 0) {
            drawCell(ctx, x + c, gy, cellSize, color, GHOST_OPACITY);
          }
        }
      }
    }

    // Current piece
    if (state.currentPiece) {
      const { shape, x, y, type } = state.currentPiece;
      const color = PIECE_COLORS[type] || '#fff';
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const py = y + r;
          if (py >= 0) {
            drawCell(ctx, x + c, py, cellSize, color, 1);
          }
        }
      }
    }

    // Border
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, boardWidth - 1, boardHeight - 1);

    ctx.restore();
  }, [getCellSize]);

  // Size canvas to container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const containerWidth = container.clientWidth;
    const cellSize = Math.floor(containerWidth / COLS);
    const width = cellSize * COLS;
    const height = cellSize * ROWS;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    render();
  }, [render]);

  // Initialize engine
  useEffect(() => {
    const engine = new TetrisEngine();
    engineRef.current = engine;

    engine.onStateChange = (state) => {
      stateRef.current = state;
      onStateChange(state);
      render();
    };

    engine.onGameOver = onGameOver;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle resize
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine || engine.gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          engine.moveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          engine.moveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          engine.moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          engine.rotate();
          break;
        case ' ':
          e.preventDefault();
          engine.hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engineRef]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[280px] mx-auto"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  size: number,
  color: string,
  opacity: number,
) {
  const x = col * size;
  const y = row * size;
  const inset = 1;

  ctx.globalAlpha = opacity;

  // Fill
  ctx.fillStyle = color;
  ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);

  // Subtle highlight (top-left)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + inset, y + inset, size - inset * 2, 2);
  ctx.fillRect(x + inset, y + inset, 2, size - inset * 2);

  // Subtle shadow (bottom-right)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + inset, y + size - inset - 2, size - inset * 2, 2);
  ctx.fillRect(x + size - inset - 2, y + inset, 2, size - inset * 2);

  ctx.globalAlpha = 1;
}
