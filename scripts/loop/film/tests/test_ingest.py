import subprocess, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import probe, true_rate  # noqa: E402


def clip(dest: Path, rotation: int | None):
    """A one second 64x36 clip, stored landscape, with a display rotation if given."""
    plain = dest.with_name(f"plain-{dest.name}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=64x36:r=30:d=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(plain)], check=True)
    # The rotation rides on the stream as metadata, as a phone writes it: copied, not re-encoded.
    turn = ["-display_rotation:v:0", str(rotation)] if rotation is not None else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", *turn, "-i", str(plain), "-c", "copy", str(dest)], check=True)


class Probe(unittest.TestCase):
    def test_a_phone_portrait_take_is_its_upright_size(self):
        # An iPhone stores portrait as landscape plus a rotation (IMG_0191.MOV:
        # 1920x1080, rotation -90). ffmpeg decodes it upright, so the take is too.
        with tempfile.TemporaryDirectory() as d:
            for turn in (90, -90):
                p = Path(d) / f"r{turn}.mp4"
                clip(p, turn)
                info = probe(p)
                self.assertEqual((info["w"], info["h"]), (36, 64), turn)

    def test_an_unturned_take_keeps_its_size(self):
        with tempfile.TemporaryDirectory() as d:
            for turn in (None, 180):
                p = Path(d) / f"r{turn}.mp4"
                clip(p, turn)
                self.assertEqual((probe(p)["w"], probe(p)["h"]), (64, 36), turn)


class Rate(unittest.TestCase):
    def test_a_timebase_is_not_a_frame_rate(self):
        # IMG_0330.MOV: r_frame_rate 120/1, 17,789 frames over 9:54.
        self.assertEqual(true_rate("120/1", "1334175/44533"), 30.0)

    def test_a_phone_take_reads_as_its_whole_rate(self):
        self.assertEqual(true_rate("30/1", "10788600/359639"), 30.0)

    def test_real_high_frame_rates_and_broadcast_rates_stand(self):
        self.assertEqual(true_rate("120/1", "120/1"), 120.0)
        self.assertEqual(true_rate("30000/1001", "30000/1001"), 29.97)

    def test_no_average_keeps_the_stated_rate(self):
        self.assertEqual(true_rate("25/1", "0/0"), 25.0)


if __name__ == "__main__":
    unittest.main()
