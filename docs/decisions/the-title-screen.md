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

## His notes from his phone (2026-10-27, the preview), and what they changed

His words: "the gear shadows arent blurred enough still looks artificial", "the product page should
also use the same design at least the color... it feels like going to a completely different
store when I click the actual product", "the product image is huge", "it says gear now. But when
you go back to shop, it goes back to this shop... and then when I cancel that, it goes to the
clips", "the dance man... stays blurry for a second before it sharpens", "the video is blurry when
the page first loads... have the poster load like the first frame", "the reflection just seem to
cut off so jarringly", then "i think the product image should animate like the danceman logo when
its opened... I also want optimization. faster loading if possible", and "sweep the whole public
facing app".

- **The floor under a piece (`components/room/PieceOnFloor.tsx`, shared by /gear and the piece's
  page).**
  - The shade is two ellipses under a Gaussian blur, a wide faint one and a close darker one, in
    a deeper tone of the room (`color-mix` with black). No drawn edge anywhere.
  - The reflection is a little out of focus (`blur`) and fades on an ease-out curve over 30% of
    the piece. A straight fade read as a line where it stopped.
  - A piece comes in whole once its photo is there: never a shade on an empty floor.
  - The "jagged edges" he first named were the shadow's crisp line, not the photos (his
    correction); the cutouts were left as they are.
- **The piece's page is in its room.** The same colour as in /gear, the same floor, the photo a
  share of the screen (36% on a phone), the sizes and Add to bag under it. A colour option with
  only one value is not asked. The hanger at the top goes back to /gear on that piece
  (`?piece=`); the bag sits beside it once something is in it.
- **One store.** `/store` sends every old link to `/gear` with its query. The bag
  (`/store/cart?room=`) is in the room of the piece the visitor came from, else the house's dark.
- **The piece flies (`components/room/flight.ts`).** A tap on a piece (or See it) flies it into
  its page with the browser's own view transition, and the hanger flies it back. The page under
  it cross-fades in the same colour. Safari 18 and Chrome; elsewhere the page simply changes.
  Both pages ask for the same photo (1080 wide, WebP from Shopify, ~60 KB), so it is already
  there when the piece lands.
- **The danceman's flight** grows him by his own size (a CSS variable), never a transform's
  scale. A scaled layer is a stretched picture that Safari left blurred until a pinch.
- **The video starts sharp.**
  - The still is the copy's first frame at full size, so the hand-over has no jump.
  - Stream makes its stills with the SD formula from an HD copy, so they were darker than the
    room (Billie Jean #ea85a3 in the still, #f593a6 the room). `/stills/<uid>.jpg`
    (`lib/stillsServer.ts`) turns them back with one 3x3 step; the still now reads #f28fa1
    against the video's #f291a2. Kept a year at the edge.
  - Chrome now plays HLS natively and starts on the 240p rendition. The rooms use hls.js
    everywhere but Apple's player, start on the level that fills the screen, wait for the
    manifest before loading, and drop the clips' 1.5 s fragment limit (it dropped the first
    fragment to 240p). The video takes over from the still only once it plays sharp, or after
    5 s regardless.
- **Faster.** The levels are kept two minutes and each piece's look 30 days in Next's data cache;
  Shopify's product reads are kept a minute; the home fetches /gear behind the room, /gear
  fetches the page of the piece in front, and a piece's page fetches /gear.
- **The sweep (one read-only pass over every public route).** Fixed here: the old desktop
  sidebar hidden under every room (`isRoomRoute`), the sitemap listing the rooms, one robots
  route, the default browser bar in the house ink, the app installs as Odubo Studio, share cards
  at 1200 x 630 (`/share/<level>`, `/share/newest`, `/share/house`), dash-free alt text, the
  sign-in pages' old "Cool Wrld" title, 44 px targets. The cookie bar, contact, the conversation
  page, the small print and the 404 and error pages were set in the room in the same pass.

## The whole dance, and the room sampled from it (2026-10-27, his words)

"we're not even going to use the reels at all. We'll use the full videos just without the HUD", "I
want the page to sample the color from those videos... it should look like I'm dancing, not in the
video on the page, but I'm dancing on the page", "don't just like code a color... like Photoshop, you
can have a color sampler tool... once the video is uploaded, we do that for the video, we cache it",
"I make them almost every day... new colours", "6 hours is not going to cut it", and for Billie
Jean "the website doesn't need" the echoes.

- **A site copy is the whole dance**, rendered again from its take with the HUD off, from the
  song's own show (`scripts/loop/posts/site_copies.py`).
  - **Every copy stands on the lacquer floor, with no effects.** His words: "everything should have
    the lacquer floor, because some of them, the shadow is not right... if we're going to re-render
    them for the website, then we must make everything look... the same".
  - The song's show file is left as it is (it is the posted video's); the copy's show is written
    beside the copies, the song's own with `floor: lacquer, effects: []`.
  - Billie Jean's echo and tiles stay in its posted video.
  - No covering: a box over a HUD corner could cut his hand.
  - The take's matte, field and paint are already made, so only compose runs. The lacquer floor
    drew at 15.6 fps; its texture and sheen are now kept between frames under a still camera
    (`plane.py`, bit-identical output, PSNR infinite), 24.8 fps: about 1¼ hours for all 15, each
    uploaded while the next renders. Three renders at once were slower than one after another
    (the GPU is the limit). The 6 hours was the whole pipeline, segmentation included.
