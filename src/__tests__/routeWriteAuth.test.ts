/**
 * @jest-environment node
 *
 * Every write route says who may call it.
 *
 * Reads every POST/PUT/PATCH/DELETE handler under src/app/api. Each must sit
 * behind one of middleware.ts's fail-closed gates, or verify something itself
 * (a signed session, a signature, a secret), or be listed below with the
 * reason it is open. A new handler that does none of these fails here: gate
 * it (requireAdmin from @/lib/api/requireAdmin is the house gate), or add it
 * to PUBLIC_WRITES and say why. An entry that no longer matches fails too.
 *
 * A verifier counts only in code, never in a comment or a writeAuditLog call
 * (see src/lib/api/routeHandlers.ts, shared with routeReadAuth.test.ts).
 */
import { unverifiedHandlers } from '@/lib/api/routeHandlers';

const PUBLIC_WRITES: Record<string, string> = {
  'POST /api/admin/accept-invite': 'carries its own credential, the hashed, expiring invite token',
  'POST /api/analytics/events': 'fan analytics',
  'POST /api/analytics/funnel': 'fan analytics',
  'POST /api/analytics/identity': 'fan analytics',
  'POST /api/clips/engagement': 'fan engagement counts',
  'POST /api/contact': 'contact form',
  'POST /api/email/subscribe': 'fan email capture',
  'POST /api/featured/rsvp': "an Instagram handle into the audit log; the featured pages it served redirect to / now",
  'POST /api/game/scores': 'game leaderboard',
  'POST /api/linktree/[id]': 'link click counter',
  'DELETE /api/loop/admin/login': 'logout',
  'POST /api/loop/ballots/[kind]': 'Loop fan flow',
  'POST /api/loop/cover': 'Loop fan flow',
  'DELETE /api/loop/cover': 'Loop fan flow',
  'POST /api/loop/gift': 'Loop fan flow',
  'POST /api/loop/pass/intent': 'Loop pass flow',
  'POST /api/loop/pass/lookup': 'Loop pass flow',
  'POST /api/loop/pass/waitlist': 'Loop pass flow',
  'POST /api/moments/rsvp': 'public RSVP',
  'POST /api/moments/rsvp/unsubscribe': 'public RSVP',
  'POST /api/orders': 'the store checkout',
  'POST /api/shopify/checkout': 'the store checkout',
  'POST /api/store/cart/sync': "a visitor's cart",
  'POST /api/store/inventory': 'stock check for the cart page',
  // Verified, in a way this scan cannot see.
  'POST /api/webhooks/shopify': 'HMAC via crypto.subtle; fails closed in production',
  'POST /api/moments/thumbnail-job': 'x-thumbnail-secret, only the R2 worker holds it',
  // Write nothing.
  'POST /api/films': 'validates and echoes; no write',
  'POST /api/products': 'answers 405',
  'POST /api/webhooks/clerk': 'disabled; answers 200 and does nothing',
};

// Open, and should not be, each with what it waits on. None now: the last,
// POST /api/stream/webhook, verifies Stream's signature since 2026-10-02.
const KNOWN_OPEN: Record<string, string> = {};

describe('write routes', () => {
  it('each sits behind a gate, verifies its caller, or is listed with a reason', () => {
    const expected = Object.keys({ ...PUBLIC_WRITES, ...KNOWN_OPEN }).sort();
    expect(unverifiedHandlers(['POST', 'PUT', 'PATCH', 'DELETE'])).toEqual(expected);
  });
});
