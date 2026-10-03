"""
The show file: a performance designed like a concert, cue by cue on the song's bars.

    npm run film:dance -- <take> cut --show=data/loop/film/shows/<name>.json --name=<name>

A real show runs from a cue list: the lights, the floor, the set and the
camera all change on the music. A show file is that list for one performance,
in bars of the song (bar 1 is the song's first downbeat). A cue sets part of
the stage, and what it sets holds until a later cue changes it (cues track, as
on a lighting desk). A camera move is the exception: it lasts `for` bars and
returns to the wide shot.

    {
      "name": "Billie Jean, the street",
      "bars": [65, 93],
      "stage": {"floor": "plain", "light": "key", "effects": []},
      "cues": [
        {"bar": 69, "light": "spot"},
        {"bar": 73, "floor": "tiles", "light": "key", "props": [{"name": "lamp", "x": -0.7, "z": 1}]},
        {"bar": 77, "camera": "feet", "for": 1},
        {"bar": 81, "effects": ["echo", "hits"]},
        {"bar": 85, "field": "#5ec6ec"}
      ]
    }

`bars` is the piece: from the first bar up to (not including) the second.
`hud`, if given, lays the game's layer over the whole piece:
{"level": "1-1", "title": "Billie Jean"} (hud.py).
The stage, and what each key takes:

  field    a colour, #rrggbb (its palette comes from palette.ts, as every
           chapter's does); left out, the chapter's own colour
  floor    plain | tiles   tiles: the Billie Jean pavement on a glossy floor
  light    key | spot      key: the cast shadow (on the glossy floor it comes
                           low from the side, clear of the reflection);
                           spot: overhead, a pool of light follows him, the
                           rest of the stage dims a step, his shadow pools
                           under him
  effects  a list of echo, hits, freeze, flip
  camera   wide | feet     with "for": bars, then back to wide
  props    a list of {"name": a prop in props.py, "x": his heights to the
           side of where he stands (minus is left), "z": tile depths back
           (minus comes toward the camera, in front of him)}
"""
import bisect, json, subprocess
from dataclasses import dataclass, replace
from pathlib import Path
from film_common import REPO

FLOORS, LIGHTS, CAMERAS = ("plain", "tiles"), ("key", "spot"), ("wide", "feet")
EFFECTS = ("echo", "hits", "freeze", "flip")


@dataclass(frozen=True)
class State:
    field: str | None = None      # None: the chapter's own colour
    floor: str = "plain"
    light: str = "key"
    effects: frozenset = frozenset()
    camera: str = "wide"
    props: tuple = ()             # ((name, x, z), ...)


class Show:
    """The stage at any moment of the take, from a cue list."""

    def __init__(self, spec: dict, downbeat: float, bar: float, name: str = ""):
        self.name = spec.get("name", name)
        self.downbeat, self.bar = downbeat, bar
        self.range = tuple(spec["bars"]) if spec.get("bars") else None
        self.hud = spec.get("hud")  # {"level": "1-1", "title": "..."}: the game's layer (hud.py)
        base = self._apply(State(), spec.get("stage", {}), where="stage")
        self.marks, self.states, self.moves = [0], [base], []
        state = base
        for cue in sorted(spec.get("cues", []), key=lambda c: c["bar"]):
            b = int(cue["bar"])
            if b < 1:
                raise ValueError(f"a cue at bar {b}: bars start at 1, the song's first downbeat")
            if "camera" in cue and cue.get("for"):
                if cue["camera"] not in CAMERAS:
                    raise ValueError(f"bar {b}: camera {cue['camera']!r} is not one of {CAMERAS}")
                self.moves.append((b, b + int(cue["for"]), cue["camera"]))
                cue = {k: v for k, v in cue.items() if k not in ("camera", "for")}
            state = self._apply(state, cue, where=f"bar {b}")
            if self.marks[-1] == b:
                self.states[-1] = state
            else:
                self.marks.append(b)
                self.states.append(state)

    @staticmethod
    def _apply(state: State, cue: dict, where: str) -> State:
        out = state
        if "field" in cue:
            out = replace(out, field=cue["field"])
        for key, allowed in (("floor", FLOORS), ("light", LIGHTS), ("camera", CAMERAS)):
            if key in cue:
                if cue[key] not in allowed:
                    raise ValueError(f"{where}: {key} {cue[key]!r} is not one of {allowed}")
                out = replace(out, **{key: cue[key]})
        if "effects" in cue:
            bad = set(cue["effects"]) - set(EFFECTS)
            if bad:
                raise ValueError(f"{where}: effects {sorted(bad)} are not among {EFFECTS}")
            out = replace(out, effects=frozenset(cue["effects"]))
        if "props" in cue:
            out = replace(out, props=tuple((p["name"], float(p.get("x", 0)), float(p.get("z", 0))) for p in cue["props"]))
        return out

    @classmethod
    def load(cls, path, downbeat: float, bar: float):
        p = Path(path)
        return cls(json.loads(p.read_text()), downbeat, bar, name=p.stem)

    @classmethod
    def from_flags(cls, effects: set, downbeat: float, bar: float):
        """The old flags (--effects=sidewalk,echo,...) as a show with no cues."""
        stage = {"effects": sorted(effects & set(EFFECTS))}
        if "sidewalk" in effects:
            stage["floor"] = "tiles"
        return cls({"stage": stage}, downbeat, bar)

    def bar_at(self, t: float) -> int:
        """The bar (1 is the song's first downbeat) a moment of the take falls in."""
        return int((t - self.downbeat) // self.bar) + 1

    def time_of(self, bar: int) -> float:
        """Where a bar starts, in take seconds."""
        return self.downbeat + (bar - 1) * self.bar

    def at(self, t: float) -> State:
        b = self.bar_at(t)
        state = self.states[max(0, bisect.bisect_right(self.marks, b) - 1)]
        for b0, b1, cam in self.moves:
            if b0 <= b < b1:
                state = replace(state, camera=cam)
        return state

    def uses(self, **want) -> bool:
        """Whether any moment of the show has, for instance, floor="tiles" or effect="echo"."""
        states = self.states + [replace(s, camera=c) for s in self.states for _, _, c in self.moves]
        for s in states:
            for key, value in want.items():
                if key == "effect" and value in s.effects:
                    return True
                if key == "prop" and any(p[0] == value for p in s.props):
                    return True
                if key not in ("effect", "prop") and getattr(s, key) == value:
                    return True
        return False

    def fields(self) -> set:
        return {s.field for s in self.states if s.field}

    def camera_spans(self) -> list:
        """[(start, end, mode)] in take seconds, the camera moves."""
        return [(self.time_of(b0), self.time_of(b1), cam) for b0, b1, cam in self.moves]


def resolve_palettes(fields) -> dict:
    """{hex: {"palette": ..., "paletteFlip": ...}} from palette.ts, the one implementation, in one call."""
    fields = sorted(set(fields))
    if not fields:
        return {}
    code = ("import { palette, sibling, parseHex } from './src/lib/loop/film/palette';"
            f"const out: Record<string, unknown> = {{}}; for (const h of {json.dumps(fields)}) {{"
            "const f = parseHex(h); if (!f) throw new Error(`not a colour: ${h}`);"
            "out[h] = { palette: palette(f), paletteFlip: palette(sibling(f)) }; }"
            "console.log(JSON.stringify(out));")
    out = subprocess.run(["npx", "tsx", "-e", code], cwd=REPO, capture_output=True, text=True, check=True).stdout
    return json.loads(out.strip().splitlines()[-1])
