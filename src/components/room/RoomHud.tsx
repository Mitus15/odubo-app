import { Mark } from './RoomParts';
import { ODUBO_SEAL, ODUBO_SEAL_ASPECT } from '@/lib/brand/marks';

/**
 * The game's layer, drawn by the site instead of burned into the video: the
 * clean copy carries none (scripts/loop/posts/site_copies.py), and the HUD
 * comes from the Studio's data about which piece it is. The same layout as
 * the film's (scripts/loop/film/hud.py, layout D, his pick 2026-10-12), in
 * the same fractions of the frame, so it sits where the videos' own did:
 *
 *   left        the seal, and the character he plays (no steps: his call)
 *   right       the level, or TRAINING, over the song and its artist
 *   under both  a thin line, the piece's progress (a level's; practice has no finish)
 *
 * Sizes are in the frame's own width (cqw: 1cqw = 10.8px of a 1080 frame).
 */
export interface HudSpec {
  level: string;
  credit: string;
  player: string;
  /** A level shows its progress; training does not */
  progress: boolean;
}

const px = (n: number) => `${((n / 1080) * 100).toFixed(3)}cqw`;

export default function RoomHud({ level, credit, player, progress }: Omit<HudSpec, 'progress'> & { progress: number | null }) {
  return (
    <div aria-hidden="true" className="room-display pointer-events-none absolute inset-x-0" style={{ top: px(236), paddingLeft: px(72), paddingRight: px(72) }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center" style={{ gap: px(20), height: px(58) }}>
          <Mark src={ODUBO_SEAL} aspect={ODUBO_SEAL_ASPECT} height={0} label="" size={px(58)} />
          <span className="uppercase" style={{ fontWeight: 500, fontSize: px(20), letterSpacing: '0.16em' }}>
            {player}
          </span>
        </div>
        <div className="text-right uppercase" style={{ lineHeight: 1 }}>
          <div style={{ fontSize: px(40), letterSpacing: '0.08em' }}>{level}</div>
          <div style={{ fontWeight: 500, fontSize: px(20), letterSpacing: '0.16em', marginTop: px(14) }}>{credit}</div>
        </div>
      </div>
      {progress !== null && (
        <div className="relative" style={{ marginTop: px(22), height: px(3) }}>
          <span className="absolute inset-0 bg-current opacity-[0.22]" />
          <span className="absolute inset-y-0 left-0 bg-current" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </div>
      )}
    </div>
  );
}
