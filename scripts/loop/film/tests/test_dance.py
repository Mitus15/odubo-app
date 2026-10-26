import json, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dance import chapter_of, local_files  # noqa: E402

FILS = {"slug": "fils-de-joie", "filmStart": 8.16}
SANTE = {"slug": "sante", "filmStart": 222.45}


class TwoSongsInOneTake(unittest.TestCase):
    def test_a_new_take_starts_with_no_songs(self):
        with tempfile.TemporaryDirectory() as d:
            story, align = local_files(Path(d))
            self.assertEqual(story["chapters"], [])
            self.assertEqual(align["songs"], [])

    def test_an_album_take_is_never_mixed_into(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "story.json").write_text(json.dumps({"chapters": [{"slug": "welcome"}], "cards": []}))
            (Path(d) / "align.json").write_text(json.dumps({"songs": [{"slug": "welcome"}]}))
            story, align = local_files(Path(d))
            self.assertEqual(story["chapters"], [])

    def test_a_dance_take_keeps_its_songs(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "story.json").write_text(json.dumps({"local": True, "chapters": [FILS], "cards": []}))
            (Path(d) / "align.json").write_text(json.dumps({"songs": [FILS]}))
            story, _ = local_files(Path(d))
            self.assertEqual([c["slug"] for c in story["chapters"]], ["fils-de-joie"])

    def test_the_only_song_needs_no_slug(self):
        self.assertIs(chapter_of([FILS], None), FILS)

    def test_two_songs_need_one(self):
        with self.assertRaises(SystemExit):
            chapter_of([FILS, SANTE], None)
        self.assertIs(chapter_of([FILS, SANTE], "sante"), SANTE)
        with self.assertRaises(SystemExit):
            chapter_of([FILS, SANTE], "billie-jean")


if __name__ == "__main__":
    unittest.main()
