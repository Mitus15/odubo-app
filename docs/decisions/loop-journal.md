# The Loop Journal — one issue per volume

**Date:** 2026-08-10
**Scope:** `/loop/journal`, Legacy, the Gathering poster, `/loop/admin`, migration 144

## Decision

Loop Soul's event enhancement and its community magazine are **one system, not
two**. Each volume gets a Journal issue that the event largely writes for
itself, and the issue then becomes the marketing engine for the next volume:

```
Gathering sells the night → Portal captures it → the Journal prints it
        ↑                                              │
        └────────── the issue hypes the next volume ───┘
```

## What the issue prints, and where it comes from

| Section | Source | Curated? |
| --- | --- | --- |
| Cover (headline, standfirst) | `journal_issues` | yes — admin |
| The Anthem (champion + final tally) | derived from ballots via `buildBracket` | no — automatic |
| Iconic Moments (photography) | `journal_moments` | yes — admin |
| The Night That Was | `run_of_show` (already admin-edited) | no — reuses existing |
| "The loop continues" (next-volume CTA) | current event | no — automatic |

The anthem result is re-derived from the same pure `buildBracket` the public
bracket uses — never stored, so the Journal can never disagree with the
bracket. Sections self-omit when their data doesn't exist, so a half-curated
issue still reads as a finished page.

## Alternatives considered

- **Adopt the Moments editorial kit** (`src/components/moments/editorial/` —
  dark field, Baskerville serif). Rejected for the surface: it reads as a
  different publication than the Loop poster. The Journal instead borrows its
  *structure* (spotlight → grid, ruled section headers) and renders it in the
  Loop poster language.
- **Vault mode (oxblood field) for the Journal.** Rejected: the magazine IS
  the printed artefact, and the print is sand ground with oxblood ink. Legacy
  keeps vault chrome; the Journal opens like paper pulled out of the vault.
- **A separate "event enhancement" feature.** Rejected as incoherent — every
  enhancement worth building (photo submissions, shoutouts, curation) is a
  Journal input, so the Journal's needs define the enhancement roadmap.

## Phase behaviour

- `pre` — a published previous issue surfaces on the poster footer ("The
  Journal ↗") as proof of what the night is like; unpublished issues are
  invisible to the public.
- unpublished + logged-in admin — `/loop/journal` renders the live draft with
  a "Draft preview" ribbon, so curation is checked against the real page.
- Legacy — the Journal card is the first (and only live) card in the hub.

## Data model (migration 144)

- `journal_issues` — event-scoped editorial frame; `published_at` stamps on
  first publish and survives unpublish/republish, like a real print run.
- `journal_moments` — ordered, full-replace curated list (run-of-show
  pattern); no `_saved` marker because there is no seed list to resurrect.

## Deliberately deferred (follow-up PR)

- Portal → Journal photo submission (Pose Studio gallery already notes R2 sync
  as its intended future; `journal_moments.image_url` is the landing spot).
- Guestbook / "Voices" section (needs the submission + moderation pipeline).
- Multi-issue archive (blocked on a real `events` table — the current event is
  still `MOCK_CURRENT_EVENT`; the Journal is event-scoped, so back-issues fall
  out naturally once events do).
