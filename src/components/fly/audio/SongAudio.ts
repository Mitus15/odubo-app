/**
 * The song under the fall, and the clock the fall runs on.
 *
 * A level lasts exactly as long as its song, so the game's time IS the song's
 * time: clock() is the song's position, smoothed between the element's own
 * reports, and it stops whenever the song stops. A phone that stalls on a
 * slow connection pauses the fall with it instead of letting the world run on
 * ahead of the music.
 *
 * When there is no song to play (no link, or the file failed twice) the clock
 * runs on its own, so the game still plays, just without sound.
 *
 * Two elements, A and B: while one plays, the next song loads in the other,
 * and swap() starts it the moment the first one ends. That is as close to
 * gapless as plain audio elements get.
 *
 * Framework-free and client-only: construct it in the browser, never during a
 * server render.
 *
 * iOS notes. An element may play outside a tap only once it has played inside
 * one, which is what unlock() is for. And iOS ignores an element's volume, so
 * there fadeOut() is a cut at the end of the fade rather than a fade.
 */

/** 8 ms of 8-bit silence: enough for iOS to count as a play. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

/** HTMLMediaElement.HAVE_FUTURE_DATA: enough to keep playing, not just this frame. */
const HAVE_FUTURE_DATA = 3;
/** Trust the element again once it disagrees with the extrapolation by more than this (s). */
const DRIFT_SECONDS = 0.05;
/** A step back smaller than this is held, so the fall never runs backwards (s). */
const HOLD_SECONDS = 0.25;
/** How often a fade steps the volume (ms). */
const FADE_STEP_MS = 16;
/** Playing, with data, yet not moving for this long (ms): the song goes on silently. */
const STUCK_MS = 2500;
/** Waiting this long for a song's data (ms), the fall goes on without it. */
const GIVE_UP_MS = 12000;

interface Slot {
  el: HTMLAudioElement;
  /** The link the game asked for, without the retry mark. Null: no song. */
  url: string | null;
  /** Bumps whenever the source changes, so a late callback can tell it is stale. */
  gen: number;
  /** Already asked again once after an error. */
  retried: boolean;
  /** Failed twice: this song plays on the silent clock. */
  failed: boolean;
  /** Set by preload(): swap() has something to start. */
  staged: boolean;
  /** How long the song is (s), so the silent clock knows when it ends. */
  seconds: number | null;
  /** Where to seek once the file's length is known. */
  seekTo: number | null;
  /** Has played inside a tap, so iOS will let it play later. */
  unlocked: boolean;
  detach: () => void;
}

interface Fade {
  timer: ReturnType<typeof setInterval>;
  el: HTMLAudioElement;
  volume: number;
  resolve: () => void;
}

export interface SongAudioOptions {
  onEnded?: () => void;
  /** The phone paused the song by itself (headphones out, a call). */
  onInterrupted?: () => void;
  /** Milliseconds. performance.now by default; tests pass their own. */
  now?: () => number;
  /** Makes one audio element. new Audio() by default; tests pass their own. */
  createElement?: () => HTMLAudioElement;
}

/** play() without ever throwing synchronously, and without waiting for anything first. */
function attemptPlay(el: HTMLAudioElement): Promise<void> {
  try {
    return Promise.resolve(el.play());
  } catch (err) {
    return Promise.reject(err);
  }
}

function errorName(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err) return String((err as { name: unknown }).name);
  return '';
}

