/**
 * The levels (lib/levels): which Studio posts reach the site, and what each says.
 */
import { bySong, creditOf, hearIt, hudOf, levelFrom, PLAYER, sortLevels, stillAt, type LevelRow } from '@/lib/levels';

jest.mock('@/lib/db', () => ({ queryDatabase: jest.fn() }));

const UID = 'b534d0dadc5edb5b7adb66fc4c1c78e3';
const SITE = 'aaaabbbbccccddddeeeeffff00001111';

function row(over: Partial<LevelRow> = {}): LevelRow {
  return {
    id: 'p1',
    tags: '["full"]',
    platforms: '["youtube"]',
    platform_status: '{"youtube":{"posted":true,"at":"2026-10-27T17:05:00.000Z"}}',
    media_url: `https://videodelivery.net/${UID}/downloads/default.mp4`,
    thumbnail_url: `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg`,
    campaign_id: 'camp_fils',
    campaign_name: '1-2 · Fils de joie',
    campaign_color: '#e2492f',
    ...over,
  };
}

describe('levelFrom', () => {
  it('makes a level of a piece that is out', () => {
    const level = levelFrom(row(), { 'Fils de joie': 'Stromae' }, { camp_fils: SITE });
    expect(level).toMatchObject({
      id: 'p1',
      code: '1-2',
      label: 'Level 1-2',
      song: 'Fils de joie',
      artist: 'Stromae',
      kind: 'full',
      colour: '#e2492f',
      hls: `https://videodelivery.net/${SITE}/manifest/video.m3u8`,
      outAt: '2026-10-27T17:05:00.000Z',
      links: [{ platform: 'youtube', url: null }],
    });
  });

  it('stands the site copy\'s first frame, through the site, in the video\'s colour', () => {
    const level = levelFrom(row(), {}, { camp_fils: SITE })!;
    expect(level.poster).toBe(`/stills/${SITE}.jpg?h=1920`);
    expect(stillAt(level.poster, 640)).toBe(`/stills/${SITE}.jpg?h=640`);
  });

  it('streams only the song\'s clean, silent site copy: none yet, a still and no stream', () => {
    const level = levelFrom(row())!;
    expect(level.hls).toBeNull();
    expect(level.poster).toBe(`https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg`);
    expect(levelFrom(row(), {}, { camp_fils: 'not-a-uid' })!.hls).toBeNull();
  });

  it('leaves out a piece that is not out anywhere yet', () => {
    expect(levelFrom(row({ platform_status: '{"youtube":{"posted":false}}' }))).toBeNull();
    expect(levelFrom(row({ platform_status: '{"youtube":{"posted":false,"sent":"scheduled"}}' }))).toBeNull();
    expect(levelFrom(row({ platform_status: null }))).toBeNull();
  });

  it('leaves out Shorts, the Reels cut again for YouTube', () => {
    expect(levelFrom(row({ tags: '["shorts"]' }))).toBeNull();
  });

  it('leaves out a post that is not a dance piece on Stream', () => {
    expect(levelFrom(row({ campaign_name: 'Spring drop' }))).toBeNull();
    expect(levelFrom(row({ media_url: 'https://www.youtube.com/embed/abc' }))).toBeNull();
  });

  it('calls a training piece Training', () => {
    expect(levelFrom(row({ campaign_name: 'Training · Monkey' }))).toMatchObject({ code: null, label: 'Training', song: 'Monkey' });
  });

  it('tells the first, untagged pieces apart by where they went', () => {
    expect(levelFrom(row({ tags: '["1-1"]', platforms: '["youtube"]' }))?.kind).toBe('full');
    expect(levelFrom(row({ tags: '["1-1"]', platforms: '["instagram","tiktok"]' }))?.kind).toBe('reels');
  });

  it('lists the apps it is out on, YouTube first, with the link when the Studio has it', () => {
    const level = levelFrom(
      row({
        platform_status: JSON.stringify({
          tiktok: { posted: true, at: '2026-10-27T19:10:00Z' },
          instagram: { posted: true, at: '2026-10-27T19:00:00Z', url: 'https://www.instagram.com/reel/x/' },
          youtube: { posted: false },
        }),
      }),
    );
    expect(level?.links).toEqual([
      { platform: 'instagram', url: 'https://www.instagram.com/reel/x/' },
      { platform: 'tiktok', url: null },
    ]);
    expect(level?.outAt).toBe('2026-10-27T19:00:00Z');
  });
});

