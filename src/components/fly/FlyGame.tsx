'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { ATTRACT_COURSE, LEVELS, levelBySlug, STAGES, type LevelDef, type Stage } from '@/lib/fly/album';
import { browserStorage, loadGhost, loadProgress, markSeen, recordAlbum, recordLevel, saveAlbumPlace, type Progress } from '@/lib/fly/progress';
import { lookFor, TITLE_LOOK, type Look } from '@/lib/fly/region';
import { FALL } from '@/lib/fly/rules';
import {
  albumDone,
  albumStart,
  albumTotal,
  currentStage,
  finishStage,
  isFullRun,
  nextLevelAfter,
  nextStage,
  resultLine,
  skipCutscene,
  type AlbumRun,
} from '@/lib/fly/story';
import { pauseSiteMusic, SongAudio } from './audio/SongAudio';
import { Course } from './engine/course';
import { FallEngine } from './engine/FallEngine';
import { Trajectory } from './engine/record';
import type { FallEvent } from './engine/types';
import type { FlyClientProps } from './FlyClient';
import { DEFAULT_SENSITIVITY, useSlideSteer } from './input/useSlideSteer';
import { FlyRuntimeContext, type FlyRuntime } from './runtime';
import { WorldFrame } from './scene/frame';
import { FlyScene } from './scene/FlyScene';
import { LiveLook } from './scene/look';
import { burst, buzz, flash } from './ui/effects';
import { Hud } from './ui/Hud';
import {
  AlbumResultScreen,
  CutsceneOverlay,
  LevelResultScreen,
  PassingCard,
  PausedScreen,
  SongsScreen,
  TitleScreen,
  type AlbumLine,
  type AlbumResult,
  type LevelResult,
} from './ui/Screens';

type Phase = 'title' | 'songs' | 'cutscene' | 'run' | 'paused' | 'levelResult' | 'albumResult';
type Mode = 'songs' | 'album';

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.34em]';
const WORD = 'text-[20px] font-bold uppercase tracking-[0.12em]';
/** How long the passing card between album levels stays (ms). */
const CARD_MS = 4200;
/** How long a level's title shows as it begins (ms). */
const TITLE_MS = 2400;
/** Song links last six hours; ask for new ones after five (ms). */
const LINKS_STALE_MS = 5 * 60 * 60 * 1000;

function createRuntime(): FlyRuntime {
  return {
    engine: new FallEngine(new Course(ATTRACT_COURSE), 'auto'),
    frame: new WorldFrame(),
    look: new LiveLook(TITLE_LOOK),
    mode: 'attract',
    paused: false,
    clock: null,
    attractSeconds: 0,
    view: { s: 0, x: 0, y: 0, tick: 0 },
    keys: { left: false, right: false, up: false, down: false },
    shadowLag: 0,
    albumProgress: 0,
    albumFrom: 0,
    albumSpan: 0,
    landingFrom: null,
    albumBase: null,
    debugFlow: null,
    ghost: null,
    cutscene: null,
    stratum: 0,
    kiss: { x: 0, y: 0, s: 0, age: -1 },
    shake: 0,
    flyerScreen: { x: 0, y: 0 },
    reducedMotion: false,
    hud: { depth: null, ghostDelta: null, total: null, progress: null, flow: null, bursts: null, flash: null, debug: null, stall: null },
    onEvents: () => {},
  };
}

/** The level a stage leads into: itself, or the first level after a cutscene. */
function levelAtOrAfter(stage: Stage): LevelDef | null {
  if (stage.kind === 'level') return stage;
  const index = STAGES.indexOf(stage);
  for (let i = index + 1; i < STAGES.length; i++) {
    const next = STAGES[i];
    if (next.kind === 'level') return next;
  }
  return null;
}

interface Debug {
  on: boolean;
  level: LevelDef | null;
  startAt: number;
  flow: number | null;
}

