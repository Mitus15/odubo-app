import { allPlatformsDone, captionFor, isPlatformDone, markPatch, queueOf, soundCue, withPlatformMark, type QueuePost } from '@/lib/social/postQueue';

const post = (id: string, extra: Partial<QueuePost> = {}): QueuePost => ({
  id,
  status: 'draft',
  media_type: 'video',
  media_url: `https://videodelivery.net/${id}/downloads/default.mp4`,
  platforms: ['instagram', 'tiktok'],
  ...extra,
});

// Monday 12 October 2026, 09:00 local
const now = new Date(2026, 9, 12, 9, 0, 0);
const at = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0).toISOString();

describe('the posting queue', () => {
  it('puts today and anything overdue first, in time order, then later, then undated', () => {
    const q = queueOf(
      [
        post('wed', { scheduled_at: at(14) }),
        post('mon-late', { scheduled_at: at(12, 18) }),
        post('sun-missed', { scheduled_at: at(11) }),
        post('mon', { scheduled_at: at(12) }),
        post('someday'),
      ],
      now,
    );
    expect(q.due.map((p) => p.id)).toEqual(['sun-missed', 'mon', 'mon-late']);
    expect(q.later.map((p) => p.id)).toEqual(['wed']);
    expect(q.unplanned.map((p) => p.id)).toEqual(['someday']);
  });

  it('leaves out what is already out, and shows what went out today', () => {
    const q = queueOf(
      [
        post('done', { status: 'published', published_at: at(12, 8), scheduled_at: at(12) }),
        post('old', { status: 'published', published_at: at(10) }),
        post('busy', { status: 'publishing', scheduled_at: at(12) }),
      ],
      now,
    );
    expect(q.due).toEqual([]);
    expect(q.postedToday.map((p) => p.id)).toEqual(['done']);
  });

  it('is done when every planned platform is ticked, and only then', () => {
    let p = post('reel');
    p = { ...p, platform_status: withPlatformMark(p.platform_status, 'instagram', true, at(12)) };
    expect(isPlatformDone(p, 'instagram')).toBe(true);
    expect(allPlatformsDone(p)).toBe(false);
    p = { ...p, platform_status: withPlatformMark(p.platform_status, 'tiktok', true, at(12)) };
    expect(allPlatformsDone(p)).toBe(true);
    p = { ...p, platform_status: withPlatformMark(p.platform_status, 'tiktok', false, at(12)) };
    expect(allPlatformsDone(p)).toBe(false);
  });

  it('puts a post back in the queue when its last tick is undone', () => {
    // A YouTube Short ticked by the share sheet, then left as a draft on YouTube (Oct 28)
    const short = post('short', { platforms: ['youtube'], scheduled_at: at(11, 18) });
    const ticked = markPatch(short, 'youtube', true, at(11, 23));
    expect(ticked).toMatchObject({ status: 'published', published_at: at(11, 23) });
    const out = { ...short, platform_status: ticked.platform_status, status: 'published', published_at: at(11, 23) };
    expect(queueOf([out], now).due).toEqual([]);

    const undone = markPatch(out, 'youtube', false, at(12));
    expect(undone).toEqual({ platform_status: { youtube: { posted: false } }, status: 'draft', published_at: null });
    const back = { ...out, platform_status: undone.platform_status, status: 'draft', published_at: undefined };
    expect(queueOf([back], now).due.map((p) => p.id)).toEqual(['short']);
  });

  it('leaves the status alone on a tick that does not finish the post', () => {
    expect(markPatch(post('reel'), 'instagram', true, at(12))).toEqual({
      platform_status: { instagram: { posted: true, at: at(12) } },
    });
  });

  it('keeps whatever else platform_status held (PostForMe statuses)', () => {
    const status = withPlatformMark({ youtube: 'processing' }, 'instagram', true, at(12));
    expect(status.youtube).toBe('processing');
  });

  it('pastes the platform caption when there is one, the hashtags after', () => {
    const p = post('clap', { caption: 'Billie Jean, in silhouette.', hashtags: ['billiejean', '#dance'], caption_by_platform: { youtube: '1-1 · Billie Jean' } });
    expect(captionFor(p, 'instagram')).toBe('Billie Jean, in silhouette.\n\n#billiejean #dance');
    expect(captionFor(p, 'youtube')).toBe('1-1 · Billie Jean\n\n#billiejean #dance');
  });
});

describe('the sound cue in a note', () => {
  const note = 'Monkey · M.I Abaga\nSound from 0:17 (to 0:59)\nAdd the song in the app from that time.\nOct 23 · 1023-monkey-reel-a';

  it('takes the start and end out of the note and keeps the other lines in order', () => {
    expect(soundCue(note)).toEqual({
      from: '0:17',
      to: '0:59',
      extra: undefined,
      rest: ['Monkey · M.I Abaga', 'Add the song in the app from that time.', 'Oct 23 · 1023-monkey-reel-a'],
    });
  });

  it('keeps what follows the times on that line', () => {
    expect(soundCue('Sound from 0:00 (to 0:57) (the song starts 4 s into the video)')).toMatchObject({
      from: '0:00',
      to: '0:57',
      extra: '(the song starts 4 s into the video)',
    });
  });

  it('is null for a note without one, a full video with the song laid in, or none', () => {
    expect(soundCue('Song laid in: 0:00 to 4:06')).toBeNull();
    expect(soundCue('')).toBeNull();
    expect(soundCue(undefined)).toBeNull();
  });
});