/** The same link, marked so no cache along the way hands back the failure. */
function withRetryMark(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}r=1`;
}

export class SongAudio {
  /** Called once when the song playing reaches its end, heard or silent. */
  onEnded: (() => void) | null;
  /** Called when the phone pauses the song by itself, not the game. */
  onInterrupted: (() => void) | null;

  private readonly slots: [Slot, Slot];
  private active: 0 | 1 = 0;
  private readonly now: () => number;
  private mode: 'media' | 'silent' = 'silent';
  /** A song has been started at least once. */
  private started = false;
  /** Paused by the game. */
  private held = true;
  private endedFired = false;
  /** The file ended short of the song's length; the clock is finishing the song. */
  private tail = false;
  /** The browser refused to play outside a gesture; a later tap may change its mind. */
  private blocked = false;
  private destroyed = false;

  // The media clock: the element's position at a wall time, extrapolated from.
  private anchored = false;
  private anchorMedia = 0;
  private anchorWall = 0;
  /** Where the song is meant to start, until the element can say for itself. */
  private pendingStart: number | null = null;
  /** What clock() last said. */
  private last = 0;
  /** The element's time when last seen moving, and since when it has not (wall ms). */
  private stuckAt = -1;
  private stuckSince = 0;
  /** Since when the song has kept the fall waiting for data (wall ms), or -1. */
  private waitingSince = -1;

  // The silent clock.
  private silentBase = 0;
  private silentWall = 0;
  private silentDone = false;
  private silentTimer: ReturnType<typeof setTimeout> | null = null;

  private fade: Fade | null = null;

  constructor(options: SongAudioOptions = {}) {
    this.onEnded = options.onEnded ?? null;
    this.onInterrupted = options.onInterrupted ?? null;
    this.now = options.now ?? (() => performance.now());
    const make = options.createElement ?? (() => new Audio());
    this.slots = [this.makeSlot(make()), this.makeSlot(make())];
  }

  /** True while the game hears the song; false on the silent clock. */
  get audible(): boolean {
    return this.mode === 'media' || this.tail;
  }

  /**
   * Call inside the first tap, before play(). Both elements play a few
   * milliseconds of silence, so the next song can start from an 'ended'
   * event later, outside any tap, and iOS will still allow it.
   */
  unlock(): void {
    if (this.destroyed) return;
    for (const slot of this.slots) {
      if (slot.unlocked) continue;
      slot.unlocked = true;
      const el = slot.el;
      // A song preloaded before the tap goes back in once the silence is done.
      const keep = slot.url;
      const gen = ++slot.gen;
      el.src = SILENT_WAV;
      const settle = (): void => {
        if (this.destroyed || slot.gen !== gen) return;
        el.pause();
        if (keep) {
          slot.gen++;
          el.src = keep;
        }
      };
      attemptPlay(el).then(settle, settle);
    }
  }

  /**
   * Start a song from fromSeconds. Safe inside a tap: the source is set and
   * play() is called at once, with nothing awaited in between, which is what
   * Safari needs to count it as the user's own action. With no url the song
   * plays on the silent clock.
   *
   * Pass songSeconds (the level's length) whenever it is known: the silent
   * clock ends there, and a file that runs short of it is finished in silence,
   * so the clock always reaches the level's last tick before onEnded.
   */
  play(url: string | null | undefined, fromSeconds = 0, songSeconds?: number): void {
    if (this.destroyed) return;
    const from = Math.max(0, fromSeconds);
    const idle = this.idle;
    // Already loading next door: start that one rather than load it twice.
    if (url && from === 0 && idle.staged && idle.url === url && !idle.failed) {
      if (songSeconds !== undefined) idle.seconds = songSeconds;
      this.swap();
      return;
    }

    const slot = this.current;
    slot.el.pause();
    idle.el.pause();
    this.cancelFade();
    this.beginSong(slot, from, songSeconds ?? null);
    slot.gen++;
    slot.url = url || null;
    slot.retried = false;
    slot.failed = false;
    slot.staged = false;
    slot.unlocked = true;
    if (!slot.url) {
      this.goSilent(from);
      return;
    }

    this.mode = 'media';
    this.pendingStart = from;
    slot.seekTo = from > 0 ? from : null;
    slot.el.src = slot.url;
    if (from > 0) {
      try {
        slot.el.currentTime = from;
      } catch {
        // Too early for this browser; loadedmetadata applies it.
      }
    }
    this.start(slot);
  }

  /** Load the next song in the idle element, ready for swap(). */
  preload(url: string | null | undefined, songSeconds?: number): void {
    if (this.destroyed) return;
    const slot = this.idle;
    slot.seconds = songSeconds ?? null;
    slot.staged = true;
    const next = url || null;
    if (next && slot.url === next && !slot.failed) return;
    slot.gen++;
    slot.url = next;
    slot.retried = false;
    slot.failed = false;
    slot.seekTo = null;
    if (!next) return;
    slot.el.preload = 'auto';
    slot.el.src = next;
  }

  /** Start the preloaded song. False when nothing was preloaded. */
  swap(): boolean {
    if (this.destroyed) return false;
    const next = this.idle;
    if (!next.staged) return false;
    const prev = this.current;
    prev.el.pause();
    this.cancelFade();
    this.active = this.active === 0 ? 1 : 0;
    next.staged = false;
    next.unlocked = true;
    this.beginSong(next, 0, next.seconds);
    if (!next.url || next.failed) {
      this.goSilent(0);
      return true;
    }
    this.mode = 'media';
    this.pendingStart = 0;
    if (next.el.currentTime !== 0) {
      try {
        next.el.currentTime = 0;
      } catch {
        // A fresh element is at 0 already.
      }
    }
    this.start(next);
    return true;
  }

  pause(): void {
    if (this.destroyed) return;
    if (this.held) {
      this.cancelFade();
      return;
    }
    if (this.mode === 'silent') {
      this.silentBase = this.silentClock();
      this.clearSilentTimer();
    }
    this.held = true;
    this.anchored = false;
    // Silence first, then put the volume back, so a fade never ends on a blip.
    this.current.el.pause();
    this.cancelFade();
  }

  resume(): void {
    // A song that has ended stays ended: play() on an ended element would
    // quietly start it again from the top.
    if (this.destroyed || !this.started || !this.held || this.endedFired) return;
    this.held = false;
    const slot = this.current;
    if (this.mode === 'silent') {
      if (this.blocked && slot.url && !slot.failed) {
        // Refused before; this may be the tap the browser was waiting for.
        this.blocked = false;
        this.reattach(slot, this.silentBase);
        return;
      }
      this.silentWall = this.now();
      this.scheduleSilentEnd();
      return;
    }
    this.start(slot);
  }

  /** Fade to nothing over ms, then pause. The clock runs until the pause. */
  fadeOut(ms: number): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    this.cancelFade();
    if (this.held || !(ms > 0)) {
      this.pause();
      return Promise.resolve();
    }
    const el = this.current.el;
    const volume = el.volume;
    const t0 = this.now();
    return new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        const k = Math.min(1, (this.now() - t0) / ms);
        try {
          el.volume = volume * (1 - k);
        } catch {
          // iOS: volume is read-only, so the fade is a cut at the end.
        }
        // pause() ends the fade: it restores the volume and resolves.
        if (k >= 1) this.pause();
      }, FADE_STEP_MS);
      this.fade = { timer, el, volume, resolve };
    });
  }

  /**
   * The song's position (s), which is the game's time. Between the element's
   * reports it is extrapolated from the wall clock, and it trusts the element
   * again as soon as the two drift apart by more than 50 ms. Frozen while
   * paused, buffering or ended: the fall waits for the song.
   */
  clock(): number {
    if (!this.started) return 0;
    const t = this.mode === 'silent' ? this.silentClock() : this.mediaClock();
    const out = t < this.last && this.last - t < HOLD_SECONDS ? this.last : t;
    this.last = out;
    return out;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const slot of this.slots) {
      slot.detach();
      slot.gen++;
      try {
        slot.el.pause();
      } catch {
        // Already gone.
      }
    }
    this.cancelFade();
    this.clearSilentTimer();
    for (const slot of this.slots) {
      try {
        // Drop the source and its connection; a paused element still buffers.
        slot.el.removeAttribute('src');
        slot.el.load();
      } catch {
        // Already gone.
      }
    }
    this.onEnded = null;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private get current(): Slot {
    return this.slots[this.active];
  }

  private get idle(): Slot {
    return this.slots[this.active === 0 ? 1 : 0];
  }

  private makeSlot(el: HTMLAudioElement): Slot {
    el.preload = 'auto';
    const slot: Slot = {
      el,
      url: null,
      gen: 0,
      retried: false,
      failed: false,
      staged: false,
      seconds: null,
      seekTo: null,
      unlocked: false,
      detach: () => {},
    };
    const onEnded = (): void => this.handleEnded(slot);
    const onError = (): void => this.handleError(slot);
    const onMetadata = (): void => this.applySeek(slot);
    const onPause = (): void => this.handlePause(slot);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('loadedmetadata', onMetadata);
    el.addEventListener('pause', onPause);
    slot.detach = () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('loadedmetadata', onMetadata);
      el.removeEventListener('pause', onPause);
    };
    return slot;
  }

  /** Everything a new song resets, whichever way it starts. */
  private beginSong(slot: Slot, from: number, seconds: number | null): void {
    slot.seconds = seconds;
    this.started = true;
    this.held = false;
    this.endedFired = false;
    this.tail = false;
    this.blocked = false;
    this.anchored = false;
    this.pendingStart = null;
    this.stuckAt = -1;
    this.waitingSince = -1;
    this.last = from;
    this.silentDone = false;
    this.clearSilentTimer();
  }

  private start(slot: Slot): void {
    const gen = slot.gen;
    attemptPlay(slot.el).catch((err: unknown) => {
      if (this.destroyed || slot.gen !== gen || slot !== this.current || this.mode !== 'media') return;
      // AbortError: a newer source or a pause cut it short, which is fine.
      // NotSupportedError: the element's 'error' event deals with it.
      if (errorName(err) === 'NotAllowedError') {
        // The game plays on without sound; resume() in a later tap tries again.
        this.blocked = true;
        this.goSilent(this.clock());
      }
    });
  }

  /** Back to the element after the silent clock, at the silent clock's position. */
  private reattach(slot: Slot, at: number): void {
    this.clearSilentTimer();
    this.mode = 'media';
    this.anchored = false;
    this.pendingStart = at;
    slot.seekTo = at;
    if (slot.el.readyState >= 1) this.applySeek(slot);
    this.start(slot);
  }

  private goSilent(at: number): void {
    const slot = this.current;
    try {
      slot.el.pause();
    } catch {
      // Nothing to stop.
    }
    const length = slot.el.duration;
    if (slot.seconds === null && Number.isFinite(length) && length > 0) slot.seconds = length;
    this.mode = 'silent';
    this.anchored = false;
    this.pendingStart = null;
    this.silentBase = at;
    this.silentWall = this.now();
    this.silentDone = false;
    this.scheduleSilentEnd();
  }

  private mediaClock(): number {
    const el = this.current.el;
    const raw = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    const flowing = !this.held && !el.paused && !el.ended && !el.seeking && el.readyState >= HAVE_FUTURE_DATA;
    if (!flowing) {
      // Paused, buffering or over: the fall waits for the song (and the stuck watch starts over).
      this.stuckAt = -1;
      this.anchored = false;
      const at = this.pendingStart ?? raw;
      // Waiting on data, not on the game: give it a while, then go on in silence
      // rather than leave the fall frozen on a song that will not come.
      const waiting = !this.held && !el.ended;
      if (!waiting) {
        this.waitingSince = -1;
      } else if (this.waitingSince < 0) {
        this.waitingSince = this.now();
      } else if (this.now() - this.waitingSince > GIVE_UP_MS) {
        this.waitingSince = -1;
        this.goSilent(at);
      }
      return at;
    }
    this.waitingSince = -1;
    this.pendingStart = null;
    const wall = this.now();
    // An element that says it is playing, with data to play, yet never moves
    // (no audio output to drive it) would freeze the fall for good. After a
    // while like that, the song goes on in silence from where it stopped.
    if (raw !== this.stuckAt) {
      this.stuckAt = raw;
      this.stuckSince = wall;
    } else if (wall - this.stuckSince > STUCK_MS) {
      this.goSilent(raw);
      return raw;
    }
    if (this.anchored) {
      const rate = el.playbackRate > 0 ? el.playbackRate : 1;
      const predicted = this.anchorMedia + ((wall - this.anchorWall) / 1000) * rate;
      if (Math.abs(raw - predicted) <= DRIFT_SECONDS) return predicted;
    }
    this.anchored = true;
    this.anchorMedia = raw;
    this.anchorWall = wall;
    return raw;
  }

  private silentClock(): number {
    if (this.held || this.silentDone) return this.silentBase;
    const t = this.silentBase + (this.now() - this.silentWall) / 1000;
    const length = this.current.seconds;
    return length === null ? t : Math.min(t, length);
  }

  private scheduleSilentEnd(): void {
    this.clearSilentTimer();
    const length = this.current.seconds;
    if (this.held || this.silentDone || length === null) return;
    const left = Math.max(0, (length - this.silentClock()) * 1000);
    this.silentTimer = setTimeout(() => {
      this.silentTimer = null;
      if (this.destroyed || this.mode !== 'silent' || this.held) return;
      this.silentBase = length;
      this.silentDone = true;
      this.fireEnded();
    }, left);
  }

  private clearSilentTimer(): void {
    if (this.silentTimer === null) return;
    clearTimeout(this.silentTimer);
    this.silentTimer = null;
  }

  private cancelFade(): void {
    const fade = this.fade;
    if (!fade) return;
    this.fade = null;
    clearInterval(fade.timer);
    try {
      fade.el.volume = fade.volume;
    } catch {
      // iOS: read-only, and never changed.
    }
    fade.resolve();
  }

  private applySeek(slot: Slot): void {
    if (slot.seekTo === null) return;
    const to = slot.seekTo;
    slot.seekTo = null;
    try {
      slot.el.currentTime = to;
    } catch {
      // Refused: it plays from where it is, and the clock follows it.
    }
  }

  private handleEnded(slot: Slot): void {
    if (this.destroyed || slot !== this.current || this.mode !== 'media') return;
    // A file can run a little short of the song's listed length (Ghost World's
    // master by 0.4 s). The level IS the listed length, so the clock carries
    // on in silence to it and the song ends there.
    // Any shortfall at all, even a few milliseconds: a clock left short of the
    // last tick would leave the level waiting forever.
    const at = Number.isFinite(slot.el.currentTime) ? slot.el.currentTime : this.last;
    if (slot.seconds !== null && at < slot.seconds) {
      this.tail = true;
      this.goSilent(Math.max(at, this.last));
      return;
    }
    this.fireEnded();
  }

  private handleError(slot: Slot): void {
    if (this.destroyed || !slot.url || slot.el.src.startsWith('data:')) return;
    const isCurrent = slot === this.current && this.mode === 'media';
    if (!slot.retried) {
      // Once: a dropped connection or a stale link deserves a second ask, at
      // the point the game had reached.
      slot.retried = true;
      slot.gen++;
      const at = isCurrent ? this.last : 0;
      slot.seekTo = at > 0 ? at : null;
      if (isCurrent) {
        this.pendingStart = at;
        this.anchored = false;
      }
      slot.el.src = withRetryMark(slot.url);
      if (isCurrent && !this.held) this.start(slot);
      return;
    }
    slot.failed = true;
    if (isCurrent) this.goSilent(this.last);
  }

  /**
   * The phone stopped the song on its own (headphones out, a call, Bluetooth
   * gone). The game paused nothing, so say so: the fall should show its pause
   * screen rather than freeze. The game's own pauses and swaps are filtered out
   * by checking the state when the event arrives, not when it was queued.
   */
  private handlePause(slot: Slot): void {
    if (this.destroyed || slot !== this.current || this.mode !== 'media' || this.held) return;
    if (!slot.el.paused || slot.el.ended || this.endedFired) return;
    this.onInterrupted?.();
  }

  private fireEnded(): void {
    if (this.endedFired) return;
    this.endedFired = true;
    this.onEnded?.();
  }
}

/** The part of useMusicPlayer() this needs. */
export interface SiteMusicPlayer {
  readonly state: { readonly isPlaying: boolean };
  togglePlayPause: () => void;
}

const quietedStates = new WeakSet<object>();

/**
 * Quiet the site's own music player before a song starts here: one voice at
 * a time, and the last one asked for wins. The player has no pause, only a
 * toggle, so it is toggled only while it says it is playing, and only once
 * per state: two calls before React re-renders would toggle it back on.
 * Returns true when it asked the player to stop.
 */
export function pauseSiteMusic(player: SiteMusicPlayer | null | undefined): boolean {
  if (!player || !player.state.isPlaying) return false;
  if (quietedStates.has(player.state)) return false;
  quietedStates.add(player.state);
  player.togglePlayPause();
  return true;
}
