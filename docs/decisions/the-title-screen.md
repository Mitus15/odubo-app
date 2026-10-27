# The site is set in the room (2026-10-27)

Approved 2026-10-24: the site is the title screen of the Reels' game world. Built 2026-10-27 on
branch `claude/site-title-screen`.

## The turn, in his words

The first build was printed on the Brand Kit's sand paper: the level framed in a card, with
billing rows under it. His answer: "it feels less artistic, and more corporate… there's a middle
ground… I'd rather have something that feels like the site (and therefore all that is in it) exists
in the world that I dance in, that infinite potential imagination room vibe." He also objected that
Gear opened a single item.

So the site is now set in **the room**: the flat colour field that goes on forever, with the
lacquer floor, the shadow and the HUD.

## How the room works (`src/lib/room.ts`, `src/components/room/`)

- **The page is the level's colour.** Each video's field is exactly its campaign colour: Billie
  Jean samples #f592a6, flat edge to edge, against #f593a6 in the Studio. A page painted that colour
  has no visible edge around the video, so the dancer stands in a room that runs to the edges of the
  screen.
- **The video's edges are feathered.** Some passages light the floor or have a lighter field (Billie
  Jean's close-ups). The feather melts that into the room: 6% on a phone, 16% on a wide screen.
- **Writing is ink, the dancer's colour.** It switches to sand on a field too dark for ink. Of the
  14 songs, only Memories' blue is that dark.

## The pages

**Home and `/links` (`RoomScreen`)**
- Every level that is out, newest first, one to a screen. You swipe up for the next room, as in the
  clips feed.
- The last screen is the outro, in the house ink: the danceman, the day's verse, the marks and the
  small print.
- Your name, Mani Odubo, sits at the top, with "Hear it on YouTube" for the level on screen.
- A tick for each room runs down the right edge.
- On the floor: Levels · Music · Gear, and Save your progress (the one drawn shape).

**Save your progress**
- It opens the save slot, an ink dialog box that rises from the floor. It takes an email, never a
  password, and closes with its X, never by dragging.
- The slot is always in the page, so the tap that opens it can raise the phone's keyboard.

**`/gear` (`GearRoom`)**
- It opens in the room the visitor came from (`?room=`).
- Every piece stands on the floor in a row that slides sideways. The next piece peeks in at the
  edge.
- Each piece has a reflection and a soft shadow at its foot. The photo is cropped to the garment, by
  reading where its opaque pixels end, so the reflection meets the piece where it ends.
- The piece in front shows its name, price and "See it". The piece picked in /admin/linktree stands
  first.

**`/levels`** is a wall of windows into each room, set in the current room.

**`/levels/[id]`** is the feed, opened in that level's room. A shared link lands in the room and the
visitor can keep swiping.

**`/music`** is set in the current room:
- Catching Light's cover stands on the floor, with where it streams.
- Then World 2 · Locked and Save your progress.

## His notes the same evening, and what they changed

**"many more colors than the billie jean pink"** The rooms now use every song's colour
(`getRoomColours`). A colour names no song and no date, so it can show before the piece is out.
- On Gear, each piece stands in a room of its own colour. The first is the room you came from.
- On the home, the next room stands locked after the levels, in its song's colour (`getNextRoomColour`).

**"scrolling through the products is janky"**
- The row is left alone while a finger moves it: no piece changes size or fades as it goes, and
  nothing in the row re-renders. Only the name and the room's colour follow it, at most once a
  frame.
- Each swipe moves one piece (`snap-always`).
- The crop to the garment is now read on the server, once per photo (sharp, `lib/store/pieceBounds.ts`).
  The phone does no measuring, and pieces show at once instead of waiting to be measured.

**"button too low… top heavy"** Gear is now one block, centred in what the browser leaves of the
screen: the label, the piece on its floor, the name and price, then "See it". The home's floor
button moved up off the edge.

**"account for browser viewports"**
- The heights come from the height the browser actually leaves (`dvh`, with a `vh` fallback, inside
  the safe areas), not from fixed sizes.
