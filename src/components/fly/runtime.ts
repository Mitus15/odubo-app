import { createContext, useContext } from 'react';
import type { FlightEngine } from './engine/FlightEngine';
import type { FlightEvent } from './engine/types';
import type { Region } from './engine/regions';
import type { WorldFrame } from './scene/frame';

/**
 * Everything the running flight shares, in one mutable object that lives for
 * the whole visit. Per-frame values are written here, never into React state,
 * so the scene can run at the display's rate without re-rendering anything.
 */
export interface FlyRuntime {
  engine: FlightEngine;
  frame: WorldFrame;
  region: Region;
  /** Where Recoolman is drawn this frame: between two engine steps. */
  view: { s: number; x: number };
  /** Held keys, for steering on a desktop. */
  keys: { left: boolean; right: boolean };
  /** 1 at the start of a run, easing to 0 as he drops into the flight. */
  dropIn: number;
  /** Seconds since the crash, or -1 while he is flying. */
  crashAge: number;
  /** Camera shake to add, decays by itself. */
  shake: number;
  /** Where he is on screen (CSS pixels), for text that springs from him. */
  flyerScreen: { x: number; y: number };
  reducedMotion: boolean;
  /** The HUD's elements, attached by the HUD once mounted. */
  hud: {
    score: HTMLElement | null;
    chain: HTMLElement | null;
    bursts: HTMLElement | null;
    flash: HTMLElement | null;
    debug: HTMLElement | null;
  };
  /** Set by the game: receives every flight event, once. */
  onEvents: (events: FlightEvent[]) => void;
}

export const FlyRuntimeContext = createContext<FlyRuntime | null>(null);

export function useFlyRuntime(): FlyRuntime {
  const runtime = useContext(FlyRuntimeContext);
  if (!runtime) throw new Error('useFlyRuntime must be used inside the flight');
  return runtime;
}
