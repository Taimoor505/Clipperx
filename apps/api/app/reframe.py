"""
Smart 9:16 framing for landscape clips.

Samples the clip at a few frames per second, finds faces with OpenCV's YuNet detector,
splits the clip into camera shots, and works out who is talking in each moment from mouth
movement. Clips that are mostly people on camera get a full-height crop that follows the
speaker; anything else (gameplay, b-roll, screens) keeps the fit-with-blur layout.
"""

import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

YUNET_MODEL = Path(os.environ.get("YUNET_MODEL", "/opt/models/face_detection_yunet_2023mar.onnx"))
SAMPLE_FPS = 6
SAMPLE_W, SAMPLE_H = 640, 360
MIN_FACE_SCORE = 0.75
MIN_FACE_WIDTH = 0.035  # of frame width: ignores tiny background faces and posters
SHOT_CUT_DIFF = 28.0  # mean abs difference of 32x18 grayscale thumbnails between samples
SPEAKER_WINDOW = 1.0  # seconds per speaking decision
MIN_SEGMENT = 1.5  # seconds a framing must hold before switching again
FACE_TIME_FOR_CROP = 0.6  # share of the clip that must show faces to use the speaker crop


@dataclass
class Track:
    xs: List[float] = field(default_factory=list)  # face centers, sample-frame pixels
    widths: List[float] = field(default_factory=list)
    times: List[float] = field(default_factory=list)
    motion: List[Tuple[float, float]] = field(default_factory=list)  # (time, mouth motion)

    @property
    def x(self) -> float:
        return float(np.median(self.xs))

    @property
    def width(self) -> float:
        return float(np.median(self.widths))


@dataclass
class Shot:
    start: float
    end: float
    tracks: List[Track] = field(default_factory=list)


def _detector():
    import cv2

    if not YUNET_MODEL.exists():
        return None
    return cv2.FaceDetectorYN.create(str(YUNET_MODEL), "", (SAMPLE_W, SAMPLE_H), MIN_FACE_SCORE)


def _frames(source: Path, start: str, end: str):
    """Yields (time, BGR frame) at SAMPLE_FPS for the clip, scaled to SAMPLE_W x SAMPLE_H."""
    proc = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-ss", start, "-to", end, "-i", str(source),
            "-vf", f"fps={SAMPLE_FPS},scale={SAMPLE_W}:{SAMPLE_H}",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    size = SAMPLE_W * SAMPLE_H * 3
    index = 0
    try:
        while True:
            buf = proc.stdout.read(size)
            if len(buf) < size:
                break
            yield index / SAMPLE_FPS, np.frombuffer(buf, np.uint8).reshape(SAMPLE_H, SAMPLE_W, 3)
            index += 1
    finally:
        proc.stdout.close()
        proc.wait()


def _mouth_box(face) -> Tuple[int, int, int, int]:
    # YuNet landmarks: right eye, left eye, nose tip, right mouth corner, left mouth corner
    (rx, ry), (lx, ly) = face[10:12], face[12:14]
    span = max(8.0, abs(lx - rx))
    cx, cy = (rx + lx) / 2, (ry + ly) / 2
    x0, x1 = int(cx - span * 0.8), int(cx + span * 0.8)
    y0, y1 = int(cy - span * 0.45), int(cy + span * 0.6)
    return max(0, x0), max(0, y0), min(SAMPLE_W, x1), min(SAMPLE_H, y1)


def analyze(source: Path, start: str, end: str) -> List[Shot]:
    import cv2

    detector = _detector()
    if detector is None:
        return []
    shots: List[Shot] = []
    prev_thumb, prev_gray, t = None, None, 0.0
    for t, frame in _frames(source, start, end):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        thumb = cv2.resize(gray, (32, 18), interpolation=cv2.INTER_AREA).astype(np.float32)
        if prev_thumb is None or float(np.abs(thumb - prev_thumb).mean()) > SHOT_CUT_DIFF:
            if shots:
                shots[-1].end = t
            shots.append(Shot(start=t, end=t))
            prev_gray = None  # no mouth motion across a camera cut
        prev_thumb = thumb
        shot = shots[-1]

        _, faces = detector.detect(frame)
        for face in faces if faces is not None else []:
            x, y, w, h = face[:4]
            if w < MIN_FACE_WIDTH * SAMPLE_W:
                continue
            cx = float(x + w / 2)
            track = min(shot.tracks, key=lambda tr: abs(tr.xs[-1] - cx), default=None)
            if track is None or abs(track.xs[-1] - cx) > max(w, 0.08 * SAMPLE_W):
                track = Track()
                shot.tracks.append(track)
            track.xs.append(cx)
            track.widths.append(float(w))
            track.times.append(t)
            if prev_gray is not None:
                x0, y0, x1, y1 = _mouth_box(face)
                if x1 - x0 > 4 and y1 - y0 > 4:
                    a = cv2.resize(gray[y0:y1, x0:x1], (24, 14)).astype(np.float32)
                    b = cv2.resize(prev_gray[y0:y1, x0:x1], (24, 14)).astype(np.float32)
                    track.motion.append((t, float(np.abs(a - b).mean())))
        prev_gray = gray
    if shots:
        shots[-1].end = t + 1 / SAMPLE_FPS
    return shots


