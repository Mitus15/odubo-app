# 2026-10-02 · The Stream webhook verifies Cloudflare's signature, and reads a real notification

Committed on branch `claude/gifted-matsumoto-a1f193`, built on
`claude/unruffled-goldstine-331edc` (the guard test lives there). Not merged:
main waits on the owner. Merging this branch brings the unruffled commits too.

## 1. The signature

- `src/app/api/stream/webhook/route.ts` checked a signature only when a
  `cf-webhook-signature` header was present. Cloudflare never sends that
  header, and leaving it off skipped the check, so anyone could POST a uid and
  flip that video to `published` (un-archiving a hidden one), set its
  duration, or point its poster at any image.
- It now verifies the scheme Cloudflare documents:
  `Webhook-Signature: time=<unix seconds>,sig1=<hex>`, where sig1 is an
  HMAC-SHA256 of `${time}.${raw body}` keyed with the webhook's secret.
  Compared with `crypto.timingSafeEqual`. A time more than 5 minutes from the
  server clock, either way, is refused.
- Production with no `CLOUDFLARE_STREAM_WEBHOOK_SECRET` answers 500 and
  processes nothing, as `webhooks/shopify` does. Outside production it skips
  the check with a warning. With the secret set: no header 401 `Missing
  signature`, unparseable 401 `Malformed signature`, wrong secret or altered
  body 401 `Invalid signature`, genuine but old 401 `Stale signature`. Every
  refusal comes before the database. The secret is trimmed (a pasted value
  often ends in a newline).
- `src/__tests__/routeWriteAuth.test.ts`: `KNOWN_OPEN` is empty. The scan now
  sees the route verify (`timingSafeEqual`).

## 2. A real notification, decided with the owner

The handler read `payload.data` and `payload.result`; Cloudflare sends the
video at the top level, so a real notification got 400 `Missing uid` and none
of its writes had ever run. The owner chose what it may write:
`docs/decisions/stream-webhook-completes.md`. In short, for a row still
waiting on Stream it fills `duration` and `duration_seconds`, and starts an
automatic poster (clip: random frame to R2; parent: the Gemini pick) only over
Stream's default frame on a video no poster was made for, claimed atomically,
run after the response with `after()`. It never writes status or visibility,
never replaces a chosen poster, and leaves alone a row written after Stream
finished (`created_at` later than the notification's `modified`: the Loop film
pipeline, imports) or one that already has a duration.

How the rows are born, which shaped the rules:

- Arsenal (`/api/videos`, `/api/videos/[id]/clips`): written while Stream is
  still processing, status `published`, hidden by `is_public = 0` (clips also
  `publication_status = 'archived'`), Stream's default frame, no duration.
- The film pipeline (`scripts/loop/film/publish.ts`): written only after
  Stream is ready and the MP4 exists, so the notification normally comes
  before the row. A long film can outrun the script's 10-minute readiness
  wait and be written with no duration; the `created_at` rule still keeps the
  webhook off it.
- `poll-ready` (the Arsenal tab) makes the poster for the last file of an
  upload only, with the tab open, within about 2.5 minutes, never over 5 GB.

## Tests

`src/__tests__/streamWebhook.test.ts`, 19 tests, the route's SQL against
node:sqlite, notifications in the shape Cloudflare's docs show. Signature:
seven bad requests each refused with no database call; production without the
secret refuses a signed one. Behaviour: a waiting parent gets its duration
and a Gemini poster after the response, status and visibility unchanged; a
clip gets a random frame; an archived video with a chosen poster gets its
duration and keeps the rest; a poster already being made is not started
again; the film row written after processing is left alone; a repeat does
nothing; an error or an unknown uid writes nothing; the `result` shape is
read too.

## Verified

- Cloudflare's "Use webhooks" page for Stream, fetched 2026-10-02 (dated
  2026-09-30): the header, the source string, hex HMAC-SHA256, constant-time
  comparison advised, old timestamps to be discarded, the secret returned by
  both PUT and GET `/accounts/<id>/stream/webhook`, the notification body.
- `npx tsc --noEmit`, no `.next`: 850 before, 850 after each commit, the same
  list (positions stripped), none in the touched files.
- `npm test`: 547 pass (528 + 19 new). The 2 known failures are unchanged:
  `brandedEmailHTML` and the `GET /api/videos` fallback.
- Against the original route, the first version of these tests failed 9 of
  12: every refusal, production without a secret, and the guard test. Against
  the signature-only commit (6108ccb), all 11 behaviour tests fail and the 8
  signature tests pass.
- ESLint: the route went from 3 errors (`any` in the old handler) to none;
  the tests are clean.
- Node parses Cloudflare's six-digit fractions; this machine runs in
  America/Vancouver, so the tests exercise D1's zoneless UTC timestamps.
- Not checked: whether a webhook is registered on the Cloudflare account, or
  where it points. No Cloudflare or Vercel setting was read or changed.

## For the owner

1. Get the secret. `GET /accounts/<CLOUDFLARE_ACCOUNT_ID>/stream/webhook`
   (read-only, with the Stream API token) returns `notificationUrl` and
   `secret`. If nothing is registered, or `notificationUrl` is not the live
   site's `/api/stream/webhook`, register it with Cloudflare's PUT; that
   response carries the secret.
2. Set `CLOUDFLARE_STREAM_WEBHOOK_SECRET` in Vercel (Production) to that value
   and redeploy.

Until then production answers each Stream notification 500 and writes
nothing, as before (it wrote nothing then either).

## Left as is

- `poll-ready` does not check the poster claim, so the last file of an
  Arsenal upload can get two posters; the last write wins.
- Replays inside the 5-minute window are not deduplicated by the signature
  check. The handler's own rules make a replay a no-op (the duration is
  already there). Capturing a request means breaking TLS.
- A processing error is only logged; there is no column to show it in the
  Arsenal.