- **The colour sampler (`lib/sampler.ts`, `lib/samplerServer.ts`).**
  - Each video's first frame (the corrected still) is read once: the field from its edges, the
    figure (the ink he is drawn in) from what stands out in the middle.
  - Kept 30 days in Next's data cache per uid; a new upload is sampled the first time its room
    is shown.
  - The room is the field; the page writes in his own ink where it reads, else ink or sand
    (`writingOn`). Memories, on a deep blue, writes in sand.
  - No room colour is written in code; the campaign's colour is only the fallback before a video
    is sampled.
  - On screen in Chromium: page #e595a2, video field #e595a2.
- **The sampler picks its moment.** Three full dances open with him walking back from the phone,
  a close-up (Memories for 8 s, Planet Rock 4, Give Life Back to Music and Molowo Noni 2). The
  sampler steps through the first seconds and reads the first frame where he stands in the room:
  the field all round the sides and top, none of his ink on the bottom edge (the floor is its own
  tone), and him covering under 18% of the frame (`settled`). That moment is the still, the
  colour sample and where the video starts (`posterAt`), so the hand-over has no jump. A frame
  Stream will not give (busy, a dropped connection) is retried, and a look is never kept from a
  partial read; videos are sampled three at a time (fifteen at once lost most connections).
- **A copy opens and closes like the YouTube cut.** "I think for all web renders, we need to open
  and close like the videos too." The whole recording ran from before the song (up to 14 s of him
  waiting, Monkey) to after the dance (23 s of walking to the camera, Hold the Line). Each copy now
  runs between its YouTube cut's points (`youtube.json`): the song's first note, or the first bar
  after he settles, to the last bar before he stops. The copy and the posted full video share a
  timeline frame for frame (his movement lines up at 0.0 s in all fourteen), so the points carry
  over; Billie Jean, cut by its show's bars, keeps its own. No render was made again: the cut is
  taken from the render already made (28 s an encode). Each copy fades in from its field over
  0.5 s and out to it over its last second, so on the page, where it loops, he appears on the room
  and leaves it with no seam. The sampler treats the field alone as no one there (`settled` needs
  him in at least 1% of the frame), so the still and the start fall at 1 s, after the fade in.
- **The copies are tagged with the sRGB curve.** An untagged curve was drawn as video's own, a
  touch lighter and bluer than the page; Stream keeps the tag in every rendition.
- **Made once, kept as made.** "We don't have to re-render... as stuff gets better, it just gets
  better. And so people would be able to see the progression in the design." Better silhouettes
  and shadows go into the next dances; the copies on the site stay.
- **The world is the brand's anchor.** After the Loop Soul album, the pop-art silhouette world
  becomes a staple of the brand (not the only thing), tied to the Danceman, whose silhouette he
  inspired. The video game and the album's movie live in this world.
- **A preview shows every song** with a dance on Stream, posted or not (`SHOWS_UNRELEASED`:
  everywhere but `VERCEL_ENV=production`), what is out first, then the rest in planned order. The
  live site still shows only what is out.
- **The levels code is split**: `lib/levels.ts` is what the browser may read; the database, the
  sampler and the still's image library are `lib/levelsServer.ts`.

## On a weak line (2026-10-27, his words)

"The infinity hoodie and the portrait hoodie are the only products whose images load. And the
videos... still struggle to load well on shotty wifi/network. Takes the magic out of loading the
page and its design."

- **The gear row fetches its own photos**: the piece in front and two either side of it, of every
  piece that has stood in front. The browser's lazy loading never fetched the pieces of the sideways
  row on his iPhone; only the two fetched at once ever stood. No photo on the site is lazy now.
- **A room keeps half a minute ahead** (`ROOM_BUFFER` in `lib/hlsPlayer.ts`). The clips' buffers
  (3 s on a phone) were made for a feed swiped through, and froze a room on the first weak patch.
  Measured with the line held to 1.2 Mbps and 150 ms: 15 to 20 s ahead, 1080p from 21 s.
- **The room a visitor lands in starts from the page itself** on Apple's player (`early` in
  `RoomVideo`: a few lines run as the page is read). Before, nothing was asked of Stream until the
  site's code (about 315 KB compressed) had come and run, and on a weak line he stood still through
  all of it. The component takes the stream over as it is.
- **One stream has the line.** In the focused view the performance on screen plays first; the ones
  beside it fetch their first seconds once it plays sharp, and nothing further away is fetched.
- **Not done: the code itself.** Every page carries the whole old app's machinery in the root
  layout (the store, music and media orchestrators, their modals, the desktop sidebar): about
  315 KB of script before a room is live. Splitting it out is the next real gain on a weak line.

### The blurry minute (the same night, his words)

"The video loaded into the world sometimes is blurry for a minute before clearing up. That still
needs to be optimized. The lower quality also takes away from the magic for those few seconds."

- **A room's manifest holds only its sharp renditions.** Stream's manifest offers five, down to
  240p, and both players took the low ones on a weak start: Apple's measures the first segment,
  drops to 240p or 480p and climbs back a step at a time (the minute of blur); hls.js started where
  the browser's guess of the line put it. The site now serves each copy's manifest itself
  (`/streams/<uid>.m3u8`, `lib/streams.ts`), with the renditions under 720 lines taken out, and
  points every room at it. Neither player can go below 720p, and Apple's starts on the 1080p, which
  is listed first.
- **The trade:** on a line under about half a megabit the picture holds instead of blurring. A
  copy's 720p averages about 0.45 Mbps and its 1080p about 0.8 to 0.9, so that is a line the site
  does not expect; his word is that the blur costs more than a pause.
- The manifest is kept a day at the edge and an hour in the browser; a copy never changes under its
  uid.

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
- **The old 15-second popup** still runs on the clips feed, `/?clip=` and `/media` (`/store` goes to `/gear` now).
