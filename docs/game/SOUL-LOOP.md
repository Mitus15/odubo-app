# Soul Loop: the game

The game Loop Soul is played as. It begins where the album's first song ends:
Welcome is the incarnation, its last bars are the take-off, and the take-off
is the game's first second. The album is a flight through life; the game is
that flight, played.

Live today at `/game/soul-loop` (the old `/game/street-runner` forwards):
Recoolman's runner, renamed, opening on the take-off (he rises out of his
shadow and lifts away), with any single that is out as the soundtrack
(`?song=<slug>`, the audio gate decides). Canon: `~/Documents/Apps/Game/game/docs/CANON.md`,
section "Loop Soul, the album's book". Catching Light, the Godot game in the
Game folder, keeps its own name.

## The road

1. **The runner** (now). The city, the lanes, the score and the leaderboard
   (`/api/game/scores`). The take-off opens every run.
2. **The flight.** The same run, off the ground: Recoolman flies the album.
   Lanes become altitude bands; jumps become climbs.
3. **The race.** Other players' Recoolmen in the same sky, racing a song. The
   leaderboard becomes per song.

## The course is the album

Every song already has a measured shape (`data/loop/film/shape.json`, from
`npm run film:listen`): its loudness every second and its tempo. That is the
course.

| The song | The course |
| --- | --- |
| Loudness, second by second | Altitude: the loud parts climb, the quiet parts fall back to the ground |
| Tempo | Speed, and how often things come at him |
| Where it lets go | The end of a stage |
| The Other Side's near silence | A pass through still air |
| The film's colour for the chapter | The sky's colour for the stage |

His shadow is on the ground below him the whole flight, as it is in the film:
in step when he is at peace, lagging where The Game pulls (1984, News Peak,
The Mind Pt 1).

## Rules that carry over from the film

- He is never named. Everyone knows who we mean.
- The badge sits on his heart; it is given, never bought.
- Shown, never explained.
- A song plays only when it is out (the audio gate, `src/lib/loop/audioAccess.ts`).
  Welcome's last bars will play under the take-off once Welcome is out.
