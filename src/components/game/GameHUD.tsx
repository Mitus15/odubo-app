'use client';

import type { GameState } from '@/types/game';
import { PIECE_COLORS } from '@/types/game';

interface GameHUDProps {
  state: GameState;
}

/**
 * GameHUD — Score, level, lines cleared, and next piece preview
 * Displayed alongside the Tetris board during gameplay
 */
export default function GameHUD({ state }: GameHUDProps) {
  const { score, level, linesCleared, nextPiece } = state;

  return (
    <div className="flex flex-row items-start gap-3 w-full max-w-[280px] mx-auto">
      {/* Stats row */}
      <div className="flex-1 flex gap-2">
        <StatBox label="Score" value={score.toLocaleString()} />
        <StatBox label="Level" value={String(level)} />
        <StatBox label="Lines" value={String(linesCleared)} />
      </div>

      {/* Next piece preview */}
      <div
        className="flex flex-col items-center rounded-lg px-2 py-1.5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className="text-[9px] uppercase tracking-widest text-[#ede8df]/30 mb-1">Next</span>
        <NextPiecePreview nextPiece={nextPiece} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center rounded-lg px-2 py-1.5"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-[9px] uppercase tracking-widest text-[#ede8df]/30">{label}</span>
      <span className="text-sm font-mono text-[#ede8df]/80">{value}</span>
    </div>
  );
}

function NextPiecePreview({ nextPiece }: { nextPiece: GameState['nextPiece'] }) {
  if (!nextPiece) return <div className="w-10 h-10" />;

  const { shape, type } = nextPiece;
  const color = PIECE_COLORS[type] || '#fff';
  const cellSize = 10;

  // Trim empty rows/cols for tighter rendering
  const filledRows = shape.map((row, r) => ({ row, r })).filter(({ row }) => row.some(Boolean));
  const filledCols = new Set<number>();
  shape.forEach(row => row.forEach((cell, c) => { if (cell) filledCols.add(c); }));
  const minCol = Math.min(...filledCols);
  const maxCol = Math.max(...filledCols);
  const minRow = filledRows[0]?.r ?? 0;
  const maxRow = filledRows[filledRows.length - 1]?.r ?? 0;

  const trimmedW = maxCol - minCol + 1;
  const trimmedH = maxRow - minRow + 1;

  return (
    <svg
      width={trimmedW * cellSize}
      height={trimmedH * cellSize}
      viewBox={`0 0 ${trimmedW * cellSize} ${trimmedH * cellSize}`}
    >
      {shape.map((row, r) =>
        row.map((cell, c) => {
          if (!cell) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={(c - minCol) * cellSize + 0.5}
              y={(r - minRow) * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={1.5}
              fill={color}
              opacity={0.9}
            />
          );
        })
      )}
    </svg>
  );
}
