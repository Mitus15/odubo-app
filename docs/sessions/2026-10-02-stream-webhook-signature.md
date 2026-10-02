# 2026-10-02 · The Stream webhook verifies Cloudflare's signature

Committed on branch `claude/gifted-matsumoto-a1f193`, built on
`claude/unruffled-goldstine-331edc` (the guard test lives there). Not merged:
main waits on the owner. Merging this branch brings the unruffled commits too.

## What changed

- `src/app/api/stream/webhook/route.ts`: checked a signature only when a
  `cf-webhook-signature` header was present. Cloudflare never sends that
  header, and leaving it off skipped the check, so anyone could POST a uid and
  flip that video to `published` (un-archiving a hidden one), set its
  duration, or point its poster at any image. It now verifies the scheme
  Cloudflare documents: `Webhook-Signature: time=<unix seconds>,sig1=<hex>`,
  where sig1 is an HMAC-SHA256 of `${time}.${raw body}` keyed with the
  webhook's secret. Compared with `crypto.timingSafeEqual`. A time more than 5
  minutes from the server clock, either way, is refused.
- Production with no `CLOUDFLARE_STREAM_WEBHOOK_SECRET` answers 500 and
  processes nothing, as `webhooks/shopify` does. Outside production it skips
  the check with a warning. With the secret set: no header 401 `Missing
  signature`, unparseable 401 `Malformed signature`, wrong secret or altered
  body 401 `Invalid signature`, genuine but old 401 `Stale signature`. Every
  refusal comes before the database. The secret is trimmed (a pasted value
  often ends in a newline).
- `handlePayload`, the part that writes `videos`, is unchanged.
- `src/__tests__/streamWebhook.test.ts`: 11 tests, the route's SQL against
  node:sqlite. A signed notification updates its row and starts the thumbnail
  run; seven bad requests are each refused with no database call and the
  hidden row untouched; production without the secret refuses even a signed
  one.
- `src/__tests__/routeWriteAuth.test.ts`: `KNOWN_OPEN` is empty. The scan now
  sees the route verify (`timingSafeEqual`).

## Verified

- Cloudflare's "Use webhooks" page for Stream, fetched 2026-10-02 (dated
  2026-09-30): the header, the source string, hex HMAC-SHA256, constant-time
  comparison advised, old timestamps to be discarded, the secret returned by
  both PUT and GET `/accounts/<id>/stream/webhook`.
- `npx tsc --noEmit`, no `.next`: 850 before, 850 after, the same list
  (positions stripped), none in the touched files.
- `npm test`: 539 pass (528 + 11 new). The 2 known failures are unchanged:
  `brandedEmailHTML` and the `GET /api/videos` fallback.
- With the old route swapped back in, 9 of the 12 tests fail: the 7 refusals,
  production without a secret, and the guard test. The 3 that pass are
  requests both versions process.
- ESLint: no file worse. The route's 3 `any`s are in the untouched
  `handlePayload`.
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

Until then production answers each Stream notification 500. Nothing is lost:
before this change those notifications got a 400 and wrote nothing (below).

## Found in passing (not fixed)

- **The handler cannot read a real notification.** Cloudflare sends the video
  at the top level (`uid`, `readyToStream`, `status.state`, `duration`,
  `thumbnail`), as in the docs' example. `handlePayload` reads only
  `payload.data.*` and `payload.result.*`, so a notification shaped like
  Cloudflare's gets 400 `Missing uid` and writes nothing. Its writes were
  reachable only by a hand-made body, which is what this fix shuts out. Left
  alone on purpose: reading the top level would switch on, for every
  processed upload, a status flip to `published` (an archived row included),
  `poster_url` and `thumbnail` overwritten with Stream's generic thumbnail,
  and an AI thumbnail run for parent videos. Each wants a decision, ideally
  before the film upload. The test sends the `data` shape the handler reads,
  with a comment saying so.
- Replays inside the 5-minute window are not deduplicated. The writes repeat
  harmlessly, but each replay would start another thumbnail run. Capturing a
  request means breaking TLS, so it stays as is.
