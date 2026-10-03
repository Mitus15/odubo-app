# Soul Loop: the game

The game Loop Soul is played as. Welcome sends Recoolman down from heaven; the game is his
fall through the sky of the whole album, a layer of sky for each song, the Earth closer song
by song, landing with Ghost World. The album is a flight through life; the game is that
flight, played downward. (The owner's word, 2026-10-02. It replaces the take-off at the end
of Welcome; see `docs/decisions/fly-the-fall.md`.)

## Where it lives

- **`/fly`**, hidden (not in the menu): the fall. Two modes. **Songs**: any of the ten
  levels alone, with medals, your best and a ghost of your best run. **Album**: the whole
  album in order, the intro and the interludes as skippable cutscenes, total depth.
- `/game/soul-loop` still serves Recoolman's earlier street runner, with any single that is
  out as its soundtrack.

## The album, played

| # | Song | In the game |
|---|---|---|
| 1 | Welcome | Cutscene: sent down from heaven |
| 2 | 1984 | Level 1: plates and pillars |
| 3 | Hallucinogen | Level 2: the grid |
| 4 | The No End Theory | Cutscene: a band of cloud |
| 5 | In The Court | Level 3: one way through, gates |
| 6 | News Peak | Level 4: lattices |
| 7 | Every Generation | Cutscene: a band of cloud |
| 8 | Rap | Level 5: pillar forests |
| 9 | Makunahea | Level 6: cracks, open air |
| 10 | The Other Side | Level 7: still air |
| 11 | The Mind Pt 1 | Level 8: everything, tightest |
| 12 | Midnight Marauders | Cutscene: a band of cloud |
| 13 | The Mind Pt 2 | Level 9 |
| 14 | Ghost World | Level 10: one way out, then the ground |

## How it plays

- **Steer** by sliding a finger anywhere, in any direction, like a trackpad.
- **Floors** of stone cross the fall. Each has one safe hole and, often, narrow ones.
- **Flow is speed.** Threading a narrow hole, kissing an edge, hugging a pillar, passing a
  gate: each builds flow, and flow takes him from 30 to 70 m/s. The safe path alone holds
  base speed. A hit is a stumble: flow gone, half speed, a moment passing through stone.
- **Depth when the song ends** is the one number. Each level has bronze, silver and gold.
- **His shadow** falls on the stone below him: where he will pass. In 1984, News Peak and
  The Mind Pt 1 it lags a beat behind him, The Game's pull, as in the film.
- **Every song plays** in the game, for everyone (the owner's decision). The album page is
  still gated. To close the game too: D1 `loop_settings`, key `fly_all_songs`, value `off`.

## The road

1. **The fall** (now): both modes, ten levels, four cutscenes, local bests and ghosts.
2. **Signatures**: each song's own mechanic, tuned with the owner.
3. **The race, against the world**: per-song leaderboards checked by replaying each run
   (the engine is deterministic for this), and other players' ghosts.
4. **Live races.**

## Rules that carry over from the film

- He is never named. Everyone knows who we mean.
- The badge sits on his heart; it is given, never bought.
- Shown, never explained.
