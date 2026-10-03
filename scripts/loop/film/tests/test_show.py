import sys, unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from show import Show  # noqa: E402
import props  # noqa: E402

DOWNBEAT, BAR = 10.0, 2.0
SPEC = {
    "name": "test",
    "bars": [5, 13],
    "stage": {"field": "#f593a6", "floor": "plain", "light": "key"},
    "cues": [
        {"bar": 9, "floor": "tiles", "props": [{"name": "lamp", "x": -0.3, "z": 1}]},
        {"bar": 7, "light": "spot"},
        {"bar": 10, "camera": "feet", "for": 2, "effects": ["echo"]},
        {"bar": 12, "field": "#5ec6ec"},
    ],
}


def at_bar(show: Show, bar: int):
    return show.at(show.time_of(bar) + 0.01)


class Cues(unittest.TestCase):
    def setUp(self):
        self.show = Show(SPEC, DOWNBEAT, BAR)

    def test_bar_one_is_the_downbeat(self):
        self.assertEqual(self.show.time_of(1), DOWNBEAT)
        self.assertEqual(self.show.bar_at(DOWNBEAT + 2.5 * BAR), 3)
        self.assertEqual(self.show.range, (5, 13))

    def test_a_cue_holds_until_a_later_one_changes_it(self):
        self.assertEqual(at_bar(self.show, 5).light, "key")
        self.assertEqual(at_bar(self.show, 7).light, "spot")
        self.assertEqual(at_bar(self.show, 12).light, "spot")  # never changed back
        self.assertEqual(at_bar(self.show, 8).floor, "plain")
        self.assertEqual(at_bar(self.show, 9).floor, "tiles")
        self.assertEqual(at_bar(self.show, 9).props, (("lamp", -0.3, 1.0),))

    def test_a_camera_move_lasts_its_bars_then_returns_wide(self):
        self.assertEqual([at_bar(self.show, b).camera for b in (9, 10, 11, 12)], ["wide", "feet", "feet", "wide"])
        self.assertEqual(self.show.camera_spans(), [(self.show.time_of(10), self.show.time_of(12), "feet")])
        self.assertEqual(at_bar(self.show, 12).effects, frozenset({"echo"}))  # the rest of the cue tracks

    def test_before_the_first_cue_the_stage_is_as_set(self):
        s = self.show.at(DOWNBEAT - 5)
        self.assertEqual((s.field, s.floor, s.light), ("#f593a6", "plain", "key"))

    def test_what_the_show_uses(self):
        self.assertTrue(self.show.uses(floor="tiles"))
        self.assertTrue(self.show.uses(effect="echo"))
        self.assertTrue(self.show.uses(prop="lamp"))
        self.assertFalse(self.show.uses(effect="hits"))
        self.assertEqual(self.show.fields(), {"#f593a6", "#5ec6ec"})

    def test_a_mistyped_cue_is_refused_with_its_bar(self):
        for cue in ({"bar": 3, "floor": "carpet"}, {"bar": 3, "effects": ["glitter"]}, {"bar": 0, "light": "spot"},
                    {"bar": 3, "camera": "drone", "for": 1}):
            with self.assertRaises(ValueError):
                Show({"cues": [cue]}, DOWNBEAT, BAR)

    def test_the_old_flags_are_a_show_with_no_cues(self):
        s = Show.from_flags({"sidewalk", "echo", "close"}, DOWNBEAT, BAR).at(DOWNBEAT + 30)
        self.assertEqual((s.floor, s.effects), ("tiles", frozenset({"echo"})))


class Props(unittest.TestCase):
    def test_a_lamp_stands_on_its_foot_and_is_whole(self):
        polys, light = props.place("lamp", 500.0, 1600.0, 1000.0)
        cov, (x0, y0) = props.coverage(polys, 1080, 1920)
        pts = np.concatenate(polys)
        self.assertAlmostEqual(float(pts[:, 1].max()), 1600.0, delta=1.0)  # its foot is on the floor
        self.assertGreater(props.height(polys, 1600.0), 1300)               # taller than him
        # where the pole meets its base there is no hole (shapes fill one by one)
        self.assertGreater(cov[int(1600 - 55 - y0), int(500 - x0)], 0.99)
        self.assertIsNotNone(light)

    def test_every_prop_draws(self):
        for name in props.PROPS:
            polys, _ = props.place(name, 540.0, 1700.0, 900.0)
            cov, _ = props.coverage(polys, 1080, 1920)
            self.assertGreater(cov.sum(), 100, name)


if __name__ == "__main__":
    unittest.main()
