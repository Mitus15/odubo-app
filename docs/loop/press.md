# The press kit and the single's page

Two public links do the promoting:

- **odubostudio.com/loop/press** — the package for anyone who helps: the story,
  the live facts and a day count, rules for posting, five captions with a copy
  button, the three reels, every piece of artwork, the cover, the logos, and
  one zip. `noindex`: it is a working link, not a landing page.
- **odubostudio.com/loop/1984** — the single on its own: plays on the first
  tap, scrubs on the vinyl ring, sells a pass in place, and unfurls as the
  song (its own share card with the cover). Gift links from the single now
  point here. If the featured track is ever changed to a different song, this
  URL sends people to the poster rather than play another song as "1984".

## Where the files live

| What | Where | Why |
|---|---|---|
| Artwork, cover, logos, photos, reel stills | `public/loop/press/…` (git) | images, served statically and fast |
| The zip and the six reels | R2 `warehouse/press/loop-soul-v1/…` | too heavy for git; served by `/api/media/audio/<key>` |
| The list the page renders | `src/lib/loop/press/manifest.json` | written by the build script |
| The readme and release in the zip | `docs/loop/press/` | the unapproved quotes are in `draft-quotes.md`, not published |

## Adding photos (or anything)

```bash
# drop JPG/PNG files into public/loop/press/photos, then:
npm run loop:press -- --no-reels
git add public/loop/press src/lib/loop/press/manifest.json && git commit -m "press: photos" && git push origin HEAD:main
```

Re-rendering the artwork: `npm run loop:posters -- --out=public/loop/press/artwork --figures=crowd,dance --bleed`,
then the same two commands. The image URLs carry a content hash, so a re-render
is never served from a year-long cache.