export default function FlyGame({ audio: songLinks, fields, mintedAt }: FlyClientProps) {
  const runtimeRef = useRef<FlyRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = createRuntime();
  const runtime = runtimeRef.current;
  const songRef = useRef<SongAudio | null>(null);
  const player = useMusicPlayer();
  const router = useRouter();
  const playerRef = useRef(player);
  playerRef.current = player;

  const [phase, setPhase] = useState<Phase>('title');
  const [look, setLook] = useState<Look>(TITLE_LOOK);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [albumResult, setAlbumResult] = useState<AlbumResult | null>(null);
  const [passing, setPassing] = useState<AlbumLine | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [ghostShown, setGhostShown] = useState(false);
  const [debug, setDebug] = useState<Debug>({ on: false, level: null, startAt: 0, flow: null });
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [acceleration, setAcceleration] = useState(true);
  const [dpr, setDpr] = useState(1.5);

  const surface = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('title');
  // Every change of phase goes through here, so a tap or a key in the same moment sees it at once.
  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const modeRef = useRef<Mode>('songs');
  const runRef = useRef<AlbumRun | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const pausedFrom = useRef<Phase>('run');
  /** A level's line waiting for the next level to begin (a cutscene sits between them). */
  const heldLine = useRef<AlbumLine | null>(null);
  /** This album run used a tuning knob (?t, ?flow): it is shown, never saved. */
  const practiceAlbum = useRef(false);
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const lookOf = useCallback((stage: Stage | LevelDef | null): Look => {
    if (!stage) return TITLE_LOOK;
    return lookFor(fields[stage.slug] ?? null, stage.number - 1);
  }, [fields]);

  // ── Setting up ───────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowParam = params.get('flow');
    const level = levelBySlug(params.get('level') ?? '');
    const startAt = Math.max(0, Number(params.get('t')) || 0);
    const on = params.has('debug');
    setDebug({ on, level, startAt, flow: flowParam === null ? null : Math.min(1, Math.max(0, Number(flowParam) || 0)) });
    if (on) (window as unknown as { fly?: FlyRuntime }).fly = runtime;
    const sens = Number(params.get('sens'));
    if (sens > 0) setSensitivity(sens);
    if (params.get('accel') === '0') setAcceleration(false);
    setDpr(Math.min(window.devicePixelRatio || 1, 1.75));
    runtime.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const storage = browserStorage();
    setProgress(loadProgress(storage));
    // The first build's best score; nothing reads it any more.
    try {
      storage?.removeItem('fly.best.dive');
    } catch {
      // Storage may refuse even this; it is only tidying.
    }
    const song = new SongAudio();
    songRef.current = song;
    if (on) (window as unknown as { flySong?: SongAudio }).flySong = song;
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      song.destroy();
      songRef.current = null;
    };
  }, [runtime]);

  // ── Stages ───────────────────────────────────────────────────────────────

  /**
   * Begin a stage: its course, its sky, its song. `fromTap` means a finger is
   * on the glass right now, so the song can start the way iOS insists on;
   * otherwise the song preloaded during the last stage starts in its place.
   */
  const enterStage = useCallback(
    (stage: Stage, fromTap: boolean) => {
      const song = songRef.current;
      const storage = browserStorage();
      const debugNow = debugRef.current;
      const previous = stageRef.current;
      stageRef.current = stage;
      const course = new Course(stage.course);
      runtime.frame.reset(0);
      runtime.paused = false;
      runtime.kiss.age = -1;

      if (stage.kind === 'cutscene') {
        runtime.engine.load(course, 'auto');
        runtime.mode = 'cutscene';
        runtime.cutscene = { script: stage.script, t: 0, duration: stage.seconds, letGo: stage.fallsAwayAt };
        runtime.ghost = null;
        runtime.shadowLag = 0;
        runtime.landingFrom = null;
        const into = levelAtOrAfter(stage);
        // Welcome is sand from the first frame; an interlude blends one sky into the next.
        const next = stage.script === 'welcome' ? lookOf(stage) : lookOf(into);
        runtime.look.set(next, stage.script === 'welcome' ? 0 : stage.seconds * 0.8);
        setLook(next);
        runtime.albumFrom = into ? (into.index - 1) / LEVELS.length : 1;
        runtime.albumSpan = 0;
        setGhostShown(false);
        goTo('cutscene');
      } else {
        runtime.engine.load(course, 'player');
        runtime.mode = 'level';
        runtime.cutscene = null;
        runtime.shadowLag = stage.shadow === 'lag' ? 60 / stage.bpm : 0;
        runtime.landingFrom = stage.landing ? Math.round(stage.fallsAwayAt * FALL.ticksPerSecond) : null;
        const ghostText = loadGhost(storage, stage.slug);
        runtime.ghost = ghostText ? Trajectory.decode(ghostText) : null;
        setGhostShown(runtime.ghost !== null);
        const next = lookOf(stage);
        const fromInterlude = previous?.kind === 'cutscene';
        runtime.look.set(next, fromInterlude ? 0.6 : 1.4);
        setLook(next);
        // Between two songs with nothing between them, a band of cloud.
        if (!fromInterlude && previous) runtime.stratum = 1;
        runtime.albumFrom = (stage.index - 1) / LEVELS.length;
        runtime.albumSpan = 1 / LEVELS.length;
        runtime.debugFlow = debugNow.flow;
        setTitle(stage.title);
        later(TITLE_MS, () => setTitle(null));
        // The last level's line, held through a cutscene, passes over this one's opening.
        const held = heldLine.current;
        if (held) {
          heldLine.current = null;
          setPassing(held);
          later(CARD_MS, () => setPassing(null));
        }
        if (!(loadProgress(storage).steerHintSeen)) {
          setHint(true);
          later(4500, () => setHint(false));
        }
        goTo('run');
      }

      // ?t= (tuning): fly ahead on autopilot, then hand over. Never saves a best.
      const startAt = stage.kind === 'level' && debugNow.startAt > 0 ? Math.min(debugNow.startAt, stage.seconds - 1) : 0;
      if (startAt > 0) {
        runtime.engine.setPilot('auto');
        runtime.engine.advanceTo(Math.floor(startAt * FALL.ticksPerSecond));
        runtime.engine.drainEvents();
        runtime.engine.setPilot('player');
      }

      const url = songLinks[stage.slug] ?? null;
      if (song) {
        if (fromTap || startAt > 0 || !song.swap()) song.play(url, startAt, stage.seconds);
        runtime.clock = () => song.clock();
        // The next song loads while this one plays, so the album never stops for it.
        const run = runRef.current;
        const after = modeRef.current === 'album' && run ? nextStage(run) : null;
        if (after) song.preload(songLinks[after.slug] ?? null, after.seconds);
      }
      setMediaSession(stage);
    },
    [runtime, songLinks, lookOf, later, goTo],
  );

  const toTitle = useCallback(() => {
    runtime.engine.load(new Course(ATTRACT_COURSE), 'auto');
    runtime.frame.reset(0);
    runtime.mode = 'attract';
    runtime.clock = null;
    runtime.attractSeconds = 0;
    runtime.cutscene = null;
    runtime.ghost = null;
    runtime.landingFrom = null;
    runtime.albumBase = null;
    runtime.albumFrom = 0;
    runtime.albumSpan = 0;
    runtime.shadowLag = 0;
    runtime.debugFlow = null;
    runtime.paused = false;
    runtime.look.set(TITLE_LOOK, 1.2);
    setLook(TITLE_LOOK);
    stageRef.current = null;
    runRef.current = null;
    void songRef.current?.fadeOut(600);
    setTitle(null);
    setHint(false);
    setPassing(null);
    setProgress(loadProgress(browserStorage()));
    goTo('title');
    if (Date.now() - mintedAt > LINKS_STALE_MS) router.refresh();
  }, [runtime, goTo, mintedAt, router]);

  // ── Starting, from a tap ─────────────────────────────────────────────────

  const startSong = useCallback(
    (level: LevelDef) => {
      songRef.current?.unlock();
      pauseSiteMusic(playerRef.current);
      modeRef.current = 'songs';
      runRef.current = null;
      runtime.albumBase = null;
      setLevelResult(null);
      enterStage(level, true);
    },
    [runtime, enterStage],
  );

  const startAlbum = useCallback(
    (fromBeginning: boolean) => {
      songRef.current?.unlock();
      pauseSiteMusic(playerRef.current);
      const storage = browserStorage();
      const debugLevel = debugRef.current.level;
      const from = debugLevel ? debugLevel.slug : fromBeginning ? null : loadProgress(storage).continueFrom;
      const run = albumStart(from);
      modeRef.current = 'album';
      runRef.current = run;
      practiceAlbum.current = debugRef.current.startAt > 0 || debugRef.current.flow !== null;
      heldLine.current = null;
      runtime.albumBase = 0;
      setAlbumResult(null);
      saveAlbumPlace(storage, run);
      const stage = currentStage(run);
      if (stage) enterStage(stage, true);
    },
    [runtime, enterStage],
  );

  // ── Ending ───────────────────────────────────────────────────────────────

  const showAlbumResult = useCallback((run: AlbumRun) => {
    const storage = browserStorage();
    const practice = practiceAlbum.current;
    saveAlbumPlace(storage, run);
    const record = practice ? null : recordAlbum(storage, run);
    const stored = loadProgress(storage).albumBest?.total ?? 0;
    const lines = run.lines.map((line) => ({ slug: line.slug, title: line.title, depth: line.depth, medal: line.medal }));
    setAlbumResult({
      total: albumTotal(run),
      lines,
      finished: albumDone(run),
      complete: isFullRun(run),
      best: record ? Math.max(record.total, record.previousBest?.total ?? 0) : stored,
      isBest: record?.isBest ?? false,
      practice,
    });
    setProgress(loadProgress(storage));
    heldLine.current = null;
    void songRef.current?.fadeOut(1500);
    goTo('albumResult');
  }, [goTo]);

  const finishLevel = useCallback(
    (level: LevelDef) => {
      const storage = browserStorage();
      const engine = runtime.engine;
      const depth = engine.state.s;
      const counts = !debugRef.current.startAt && debugRef.current.flow === null;
      const record = counts
        ? recordLevel(storage, level.slug, depth, engine.trajectory.encode())
        : { isBest: false, medal: resultLine(level, depth).medal, previousBest: null };
      const line = resultLine(level, depth);

      if (modeRef.current === 'songs') {
        const previous = record.previousBest?.depth ?? null;
        setLevelResult({
          level,
          depth: line.depth,
          medal: line.medal,
          best: Math.max(line.depth, previous ?? 0),
          isBest: record.isBest,
          againstBest: previous === null ? null : line.depth - previous,
          practice: !counts,
        });
        setProgress(loadProgress(storage));
        void songRef.current?.fadeOut(1400);
        goTo('levelResult');
        return;
      }

      const run = finishStage(runRef.current ?? albumStart(level.slug), depth);
      runRef.current = run;
      runtime.albumBase = albumTotal(run);
      saveAlbumPlace(storage, run);
      if (albumDone(run)) {
        showAlbumResult(run);
        return;
      }
      const passingLine = { slug: line.slug, title: line.title, depth: line.depth, medal: line.medal };
      const next = currentStage(run);
      // Over a cutscene the card would sit on the film; it waits for the next level instead.
      heldLine.current = passingLine;
      if (next) enterStage(next, false);
    },
    [runtime, enterStage, showAlbumResult, goTo],
  );

  const finishCutscene = useCallback(
    (skipped: boolean) => {
      const run = runRef.current;
      if (!run) return;
      const stage = currentStage(run);
      // A Skip that lands just after the cutscene ended must not skip the level that followed it.
      if (stage?.kind !== 'cutscene') return;
      if (stage.script === 'welcome') markSeen(browserStorage(), 'welcomeSeen');
      const next = skipped ? skipCutscene(run) : finishStage(run);
      runRef.current = next;
      saveAlbumPlace(browserStorage(), next);
      const after = currentStage(next);
      if (!after) {
        showAlbumResult(next);
        return;
      }
      // A skip is a tap: the next song can start fresh. An ending is not: swap.
      enterStage(after, skipped);
    },
    [enterStage, showAlbumResult],
  );

  // Everything the fall reports, turned into words, light and a buzz.
  useEffect(() => {
    runtime.onEvents = (events: FallEvent[]) => {
      // The title's fall is scenery: no words, no flashes, no buzz in the hand.
      if (runtime.mode === 'attract') return;
      const { hud, flyerScreen } = runtime;
      for (const event of events) {
        switch (event.type) {
          case 'thread':
            if (!event.safe) {
              burst(hud.bursts, flyerScreen.x, flyerScreen.y - 70, [
                { text: event.size === 'narrow' ? 'Narrow' : 'Thread', className: EYEBROW },
              ]);
              buzz(event.size === 'narrow' ? 14 : 8);
            }
            break;
          case 'kiss':
            runtime.kiss = { x: event.x, y: event.y, s: event.s, age: 0 };
            burst(hud.bursts, flyerScreen.x, flyerScreen.y - 96, [
              { text: 'Kiss', className: EYEBROW },
              { text: event.clearance.toFixed(1), className: WORD },
            ]);
            buzz(10);
            break;
          case 'gate':
            burst(hud.bursts, flyerScreen.x, flyerScreen.y - 70, [{ text: 'Gate', className: EYEBROW }]);
            flash(hud.flash, 0.18);
            buzz([8, 30, 8]);
            break;
          case 'hug':
            if (event.on) burst(hud.bursts, flyerScreen.x, flyerScreen.y - 70, [{ text: 'Hug', className: EYEBROW }]);
            break;
          case 'stumble':
            runtime.shake = 0.9;
            flash(hud.flash, 0.4);
            buzz(40);
            break;
          case 'end': {
            const stage = stageRef.current;
            if (!stage) break;
            if (stage.kind === 'cutscene') finishCutscene(false);
            else finishLevel(stage);
            break;
          }
        }
      }
    };
  }, [runtime, finishLevel, finishCutscene]);

  // ── Pause ────────────────────────────────────────────────────────────────

  const releaseKeys = useCallback(() => {
    const keys = runtime.keys;
    keys.left = keys.right = keys.up = keys.down = false;
  }, [runtime]);

  const pause = useCallback(() => {
    const now = phaseRef.current;
    if (now !== 'run' && now !== 'cutscene') return;
    // A level that has just ended is on its way to its result, not to a pause.
    if (runtime.engine.done) return;
    pausedFrom.current = now;
    runtime.paused = true;
    releaseKeys();
    songRef.current?.pause();
    goTo('paused');
  }, [runtime, goTo, releaseKeys]);

  const resume = useCallback(() => {
    // A Play from the lock screen while the page is hidden would run the song on unseen.
    if (typeof document !== 'undefined' && document.hidden) return;
    if (phaseRef.current !== 'paused') return;
    runtime.paused = false;
    releaseKeys();
    songRef.current?.resume();
    goTo(pausedFrom.current);
  }, [runtime, goTo, releaseKeys]);

  // The phone stopping the song by itself, and a song ending before its level does.
  useEffect(() => {
    const song = songRef.current;
    if (!song) return;
    song.onInterrupted = () => pause();
    song.onEnded = () => {
      // The clock has reached the song's end, so the level has too: make sure it knows.
      const engine = runtime.engine;
      if (runtime.mode !== 'attract' && !engine.done && Number.isFinite(engine.course.endTick)) {
        engine.advanceTo(engine.course.endTick);
      }
    };
  }, [runtime, pause]);

  const leave = useCallback(() => {
    runtime.paused = false;
    const run = runRef.current;
    if (modeRef.current === 'album' && run && run.lines.length > 0) {
      showAlbumResult(run);
      return;
    }
    if (run) saveAlbumPlace(browserStorage(), run);
    toTitle();
  }, [runtime, showAlbumResult, toTitle]);

  // The hint leaves as soon as the thumb has found the steering.
  const onSlide = useCallback(() => {
    if (phaseRef.current !== 'run') return;
    setHint((shown) => {
      if (shown) markSeen(browserStorage(), 'steerHintSeen');
      return false;
    });
  }, []);

  useSlideSteer(surface, runtime, sensitivity, acceleration, onSlide);

  // Leaving the tab pauses the fall; nobody loses a song to a notification.
  // Coming back after hours fetches fresh song links (they last six), between runs.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        pause();
        return;
      }
      const between = phaseRef.current === 'title' || phaseRef.current === 'songs';
      if (between && Date.now() - mintedAt > LINKS_STALE_MS) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause, mintedAt, router]);

  // Keys, for a desktop. Captured first and marked handled, so the site's
  // music shortcuts (arrows seek, space plays) stay out of the fall.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const down = event.type === 'keydown';
      const keys = runtime.keys;
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          keys.left = down;
          break;
        case 'ArrowRight':
        case 'KeyD':
          keys.right = down;
          break;
        case 'ArrowUp':
        case 'KeyW':
          keys.up = down;
          break;
        case 'ArrowDown':
        case 'KeyS':
          keys.down = down;
          break;
        case 'Space':
        case 'Escape': {
          // On a menu, a focused row is the keyboard's own: Space presses it.
          const now = phaseRef.current;
          const playing = now === 'run' || now === 'cutscene' || now === 'paused';
          if (!playing || (event.code === 'Space' && onButton(event) && now === 'paused')) return;
          if (down && !event.repeat) {
            if (now === 'paused') resume();
            else pause();
          }
          break;
        }
        case 'Enter':
          // Enter on a focused row presses that row; on the title with nothing focused, it starts the album.
          if (phaseRef.current !== 'title' || onButton(event)) return;
          if (down && !event.repeat) startAlbum(false);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    // A key let go in another window would steer on forever.
    const onBlur = () => releaseKeys();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [runtime, pause, resume, startAlbum, releaseKeys]);

  // The phone's lock screen and headphones: the song's name, and pause.
  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!session) return;
    try {
      session.setActionHandler('pause', () => pause());
      session.setActionHandler('play', () => {
        if (phaseRef.current === 'paused') resume();
      });
    } catch {
      // Some browsers know mediaSession but not every action.
    }
    return () => {
      try {
        session.setActionHandler('pause', null);
        session.setActionHandler('play', null);
      } catch {
        // As above.
      }
    };
  }, [pause, resume]);

  // ── Drawing ──────────────────────────────────────────────────────────────

  const tone = { ink: look.ink, field: look.field };
  const continueLevel = debug.level ?? (progress?.continueFrom ? levelBySlug(progress.continueFrom) : null);
  const bests = progress?.bests ?? {};
  const running = phase === 'run';
  const resultLevel = levelResult?.level ?? null;
  const nextAfterResult = resultLevel ? nextLevelAfter(resultLevel.slug) : null;

  return (
    <div
      ref={surface}
      className="absolute inset-0 select-none overflow-hidden"
      style={{ fontFamily: '"Jost", var(--font-geist-sans), sans-serif', touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
    >
      <Canvas
        flat
        dpr={dpr}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 80, near: 0.3, far: 2400, position: [0, 9, -5] }}
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

      <Hud
        runtime={runtime}
        running={running}
        album={modeRef.current === 'album' && running}
        showGhost={ghostShown && running}
        hint={hint && running}
        title={running ? title : null}
        debug={debug.on}
        ink={look.ink}
        halo={look.inkHalo}
        onPause={pause}
      />

      {passing && running ? <PassingCard tone={tone} line={passing} /> : null}

      {phase === 'title' ? (
        <TitleScreen
          tone={tone}
          continueFrom={continueLevel}
          onAlbum={() => startAlbum(false)}
          onAlbumFromStart={() => startAlbum(true)}
          onSongs={() => goTo('songs')}
        />
      ) : null}
      {phase === 'songs' ? (
        <SongsScreen
          tone={tone}
          levels={LEVELS}
          bests={bests}
          onPlay={startSong}
          // From the title the fall behind is already the title's; after a level it is not.
          onBack={() => (runtime.mode === 'attract' ? goTo('title') : toTitle())}
        />
      ) : null}
      {phase === 'cutscene' ? <CutsceneOverlay tone={tone} onSkip={() => finishCutscene(true)} /> : null}
      {phase === 'paused' ? <PausedScreen tone={tone} onResume={resume} onLeave={leave} /> : null}
      {phase === 'levelResult' && levelResult ? (
        <LevelResultScreen
          tone={tone}
          result={levelResult}
          hasNext={nextAfterResult !== null}
          onAgain={() => startSong(levelResult.level)}
          onNext={() => nextAfterResult && startSong(nextAfterResult)}
          onSongs={() => goTo('songs')}
          onTitle={toTitle}
        />
      ) : null}
      {phase === 'albumResult' && albumResult ? (
        <AlbumResultScreen tone={tone} result={albumResult} onAgain={() => startAlbum(true)} onSongs={() => goTo('songs')} onTitle={toTitle} />
      ) : null}
    </div>
  );
}

/** True when a key lands on a focused button, which the browser should press. */
function onButton(event: KeyboardEvent): boolean {
  const target = event.target as Element | null;
  return Boolean(target?.closest?.('button'));
}

function setMediaSession(stage: Stage): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaSession || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: stage.title, artist: 'Mani Odubo', album: 'Loop Soul' });
  } catch {
    // Media Session is a nicety; never let it stop the fall.
  }
}
