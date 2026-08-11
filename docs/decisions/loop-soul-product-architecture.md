# Loop Soul — what the app is for, and the architecture that follows

**Status:** living document. Started 2026-08-11 from the owner's thinking-out-loud.
Everything here is owner intent captured verbatim-in-spirit, then turned into
system design. Update it as the shape changes; don't let decisions live only in
chat.

---

## The governing principle

> The app must **enhance the event, not replace it**. Nobody should be on their
> phone all night. The phone comes out for specific moments and then goes away.

Test every feature against it: *does this make the room better, or does it just
make the app busier?* Anything that rewards staring (infinite feeds, chat,
notifications during the show) fails the test.

The three phases each have one job:

| Phase | Job | Surfaces |
|---|---|---|
| **Before** | Promote and sell the room | Gathering poster, pass sales, anthem nominations/voting, Poster Studio (marketing) |
| **During** | Enhance specific moments | Danceyokey queue, the camera, the Wall, the live program |
| **After** | Record it into a history piece | The Vault, attendee curations, the official gallery, the magazine issue |

---

## The event is also a taping

Loop Soul is a recurring event **and** a web-series episode. That has design
consequences:

- The **run of show is a script** — acts, not just a timetable. The app's live
  program should read like the episode's structure (cold open → sets →
  Danceyokey → the anthem/Soul Train line).
- **Music rights are handled by design, transparently.** Guests dance to music
  everyone knows in the room; the published episode can be overdubbed with
  local-artist music afterward. The app should therefore capture *what was
  danced to* (song metadata) so the edit knows what to replace, and so the
  local artist gets credited.
- Anything the app records during the night is **production footage as well as
  souvenir** — a second reason to make capture effortless.

---

## Danceyokey

**Name:** Danceyokey (dance + yo + key). Hashtag `#danceyokey`.

**The model is karaoke at a pub, done digitally.** At a karaoke night: a host/DJ
keeps a list, each person picks a song, the DJ cues it, the person gets the
floor for one song. Danceyokey is the same social contract with dancing (or lip
sync) instead of singing — **the dance floor is yours for your song.**

Design implications:

- **Limited spots per night** (owner: ~3), so a spot is a real prize and the
  queue stays short. Scarcity is the point.
- **Guest side is 15 seconds of phone**: claim a spot, pick your song, put the
  phone away. Then a "you're up next" moment.
- **Host side is the important surface**: the running order, who's next, mark
  done, reorder, cut. This is the app *running the night from the host's
  pocket* — the mirror of every other feature, where the guest does almost
  nothing and the host does the work.
- **Song choice is data**, not just a label: it feeds the DJ (what to cue), the
  edit (what to overdub), and the magazine (what was danced to).
- Open questions for the owner: first-come vs. host-picked? Sign-up before the
  night or only in the room? Can two people share a spot (duets)? Is there a
  "wildcard" spot the host gives away live?

---

## Capture, and who owns the record of the night

The owner's frame, kept because it's the clearest statement of the model:

> Think of it like a gospel. The event is what happened. Certain attendees are
> **witnesses** — they take photos and video, they choose which scenes matter,
> and they write their own account of it. Each account is theirs.

So the system has **three layers of record**, not one gallery:

1. **Raw capture** — everything shot in the room. Today: the Wall (shared) plus
   on-device shots. Attendees shoot each other constantly (especially during
   Danceyokey — "your friend is about to go up, so you film them").
2. **Attendee curations** — an attendee selects and sequences *their* account of
   the night. It appears on their profile, credited to them, as one witness's
   version of the event.
3. **The official gallery** — curated by the owner. This is the canonical record
   of the volume and the basis of the magazine.

**The magazine is the artifact.** Each event becomes an issue. Two kinds:

- **Official issue** — owner's curation only. Sellable, no royalties owed.
- **Contributor issue(s)** — include attendee work. Sellable, and contributors
  earn a **royalty share on sales** for the photos of theirs that are used.

That royalty promise makes attribution a first-class requirement, not a nicety:
every shot needs a durable owner from the moment it's taken.

### Sharing — the pain this actually solves

Owner's real experience: performing, friends filmed it on their phones, then it
was AirDrop / Bluetooth / text / "can you send me that" — media scattered and
half-lost. Loop Soul should make that a non-event:

- Attendees can **share their vault** with another attendee, who can then
  **download the originals directly**. No AirDrop, no compression, no chasing.
- If someone hasn't shared with you, you still see them as an attendee — you
  can ask, or see their public curation.
- Across volumes this accrues into a **living portfolio** of the series for the
  owner: photos, video, magazines, all in one place that grows every event.

---

## What that means architecturally

The current build already has the right spine (Wall on the moments core, event
codes as identity, shared media components). What's missing is **identity with
continuity** and **attribution**.

### 1. Attendee identity (the missing piece)

Today a guest is an anonymous `ls_voter` cookie plus a redeemed event code.
That's enough to gate the room; it is **not** enough for profiles, credits,
royalties, or vault sharing — clear your cookies and you're a stranger.

Direction: keep the frictionless cookie for the night, then let a guest
**claim** their identity (a name and a way back in — the checkout email is the
natural key, since it's already tied to their pass). Claiming binds their shots
to a durable attendee record. No passwords at the door; claiming can happen
after the event when they want their photos.

This is the biggest open design question and should be its own decision doc
before it's built.

### 2. Attribution on every capture

`gallery_photos` currently records a free-text `user_name`. For credit and
royalties it needs the attendee id, captured at upload time and immutable
afterward. Cheap to add now, painful to retrofit after a night of shooting.

### 3. Curations as first-class objects

An attendee curation = an ordered, titled selection of shots (theirs and/or
others', within one event) with a cover. That's a small table plus a join, and
it powers: profiles, the magazine's contributor sections, and "share my vault."

### 4. The magazine pipeline

The Journal (open PR #4) is the per-volume issue that mostly writes itself from
event data. The commerce layer on top — selling an issue, tracking which
contributors are in it, paying royalties — is a later phase and should reuse
Shopify (products = issues) exactly as passes do.

---

## Constraints to design around

- **No reliable domain.** `odubo.studio` is lapsed and won't be used for a long
  time; a replacement may or may not arrive. **Never hardcode a domain.**
  Everything (share links, QR codes, email senders, canonical URLs) must be
  derived from the request origin or an admin setting.
- **Email is not a critical path.** Because there's no verified sending domain,
  code delivery can't be trusted for strangers yet. Anything essential (getting
  into the room, getting your photos) must have a non-email route.
- **Phones at a venue**: bad light, worse Wi-Fi, one hand, dark room. Contrast
  and tap targets are functional requirements, not polish.

---

## Immediate follow-ups (in order)

1. **Code lookup without email** — "find my code" by checkout email, so a lost
   or undelivered email never blocks entry. *(Building now.)*
2. **Configurable sender + no hardcoded origins** — sender address as a setting;
   audit for hardcoded `odubo.studio` / vercel URLs.
3. **Filter nuance** — owner: the new engraved style is much better, but faces
   lose their nuance unless the light is great. Keep the line quality, recover
   facial structure in mid-tones.
4. **Danceyokey** — host-run queue + guest sign-up, designed from the karaoke
   model above. Needs the owner's answers to the open questions.
5. **Attendee identity** — its own decision doc, then build.
6. **Curations + attribution**, then the magazine commerce layer.