- A short screen (under 600px tall: an in-app browser's bars, a phone on its side) gets a lower
  floor.
- On a screen too short for it, Gear scrolls instead of cutting off.
- The browser's own bars take the room's colour (`theme-color`).
- Checked at 375×812, 375×640, 812×375, 768×1024 and 1366×860.

**"I'm Mani. Not the site nor the company behind it."** The site is Odubo Studio. Mani is the one
dancing in it, never its name. The titles and descriptions now say "Odubo Studio: the music and
dance of Mani Odubo…".

**"just the danceman in the header… rely more on alt text… images/symbols rather than full on
words"**
- The header is the danceman alone (named Odubo Studio for search and screen readers).
- The floor's doors are a grid, a record and a hanger, each named.
- The sound link is a speaker plus the app's own mark.
- The locked room is a lock.
- Gear wore B.A.A.D's hand-lettered mark for an hour; taken off at his note below.
- Music shows the streaming services' marks.
- Every image of a level has a description ("Level 1-1: Mani Odubo dances Billie Jean").
- Words stay where they carry the thing itself: a piece's name and price, the album's name,
  "Save your progress", "See it" and the small print.

**"the song colors have no bearing in and of themselves… pop art concept pieces tied to the art
style of my second album, not the crux of my brand… the colors available will inevitably grow"**
- Nothing on the site names or treats a colour as meaningful. `getRoomColours` is the levels'
  pop-art palette, read from the campaigns, so new colours join on their own.
- The writing on a field is the house's ink, or sand when ink doesn't read. For any colour,
  including mid-tones, it is whichever reads better (`onRoom`).

**"BAAD creative wear can be below the products like it was in the product view of the store…
the danceman and the BAAD together… makes even me confused about what brand this is"**
- The hand-lettered B.A.A.D mark is off the site.
- Gear sets "B.A.A.D Creative Wear / by Odubo" small under the piece's name, as the product page
  does.
- The danceman at the top is the only mark, and the label is never set beside him.

**"look at this bs reflection. and the hard edge… the colors should come from the pieces. not songs…
Manteau de vin has a green background. how does that make sense?… new pieces should naturally get a
fitting color too"**
- **The rooms come from the pieces.** `lib/store/pieceLook.ts` reads each product photo once on the
  server, at 320 px wide.
  - A coloured piece stands in a pop tint of its own hue: light for a dark piece, deeper for a
    light one. Manteau de Vin gets a rose, the Infinity Hoodie an ochre, Jeans N°1 a blue.
  - A black or white piece takes the colour of its print. The Emblem seal gives a salmon, the
    Catching Light prints a peach.
  - Only a piece with no colour on it at all stands in a quiet grey (the Portrait Hoodie, the two
    black pants).
  - A new piece gets its room the first time it is shown.
  - The levels' palette is no longer used for Gear, and `getRoomColours` is gone.
- **No hard edges.** The crop keeps everything visible in the photo, soft edges and glow included,
  with 1.5% of air. Only the bottom is cut exactly, at the lowest visible pixel, so the floor meets
  the hem.
- **The reflection** was `-webkit-box-reflect` hanging below the row, so the row clipped it flat.
  Now it is part of each piece:
  - its bottom 22% mirrored and fading out;
  - a soft shadow where it stands;
  - all inside the piece's own height, so nothing is ever clipped.

**"emblem hoodie to catching light performance longsleeve is not smooth cause of the movement of
the button and text due to the longer name… also, we need a grid view of the clothes… yeezy…
inspo"**
- **The name always has two lines' room** (it is clamped to two), so the label, the price and the
  button never move. Measured: the button sits at the same height for the shortest and the longest
  name. The name and price fade in as they change (`room-fade`, off under reduced motion).
- **The grid view (`GearGrid`)**, modelled on yeezy.com's range page:
  - every piece small and the same size, in the room you are in, its name in small caps under it;
  - three across on a phone, four on a tablet, six on a desktop;
  - the grid symbol at the top right opens it, and a single square goes back;
  - tapping a piece opens it in its own room.

**"silent copies it is… just me dancing and the lacquer floor and shadow. no HUD… but i need the
baad badge still"; "the danceman on the header should animate to the danceman above the verse";
"whats up with the first two vertical tabs?"**
- **Clean site copies (`scripts/loop/posts/site_copies.py`)** are the song's whole dance:
  - him, the lacquer floor, his shadow, and the seal over his head;
  - no HUD, no outro, no song;
  - rendered with `compose --hud=none` (new), the plain stage `data/loop/film/shows/site.json`,
    `film:dance --audio=silent --outro=no`.
  - One per song is uploaded to Stream as "site · <song>", and the song's campaign `site_video`
    holds its uid (migration 170).
  - A room plays only that copy. A song without one shows a still and streams nothing, so no song
    ever reaches the site.
  - Timing: about 25 minutes of GPU per song, about 6 hours for all 15.
  - The composer also gained `--marker=none`, which the site copies do not use (the badge stays).
- **One room per song (`bySong`).** The first two ticks on the ladder were the two Billie Jean posts
  (the full song and the Ready Player 1 Reel).
  - A level is now the song.
  - Its room shows the whole dance when that is out, otherwise a Reel.
  - It is out wherever any of its pieces is, and any piece's address finds it.
- **One danceman.** As the outro comes up, the header's danceman flies down and grows into its
  place above the verse (scroll-linked, `transform` only). He turns sand as he crosses into the dark
  room.
- **The top and the floor each take the writing colour of the room under them**, so neither goes
  ink on ink mid-swipe.

**"the viewer should click on the actual video to be able to scroll through and change
rooms/performances… come out of the focused view to the main page in that room… instead of having a
tab for every video released"; "the 3 page structure is it though. something belongs on that locked
page (perhaps the game). once its time"**
- **The home is three pages, scrolled:**
  - the room (one level: the newest, or the one you came out of the focused view in);
  - the lock (the next room, its door shut, in its colour; its page is kept for the game, or
    whatever comes when it is time);
  - the outro.
- The ladder (a tick a video) is gone.
- **A tap on the dancer opens `FocusView`:**
  - the performances, one to a screen, swiped through in their rooms, each labelled at its foot
    with the level, the song and where to hear it;
  - an X, Escape or the phone's back (a pushed history state) brings you out;
  - you land on the main page, at its top, in the room you stopped in.
- An open symbol at the dancer's corner says he is a door.

**"6 hours?! … put a rectangle to cover the hud area … the regular page should not have the hud …
the HUD can appear coded into the website and get data from the studio … no need for steps … use
api, wrangler may not be logged in"**
- **Migration 170 ran through the D1 API (`stage.Cloud.sql`).** Wrangler was logged in: the safety
  check, not a login, had stopped the earlier attempt.
- **A site copy is the song's Reel,** 30 s to a minute: a room is a loop, and the whole song with
  its music is the YouTube post.
  - **Most songs:** the silent Reel, with the HUD strip (rows 0 to `split.hud_rows`, 327 at 1080)
    covered in the field's own colour (the field is flat to within 2 levels), and no sound.
    Minutes, not hours.
  - **The frame check:** where he or the seal comes within 100 px of the strip in any frame, a box
    would cut him (the HUD is his ink, and Planet Rock's first frame has his body under it). That
    Reel is skipped and the next one tried.
  - **Clean renders:** where every Reel comes near (Santé, Raise Da Roof, Hold the Line, Monkey),
    the Reel's stretch is rendered clean, about 8 minutes each. Billie Jean is always rendered,
    because its close-ups light the field.
  - **Colour:** the renders are written untagged in BT.601, and browsers play untagged video as
    BT.709, so the field came out lighter than the room (#f491a5 played as #fd9da5). Every copy is
    now converted to BT.709 and tagged, and plays within compression rounding of its room
    (Fils de joie: #eb5642 against #ee5a45).
  - **The first two uploads** (made before the colour fix) are kept aside in the ledger's
    `replaced`.
- **The site draws the HUD (`RoomHud`)**, and only in the focused view; the main page has none.
  - It uses the film's layout D in the same fractions of the frame.
  - Left: the seal and MITUS YOUNG HISTORY (no steps). Right: the level or TRAINING over
    SONG · ARTIST.
  - Under both: the progress line, following the video (levels only).
  - Its data comes from the Studio (`hudOf`).
- **Database reads retry once on a dropped connection** (`d1Fetch` in `db.ts`). Writes are never
  sent twice.

## Kept from the first build

**A level is a Studio post that is out (`src/lib/levels.ts`).** It must meet all of these:
- it belongs to a campaign named `1-2 · Song` or `Training · Song`;
- its video is on Stream;
- it is ticked posted on at least one app.

Shorts are left out. Nothing reaches the site before it is out: the next room shows only as its
colour and a lock, with no song and no date.

**Every level plays silent.** The full songs carry the song itself, which the apps are licensed to
play and this site is not. The sound is a link to where the piece is out.

**Old clip links still work.** `/?clip=123` still opens the clips feed on that clip.

## Not done yet

- **The outfit in each level.** It needs a record of which piece he wears where.
- **The welcome emails** in the game's voice.
- **The old 15-second popup** still runs on the clips feed, `/store` and `/media`.
- **The poster image** is Stream's default frame. For Billie Jean that can be a close-up.
