/**
 * Is the Soul Loop Anthem running?
 *
 * Parked for Volume 1 (2026-08-24, owner's call): a four-round tournament was
 * work the campaign did not need, and picking a cover song competed with the
 * album for meaning. The machinery is deliberately left intact — it comes back
 * after the event pointed at a better question, VOTING ON THE ALBUM'S
 * TRACKLIST, which makes the room shape the record instead of choosing
 * something outside it.
 *
 * Flip this to true to bring the module, its poster family and its pass
 * promise back. Nothing else has to change.
 */
export const ANTHEM_ENABLED = false;

/**
 * Is Danceyokey running?
 *
 * Not part of Volume 1 (owner, 2026-08-25) — the floor moment this volume has
 * is the Loop Soul Line, which needs no sign-up. The idea stands and the whole
 * feature is intact (panel, host console, API routes, D1 table); this flag is
 * the single switch that brings it back for a later volume.
 */
export const DANCEYOKEY_ENABLED = false;

/**
 * Seed content for State 1 — The Gathering.
 *
 * This is the content the marketing team will eventually edit from /admin
 * (persisted in D1). For now it lives here as typed seed data so the promo
 * experience is real and complete without a database.
 */

export type AnthemTrack = {
  id: string;
  title: string;
  artist: string;
  /** Search term used to resolve a 30s preview + artwork from iTunes. */
  query: string;
};

/** Eight tracks → Soul Loop Anthem bracket (quarters → semis → final). */
export const ANTHEM_TRACKS: AnthemTrack[] = [
  {
    id: "billie-jean",
    title: "Billie Jean",
    artist: "Michael Jackson",
    query: "Billie Jean Michael Jackson",
  },
  {
    id: "flashlight",
    title: "Flashlight",
    artist: "Parliament",
    query: "Flashlight Parliament",
  },
  {
    id: "september",
    title: "September",
    artist: "Earth, Wind & Fire",
    query: "September Earth Wind Fire",
  },
  {
    id: "aint-nobody",
    title: "Ain't Nobody",
    artist: "Rufus & Chaka Khan",
    query: "Ain't Nobody Chaka Khan",
  },
  { id: "le-freak", title: "Le Freak", artist: "Chic", query: "Le Freak Chic" },
  {
    id: "got-to-be-real",
    title: "Got to Be Real",
    artist: "Cheryl Lynn",
    query: "Got to Be Real Cheryl Lynn",
  },
  {
    id: "super-freak",
    title: "Super Freak",
    artist: "Rick James",
    query: "Super Freak Rick James",
  },
  {
    id: "give-it-to-me",
    title: "Give It to Me Baby",
    artist: "Rick James",
    query: "Give It To Me Baby Rick James",
  },
];

/**
 * The Run of Show — ONE timeline that is both the program (timed segments) and
 * the lineup (who's performing). Every row is a timed slot; rows that have a
 * performer carry their name/role + Instagram so the act links out right where
 * it happens. This replaces the old separate `Lineup`/`Program`.
 */
export type RunOfShowItem = {
  id: string;
  time: string;
  title: string;
  detail: string;
  /** Performer at this slot, if any (folds the old lineup into the timeline). */
  performer?: string;
  /** Short performer tag, e.g. "resident DJ", "filmed set", "the anthem". */
  role?: string;
  /** Bare Instagram handle → links to instagram.com/<handle>. */
  instagram?: string;
};

export const RUN_OF_SHOW: RunOfShowItem[] = [
  // Rewritten 2026-09-10 (owner). The night is THREE states, not a sequence of
  // moments: a lounge, then the record, then a floor. The band is gone — the
  // whole album is performed live, which is the thing that makes this a
  // performance rather than a listening party, and "1984" is no longer a
  // separate slot because it is simply one of the fourteen.
  //
  // NOTE: this is the SEED, not what renders. getRunOfShow reads run_of_show in
  // D1 and only falls back here when that table is empty — the live programme
  // was already edited to this shape from /loop/admin. Kept in step so the
  // fallback never contradicts the thing it is standing in for.
  {
    id: "lounge",
    time: "6:30",
    title: "The Lounge",
    detail:
      "Fire pits, games, drinks and music in the courtyard. Come when you come — nothing starts until 8, and nobody is ever on time.",
  },
  {
    id: "album",
    time: "8:00",
    title: "The Album — Live",
    detail:
      "Loop Soul performed live, front to back, outside under the lights. Not a playback: the record played as a set, once. Be here before 8.",
    performer: "Mani Odubo",
    role: "live · with Amen the DJ",
  },
  {
    id: "floor",
    time: "9:00",
    title: "The 80s Floor",
    detail:
      "Amen takes it from the last track to the dance floor. Dress code is the decade — come as you'd have come in 1985.",
    performer: "Amen the DJ",
    role: "the 1s and 2s",
  },
  {
    id: "out",
    time: "10:30",
    title: "Out",
    detail: "Hard stop. The room has to be empty by 10:30.",
  },
];

export type LookbookItem = {
  id: string;
  src: string;
  label: string;
};

/** Poster concepts double as the visual mood board until curated outfit shots land. */
export const LOOKBOOK: LookbookItem[] = [
  {
    id: "spin",
    src: "/loop/posters/spin.png",
    label: "What are you spinning?",
  },
  { id: "dance", src: "/loop/posters/dance.png", label: "What we dancin' to" },
  {
    id: "listen",
    src: "/loop/posters/listen.png",
    label: "What are you listening to?",
  },
  {
    id: "fashion",
    src: "/loop/posters/fashion.png",
    label: "What are you wearing?",
  },
  { id: "play", src: "/loop/posters/play.png", label: "What are you playing?" },
];

/**
 * The credit lines — who the record is by, and who else is on the night.
 *
 * One definition for the printed piece and the web front door. They used to
 * live only in the poster kit, which meant the paper and the page could drift
 * apart silently: the flyer is the thing a stranger holds while looking at the
 * site, and the two disagreeing is the one error neither can correct.
 *
 * Upper case is applied by the piece, not stored here — the print engine
 * upcases everything it sets, and the web page uses a CSS `uppercase` so the
 * string stays readable in source and in a screen reader.
 */
export const EVENT_CREDITS = {
  record: "An album by Mani Odubo",
  /** Subordinate to `record` by design — see the poster engine's layout doc. */
  feature: "With Amen the DJ",
} as const;

/**
 * The recording notice.
 *
 * The night is filmed and recorded, and some of that is released — "1984" is
 * performed live and recorded for the record, the room is photographed for the
 * Journal, and footage goes out as promotion. People have to be told that
 * BEFORE they pay, not discovered it when they see themselves in something.
 *
 * One constant, because a notice that appears in three places with three
 * wordings is three different notices, and only one of them is the one you
 * meant. It is deliberately plain: a wall of legalese is read by nobody and
 * therefore protects nobody.
 *
 * `optOut` is not decoration. The house style renders guests faceless
 * (docs/decisions/loop-soul-the-faceless.md), but facelessness is a privacy
 * control, not a substitute for consent — a notice with no way to say no is a
 * shield, not an offer.
 */
export const RECORDING_NOTICE = {
  short: "Filmed and recorded. You may appear.",
  headline: "This night is filmed and recorded",
  body:
    "The live performance is recorded for release, and the room is filmed and " +
    "photographed all evening for the album, the magazine and future promotion. " +
    "Coming in means you may appear in that footage, on camera or in a photograph, " +
    "at any point in the night.",
  optOut:
    "If you would rather not appear, tell anyone on the door — we will keep you out of shot.",
} as const;