def _shot_segments(shot: Shot, crop_w: float) -> List[Tuple[float, float, Optional[float]]]:
    """[(start, end, center_x or None)] for one camera shot, in sample-frame pixels."""
    length = max(shot.end - shot.start, 1e-6)
    samples = length * SAMPLE_FPS
    people = [tr for tr in shot.tracks if len(tr.xs) >= max(2, 0.3 * samples)]
    if not people:
        return [(shot.start, shot.end, None)]
    if len(people) == 1:
        return [(shot.start, shot.end, people[0].x)]
    left = min(tr.x - tr.width / 2 for tr in people)
    right = max(tr.x + tr.width / 2 for tr in people)
    if right - left <= crop_w * 0.9:
        return [(shot.start, shot.end, (left + right) / 2)]  # everyone fits in one 9:16 frame

    # Several people too far apart: follow whoever's mouth is moving, one window at a time
    windows = []
    t = shot.start
    while t < shot.end - 1e-6:
        t1 = min(shot.end, t + SPEAKER_WINDOW)
        scores = []
        for tr in people:
            vals = [m for (mt, m) in tr.motion if t <= mt < t1]
            # Normalise by face size: a close-up mouth moves more pixels than a distant one
            scores.append((np.mean(vals) / max(tr.width, 1.0)) if vals else -1.0)
        windows.append((t, t1, int(np.argmax(scores)) if max(scores) >= 0 else None))
        t = t1

    segments: List[Tuple[float, float, Optional[float]]] = []
    current, since = None, shot.start
    for i, (w0, w1, who) in enumerate(windows):
        if who is None:
            who = current
        if current is None:
            current = who
        # Switch only when the new speaker also wins the next window (no flicker on a cough)
        nxt = windows[i + 1][2] if i + 1 < len(windows) else who
        if who != current and nxt == who and w0 - since >= MIN_SEGMENT:
            segments.append((since, w0, people[current].x if current is not None else None))
            current, since = who, w0
    segments.append((since, shot.end, people[current].x if current is not None else None))
    return segments


def plan(
    source: Path, start: str, end: str, src_w: int, src_h: int,
    out_aspect: float = 9 / 16, force: bool = False,
) -> Optional[dict]:
    """
    Returns {"crop_w": int, "segments": [(t0, t1, x_left)]} in source pixels for a full-height
    crop of `out_aspect` (width / height) that follows the speaker, or None when the clip should
    keep the fit-with-blur layout. `force` crops even when few faces are found.
    """
    crop_w = int(round(src_h * out_aspect / 2) * 2)
    if crop_w >= src_w * 0.95:
        return None  # the source is already as narrow as the output: nothing to crop
    try:
        shots = analyze(source, start, end)
    except Exception:  # noqa: BLE001 - framing is a nicety; fall back to the blur layout
        return None
    if not shots:
        return None if not force else {"crop_w": crop_w, "segments": [(0.0, 1e9, (src_w - crop_w) // 2)]}

    scale = src_w / SAMPLE_W
    sample_crop_w = crop_w / scale
    raw = [seg for shot in shots for seg in _shot_segments(shot, sample_crop_w)]
    total = sum(e - s for s, e, _ in raw) or 1.0
    with_faces = sum(e - s for s, e, x in raw if x is not None)
    if with_faces / total < FACE_TIME_FOR_CROP and not force:
        return None

    segments: List[Tuple[float, float, int]] = []
    last_x = next((x for _, _, x in raw if x is not None), SAMPLE_W / 2)
    for s, e, x in raw:
        x = last_x if x is None else x  # faceless moments keep the previous framing
        last_x = x
        left = int(min(max(x * scale - crop_w / 2, 0), src_w - crop_w))
        # Merge with the previous segment when the framing barely moves (avoids tiny jumps)
        if segments and abs(segments[-1][2] - left) < 0.03 * src_w:
            segments[-1] = (segments[-1][0], e, segments[-1][2])
        else:
            segments.append((s, e, left))
    return {"crop_w": crop_w, "segments": segments}


def crop_filter(framing: dict, src_h: int, out_w: int, out_h: int) -> str:
    """An FFmpeg crop + scale chain whose x position jumps between the planned segments."""
    segments = framing["segments"]
    expr = str(segments[-1][2])
    for s, e, left in reversed(segments[:-1]):
        expr = f"if(lt(t\\,{e:.3f})\\,{left}\\,{expr})"
    return f"crop={framing['crop_w']}:{src_h}:{expr}:0,scale={out_w}:{out_h},setsar=1"
