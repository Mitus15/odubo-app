'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { FlightEngine } from './engine/FlightEngine';
import { LIGHT } from './engine/regions';
import type { FlightEvent, FlyMode } from './engine/types';
import { DEFAULT_SENSITIVITY, useSlideSteer } from './input/useSlideSteer';
import { FlyRuntimeContext, type FlyRuntime } from './runtime';
import { WorldFrame } from './scene/frame';
import { FlyScene } from './scene/FlyScene';
import { burst, buzz, flash } from './ui/effects';
import { Hud } from './ui/Hud';
import { GameOverScreen, PausedScreen, TitleScreen, type RunResult } from './ui/Screens';

type Phase = 'title' | 'run' | 'paused' | 'over';

const BEST_KEY = 'fly.best.dive';
/** How long the crash plays before the score comes up (ms). */
const CRASH_BEAT = 1100;

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // Private windows may refuse; the best simply isn't remembered.
  }
}

function createRuntime(): FlyRuntime {
  const seed = Math.floor(Math.random() * 2 ** 31);
  return {
    engine: new FlightEngine(seed),
    frame: new WorldFrame(),
    region: LIGHT,
    view: { s: 0, x: 0 },
    keys: { left: false, right: false },
    dropIn: 0,
    crashAge: -1,
    shake: 0,
    flyerScreen: { x: 0, y: 0 },
    reducedMotion: false,
    hud: { score: null, chain: null, bursts: null, flash: null, debug: null },
    onEvents: () => {},
  };
}

const BANK_TEXT = 'text-[22px] font-bold tabular-nums';
const EYEBROW_TEXT = 'text-[11px] font-bold uppercase tracking-[0.34em]';
const PORTAL_TEXT = 'text-[44px] font-bold leading-none tabular-nums';

