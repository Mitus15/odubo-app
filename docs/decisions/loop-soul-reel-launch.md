# The reels, and how they actually get posted

Three 30.6s living-poster reels, in
`Loop-soul-the-entertainment-room/social-2026-09/living-poster/`, each with a
silent twin. Written 2026-09-13 for a Monday 2026-09-14 announcement, 26 days
before the night.

Standing details for every caption, from
[loop-soul-18-posts.md](loop-soul-18-posts.md): **Sat 10 October · Scott's Inn
& Suites, Kamloops · doors 6:30, album at 8 · $5 · 19+ · dress code 80s ·
odubostudio.com/loop**. That doc's rule holds: the date, the place and the
price go in every single caption, and repetition is the strategy.

---

## Which studio can actually post this

Three systems can queue a post, on three different tables, and they do not
agree. This is the part to get right before Monday.

| Path | Table | Scheduling |
|---|---|---|
| `/admin` → **Arsenal tab** | `videos` + `video_deployments` | **Works.** Date/time picker → `scheduleAt` → PostForMe holds the timer. |
| `/admin/social` (Social CMS) | `social_content` | **Was broken, fixed 2026-09-13.** See below. |
| `/admin/social-studio` | `social_posts` | **Does not fire.** Uses the deprecated `/api/social/posts/publish`, which deliberately does not hand scheduled posts to PostForMe and waits for `/api/social/posts/process-scheduled` instead. That is driven by `/api/cron/social-sync`, which **is not registered in `vercel.json`**. Nothing runs it. |

**`/loop/admin/studio` — the Promoter Studio — cannot do this at all.** It is
posters, tickets, pass pricing and the notes thread. Its poster tool composes a
canvas and downloads a PNG; there is no video, no upload, no queue. If the plan
was "do it from the Loop studio", the plan needs a different room.

### The bug that would have posted Monday's announcement today

`/admin/social`'s PublishModal sent `schedule_at`; the publish route read
`scheduled_at`. So `scheduleAt` arrived `undefined`, and the guard

```ts
if (!publishNow && scheduleAt) createPostInput.scheduled_at = scheduleAt;
```

simply did not fire — which does **not** mean the post never went out. It means
`createPost` was called with no schedule at all, so **PostForMe published it
immediately**, while the row was written `status = 'scheduled'` and the UI said
scheduled. Set up a post for next Monday and it went out the moment you set it
up, and nothing anywhere told you.

Fixed both ends: the modal sends `scheduled_at`, the route accepts either
spelling, and a scheduled request with no time now **refuses with a 400**
rather than falling through to an immediate publish. Publishing early is the
one outcome a scheduler must never have, so it fails loudly instead.

### Two things Arsenal requires that are easy to miss

- **PostForMe needs a direct MP4 URL**, never HLS and never an iframe URL. The
  deploy route refuses without `videos.mp4_url`. The comment there cites the
  2026-02-11 crisis where silent fallbacks produced 112 broken deployments.
- **A video only posts as a Reel if it has a `parent_video_id`.** The Instagram
  config is `placement: isClip ? 'REELS' : 'FEED'`, and `isClip` is exactly
  `video.parent_video_id !== null`. Uploaded standalone, these go to the feed
  as square-cropped posts, not reels. They have to be uploaded as *clips* of a
  parent.

---

## The captions

No em dashes, per the house voice. No Michael Jackson tags: the audio is an
exact commercial master and there is no reason to hand the matcher a hint.

### 1 · `loop` — the announcement (post this one first)

The seamless cut, so it repeats invisibly while someone reads the caption.

> I made an album. On October 10th I'm playing it front to back, out loud, in
> the courtyard at Scott's, and that's the first time anyone hears it.
>
> Doors 6:30. Album at 8. $5. 19+. Dress code is 80s.
> Kamloops, come dance.
> odubostudio.com/loop

`#Kamloops #LoopSoul #ComeDance #KamloopsEvents #KamloopsMusic #YKA`

### 2 · `energetic` — the follow-up

> This is what the room is for.
>
> Loop Soul, an album by Mani Odubo, played start to finish for the first time.
> Saturday October 10 at Scott's Inn & Suites, Kamloops. Doors 6:30, album at
> 8, Amen the DJ after. $5. 19+. 80s.
> odubostudio.com/loop

`#Kamloops #LoopSoul #ComeDance #KamloopsEvents #DanceFloor #YKA`

### 3 · `calm` — the reminder

> Twenty six days.
>
> Saturday October 10, Scott's Inn & Suites, Kamloops. The whole album, live,
> in the courtyard. Doors 6:30. Album at 8. $5 at the door. 19+.
> Come dance.
> odubostudio.com/loop

`#Kamloops #LoopSoul #ComeDance #KamloopsEvents #YKA`

## Not all three on Monday

Three near-identical 30s pieces on one day compete with each other and spend
the whole idea at once. Monday takes `loop`; the other two are drafted and
dated later in the week so the announcement gets a run rather than a burst.

Only `loop` repeats invisibly (2.0% seam). `energetic` and `calm` were chosen
purely on movement and both visibly jump when the reel wraps, which matters
more the longer someone watches.

## The audio decision still stands

The music is an exact commercial master and Instagram will fingerprint it. Post
the scored version and see; if it is claimed, muted or region-locked, the
silent twin has byte-identical frames and the timecode into the song is
recorded in
[loop-living-poster.md](loop-living-poster.md), so the platform's own licensed
copy drops over it in sync.
