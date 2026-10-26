"""The GPU draws what the numpy reference draws (gpu.py): the same fields, the same frame, within a grey level."""
import sys, tempfile, unittest
from pathlib import Path
import numpy as np
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gpu  # noqa: E402
from figure import (GlossBatch, GlossStyler, arm_lines, arm_lines_patch, arm_zone, head_quiet,  # noqa: E402
                    head_quiet_patch)
from test_gloss import FH, FW, arms_pose, figure_frame, forearm_skin, pose_for  # noqa: E402

DEV = gpu.device()
on_gpu = unittest.skipIf(DEV is None, "no Metal GPU here (or FILM_GPU=0)")


def smooth(h, w, seed=0, sigma=4.0):
    rng = np.random.default_rng(seed)
    return cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), sigma)


def up(a):
    return gpu.torch.from_numpy(np.ascontiguousarray(a, np.float32)).to(DEV)


def down(t):
    return t.cpu().numpy()


class TheCroppedWalksAreTheWholeOnes(unittest.TestCase):
    """GlossBatch's CPU part works in boxes; it must give arm_lines' and head_quiet's own values."""

    def test_arm_lines_in_their_box(self):
        rgb, mask = figure_frame()
        field = np.clip(cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), max(0.8, FH * 0.005)), 0, 1)
        solid = field >= 0.5
        lm, edge_s = arms_pose(), max(0.8, FH * 0.005)
        for skin in (forearm_skin(), forearm_skin(x0=330, x1=420), np.zeros((FH, FW), np.uint8)):
            ref = arm_lines(skin.astype(np.float32) / 255, solid, lm, edge_s)
            arm = (cv2.GaussianBlur(skin.astype(np.float32) / 255, (0, 0), edge_s) >= 0.5) & solid & arm_zone(lm, FW, FH)
            patch = arm_lines_patch(arm, solid, int(solid.sum()))
            got = np.zeros_like(ref)
            if patch is not None:
                x0, y0, v = patch
                got[y0:y0 + v.shape[0], x0:x0 + v.shape[1]] = v
            np.testing.assert_array_equal(got, ref)

    def test_the_quiet_head_in_its_box(self):
        lm = pose_for()
        x0, y0, v = head_quiet_patch(lm, FW, FH)
        q = head_quiet(lm, FW, FH)
        np.testing.assert_array_equal(q[y0:y0 + v.shape[0], x0:x0 + v.shape[1]], v)
        q[y0:y0 + v.shape[0], x0:x0 + v.shape[1]] = 1
        self.assertTrue((q == 1).all())