export default function FlyGame() {
  const runtimeRef = useRef<FlyRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = createRuntime();
  const runtime = runtimeRef.current;

  const [phase, setPhase] = useState<Phase>('title');
  const [result, setResult] = useState<RunResult | null>(null);
  const [best, setBest] = useState(0);
  const [hint, setHint] = useState(false);
  const [debug, setDebug] = useState(false);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [dpr, setDpr] = useState(1.5);

  const surface = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const bestRef = useRef(best);
  bestRef.current = best;
  const crashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBest(readBest());
    const params = new URLSearchParams(window.location.search);
    setDebug(params.has('debug'));
    // ?debug also hands the running flight to the console, for tuning.
    if (params.has('debug')) (window as unknown as { fly?: FlyRuntime }).fly = runtime;
    const sens = Number(params.get('sens'));
    if (sens > 0) setSensitivity(sens);
    setDpr(Math.min(window.devicePixelRatio || 1, 1.75));
    runtime.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return () => {
      if (crashTimer.current) clearTimeout(crashTimer.current);
    };
  }, [runtime]);

  const finishRun = useCallback(() => {
    if (phaseRef.current !== 'run') return;
    const state = runtime.engine.state;
    const score = Math.floor(state.score);
    const isNewBest = score > bestRef.current;
    if (isNewBest) {
      writeBest(score);
      setBest(score);
    }
    setResult({
      score,
      best: Math.max(score, bestRef.current),
      isNewBest,
      bestChain: state.bestChain,
      portals: state.portals,
      seconds: state.t,
    });
    setHint(false);
    setPhase('over');
  }, [runtime]);

  // Everything the flight reports, turned into light, numbers and a buzz.
  useEffect(() => {
    runtime.onEvents = (events: FlightEvent[]) => {
      const { hud, flyerScreen } = runtime;
      for (const event of events) {
        switch (event.type) {
          case 'bank': {
            const text = event.multiplier > 1 ? `x${event.multiplier}  +${event.points.toLocaleString('en-US')}` : `+${event.points.toLocaleString('en-US')}`;
            burst(hud.bursts, flyerScreen.x, flyerScreen.y + 34, [{ text, className: BANK_TEXT }]);
            buzz(12);
            break;
          }
          case 'portal': {
            const width = hud.bursts?.clientWidth ?? 0;
            const height = hud.bursts?.clientHeight ?? 0;
            const lines = [{ text: 'Portal', className: EYEBROW_TEXT }];
            if (event.points > 0) lines.push({ text: `+${event.points.toLocaleString('en-US')}`, className: PORTAL_TEXT });
            burst(hud.bursts, width / 2, height * 0.3, lines, 30);
            flash(hud.flash, 0.28);
            buzz([10, 40, 10]);
            break;
          }
          case 'stumble':
            runtime.shake = 0.6;
            flash(hud.flash, 0.35);
            buzz(30);
            break;
          case 'crash':
            runtime.crashAge = 0;
            runtime.shake = 1;
            flash(hud.flash, 0.75);
            buzz(70);
            if (crashTimer.current) clearTimeout(crashTimer.current);
            crashTimer.current = setTimeout(finishRun, CRASH_BEAT);
            break;
          case 'chain-start':
            break;
        }
      }
    };
  }, [runtime, finishRun]);

  const begin = useCallback(
    (rules: FlyMode) => {
      if (crashTimer.current) clearTimeout(crashTimer.current);
      runtime.engine.restart({ rules, pilot: 'player' });
      runtime.crashAge = -1;
      runtime.dropIn = 1;
      setResult(null);
      setHint(true);
      setPhase('run');
    },
    [runtime],
  );

  const toTitle = useCallback(() => {
    if (crashTimer.current) clearTimeout(crashTimer.current);
    runtime.engine.restart({ rules: 'drift', pilot: 'auto' });
    runtime.crashAge = -1;
    runtime.dropIn = 1;
    setResult(null);
    setHint(false);
    setPhase('title');
  }, [runtime]);

  const pause = useCallback(() => {
    if (phaseRef.current !== 'run' || !runtime.engine.state.alive) return;
    runtime.engine.setPaused(true);
    setPhase('paused');
  }, [runtime]);

  const resume = useCallback(() => {
    runtime.engine.setPaused(false);
    setPhase('run');
  }, [runtime]);

  // The hint leaves as soon as the thumb has found the steering, or after a few seconds.
  const onSlide = useCallback(() => {
    if (phaseRef.current === 'run') setHint(false);
  }, []);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(timer);
  }, [hint]);

  useSlideSteer(surface, runtime, sensitivity, onSlide);

  // Leaving the tab pauses a run; nobody loses a Dive to a notification.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  // Keys, for a desktop. Captured first and marked handled, so the site's
  // music shortcuts (arrows seek, space plays) stay out of the flight.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const down = event.type === 'keydown';
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          runtime.keys.left = down;
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          runtime.keys.right = down;
          event.preventDefault();
          break;
        case 'Space':
        case 'Escape':
          event.preventDefault();
          if (!down || event.repeat) break;
          if (phaseRef.current === 'run') pause();
          else if (phaseRef.current === 'paused') resume();
          break;
        case 'Enter':
          if (!down || event.repeat) break;
          if (phaseRef.current === 'title' || phaseRef.current === 'over') begin('dive');
          break;
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [runtime, pause, resume, begin]);

  return (
    <div
      ref={surface}
      className="absolute inset-0 select-none overflow-hidden"
      style={{
        color: runtime.region.ink,
        fontFamily: '"Jost", var(--font-geist-sans), sans-serif',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Canvas
        flat
        dpr={dpr}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 70, near: 0.3, far: 2400, position: [0, 4, 8] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <FlyRuntimeContext.Provider value={runtime}>
          <PerformanceMonitor
            flipflops={4}
            onDecline={() => setDpr((value) => Math.max(1, value - 0.35))}
            onIncline={() => setDpr((value) => Math.min(Math.min(window.devicePixelRatio || 1, 2), value + 0.25))}
            onFallback={() => setDpr(1)}
          />
          <FlyScene />
        </FlyRuntimeContext.Provider>
      </Canvas>

      <Hud runtime={runtime} running={phase === 'run'} hint={hint && phase === 'run'} debug={debug} onPause={pause} />

      {phase === 'title' ? <TitleScreen best={best} onDive={() => begin('dive')} onDrift={() => begin('drift')} /> : null}
      {phase === 'paused' ? <PausedScreen onResume={resume} onTitle={toTitle} /> : null}
      {phase === 'over' && result ? (
        <GameOverScreen result={result} onAgain={() => begin('dive')} onDrift={() => begin('drift')} onTitle={toTitle} />
      ) : null}
    </div>
  );
}
