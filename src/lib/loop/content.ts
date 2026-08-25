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
  { id: "billie-jean", title: "Billie Jean", artist: "Michael Jackson", query: "Billie Jean Michael Jackson" },
  { id: "flashlight", title: "Flashlight", artist: "Parliament", query: "Flashlight Parliament" },
  { id: "september", title: "September", artist: "Earth, Wind & Fire", query: "September Earth Wind Fire" },
  { id: "aint-nobody", title: "Ain't Nobody", artist: "Rufus & Chaka Khan", query: "Ain't Nobody Chaka Khan" },
  { id: "le-freak", title: "Le Freak", artist: "Chic", query: "Le Freak Chic" },
  { id: "got-to-be-real", title: "Got to Be Real", artist: "Cheryl Lynn", query: "Got to Be Real Cheryl Lynn" },
  { id: "super-freak", title: "Super Freak", artist: "Rick James", query: "Super Freak Rick James" },
  { id: "give-it-to-me", title: "Give It to Me Baby", artist: "Rick James", query: "Give It To Me Baby Rick James" },
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
  {
    id: "doors",
    time: "6:30",
    title: "Doors · The Barbecue",
    detail: "Come in, eat, meet the room. The grill is on the whole night.",
  },
  {
    id: "welcome",
    time: "7:00",
    title: "The Welcome",
    detail: "The opening address — what Loop Soul is, and what tonight is.",
  },
  {
    id: "warm",
    time: "7:30",
    title: "Before The Record",
    detail: "Something to get the room together before the album starts.",
  },
  {
    id: "album",
    time: "8:00",
    title: "The Album",
    detail:
      "Loop Soul, start to finish, outside in the courtyard under the lights. This is the part you came for — be here before 8.",
    performer: "Mani Odubo",
    role: "front to back",
  },
  {
    id: "1984",
    time: "9:00",
    title: "\u201C1984\u201D — Live",
    detail:
      "The band plays 1984 inside, in the entertainment room. This take is recorded and it goes on the record — you\u2019re on it.",
    performer: "The Band",
    role: "live · recorded",
  },
  {
    id: "floor",
    time: "9:15",
    title: "The Dance Floor",
    detail: "Everyone in, until they turn the lights on.",
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
  { id: "spin", src: "/loop/posters/spin.png", label: "What are you spinning?" },
  { id: "dance", src: "/loop/posters/dance.png", label: "What we dancin' to" },
  { id: "listen", src: "/loop/posters/listen.png", label: "What are you listening to?" },
  { id: "fashion", src: "/loop/posters/fashion.png", label: "What are you wearing?" },
  { id: "play", src: "/loop/posters/play.png", label: "What are you playing?" },
];
