'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import RoomHud, { type HudSpec } from './RoomHud';

/**
 * A level in its room: the video, silent (lib/levels: the site never plays
 * the song), contained and unframed, so its field runs into the room's own
 * colour behind it (lib/room) and only the dancer is seen.
 *
 * The still is there at first paint, before any script. Only a room near the
 * one on screen holds a stream, and only the one on screen plays, so a long
 * feed costs one video. A tap pauses or plays; with reduced motion asked for,
 * it waits for the tap.
 */
export default function RoomVideo({
  hls,
  poster,
  title,
  active = true,
  near = true,
  className = 'relative',
  style,
  tapToPause = true,
  hud,
}: {
  /** Null: there is no site copy yet, so the still alone, and nothing streams */
  hls: string | null;
  poster: string;
  title: string;
  /** On screen: plays */
  active?: boolean;
  /** Next to the one on screen: holds its stream, ready */
  near?: boolean;
  /** Positioned: 'relative' with a size, or 'absolute' with its edges */
  className?: string;
  style?: CSSProperties;
  /** False: a tap belongs to what holds the video (the main page opens the focused view) */
  tapToPause?: boolean;
  /** The game's layer, drawn by the site over the clean copy (the focused view); none on the main page */
  hud?: HudSpec;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);
  /** How far through the piece is (0..1), for the HUD's line */
  const [progress, setProgress] = useState(0);
  /** Reduced motion: nothing moves until the tap, so the play button is there from the start */
  const [waitsForTap, setWaitsForTap] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    userPaused.current = true;
    setWaitsForTap(true);
  }, []);

  // The stream, while near
  useEffect(() => {
    const video = ref.current;
    if (!video || !near || !hls) return;
    let handle: HlsHandle | null = null;
    let gone = false;
    attachHls(video, hls).then((h) => {
      if (gone) return h?.destroy();
      handle = h;
      if (activeRef.current && !userPaused.current) video.play().catch(() => {});
    });
    return () => {
      gone = true;
      handle?.destroy();
      setShown(false);
      setPlaying(false);
    };
  }, [hls, near]);

  // Playing, while on screen
  useEffect(() => {
    const video = ref.current;
    if (!video || !near || !hls) return;
    if (active && !userPaused.current) video.play().catch(() => {});
    if (!active) video.pause();
  }, [active, near, hls]);

  const toggle = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }, []);

  return (
    <div className={`flex items-center justify-center [container-type:size] ${className}`} style={style}>
      {/* Exactly the video's 9:16, as large as the space allows, its edges feathered into the room */}
      <div className="relative aspect-[9/16] w-[min(100cqw,56.25cqh)] [container-type:inline-size]">
      <div className="room-feather absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {hls && <video
          ref={ref}
          muted
          playsInline
          loop
          preload="metadata"
          aria-label={title}
          onPlaying={() => {
            setPlaying(true);
            setShown(true);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={hud?.progress ? (e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0) : undefined}
          onClick={tapToPause ? toggle : undefined}
          className={`absolute inset-0 h-full w-full ${tapToPause ? 'cursor-pointer' : 'pointer-events-none'} object-cover transition-opacity duration-500 ${shown ? 'opacity-100' : 'opacity-0'}`}
        />}
      </div>
      {hud && <RoomHud {...hud} progress={hud.progress ? progress : null} />}
      </div>
      {hls && tapToPause && active && !playing && (shown || waitsForTap) && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Play ${title}`}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-current"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
