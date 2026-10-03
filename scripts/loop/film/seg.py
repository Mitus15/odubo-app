"""
MediaPipe, set up once for the film pipeline: the person mask and the pose.

Person mask: the selfie segmenter (its single confidence mask IS the person).
Pose: PoseLandmarker, 33 landmarks per frame, used for the heart (where the
badge sits) and the feet (where his shadow meets the ground).
"""
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
from film_common import model

SEGMENTER = "selfie_segmenter.tflite"
POSE = "pose_landmarker_full.task"


def segmenter(video: bool = True):
    opts = vision.ImageSegmenterOptions(
        base_options=mpt.BaseOptions(model_asset_path=str(model(SEGMENTER)), delegate=mpt.BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.VIDEO if video else vision.RunningMode.IMAGE,
        output_confidence_masks=True,
        output_category_mask=False,
    )
    return vision.ImageSegmenter.create_from_options(opts)


def poser(video: bool = True):
    opts = vision.PoseLandmarkerOptions(
        # GPU on purpose. With mediapipe 1.0.1 on macOS the pose detector's
        # detection step always opens a Metal helper; on the CPU delegate there
        # is no GPU service to give it and the process aborts. On the GPU
        # delegate it works, given four-channel frames (see _rgba).
        base_options=mpt.BaseOptions(model_asset_path=str(model(POSE)), delegate=mpt.BaseOptions.Delegate.GPU),
        running_mode=vision.RunningMode.VIDEO if video else vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    return vision.PoseLandmarker.create_from_options(opts)


def _image(rgb: np.ndarray):
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))


def _rgba(rgb: np.ndarray):
    """The GPU path converts to a Metal pixel buffer, which needs four channels."""
    a = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)])
    return mp.Image(image_format=mp.ImageFormat.SRGBA, data=np.ascontiguousarray(a))


def person(seg, rgb: np.ndarray, ts_ms: int | None = None) -> np.ndarray:
    """Confidence that each pixel is the person, float32 0..1, the frame's size."""
    img = _image(rgb)
    res = seg.segment_for_video(img, ts_ms) if ts_ms is not None else seg.segment(img)
    return res.confidence_masks[0].numpy_view().astype(np.float32).reshape(rgb.shape[:2])


def landmarks(pose, rgb: np.ndarray, ts_ms: int | None = None):
    """33 (x, y, visibility) in pixels, or None when no one is found."""
    img = _rgba(rgb)
    res = pose.detect_for_video(img, ts_ms) if ts_ms is not None else pose.detect(img)
    if not res.pose_landmarks:
        return None
    h, w = rgb.shape[:2]
    return np.array([[p.x * w, p.y * h, p.visibility] for p in res.pose_landmarks[0]], dtype=np.float32)


POSE_HEIGHT = 960   # the pose model works at 256 px; more than this only costs memory
POSE_REBUILD = 500  # frames between fresh landmarkers


class Pose:
    """
    The pose over a whole take, in order. Returns 33 (x, y, visibility) in the
    frame's own pixels, or None.

    mediapipe 1.0.1's GPU delegate keeps the Metal copy of every frame it is
    given until the landmarker is closed: 8 MB a frame at 1080x1920, so a five
    minute portrait take ran the GPU out of memory at frame 1240 (measured).
    So frames go in at most POSE_HEIGHT tall, and the landmarker is closed and
    rebuilt every POSE_REBUILD frames, which frees them.
    """

    def __init__(self):
        self.pose, self.used = None, 0

    def __call__(self, rgb: np.ndarray, ts_ms: int):
        if self.pose is None or self.used >= POSE_REBUILD:
            self.close()
            self.pose, self.used = poser(video=True), 0
        self.used += 1
        h, w = rgb.shape[:2]
        k = min(1.0, POSE_HEIGHT / h)
        small = cv2.resize(rgb, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA) if k < 1 else rgb
        lm = landmarks(self.pose, small, ts_ms)
        if lm is not None:
            lm[:, :2] /= k
        return lm

    def close(self):
        if self.pose is not None:
            self.pose.close()
            self.pose = None
