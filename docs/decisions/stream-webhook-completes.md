# The Stream webhook completes, it never overrules

**Owner, 2026-10-02.** What a genuine Cloudflare Stream notification may write
to `videos`. Chosen from four options; the owner picked "clips and parents".
Code: `handlePayload` in `src/app/api/stream/webhook/route.ts`.

---

## The decision

For a row still waiting on Stream, a verified notification:

- fills `duration` and `duration_seconds`;
- starts an automatic poster, only over Stream's default frame and only on a
  video no poster has been generated for: a clip gets a random frame (R2), a
  parent video the Gemini pick (five frames sent to Google). The run is
  claimed (`thumbnail_status` pending to generating, atomically), so it never
  starts twice, and it runs after the response (`after()`).

It never:

- writes `status` or visibility (`is_public`, `publication_status`);
- replaces a poster someone or something chose;
- touches a row written after Stream finished (`created_at` later than the
  notification's `modified`): the Loop film and its clips, imports;
- touches a row that already knows its duration (a repeat notification).

A processing error is logged; nothing is written.

## Why

Until 2026-10-02 the route read `payload.data` and `payload.result` only.
Cloudflare sends the video object at the top level, so none of the February
design's writes ever ran. Each was weighed against what the app does now.

| The February design wrote | What it would do today | Kept |
|---|---|---|
| `status = 'published'` when ready | Every upload route already writes `published`, and visibility lives in `is_public` and `publication_status`. The one effect left: an archived video back in the feed. | No |
| Stream's thumbnail as the poster | Every row is born with that frame. Writing it again could only overwrite a poster that was chosen or generated. | No |
| The duration | Nothing else fills it for Arsenal uploads. The clips feed reads `duration_seconds`, empty for every one of them. | Yes |
| A poster run | `poll-ready` does it, but only for the last file of a batch, with the tab open, within about 2.5 minutes, and never over 5 GB (the film). | Yes, guarded |

## The options offered

1. **Clips and parents** (chosen): random frames for clips, the Gemini pick for
   parent videos.
2. Clips only: nothing sent to Gemini automatically.
3. Durations only: no posters from the webhook.
4. Nothing: verify, answer, write nothing.

## Trade-offs accepted

- The last file of an Arsenal upload can get two posters, one from the
  webhook and one from `poll-ready`, which does not check the claim. The last
  write wins. `poll-ready` is left as it is.
- A hidden parent video's frames go to Gemini, as `poll-ready` already sent
  them.
- None of it runs until `CLOUDFLARE_STREAM_WEBHOOK_SECRET` is set in Vercel.
