"""
MediaPipe, set up once for the film pipeline: the person mask and the pose.

Person mask: the selfie segmenter (its single confidence mask IS the person).
Pose: PoseLandmarker, 33 landmarks per frame, used for the heart (where the
badge sits) and the feet (where his shadow meets the ground).
"""
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
