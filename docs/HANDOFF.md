# Odubo Studio / Loop Soul — engineering handoff

**Written 2026-09-16.** Main is `4ea6495`, deployed. The owner (Mani Odubo,
`maniodubo@gmail.com`) is a musician, not an engineer, and is handing this over
because the scope outgrew one person. Treat him as the product owner: he makes
the calls, you make them buildable.

**The hard date is Saturday 10 October 2026.** A 250-capacity live album
premiere at Scott's Inn, Kamloops. Tickets are selling now. The Facebook event
is live and pointing at `odubostudio.com/loop`. Everything in here is subordinate
to that night working.

---

## 1. Read this first — five things that will otherwise cost you a day

**`npm run build` cannot verify anything.** `next.config.ts` sets
`typescript: { ignoreBuildErrors: true }` and the script runs `--no-lint`. Delete
a module, leave a dangling import, and the build is green. Use:

```bash
npx tsc --noEmit | grep -c "error TS"     # baseline: 850
npx tsc --noEmit | grep -c "error TS2307" # baseline: 10 — a new one is a broken import
npm test                                   # baseline: 301 passing, 2 failing
```

Those two failures (`emailTemplates`, `videos.get`) were red before any of this
work and are not yours. The 850 errors are pre-existing debt; **judge
differentially, never absolutely.**

**Migration numbers collide.** `database/migrations/` is applied by hand, in
filename order. Two unmerged branches each add a file claiming a number `main`
already uses (`157`, `159`). **Renumber before merging either.** Next free is 165.

**Never drop a Loop table by name.** The table called `ballots` is a dead
feature's. The **live** Volume 1 votes are in `candidate_upvotes`, under synthetic
ids `vol-1#tracklist` and `vol-1#cover`. Dropping the intuitively-named one is
harmless; dropping the other destroys real votes. There is no down-migration
convention here. The standing rule is **drop nothing**.

**`EMAIL_MODE` defaults to `mock`, and the mock returns `ok: true`.** A send can
report `delivered: true` having never left the machine. Production is
`EMAIL_MODE=live`. When testing email, check the Resend dashboard, not the
return value.

**Shopify is on the Basic plan, which never gives the app a buyer's email.** Not
a permission you can grant — PII via API needs the Shopify/Advanced/Plus tier.
Every webhook and Admin API read returns `email`, `phone` and `customer` as null
on a paid order. See §5 for how this is worked around.

---

## 2. What a guest actually does

This is the product. If a change breaks this sequence, it is wrong.

1. Lands on **`/loop`** from a poster QR, a flyer, or the Facebook event. Sees
   the night: date, venue, price, capacity.
2. Taps **Get Pass**, types their email **once**, goes to Shopify checkout with
   that email prefilled.
3. Pays $5. Within ~2s: a code is minted, a pre-order is written, and an email
   arrives with a **rendered PNG ticket** attached.
4. Taps **Open your record** in that email → **`/loop/p/<token>`** binds the
   phone with nothing to type → the "draw" deals them **the single plus two
   more tracks, seeded on their address** so two buyers get different songs.
   The six digits at `/loop/code` are now only for a new phone or a lost email.
   (Was: the link carried no token and dead-ended on "you have not pre-ordered";
   fixed 2026-09-16, see docs/decisions/loop-claim-link.md.)
5. On the night: shows the ticket at the door. The host scans it on
   **`/loop/admin/door`**. It admits once.
6. In the room: shoots through the Loop Soul camera filter, posts to the shared
   Wall, votes on the album's **cover** and **running order**.

---

## 3. Stack and shape

| | |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript, Tailwind 4 |
| Hosting | **Vercel**, auto-deploys `main`, ~3 min |
| Database | **Cloudflare D1** (SQLite). `npx wrangler d1 execute odubo --remote --command="..."` |
| Storage | Cloudflare R2, served via `/api/media/...` presigned redirects |
| Commerce | **Shopify**, headless. Storefront API for the catalogue, cart permalinks for checkout, `orders/paid` webhook for fulfilment |
| Email | **Resend** |
| Scale | 357 API route handlers, 91 pages, 158 migrations |

**The Loop Soul surface** is `src/app/loop/**` (13 pages), `src/app/api/loop/**`
(34 routes), `src/components/loop/**`, `src/lib/loop/**`. It is largely
self-contained and is the part with the deadline. The rest of the repo (admin,
store, media, moments, clips) is older and less disciplined.

**`src/lib/loop/` is where the thinking lives.** Most files open with a comment
explaining *why*, including decisions that were reversed and why. Read those
before changing behaviour; several encode a failure that already happened.

Longer-form reasoning is in `docs/decisions/` and `docs/sessions/`.

---

## 4. Security debt — the honest list

Three holes were closed on 2026-09-15/16. **One large one remains.**

### CLOSED 2026-09-16 — the JWT repair

**`getUserFromRequest()` now verifies the signature** (`jose.jwtVerify`,
identical to `verifyUserFromRequest`, which is kept as an alias). It is async;
all 131 call sites await; `decodeWithoutVerify` is deleted;
`getUserRoleFromRequest` verifies too. A bare `await` in a non-async function
is a syntax error, so tsc holding at the 850/10 baseline proves every call
landed in async scope. A forged unsigned admin token is now rejected by the
moments routes; a signed token still passes. Locked by
`src/__tests__/auth.test.ts`. The 227-file eval branch was NOT used.