@on_gpu
class Primitives(unittest.TestCase):
    def test_blur_is_cv2s(self):
        x = smooth(120, 90)
        for sigma in (0.9, 3.0, 9.6, 40.0):  # 40: the kernel is wider than the picture, mirrored again and again
            np.testing.assert_allclose(down(gpu.blur(up(x)[None], sigma))[0], cv2.GaussianBlur(x, (0, 0), sigma),
                                       atol=2e-6)

    def test_the_strip_blur_mirrors_at_the_strips_ends(self):
        x = smooth(200, 60)
        got = down(gpu.blur_within(up(x), 6.0, 50, 130))[50:130]
        np.testing.assert_allclose(got, cv2.GaussianBlur(x[50:130], (0, 0), 6.0), atol=2e-6)

    def test_resizes_are_cv2s(self):
        x = smooth(96, 64)
        np.testing.assert_allclose(down(gpu.area(up(x)[None], 16, 24))[0], cv2.resize(x, (16, 24), interpolation=cv2.INTER_AREA),
                                   atol=1e-6)
        np.testing.assert_allclose(down(gpu.area(up(x)[None], 20, 30))[0], cv2.resize(x, (20, 30), interpolation=cv2.INTER_AREA),
                                   atol=1e-5)
        np.testing.assert_allclose(down(gpu.linear(up(x[:24, :16])[None], 64, 96))[0],
                                   cv2.resize(x[:24, :16], (64, 96), interpolation=cv2.INTER_LINEAR), atol=1e-5)
        np.testing.assert_allclose(down(gpu.cubic(up(x)[None], 100, 150))[0],
                                   cv2.resize(x, (100, 150), interpolation=cv2.INTER_CUBIC), atol=1e-5)

    def test_the_wide_blur_is_figures(self):
        from figure import wide_blur
        x = smooth(480, 270, sigma=2)
        for sigma in (5.0, 7.0, 30.72, 115.2):
            np.testing.assert_allclose(down(gpu.wide_blur(up(x)[None], sigma))[0], wide_blur(x, sigma), atol=1e-5)

    def test_warps_are_cv2s(self):
        src = smooth(300, 200) * 3
        for M in (np.float32([[1.37, 0, -17.4], [0, 1.37, 11.2]]), np.float32([[0.61, 0, 40.0], [0, 0.61, -3.0]]),
                  np.float32([[1.2, 0, 5.0], [0, -0.4, 380.0]])):  # the last mirrored and squashed: a reflection
            for flag, cubic in ((cv2.INTER_LINEAR, False), (cv2.INTER_CUBIC, True)):
                ref = cv2.warpAffine(src, M, (310, 420), flags=flag, borderValue=0)
                got = down(gpu.warp(up(src), M, 310, 420, bicubic=cubic))
                np.testing.assert_allclose(got, ref, atol=1e-4)
        M = np.float32([[1.37, 0, -17.4], [0, 1.37, 11.2]])
        cut_at = cv2.warpAffine(src, M, (310, 200), flags=cv2.INTER_LINEAR, borderValue=0)
        full = down(gpu.warp(up(src), M, 310, 420, rows=200))
        np.testing.assert_allclose(full[:200], cut_at, atol=1e-4)
        self.assertEqual(float(np.abs(full[200:]).max()), 0.0)

    def test_remap_is_cv2s(self):
        src = smooth(300, 200)
        yy, xx = np.mgrid[0:250, 0:220].astype(np.float32)
        mx, my = xx * 0.9 + 0.003 * yy * xx / 10 - 6, yy * 1.1 - 9 + 0.01 * xx
        ref = cv2.remap(src, mx, my, cv2.INTER_LINEAR, borderValue=0)
        np.testing.assert_allclose(down(gpu.remap(up(src), up(mx), up(my))), ref, atol=1e-5)

    def test_cut_and_melt_are_edges(self):
        from edge import cut, melt
        f = smooth(80, 70, sigma=6) * 4 - 1.5
        np.testing.assert_allclose(down(gpu.cut(up(f), 0.5)), cut(f, 0.5), atol=1e-5)
        np.testing.assert_allclose(down(gpu.melt(up(f), 0.75, 0.08)), melt(f, 0.75, 0.08), atol=1e-6)


@on_gpu
class TheFigure(unittest.TestCase):
    def frames(self):
        """A short run: the light moving over him, an arm across his chest, one frame with no one in it."""
        out = []
        for k, at in enumerate(((320, 150), (330, 170), (300, 230), (310, 120), (320, 160))):
            rgb, mask = figure_frame(light_at=at)
            if k == 3:
                mask[:] = 0
            stroke = np.zeros((FH, FW), np.uint8)
            stroke[140:165, 290:350] = 200 if k % 2 else 0  # painted strokes (paint.py) on some frames
            out.append((rgb, mask, arms_pose(), forearm_skin(), stroke if k % 2 else None))
        return out

    def test_the_batch_draws_what_the_styler_draws(self):
        frames = self.frames()
        ref = GlossStyler(FW * 2, FH * 2, FW, FH)
        want = [ref(*f) for f in frames]
        batch = GlossBatch(FW * 2, FH * 2, FW, FH, DEV)
        got = batch.batch(frames[:3]) + batch.batch(frames[3:])  # the tone scale eases on across batches
        for (gl, ga, gf, gt), (wl, wa, wf, wt) in zip(got, want):
            for g, w in ((gl, wl), (ga, wa), (gf, wf), (gt, wt)):
                self.assertEqual(g.shape, w.shape)
                self.assertLessEqual(int(np.abs(g.astype(int) - w.astype(int)).max()), 1)
        np.testing.assert_allclose(batch.anchors, ref.anchors, rtol=1e-5, atol=1e-6)