describe('creditOf', () => {
  it('reads the artist from a note that starts with the song', () => {
    expect(creditOf('Monkey · M.I Abaga\nSound from 0:17', 'Monkey')).toBe('M.I Abaga');
  });
  it('reads nothing from a note about something else', () => {
    expect(creditOf('YouTube long form, not a Short.', 'Billie Jean')).toBeNull();
    expect(creditOf(null, 'Billie Jean')).toBeNull();
  });
});

describe('hearIt', () => {
  const accounts = [{ platform: 'youtube', url: 'https://www.youtube.com/@maniodubo' }];
  it('sends to the post when the Studio has its link', () => {
    const level = levelFrom(row({ platform_status: '{"youtube":{"posted":true,"at":"x","url":"https://youtu.be/abc"}}' }))!;
    expect(hearIt(level, accounts)).toEqual({ platform: 'youtube', app: 'YouTube', url: 'https://youtu.be/abc' });
  });
  it('falls back to the account', () => {
    expect(hearIt(levelFrom(row())!, accounts)).toEqual({ platform: 'youtube', app: 'YouTube', url: 'https://www.youtube.com/@maniodubo' });
  });
  it('says nothing when neither is known', () => {
    expect(hearIt(levelFrom(row())!, [])).toBeNull();
  });
});

describe('sortLevels', () => {
  it('puts the newest first', () => {
    const a = levelFrom(row({ id: 'a', platform_status: '{"youtube":{"posted":true,"at":"2026-10-26T18:00:00Z"}}' }))!;
    const b = levelFrom(row({ id: 'b', platform_status: '{"youtube":{"posted":true,"at":"2026-10-27T17:00:00Z"}}' }))!;
    expect(sortLevels([a, b]).map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('bySong', () => {
  it('gives a song one room, showing its whole dance, out wherever any piece is', () => {
    const full = levelFrom(row({ id: 'full', tags: '["full"]', platform_status: '{"youtube":{"posted":true,"at":"2026-10-26T18:00:00Z"}}' }))!;
    const reel = levelFrom(
      row({ id: 'reel', tags: '["reels"]', platforms: '["instagram"]', platform_status: '{"instagram":{"posted":true,"at":"2026-10-13T14:00:00Z","url":"https://instagram.com/reel/x"}}' }),
    )!;
    const [room, ...rest] = bySong([reel, full]);
    expect(rest).toHaveLength(0);
    expect(room.id).toBe('full');
    expect(room.pieceIds.sort()).toEqual(['full', 'reel']);
    expect(room.outAt).toBe('2026-10-13T14:00:00Z');
    expect(room.links.map((l) => l.platform)).toEqual(['youtube', 'instagram']);
  });
  it('puts the newest song first', () => {
    const a = levelFrom(row({ id: 'a', platform_status: '{"youtube":{"posted":true,"at":"2026-10-26T18:00:00Z"}}' }))!;
    const b = levelFrom(row({ id: 'b', campaign_name: 'Training · Monkey', platform_status: '{"youtube":{"posted":true,"at":"2026-10-28T18:00:00Z"}}' }))!;
    expect(bySong([a, b]).map((l) => l.song)).toEqual(['Monkey', 'Fils de joie']);
  });
});

describe('hudOf', () => {
  it('says the level, the song and its artist, and the player, with the progress line', () => {
    expect(hudOf(levelFrom(row(), { 'Fils de joie': 'Stromae' })!)).toEqual({ level: '1-2', credit: 'Fils de joie · Stromae', player: PLAYER, progress: true });
  });
  it('says TRAINING, with no progress line: practice has no finish', () => {
    expect(hudOf(levelFrom(row({ campaign_name: 'Training · Monkey' }))!)).toEqual({ level: 'Training', credit: 'Monkey', player: PLAYER, progress: false });
  });
});
