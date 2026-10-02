/**
 * @jest-environment node
 *
 * Every read route says who may call it.
 *
 * The same reading as routeWriteAuth.test.ts, for GET. Each handler must sit
 * behind one of middleware.ts's fail-closed gates, or verify its caller, or be
 * listed below with the reason it is open. On 2026-10-02 a sweep found 87 GETs
 * that did neither; the 44 serving the owner's books (orders with addresses,
 * BI, analytics, social drafts, every hidden video in the Arsenal, a listing
 * of the R2 bucket) are gated now. A new GET that does neither fails here:
 * gate it with requireAdmin, or add it to PUBLIC_READS and say why. An entry
 * that no longer matches fails too.
 */
import { unverifiedHandlers } from '@/lib/api/routeHandlers';

const PUBLIC_READS: Record<string, string> = {
  'GET /api/albums': 'the album catalogue',
  'GET /api/announcements': 'site announcements, active ones only',
  'GET /api/arsenal/feed-order': 'public, live clips in the order the feed shows them',
  'GET /api/clips': 'the public clips feed',
  'GET /api/clips/parents': 'titles of the videos public clips come from',
  'GET /api/featured': 'the homepage feature',
  'GET /api/featured-active-mode': 'which feature is live',
  'GET /api/featured/[slug]': 'a feature page',
  'GET /api/featured/active': 'the live feature page',
  'GET /api/films': 'a fixed placeholder message',
  'GET /api/health/env': 'the deploy probe, public by design: which env vars are set, never their values',
  'GET /api/homepage-mode': 'clips or music on the homepage',
  'GET /api/likes/count': 'like counts',
  'GET /api/linktree': 'the public link page',
  'GET /api/loop/ballots/[kind]': "tallies, and the visitor's own vote by their signed voter cookie",
  'GET /api/loop/capacity': 'passes left',
  'GET /api/loop/gift': 'how many gifts a code has made; the code is the credential',
  'GET /api/loop/room': 'how many are in the room',
  'GET /api/moments/galleries/[id]/links': 'the products and tracks a gallery links to',
  'GET /api/moments/galleries/public': 'public galleries; private ones are left out',
  'GET /api/moments/join': 'the gallery a code opens; the code is the credential',
  'GET /api/products': 'the store, through the Storefront token',
  'GET /api/shopify/collections': 'the store, through the Storefront token',
  'GET /api/shopify/product': 'the store, through the Storefront token',
  'GET /api/shopify/products': 'the store, through the Storefront token',
  'GET /api/shopify/products/search': 'the store, through the Storefront token',
  'GET /api/shopify/webhooks/orders': 'a fixed status line',
  'GET /api/store/cart/sync': "a visitor's cart, by the id their browser made; nothing personal",
  'GET /api/tracks': "the track catalogue; an unreleased album's audio URLs are withheld",
  'GET /api/tracks/[id]/credits': 'public credits',
  'GET /api/tracks/[id]/stream': 'the bytes; audioAccess.ts decides who may hear an unreleased track',
  'GET /api/videos/stream/direct-upload': "a debug echo of the caller's Origin and the public site URL",
};

// Open, and should not be: each serves something private or writes, and waits
// on a decision recorded in docs/sessions/2026-10-02-read-routes.md.
const KNOWN_OPEN: Record<string, string> = {
  'GET /api/albums/[id]': "an unreleased album's track audio_url and stem URLs, which /api/tracks withholds",
  'GET /api/connections/callback': 'stores OAuth tokens on an unsigned state, then redirects to its returnUrl',
  'GET /api/featured-single': 'creates a published featured page for any ?mode=',
  'GET /api/game/scores': "every leaderboard player's email",
  'GET /api/loop/gallery/media/[...key]': 'any galleries/ key, private galleries included',
  'GET /api/media/audio/[...key]': "an unreleased track's .hls/ files and dead-host keys; audioAccess.ts only knows a key equal to audio_url",
  'GET /api/moments/rsvp': "an RSVP's email, name and phone, to anyone holding one of the three",
  'GET /api/tracks/[id]': "an unreleased track's audio_url and hls_url, which /api/tracks withholds",
};

// Fixed on claude/mystifying-hugle-0cde7d, where these ask isAdminRequest.
// Neither listed nor required here, so the two branches merge either way.
const ELSEWHERE = new Set(['GET /api/videos', 'GET /api/videos/[id]']);

describe('read routes', () => {
  it('each sits behind a gate, verifies its caller, or is listed with a reason', () => {
    const expected = Object.keys({ ...PUBLIC_READS, ...KNOWN_OPEN }).sort();
    expect(unverifiedHandlers(['GET']).filter((h) => !ELSEWHERE.has(h))).toEqual(expected);
  });
});