@on_gpu
class TheFrame(unittest.TestCase):
    PAL = {"field": np.float32([201, 224, 92]), "ink": np.float32([42, 15, 10]), "mid": np.float32([158, 142, 7]),
           "highlight": np.float32([237, 255, 212]), "shadow": np.float32([169, 192, 41]), "badge": np.float32([240, 211, 173])}

    def canvases(self, w=200, h=300):
        ref = np.empty((h, w, 3), np.float32)
        ref[:] = self.PAL["field"]
        c = gpu.Canvas(w, h, DEV)
        c.fill(self.PAL["field"])
        return ref, c

    def test_strokes_land_alike(self):
        ref, c = self.canvases()
        cov = smooth(40, 70, sigma=3)
        for x, y, op in ((10, 20, 1.0), (170, 280, 0.6), (-15, -5, 0.3)):  # inside, over the corner, off the edge
            gpu.lay(ref, cov, x, y, self.PAL["ink"], op)
            gpu.lay(c, cov, x, y, self.PAL["ink"], op)
        gpu.band(ref, 20, 100, 150, 104, self.PAL["ink"], 0.22)
        gpu.band(c, 20, 100, 150, 104, self.PAL["ink"], 0.22)
        np.testing.assert_array_equal(c.frame(), np.clip(ref, 0, 255).astype(np.uint8))

    def test_the_spotlight(self):
        from floor import spotlight
        ref, c = self.canvases()
        spotlight(ref, 100.0, 250.0, 200.0, self.PAL)
        spotlight(c, 100.0, 250.0, 200.0, self.PAL)
        self.assertLessEqual(int(np.abs(c.frame().astype(int) - np.clip(ref, 0, 255).astype(np.uint8)).max()), 1)

    def test_the_hud(self):
        from hud import Hud
        ref, c = self.canvases(1080, 1920)
        hud = Hud(1080, 1920, "1-1", "Planet Rock", [(10, 0, 0, "left")], 0, "Afrika Bambaataa", "Mitus Young History")
        hud.draw(ref, 20, 0.4, self.PAL["ink"], 0.8)
        hud.draw(c, 20, 0.4, self.PAL["ink"], 0.8)
        np.testing.assert_array_equal(c.frame(), np.clip(ref, 0, 255).astype(np.uint8))

    def test_him(self):
        from compose import _him, paint
        fld, tn = smooth(300, 200, sigma=8) * 2.2 - 0.6, smooth(300, 200, 1, sigma=8) * 2.4 - 0.7
        ref, c = self.canvases()
        for look in ("gloss", "cover"):
            colour, a = paint(fld, tn, self.PAL, look)
            want = ref + (colour - ref) * (a * 0.7)[..., None]
            c.fill(self.PAL["field"])
            c.px = _him(c.px, up(np.stack((fld, tn))), c.colour(self.PAL["ink"]), c.colour(self.PAL["field"]),
                        c.colour(self.PAL["highlight"]), 0.7, look, (0.55, 0.75), 0.08)
            self.assertLessEqual(int(np.abs(c.frame().astype(int) - np.clip(want, 0, 255).astype(np.uint8)).max()), 1)

    def test_his_shadow(self):
        from shadow import cast_on_floor, cast_on_floor_gpu
        fig = np.zeros((1800, 1080), np.float32)
        fig[1100:1700, 380:420] = 1
        fig[1160:1760, 640:680] = 1
        fig = cv2.GaussianBlur(fig, (0, 0), 2)
        for contact in (((400, 1700), (660, 1760)), 1730.0, ((500, 1650), (510, 1750))):
            ref, y0 = cast_on_floor(fig, contact, 600.0, 540.0, 600.0, 1920)
            got, yb = cast_on_floor_gpu(up(fig), contact, 600.0, 540.0, 600.0, 1920)
            got = down(got)
            self.assertLessEqual(yb, y0)
            self.assertLessEqual(y0 + len(ref), yb + len(got))
            np.testing.assert_allclose(got[y0 - yb:y0 - yb + len(ref)], ref, atol=2e-3)
            self.assertEqual(float(got[:y0 - yb].max(initial=0)), 0.0)


class TheStreams(unittest.TestCase):
    def test_frames_round_trip_through_the_threads(self):
        from take import Reader, Writer
        rng = np.random.default_rng(1)
        frames = [rng.integers(0, 256, (48, 64), dtype=np.uint8) for _ in range(9)]
        with tempfile.TemporaryDirectory() as d:
            w = Writer(Path(d) / "x.mkv", 64, 48, 30.0)
            for f in frames:
                w.write(f)
            w.close()
            back = list(Reader(Path(d) / "x.mkv", 64, 48, gray=True))
        self.assertEqual(len(back), len(frames))
        for a, b in zip(back, frames):
            np.testing.assert_array_equal(a, b)

    def test_a_reader_closed_early_stops_quietly(self):
        from take import Reader, Writer
        with tempfile.TemporaryDirectory() as d:
            w = Writer(Path(d) / "x.mkv", 64, 48, 30.0)
            for _ in range(40):
                w.write(np.zeros((48, 64), np.uint8))
            w.close()
            r = Reader(Path(d) / "x.mkv", 64, 48, gray=True)
            next(r)
            r.close()
            self.assertIsNone(next(r, None))


if __name__ == "__main__":
    unittest.main()