**Mitigation already in place:** `src/middleware.ts` now has three fail-closed
edge backstops — the whole `/api/admin/**` prefix (verified with `jose`),
the command centre, and catalogue writes. So admin routes are covered even where
the handler forgets. The 94 non-admin routes are not.

### Closed on 2026-09-15/16

- **The unreleased album was publicly streamable.** `/api/tracks` handed out all
  14 audio URLs and both byte routes served audio to anonymous callers. Now
  gated by `src/lib/loop/audioAccess.ts` — one pure, tested rule: published
  albums public, the featured single public, verified admins through,
  pass-holders get only their own draw before release, everyone else 404 (never
  403 — a 403 confirms the id). **It fails closed.**
- **The catalogue was writable by anyone.** `PATCH /api/tracks/[id]`, the bulk
  routes, `/api/albums/[id]` and credits had no auth at all. `/api/r2-proxy`
  deleted. `/api/admin/media-proxy` gated and its substring allowlist fixed.
- **`/api/customers`** returned every customer's email, name, phone and lifetime
  spend to the open internet. Gated in-route.

---

## 5. Shopify Basic, and the workaround you must not undo

Basic gives the app no buyer email, ever. The workaround, all verified against a
real sale:

1. The pass sheet asks for the address **before** checkout.
2. `POST /api/loop/pass/intent` stores it (`loop_pass_intents`, migration 163)
   and returns a checkout URL carrying **`checkout[email]=`** (which prefills
   Shopify's own field, so nobody types it twice) and
   **`attributes[loop_ref]=<token>`**.
3. `attributes[...]` survives checkout into the order's `note_attributes`, which
   **is** readable on Basic because it is merchant data, not customer data.
4. The `orders/paid` webhook reads `loop_ref` back and recovers the address.

If the reference ever fails to return, the intent row is still there with a
timestamp, and **Admin → Event codes** offers it as a one-tap chip beside the
orphaned pass. There is also **Attach & send pass** and **Resend**.

Upgrading the Shopify plan would let you delete all of this. It is not worth it
for one night.

---

## 6. Unmerged branches

Six remain. None are merged into `main`; four dead ones were archived as
`archive/*` tags and deleted (recover with `git checkout archive/<name>`).

| Branch | Commits | What it is |
|---|---|---|
| ~~`claude/shopify-customer-messaging-crm-0f1a53`~~ | — | **MERGED 2026-09-16.** The customer inbox is live at /admin/inbox; migration renumbered 159 → 166 and applied. Owner still needs to set the Resend Inbound MX + `RESEND_WEBHOOK_SECRET` for email replies (see docs/loop/owner-checklist.md) |
| ~~`claude/loop-gallery-album-contest-flow-b38fe8`~~ | — | **CARRIED 2026-09-16.** The winner-declaration half is applied by hand (migration 167, `loop_ballot_results`, admin Declare, frozen resolveCover). The 3-covers-hold schema rebuild is deferred |
| `claude/loop-soul-platform-eval-dbcba9` | 7 | The 227-file auth repair + domain move. **Contains the real JWT fix.** Read, don't merge blind |
| `claude/scotts-inn-venue-brief-846aab` | 11 | Venue brief docs, plus one real change: **19+ on the Volume 1 artwork**, which is not on `main`. The door is 19+ and the posters do not say so |
| `claude/loop-soul-hub-overview-a5ac87` | 6 | Superseded playbill design. Its worktree holds **8 uncommitted files** — look before deleting |
| `feat/loop-journal` | 1 | Obsolete: built on a feature deleted 2026-09-15 |

**A pattern worth knowing:** work recorded in the owner's notes as "shipped" has
several times been sitting on an unmerged branch. **Verify against the live
domain, not against a commit existing.**

---

## 7. Things only the owner can do

You will be blocked on these. Ask early.

- **`LOOP_ADMIN_PASSWORD`** — production Loop admin is password-locked (good).
  Not in `.env.local`.
- **Vercel and Cloudflare dashboards** — env vars, deploys, D1, R2.
- **Shopify admin** — plan tier, product/pass SKU, notification templates, and
  granting Protected Customer Data if he ever upgrades.
- **The album's release switch** — `/loop/admin` → The Record. Nothing derives
  it from a date, on purpose.
- **Apple Wallet passes** — needs a certificate from his developer account.

`.env.local` is pulled with `vercel env pull .env.local`. **Never clear it
without a backup.**

---

## 8. What I would do first

The 2026-09-16 pass closed items 1 and 2 (JWT verified, inbox merged) and
rebuilt the buyer journey. What remains is the owner's, in
`docs/loop/owner-checklist.md`:

1. **A real $5 purchase from a phone.** The one true test of the new one-tap
   journey. Confirm delivery in the Resend dashboard, not the return value.
2. **Test the door with two real phones.** `/loop/admin/door` is still unproven
   against real hardware. The one part of the night not yet exercised.
3. **Put 19+ on the printed artwork** before any print run. A licensing
   condition. The ticket and pass sheet already carry it.
4. **The Shopify clicks** (store name → Odubo Studio, order prefix OS-, the
   receipt template, the pass image alt text).

---

## 9. Conventions worth keeping

- **No em dashes** in brand or customer-facing copy. Rewrite the sentence.
- Guest copy is terse and editorial. No card bubbles; tappable text with hairline
  rules. One drawn shape per screen — the primary action.
- Comments explain **why**, especially where a decision was reversed.
- Settings that the owner should change without a deploy live in `loop_settings`
  (price, the featured single, doors open, the album release, the early-track
  rule). **Never hardcode a domain** — the printed URL has moved once already.
