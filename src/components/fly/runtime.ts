import { createContext, useContext } from 'react';
import type { CutsceneScript } from '@/lib/fly/album';
import type { FallEngine } from './engine/FallEngine';
import type { Trajectory } from './engine/record';
import type { FallEvent } from './engine/types';
import type { WorldFrame } from './scene/frame';
import type { LiveLook } from './scene/look';

/** What the fall is doing: the title's endless fall, a cutscene, or a level. */
export type FlyMode = 'attract' | 'cutscene' | 'level';

export interface CutsceneState {
  script: CutsceneScript;
  /** Seconds into the cutscene. */
  t: number;
  /** How long it lasts (s). */
  duration: number;
  /** Where the song lets go (s): Welcome opens his arms here. */
  letGo: number;
}

/**
 * Everything the running fall shares, in one mutable object that lives for
 * the whole visit. Per-frame values are written here, never into React state,
 * so the scene can run at the display's rate without re-rendering anything.
 */
export interface FlyRuntime {
  engine: FallEngine;
  frame: WorldFrame;
  look: LiveLook;
  mode: FlyMode;
  paused: boolean;
  /**
   * The run's clock (seconds into the song). The engine steps until it has
   * caught up with it, so the song keeps time and a stall pauses the fall.
   * Null on the title screen, which runs on frame time.
   */
  clock: (() => number) | null;
  /** Frame time, for the title's fall (s). */
  attractSeconds: number;
  /** Where Recoolman is drawn this frame: between two engine steps. */
  view: { s: number; x: number; y: number; tick: number };
  /** Held keys, for steering on a desktop. */
  keys: { left: boolean; right: boolean; up: boolean; down: boolean };
  /** His shadow keeps his time, or lags behind him by this many seconds. */
  shadowLag: number;
  /** 0..1: how far through the album this sky is. The Earth grows with it. */
  albumProgress: number;
  /** Where this stage starts in the album (0..1) and how much of it it spans. */
  albumFrom: number;
  albumSpan: number;
  /** The landing (Ghost World): from this step the ground comes up to meet him. */
  landingFrom: number | null;
  /** In the Album, the depth banked by the levels before this one (m); null in Songs. */
  albumBase: number | null;
  /** ?flow= for tuning: flow held at this value every frame. Never saves a best. */
  debugFlow: number | null;
  /** The best run on this level, flying alongside. */
  ghost: Trajectory | null;
  cutscene: CutsceneState | null;
  /** 1 while passing through a band of cloud between skies, easing to 0. */
  stratum: number;
  /** The last kiss, for its flash on the stone (age in seconds, -1 for none). */
  kiss: { x: number; y: number; s: number; age: number };
  /** Camera shake to add; decays by itself. */
  shake: number;
  /** Where he is on screen (CSS pixels), for words that spring from him. */
  flyerScreen: { x: number; y: number };
  reducedMotion: boolean;
  /** The HUD's elements, attached by the HUD once mounted. */
  hud: {
    depth: HTMLElement | null;
    ghostDelta: HTMLElement | null;
    total: HTMLElement | null;
    progress: HTMLElement | null;
    flow: HTMLElement | null;
    bursts: HTMLElement | null;
    flash: HTMLElement | null;
    debug: HTMLElement | null;
    /** "Loading the song": shown while the song keeps the fall waiting. */
    stall: HTMLElement | null;
  };
  /** Set by the game: receives every engine event, once. */
  onEvents: (events: FallEvent[]) => void;
}

export const FlyRuntimeContext = createContext<FlyRuntime | null>(null);

export function useFlyRuntime(): FlyRuntime {
  const runtime = useContext(FlyRuntimeContext);
  if (!runtime) throw new Error('useFlyRuntime must be used inside the fall');
  return runtime;
}
