-- The Loop Soul film: Recoolman's flight through the album, as data the site,
-- the admin page and the film pipeline (scripts/loop/film/) all read.
--
-- One chapter per song, in album order (src/lib/loop/film/songs.json holds the
-- slugs and track ids). A chapter carries the story (its thread and emotion
-- words), the look (its field colour and how his ground shadow behaves), and
-- where it sits in the one-take film once the take is aligned.
--
-- Every word here is faith content: nothing reaches a guest until the owner
-- approves it (status 'approved'), and nothing ever names Him (the canon's
-- Loop Soul section; enforced by src/lib/loop/film/naming.ts).
--
-- Prefixed loop_ because D1 already has `films` and `film_*` tables for the
-- older Films feature.
CREATE TABLE IF NOT EXISTS loop_film_chapters (
  slug          TEXT PRIMARY KEY,               -- the song's slug, a URL: /loop/<slug>
  number        INTEGER NOT NULL UNIQUE,        -- album order, 1..14
  track_id      TEXT NOT NULL,                  -- tracks.id
  title         TEXT NOT NULL,                  -- the chapter's name; the song title by default
  thread        TEXT,                           -- where Recoolman is: a line or two
  emotion       TEXT,                           -- words, comma separated; feeds the verse search
  field         TEXT NOT NULL,                  -- '#rrggbb', this chapter's colourway
  shadow_mode   TEXT NOT NULL DEFAULT 'sync',   -- 'none' | 'sync' | 'lag' (The Game pulling)
  shadow_lag    INTEGER NOT NULL DEFAULT 0,     -- frames behind him when 'lag'
  badge_from    REAL,                           -- seconds into the chapter the badge lands; NULL = from its start
  lyrics_draft  TEXT,                           -- JSON from film:transcribe, for the owner to correct
  film_start    REAL,                           -- the chapter's range in the take (film:align)
  film_end      REAL,
  status        TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'approved'
  revealed_at   TEXT,                           -- public from here; NULL = shown as a silhouette
  updated_at    TEXT NOT NULL
);

-- A scripture card: the KJV words (the sample) and the owner's flip (how it
-- is cut), pinned to a moment of the film. Each becomes one clip.
CREATE TABLE IF NOT EXISTS loop_film_cards (
  id          TEXT PRIMARY KEY,
  chapter     TEXT NOT NULL,                    -- loop_film_chapters.slug
  sort        INTEGER NOT NULL DEFAULT 0,
  verse_ref   TEXT NOT NULL,                    -- 'Genesis 2:7'
  verse_text  TEXT NOT NULL,                    -- the words on the card; may be an excerpt of the verse
  flip        TEXT,                             -- the owner's line
  film_start  REAL,                             -- the moment in the take, seconds
  film_end    REAL,
  status      TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'approved'
  video_id    TEXT,                             -- videos.uid of the published clip
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loop_film_cards_chapter ON loop_film_cards (chapter, sort);

-- The world page (/recoolman): a sparse map, never an explainer. A name and a
-- line, revealed with a chapter; until then it shows as a silhouette.
CREATE TABLE IF NOT EXISTS loop_film_world (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  line          TEXT NOT NULL,
  revealed_with TEXT,                           -- chapter slug
  sort          INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'approved'
  updated_at    TEXT NOT NULL
);

-- A published clip knows its card and chapter, so the feed can show the flip
-- and open the chapter.
ALTER TABLE videos ADD COLUMN card_id TEXT;
ALTER TABLE videos ADD COLUMN film_chapter_id TEXT;
