import { feedPost, markFromFeed, matchFeed, words, type FeedPost } from '@/lib/social/feedMatch';
import { allPlatformsDone, platformState, withPlatformMark, type QueuePost } from '@/lib/social/postQueue';
import { plainError, youtubeDetails } from '@/lib/social/appLink';

const post = (id: string, caption: string, scheduled_at: string, platforms = ['instagram', 'tiktok'], extra: Partial<QueuePost> = {}): QueuePost => ({
  id,
  status: 'draft',
  caption,
  media_type: 'video',
  media_url: `https://videodelivery.net/${id}/downloads/default.mp4`,
  platforms,
  scheduled_at,
  ...extra,
});

const live = (platform: string, id: string, caption: string, at: string, views?: number): FeedPost => ({
  platform,
  id,
  caption,
  at,
  url: `https://example.com/${id}`,
  views,
});

describe('the apps feeds, matched to the Studio', () => {
  it('reads a caption by its words alone', () => {
    expect(words('Next level. #dance #fyp')).toBe('next level');
    expect(words('Santé, player one!')).toBe('sante player one');
  });

  it('finds the planned post a live one is: same app, same caption, near its time', () => {
    const posts = [
      post('reel-a', 'Next level.', '2026-10-27T19:00:00.000Z'),
      post('reel-b', 'Stage clear.', '2026-10-29T19:00:00.000Z'),
    ];
    const m = matchFeed(posts, [live('instagram', 'ig1', 'Next level. #dance', '2026-10-27T19:04:00.000Z', 1240)]);
    expect(m).toEqual([expect.objectContaining({ postId: 'reel-a', platform: 'instagram', known: false })]);
  });

  it('prefers the exact caption over one that only begins the same', () => {
    const posts = [
      post('short', 'Again.', '2026-11-10T02:00:00.000Z', ['tiktok']),
      post('reel', 'Again and again.', '2026-11-06T20:00:00.000Z', ['tiktok']),
    ];
    const m = matchFeed(posts, [live('tiktok', 't1', 'Again and again.', '2026-11-06T20:10:00.000Z')]);
    expect(m.map((x) => x.postId)).toEqual(['reel']);
  });

  it('does not take a post from another app, or one far from its day', () => {
    const posts = [post('reel-a', 'Next level.', '2026-10-27T19:00:00.000Z', ['instagram'])];
    expect(matchFeed(posts, [live('youtube', 'y1', 'Next level.', '2026-10-27T19:04:00.000Z')])).toEqual([]);
    expect(matchFeed(posts, [live('instagram', 'i1', 'Next level.', '2026-12-01T19:04:00.000Z')])).toEqual([]);
  });

  it('gives each live post one planned post, and each planned app one live post', () => {
    const posts = [post('a', 'Next level.', '2026-10-27T19:00:00.000Z', ['tiktok'])];
    const m = matchFeed(posts, [
      live('tiktok', 't1', 'Next level.', '2026-10-27T19:30:00.000Z'),
      live('tiktok', 't2', 'Next level.', '2026-10-28T19:30:00.000Z'),
    ]);
    expect(m.map((x) => x.item.id)).toEqual(['t1']);
  });

  it('knows a post it linked before and only refreshes its numbers', () => {
    const linked = post('a', 'Next level.', '2026-10-27T19:00:00.000Z', ['tiktok'], {
      platform_status: { tiktok: { posted: true, at: '2026-10-27T19:30:00.000Z', id: 't1', views: 10 } },
    });
    const [m] = matchFeed([linked], [live('tiktok', 't1', 'Next level.', '2026-10-27T19:30:00.000Z', 99)]);
    expect(m.known).toBe(true);
    expect(markFromFeed({ posted: true, id: 't1', views: 10 }, m.item, 'now').views).toBe(99);
  });

  it('ticks a post found live, keeps what a send knew, and the post is done when every app is', () => {
    const p = post('a', 'Next level.', '2026-10-27T19:00:00.000Z', ['instagram', 'tiktok'], {
      platform_status: { tiktok: { posted: false, sent: 'draft', pfm_id: 'sp_1' } },
    });
    const ig = markFromFeed(null, live('instagram', 'i1', 'Next level.', '2026-10-27T19:04:00.000Z', 5), 'now');
    const tt = markFromFeed({ posted: false, sent: 'draft', pfm_id: 'sp_1' }, live('tiktok', 't1', 'Next level.', '2026-10-27T19:20:00.000Z'), 'now');
    expect(tt.pfm_id).toBe('sp_1');
    const done = { ...p, platform_status: { instagram: ig, tiktok: tt } };
    expect(platformState(done, 'instagram')).toEqual(expect.objectContaining({ kind: 'posted', views: 5, url: 'https://example.com/i1' }));
    expect(allPlatformsDone(done)).toBe(true);
  });

  it('reads each app’s numbers under its own names', () => {
    const base = { platform_post_id: 'x', posted_at: '2026-10-27T19:00:00Z', platform_url: 'https://www.tiktok.com/@recoolman/video/1?utm_source=a' };
    expect(feedPost({ ...base, platform: 'tiktok', metrics: { view_count: 189, like_count: 5 } })).toEqual(
      expect.objectContaining({ platform: 'tiktok', views: 189, likes: 5, url: 'https://www.tiktok.com/@recoolman/video/1' }),
    );
    const yt = feedPost({ ...base, platform: 'youtube', platform_url: 'https://www.youtube.com/watch?v=VQVoXoFkd4s', metrics: { views: 41 } });
    expect(yt).toEqual(expect.objectContaining({ views: 41, url: 'https://www.youtube.com/watch?v=VQVoXoFkd4s' }));
    expect(feedPost({ ...base, platform: 'tiktok_business' }).platform).toBe('tiktok');
  });
});

describe('a send through Post for Me', () => {
  it('waits in the app until it is out, and an Undo of a tick keeps the send', () => {
    const sent = { youtube: { posted: false, sent: 'scheduled', pfm_id: 'sp_1', for: '2026-10-27T17:00:00.000Z' } };
    expect(platformState({ platform_status: sent }, 'youtube')).toEqual({ kind: 'scheduled', at: '2026-10-27T17:00:00.000Z' });
    const ticked = withPlatformMark(sent, 'youtube', true, 'now');
    const undone = withPlatformMark(ticked, 'youtube', false, 'later');
    expect(undone.youtube).toEqual({ posted: false, sent: 'scheduled', pfm_id: 'sp_1', for: '2026-10-27T17:00:00.000Z' });
  });

  it('names a full song after its campaign, and credits the song under the caption', () => {
    const d = youtubeDetails(
      { caption: 'Level 1-2.', notes: 'Fils de joie · Stromae\nSong laid in: 0:00 to 3:15', tags: ['training', 'full'], platforms: ['youtube'], campaign_id: 'c' },
      [{ id: 'c', name: '1-2 · Fils de joie' }],
    );
    expect(d).toEqual({ title: '1-2 · Fils de joie', description: 'Level 1-2.\n\nFils de joie · Stromae' });
  });

  it('says a refusal in one sentence', () => {
    expect(plainError("Failed to post to Youtube: 429 Too Many Requests. {\"error\": \"Quota exceeded for quota metric 'Video Uploads'\"}")).toMatch(/daily upload limit/);
    expect(plainError('Something broke\n{ "stack": 1 }')).toBe('Something broke');
  });
});
