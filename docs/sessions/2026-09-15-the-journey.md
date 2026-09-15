# 2026-09-15 — the journey, in the order the owner said it

> Land on /loop, know there is a listening event and get a ticket. See you can
> listen to 1984. With a ticket, pre-order and hear a few more tracks before the
> night. Get your pass sorted. See the cover contest. Try the camera, take a
> cover, save it on the Wall.

That was the ask. This is what stood between the live site and it, and what
changed. Same branch as the morning's deletions (`claude/loop-soul-the-room-b18a17`).

## What was in the way

| Step | On production this morning | Now |
|---|---|---|
| Land, see the event | A **bare** visit (the Facebook link is bare) opened the four-screen 1984 takeover *first*; the date and the pass were two scrolls in | The poster, always. The single is one tap away. Only a gifted link (`?from=`) opens the song |
| Get a ticket | Fine | Unchanged |
| Hear 1984 | Fine (module) | Unchanged |
| Pre-order, hear more before the night | `/loop/album` was binary: nothing until the owner flips "released". A pass-holder was told *"It lands after the night"* | **Early tracks.** Owed listeners hear a chosen set now, the rest after. Default: the opening three. The owner changes it in admin, one tap per track |
| Get your pass sorted | `/loop/code` existed but the poster had no way to it; only the pass modal and the email linked it | **"Have a pass? · The record"** row under the pass button, to `/loop/code` and `/loop/album` |
| See the cover contest | Fine (module) | Unchanged |
| Camera → save on the Wall | Impossible before the night, twice over: the camera hid the Post button (`canPost` never passed) **and** the API refused any post unless `phase === "live"`. The contest copy said *"you decide afterwards whether it goes on the Wall"*, then there was no way to | Pass-holders post from the moment they buy. The API gate is `hasRoomAccess` (redeemed, or doors open) in any phase but archived. The poster gains a **The Wall** module for holders. Strangers are told plainly: *"Shooting is free. Putting it on the Wall takes a pass."* |

## The rule, extended

`decideAlbumAccess` gained one state. Pure, under test:

```
not owed              → prove
owed, released        → listen   (all 14, marks claimed)
owed, early tracks    → early    (the chosen set)
owed, nothing early   → wait
```

`album_early_tracks` in `loop_settings`: comma-separated track numbers. Never
set means `1,2,3`; set to empty means nothing until release. The admin's "The
Record" section shows all 14 as tap-to-toggle chips; they disable once the
record is out because they no longer apply.

## Verified

Gates: `tsc --noEmit` 851 / `TS2307` 10 (baseline); `npm test` **259 passed**
(+4: the early state, the not-owed case, the setting parser), same 3
pre-existing suite failures; eslint clean on all 12 touched files.

Against a dev server on the live database, **read-only** (no code redeemed, no
setting written):

- Bare `/loop`: the poster, with `HAVE A PASS? · THE RECORD` under the pass
  button. No overlay. No console errors.
- `/loop?from=test`: the single opens over the poster. Gift path intact.
- `POST /api/loop/gallery/post` as a stranger in phase `pre`: **403 "The Wall
  is for pass-holders. Enter your pass, or get one."** (was "The Wall opens
  during the event").
- `/loop/album` as a stranger: the prove state, linking `/loop/code`.
- Cover Contest module as a stranger: *"Shooting is free. Putting it on the
  Wall takes a pass."*

**Not verified end to end:** the holder's view of `/loop/album` (the early
player) and the holder's Post button. Both need a redeemed pass, which is a
write to production. The rule is unit-tested and the page compiles; the owner
can prove it in ten seconds with his own pass on the preview deployment.

## The email

Nothing needs a reply. Nine "New Customer / are you the store owner / can I
complete my order / bad experience review / commission" messages since the
13th are the standard Shopify store-owner scam wave: fresh Gmail accounts, no
order number, one of them cc'd to a different store entirely. Do not reply, do
not open attachments if any arrive. The eight "burst N" messages from
support@ are the owner's own inbox test from the 14th. Madison at Delta asked
"good to go for Facebook?" on the 14th; the owner answered yes on the 15th and
gave her `odubostudio.com/loop`, which resolves (308 to www, then the poster).
TRU Print has the flyer files and the poster counts. Nothing outstanding.

## Next

1. **The owner picks the early tracks** at `/loop/admin` → The Record. The
   default is tracks 1–3 (Welcome, 1984, Hallucinogen). If that is wrong, it is
   one tap per track to change, no deploy.
2. Prove the holder view on the preview with a real pass.
3. Merge. Production still opens the song takeover on every bare visit until
   this lands, and the Facebook event may already be live.
