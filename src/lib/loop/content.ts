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
  { id: "doors", time: "6:00", title: "Doors & The Lookbook", detail: "Arrive, get scanned, set the tone." },
  { id: "band-open", time: "7:00", title: "The Band — Opening Set", detail: "Loose and low-stakes. Easing the room in.", performer: "The Band", role: "live · original music", instagram: "loopsoul.ca" },
  { id: "pregame", time: "7:45", title: "The Pre-Game", detail: "Drinks, mingling, first spins.", performer: "DJ Cornelius", role: "resident DJ", instagram: "loopsoul.ca" },
  { id: "danceoke", time: "8:30", title: "Danceoke", detail: "Take the floor — the queue is in the app.", performer: "The Host", role: "MC & Danceoke conductor", instagram: "loopsoul.ca" },
  { id: "room", time: "9:30", title: "The Rec Room", detail: "The band returns — filmed live session at Scott's.", performer: "The Band", role: "filmed set", instagram: "loopsoul.ca" },
  { id: "soul-loop", time: "10:15", title: "The Soul Loop Line", detail: "The anthem you voted for. Soul Train line — everyone in.", performer: "DJ Cornelius", role: "the anthem", instagram: "loopsoul.ca" },
];

export type LookbookItem = {
  id: string;
  src: string;
  label: string;
};

/** Poster concepts double as the visual mood board until curated outfit shots land. */
export const LOOKBOOK: LookbookItem[] = [
  { id: "spin", src: "/loop/posters/spin.png", label: "What are you spinning?" },
  { id: "dance", src: "/loop/posters/dance.png", label: "What are you dancing to?" },
  { id: "listen", src: "/loop/posters/listen.png", label: "What are you listening to?" },
  { id: "fashion", src: "/loop/posters/fashion.png", label: "What are you wearing?" },
  { id: "play", src: "/loop/posters/play.png", label: "What are you playing?" },
];
