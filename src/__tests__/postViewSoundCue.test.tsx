import React from 'react';
import { render, screen } from '@testing-library/react';
import PostView from '@/app/admin/social-studio/components/PostView';

// The open post fetches its video to share; the test only reads what is shown.
beforeAll(() => {
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

const due = (notes: string) => [{
  id: 'p1',
  status: 'draft',
  media_type: 'video',
  media_url: 'https://videodelivery.net/p1/downloads/default.mp4',
  platforms: ['instagram', 'tiktok'],
  caption: 'Jungle stage.',
  scheduled_at: new Date().toISOString(),
  notes,
}];

describe('the Post view note', () => {
  it('shows where to start the sound, large, and the rest of the note line by line', () => {
    const { container } = render(
      <PostView
        posts={due('Monkey · M.I Abaga\nSound from 0:17 (to 0:59)\nAdd the song in the app from that time.\nOct 23 · 1023-monkey-reel-a') as never}
        loading={false}
        onRefresh={() => {}}
        onViewPost={() => {}}
      />,
    );
    expect(screen.getByText('Start the sound at')).toBeTruthy();
    expect(screen.getByText('0:17')).toBeTruthy();
    expect(screen.getByText('to 0:59')).toBeTruthy();
    const rest = container.querySelector('.whitespace-pre-line');
    expect(rest?.textContent).toBe('Monkey · M.I Abaga\nAdd the song in the app from that time.\nOct 23 · 1023-monkey-reel-a');
  });

  it('keeps a note without a sound cue whole, line breaks and all', () => {
    const { container } = render(
      <PostView posts={due('Monkey · M.I Abaga\nSong laid in: 0:00 to 4:06') as never} loading={false} onRefresh={() => {}} onViewPost={() => {}} />,
    );
    expect(screen.queryByText('Start the sound at')).toBeNull();
    expect(container.querySelector('.whitespace-pre-line')?.textContent).toBe('Monkey · M.I Abaga\nSong laid in: 0:00 to 4:06');
  });
});
