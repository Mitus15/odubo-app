import React from 'react';
import { render, screen } from '@testing-library/react';
import { mapClipRow } from '@/lib/clipsMapper';
import { publicVideoWhere, CLIP_FILM_FIELDS, CLIP_FILM_JOIN } from '@/lib/publicVideos';
import ClipFlip from '@/components/clips/ClipFlip';
import type { ClipApiRow } from '@/types/clips';

const base: ClipApiRow = {
  id: 7,
  uid: 'abc123',
  title: 'Loop Soul',
  artist_name: 'Mani Odubo',
  shopify_product_handle: null,
};

const squash = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('clip rows carry the film', () => {
  it('maps the song, the chapter and an approved card onto the clip', () => {
    const clip = mapClipRow({
      ...base,
      track_id: 'a2f91aad-fc5c-4d52-97ef-12b46b0dc339',
      film_chapter_id: '1984',
      card_flip: 'Dust got up and walked.',
      card_verse_ref: 'Genesis 2:7',
    });
    expect(clip).toMatchObject({
      trackId: 'a2f91aad-fc5c-4d52-97ef-12b46b0dc339',
      filmChapter: '1984',
      card: { flip: 'Dust got up and walked.', verseRef: 'Genesis 2:7' },
      productHandle: null,
    });
  });

  it('gives a clip with no card (no join match) no card, and keeps every old field', () => {
    const clip = mapClipRow({ ...base, shopify_product_handle: 'script-tee' });
    expect(clip?.card).toBeNull();
    expect(clip?.filmChapter).toBeNull();
    expect(clip?.trackId).toBeNull();
    expect(clip).toMatchObject({
      id: 7,
      hlsUrl: 'https://videodelivery.net/abc123/manifest/video.m3u8',
      title: 'Loop Soul',
      artist: 'Mani Odubo',
      productHandle: 'script-tee',
    });
  });

  it('treats a blank flip as no flip, but keeps the card for its verse', () => {
    const clip = mapClipRow({ ...base, card_flip: '   ', card_verse_ref: ' Psalm 23:1 ' });
    expect(clip?.card).toEqual({ flip: null, verseRef: 'Psalm 23:1' });
  });
});

describe('the SQL every public clip read shares', () => {
  it('is the rule the feed always used, parenthesised to AND safely', () => {
    expect(squash(publicVideoWhere('v'))).toBe(
      "((v.is_public = 1 OR v.is_public IS NULL) AND COALESCE(v.status, 'published') != 'archived' AND COALESCE(v.publication_status, 'live') = 'live')",
    );
    expect(squash(publicVideoWhere(''))).toBe(
      "((is_public = 1 OR is_public IS NULL) AND COALESCE(status, 'published') != 'archived' AND COALESCE(publication_status, 'live') = 'live')",
    );
  });

  it('joins only an approved card, so a draft never reaches a guest', () => {
    expect(CLIP_FILM_JOIN).toBe("LEFT JOIN loop_film_cards c ON c.id = v.card_id AND c.status = 'approved'");
    expect(CLIP_FILM_FIELDS).toContain('c.flip AS card_flip');
    expect(CLIP_FILM_FIELDS).toContain('c.verse_ref AS card_verse_ref');
    expect(CLIP_FILM_FIELDS).toContain('v.film_chapter_id');
    expect(CLIP_FILM_FIELDS).toContain('v.track_id');
  });
});

describe('the flip over the video', () => {
  it('is one link to the chapter, with the verse reference under it', () => {
    render(<ClipFlip card={{ flip: 'Dust got up and walked.', verseRef: 'Genesis 2:7' }} chapter="1984" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/loop/1984');
    expect(link.textContent).toContain('Dust got up and walked.');
    expect(link.textContent).toContain('Genesis 2:7');
  });

  it('encodes the chapter slug into the path', () => {
    render(<ClipFlip card={{ flip: 'A line.', verseRef: 'John 1:5' }} chapter="in the court" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/loop/in%20the%20court');
  });

  it('shows the words without a link when the clip has no chapter', () => {
    render(<ClipFlip card={{ flip: 'A line.', verseRef: 'John 1:5' }} chapter={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('A line.')).toBeTruthy();
  });

  it('draws nothing at all without a flip', () => {
    const { container } = render(<ClipFlip card={{ flip: null, verseRef: 'John 1:5' }} chapter="1984" />);
    expect(container.innerHTML).toBe('');
  });
});
