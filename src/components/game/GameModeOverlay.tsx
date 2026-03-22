'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { GamePhase, GameState } from '@/types/game';
import type { TetrisEngine } from './TetrisEngine';
import TetrisBoard from './TetrisBoard';
import TouchControls from './TouchControls';
import GameHUD from './GameHUD';
import ScoreSubmission from './ScoreSubmission';
import Leaderboard from './Leaderboard';

interface GameModeOverlayProps {
  onClose: () => void;
}

const INITIAL_STATE: GameState = {
  grid: [],
  currentPiece: null,
  nextPiece: null,
  score: 0,
  level: 1,
  linesCleared: 0,
  gameOver: false,
  ghostY: null,
};

export default function GameModeOverlay({ onClose }: GameModeOverlayProps) {
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [finalScore, setFinalScore] = useState({ score: 0, level: 1, lines: 0, duration: 0 });
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const engineRef = useRef<TetrisEngine | null>(null);

  const handleStartGame = useCallback(() => {
    setPhase('playing');
  }, []);

  const handleGameOver = useCallback((score: number, level: number, lines: number, durationSeconds: number) => {
    setFinalScore({ score, level, lines, duration: durationSeconds });
    setPhase('gameOver');
  }, []);

  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  const handleScoreSubmitted = useCallback((rank: number) => {
    setSubmittedRank(rank);
    setPhase('submitted');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setSubmittedRank(null);
    setPhase('playing');
  }, []);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col"
      initial={{ opacity: 0, scale: 0.3, borderRadius: '24px' }}
      animate={{ opacity: 1, scale: 1, borderRadius: '0px' }}
      exit={{ opacity: 0, scale: 0.3, borderRadius: '24px' }}
      transition={{ type: 'spring', stiffness: 400, damping: 35, mass: 0.8 }}
      style={{
        transformOrigin: 'top left',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        touchAction: 'none',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      // Block all touch events from reaching clips beneath
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Close button — top right */}
      <div className="relative flex items-center justify-end px-4 pt-3 pb-1">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#ede8df]/60 hover:text-[#ede8df] hover:bg-white/10 transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Ready state — show leaderboard + start button */}
        {phase === 'ready' && (
          <motion.div
            className="flex flex-col items-center gap-6 w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <h2 className="text-xl font-serif text-[#ede8df]/80">Tetris</h2>
            <Leaderboard highlightRank={null} compact />
            <button
              onClick={handleStartGame}
              className="px-8 py-3 rounded-xl text-sm font-medium text-[#ede8df] transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(132,60,45,0.4) 0%, rgba(132,60,45,0.2) 100%)',
                border: '1px solid rgba(132,60,45,0.3)',
              }}
            >
              Start Game
            </button>
            <p className="text-[10px] text-[#ede8df]/25 text-center">
              Tap to rotate &middot; Swipe to move &middot; Swipe up to drop
            </p>
          </motion.div>
        )}

        {/* Playing state — board + HUD + touch controls */}
        {phase === 'playing' && (
          <div className="flex flex-col items-center gap-3 w-full">
            <GameHUD state={gameState} />
            <div className="relative">
              <TetrisBoard
                onGameOver={handleGameOver}
                onStateChange={handleStateChange}
                engineRef={engineRef}
              />
              <TouchControls engineRef={engineRef} />
            </div>
          </div>
        )}

        {/* Game over — score submission */}
        {phase === 'gameOver' && (
          <motion.div
            className="flex flex-col items-center gap-4 w-full max-w-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <h2 className="text-xl font-serif text-[#ede8df]/80">Game Over</h2>
            <div className="text-3xl font-mono text-[#ede8df]">{finalScore.score.toLocaleString()}</div>
            <div className="flex gap-4 text-xs text-[#ede8df]/40">
              <span>Level {finalScore.level}</span>
              <span>{finalScore.lines} lines</span>
              <span>{formatDuration(finalScore.duration)}</span>
            </div>
            <ScoreSubmission
              score={finalScore.score}
              level={finalScore.level}
              linesCleared={finalScore.lines}
              durationSeconds={finalScore.duration}
              onSubmitted={handleScoreSubmitted}
            />
          </motion.div>
        )}

        {/* Submitted — leaderboard with highlight + play again */}
        {phase === 'submitted' && (
          <motion.div
            className="flex flex-col items-center gap-5 w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <div className="text-center">
              <h2 className="text-xl font-serif text-[#ede8df]/80 mb-1">
                #{submittedRank}
              </h2>
              <p className="text-xs text-[#ede8df]/40">{finalScore.score.toLocaleString()} points</p>
            </div>
            <Leaderboard highlightRank={submittedRank} compact={false} />
            <button
              onClick={handlePlayAgain}
              className="px-8 py-3 rounded-xl text-sm font-medium text-[#ede8df] transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(132,60,45,0.4) 0%, rgba(132,60,45,0.2) 100%)',
                border: '1px solid rgba(132,60,45,0.3)',
              }}
            >
              Play Again
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
