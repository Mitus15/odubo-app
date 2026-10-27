import React from 'react';
import { render, screen } from '@testing-library/react';
import TodayView from '@/app/admin/social-studio/components/TodayView';

// The open post fetches its video to share; the test only reads what is shown.
beforeAll(() => {
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

const due = (notes: string, extra: Record<string, unknown> = {}) => [{
  id: 'p1',
  status: 'draft',
  media_type: 'video',
  media_url: 'https://videodelivery.net/p1/downloads/default.mp4',
  platforms: ['instagram', 'tiktok'],
  caption: 'Jungle stage.',
  scheduled_at: new Date().toISOString(),
  campaign_id: 'camp_training_monkey',
  tags: ['training', 'reels'],
  notes,
  ...extra,
}];

const campaigns = [{ id: 'camp_training_monkey', name: 'Training · Monkey', color: '#f2d14b', status: 'active', post_count: 6 }];

const view = (posts: unknown) => (
  <TodayView
    posts={posts as never}
    campaigns={campaigns as never}
    loading={false}
    now={new Date()}
    openId={null}
    onOpen={() => {}}
    onMark={async () => true}
    onSend={async () => ({ ok: true })}
    onDetails={() => {}}
    onSchedule={() => {}}
  />
);

describe('Today', () => {
  it('shows where to start the sound, large, and the note without what the page already says', () => {
    render(view(due('Monkey · M.I Abaga\nSound from 0:17 (to 0:59)\nAdd the song in the app from that time, then turn the original sound down to 0.\nOct 23 · 1023-monkey-reel-a')));
    expect(screen.getByText('Start the sound at')).toBeTruthy();
    expect(screen.getByText('0:17')).toBeTruthy();
    expect(screen.getByText('to 0:59')).toBeTruthy();
    // the song is said once (with its artist), the how in four words, the file line not at all
    expect(screen.getByText('Monkey')).toBeTruthy();
    expect(screen.getByText('· M.I Abaga')).toBeTruthy();
    expect(screen.getByText('Then the original sound to 0.')).toBeTruthy();
    expect(screen.queryByText(/1023-monkey-reel-a/)).toBeNull();
  });

  it('keeps a note without a sound cue, line by line', () => {
    render(view(due('Monkey · M.I Abaga\nSong laid in: 0:00 to 4:06', { platforms: ['youtube'], tags: ['training', 'full'] })));
    expect(screen.queryByText('Start the sound at')).toBeNull();
    expect(screen.getByText('The song is in the video, 0:00 to 4:06.')).toBeTruthy();
  });

  it('gives the next app the one drawn button, and a full song goes to YouTube through the Studio', () => {
    render(view(due('Monkey · M.I Abaga\nSong laid in: 0:00 to 4:06', { platforms: ['youtube'], tags: ['training', 'full'] })));
    expect(screen.getByText(/^Schedule on YouTube/)).toBeTruthy();
    expect(screen.queryByText(/^Post to YouTube/)).toBeNull();
  });

  it('shows a platform that is out with its views, and one in the TikTok drafts as waiting there', () => {
    render(view(due('Monkey · M.I Abaga\nSound from 0:17 (to 0:59)', {
      platform_status: {
        instagram: { posted: true, at: new Date().toISOString(), url: 'https://www.instagram.com/reel/x/', views: 1240 },
        tiktok: { posted: false, sent: 'draft', pfm_id: 'sp_1' },
      },
    })));
    expect(screen.getByText(/1\.2k views/)).toBeTruthy();
    expect(screen.getByText(/in your drafts/)).toBeTruthy();
  });
});
