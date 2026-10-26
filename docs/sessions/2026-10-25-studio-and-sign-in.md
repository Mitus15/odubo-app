# 2026-10-25: posting from the Studio, the admin's address, one sign-in

All three deployed with his OK (main b2847958 -> 431b6b74 -> 7288567a).

## The Post view's sound cue (431b6b74)

The 87 training drafts (scripts/loop/posts/stage.py, on the dance branch) carry a note with
"Sound from 0:17 (to 0:59)": each Reel and short opens on that whole second of its song, so the
app's own sound started there lines up. The Post view lifts it out as "Start the sound at 0:17",
large, and keeps the rest of the note line by line (it ran together). `soundCue` in
src/lib/social/postQueue.ts; tests socialPostQueue, postViewSoundCue.

## admin. and moments. were never attached

Since 2026-09-04 the middleware treats odubostudio.com as the live apex and sends /admin to
admin.odubostudio.com and /moments to moments.odubostudio.com, but neither was a domain on the
Vercel project (only the apex, www and odubo-studio-app.vercel.app): both answered
DEPLOYMENT_NOT_FOUND, so the admin and Moments were unreachable at the live address. Attached
both through the Vercel API; verified, certificates valid, both open.

## One sign-in (7288567a)

The sign-in is a JWT kept as the `token` cookie (the server reads it first) and in localStorage
(much of the client reads that). AUTH_COOKIE_DOMAIN was unset, so a sign-in on www never reached
admin. Now (src/lib/signIn.ts):

- on the live apexes the cookie's Domain is the whole apex; a host-only cookie from before is
  cleared at sign-in so the two never disagree (Next keeps both Set-Cookie headers: tested);
- a script in the root layout's head copies the cookie into localStorage on every page load,
  and drops the copy once the cookie is gone (signed out elsewhere, or expired: both 7 days);
- every logout (admin footer, account tab, admin nav, social-ops, AuthContext, HubUserContext)
  calls `clearSignIn`: the local copy, the host cookie and the shared one;
- vercel.app and localhost behave as before; the middleware takes its apexes from the same list.

Checked live with a dummy cookie in the built-in browser: set on www, seen and copied on
moments; logged out on moments, the copy on www dropped at the next load; no console errors.
Not checked: a real sign-in (his password); he signs in once and should stay signed in on all
three addresses.

## The Oct 10 work, at last (629e4788)

claude/ship-2026-10-10, gathered on Oct 10 to deploy in one go, had never been merged: 160 of its
files were missing from main, and the live /api/videos handed anyone 69 archived videos with their
Stream ids. Merged with his OK; 8 conflicts resolved toward what main learned since:

- the social posts routes keep main's requireAdmin (both sides had added it);
- /api/tracks/[id] keeps Phase 0's rule (an unreleased track is not there for someone who may not
  hear it) and takes the branch's caching; the album and track door tests now describe Phase 0;
- the paused rollout still sends /loop to /music, and single pages keep their Phase 0 names;
- the branch's rename to "Signs of Life" stays out of public view (owner, 2026-10-24): one switch,
  `NAME_IS_OUT` in src/lib/loop/albumName.ts, false; `PUBLIC_ALBUM_NAME` (Loop Soul) on every public
  page, the manifest and clip captions; `sharePath` stays on /loop/<slug>. Flip it, update the
  manifest (its test says so), and the album's name and /signsoflife address come out together.

Checked live: /api/videos 63 public and 0 hidden; admin, social and bulk-update routes 401 without a
sign-in; every page 200; the 1984 page carries no "Signs of Life"; 1984 plays; the clip feed works.
The Stream webhook now refuses unsigned calls (500, "not configured") until a webhook and its
CLOUDFLARE_STREAM_WEBHOOK_SECRET exist; none is set up in Cloudflare, so nothing was relying on it.
