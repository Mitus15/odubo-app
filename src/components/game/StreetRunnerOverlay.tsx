'use client';

// ============================================================================
// StreetRunnerOverlay — UI overlay for the Recoolman street runner game
//
// Phase state machine: ready → playing → gameOver → submitted
// Renders on top of the 3D scene via portal.
// ============================================================================

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StreetRunnerScene from './StreetRunnerScene';
import type { StreetRunnerSceneHandle } from './StreetRunnerScene';
import type { StreetRunnerState } from '@/types/game';

type GamePhase = 'ready' | 'playing' | 'gameOver' | 'submitted';

export default function StreetRunnerOverlay() {
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [state, setState] = useState<StreetRunnerState | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [finalCatches, setFinalCatches] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [avatarGender, setAvatarGender] = useState<'male' | 'female'>('male');
  const sceneRef = useRef<StreetRunnerSceneHandle>(null);

  const handleStart = useCallback(async () => {
    setPhase('playing');
    await sceneRef.current?.start();
  }, []);

  const handleGameOver = useCallback((score: number, catches: number, duration: number) => {
    setFinalScore(score);
    setFinalCatches(catches);
    setFinalDuration(duration);
    setPhase('gameOver');
  }, []);

  const handlePlayAgain = useCallback(async () => {
    setPhase('playing');
    await sceneRef.current?.start();
  }, []);

  const handleStateChange = useCallback((newState: StreetRunnerState) => {
    setState(newState);
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      {/* 3D Scene — always mounted */}
      <StreetRunnerScene
        ref={sceneRef}
        onStateChange={handleStateChange}
        onGameOver={handleGameOver}
        avatarGender={avatarGender}
      />

      {/* HUD — during gameplay */}
      {phase === 'playing' && state && (
        <HUD state={state} />
      )}

      {/* Ready screen */}
      <AnimatePresence>
        {phase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
            style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)' }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-center"
            >
              <h1
                className="text-5xl md:text-7xl font-bold tracking-wider mb-3"
                style={{ color: '#ede8df', textShadow: '0 0 30px rgba(196,120,90,0.5)' }}
              >
                RECOOLMAN
              </h1>
              <p className="text-lg md:text-xl mb-6" style={{ color: '#c4785a' }}>
                Bring Light to the City
              </p>

              {/* Character selector */}
              <div className="flex gap-4 justify-center mb-8">
                <button
                  onClick={() => setAvatarGender('male')}
                  className="px-5 py-2 text-sm font-semibold tracking-wide rounded-full transition-all duration-200"
                  style={{
                    background: avatarGender === 'male' ? 'linear-gradient(135deg, #843c2d, #c4785a)' : 'rgba(255,255,255,0.08)',
                    color: '#ede8df',
                    border: avatarGender === 'male' ? '2px solid #c4785a' : '2px solid rgba(255,255,255,0.15)',
                  }}
                >
                  MAN-MAN
                </button>
                <button
                  onClick={() => setAvatarGender('female')}
                  className="px-5 py-2 text-sm font-semibold tracking-wide rounded-full transition-all duration-200"
                  style={{
                    background: avatarGender === 'female' ? 'linear-gradient(135deg, #843c2d, #c4785a)' : 'rgba(255,255,255,0.08)',
                    color: '#ede8df',
                    border: avatarGender === 'female' ? '2px solid #c4785a' : '2px solid rgba(255,255,255,0.15)',
                  }}
                >
                  WOMAN-WOMAN
                </button>
              </div>

              <button
                onClick={handleStart}
                className="px-10 py-4 text-lg font-semibold tracking-wide rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #843c2d, #c4785a)',
                  color: '#ede8df',
                  boxShadow: '0 0 30px rgba(196,120,90,0.4)',
                }}
              >
                RUN
              </button>

              <p className="mt-6 text-sm opacity-50" style={{ color: '#ede8df' }}>
                Swipe or Arrow Keys to move &bull; Swipe Up or Space to jump
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over screen */}
      <AnimatePresence>
        {phase === 'gameOver' && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
            style={{ background: 'radial-gradient(ellipse at center, rgba(42,21,37,0.6) 0%, rgba(0,0,0,0.95) 100%)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.3 }}
              className="text-center"
            >
              <h2
                className="text-4xl md:text-6xl font-bold tracking-wider mb-2"
                style={{ color: '#2a1525', textShadow: '0 0 20px rgba(42,21,37,0.8)' }}
              >
                DARKNESS WINS
              </h2>
              <p className="text-lg mb-8" style={{ color: '#843c2d' }}>
                ...for now
              </p>

              <div className="grid grid-cols-3 gap-6 mb-8 max-w-sm mx-auto">
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: '#ede8df' }}>
                    {finalScore.toLocaleString()}
                  </p>
                  <p className="text-xs opacity-60" style={{ color: '#ede8df' }}>SCORE</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: '#c4785a' }}>
                    {finalCatches}
                  </p>
                  <p className="text-xs opacity-60" style={{ color: '#ede8df' }}>CATCHES</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: '#843c2d' }}>
                    {finalDuration}s
                  </p>
                  <p className="text-xs opacity-60" style={{ color: '#ede8df' }}>TIME</p>
                </div>
              </div>

              <button
                onClick={handlePlayAgain}
                className="px-10 py-4 text-lg font-semibold tracking-wide rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #843c2d, #c4785a)',
                  color: '#ede8df',
                  boxShadow: '0 0 30px rgba(196,120,90,0.4)',
                }}
              >
                RUN AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// HUD — Score, Lives, Combo during gameplay
// ============================================================================

function HUD({ state }: { state: StreetRunnerState }) {
  const { score, lives, combo, lightRadius, totalCatches, clothing, elapsed } = state;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4 md:p-6">
      <div className="flex items-start justify-between max-w-lg mx-auto">
        {/* Score */}
        <div>
          <p
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{ color: '#ede8df', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            {score.toLocaleString()}
          </p>
          <p className="text-xs opacity-60" style={{ color: '#c4785a' }}>
            {Math.round(elapsed)}s
          </p>
        </div>

        {/* Lives — light orbs */}
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-all duration-300"
              style={{
                background: i < lives
                  ? 'radial-gradient(circle, #ede8df, #c4785a)'
                  : '#1a1a1a',
                boxShadow: i < lives ? '0 0 8px rgba(196,120,90,0.6)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Combo */}
        {combo > 1 && (
          <motion.div
            key={combo}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-right"
          >
            <p
              className="text-xl font-bold"
              style={{ color: '#c4785a', textShadow: '0 0 10px rgba(196,120,90,0.5)' }}
            >
              x{combo}
            </p>
          </motion.div>
        )}
      </div>

      {/* Clothing slots indicator */}
      <div className="flex justify-center gap-2 mt-2">
        {[
          { filled: !!clothing.top, color: '#ede8df', label: 'T' },
          { filled: !!clothing.bottom, color: '#843c2d', label: 'B' },
          { filled: !!clothing.layer, color: '#c4785a', label: 'L' },
        ].map((slot, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold"
            style={{
              background: slot.filled ? slot.color : 'rgba(255,255,255,0.05)',
              color: slot.filled ? '#0a0a0a' : 'rgba(255,255,255,0.2)',
              boxShadow: slot.filled ? `0 0 8px ${slot.color}40` : 'none',
            }}
          >
            {slot.label}
          </div>
        ))}
      </div>
    </div>
  );
}
