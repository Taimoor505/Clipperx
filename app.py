"""
AI Short-Form Video Clipper Engine — SOTA Engagement Edition (app.py)
=====================================================================
Refactored & upgraded full-stack Python pipeline featuring:
1. Alex Hormozi-Style Animated Karaoke Captions:
   - Word-level timing extraction (`word`, `start_time`, `end_time`) via Gemini Multimodal API.
   - Dynamic ASS Karaoke rendering (`\\k` tags + active word `\\fscx110\\fscy110` scale bump).
   - Automatic contextual emoji insertion (💰, 🔥, 🚀, 🧠, ⏱️, ⚡, 🏆, 📊) beside/above captions.
2. Dynamic Punch-In Zooms & Visual Cuts:
   - Alternating 1.0x (normal) and 1.12x (punch-in zoom) on sentence/hook transitions
     (`scale=iw*1.12:-1,crop=iw/1.12:ih/1.12:enable='...'`) to reset viewer visual fatigue.
3. Smart Face Tracking Auto-Reframing:
   - MediaPipe / OpenCV active speaker detection ($X_{face}$) with Exponential Moving Average (EMA)
     smoothing (`x = clamp(X_face - 540, 0, max_x)`) to prevent camera jitter.
4. Background Music Overlay & Sidechain Audio Ducking:
   - Ambient MP3/WAV overlay with FFmpeg `sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300`.
5. Streamlit UI Upgrades:
   - Caption Style Presets (*Hormozi Pop*, *Minimalist Clean*, *Cyber Neon*).
   - Sidebar Feature Toggles for Karaoke, Dynamic Zooms, Face Tracking, and Audio Ducking.
   - Live Static Sample Frame Preview showing font, active word highlight, emoji, and safe-zone margin.

Installation:
    pip install streamlit google-genai yt-dlp opencv-python mediapipe numpy pillow
    export GEMINI_API_KEY="your-api-key"
    streamlit run app.py --server.maxUploadSize=2048
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import streamlit as st
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types

# Optional MediaPipe import with graceful OpenCV Haar fallback
try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except ImportError:
    mp = None
    HAS_MEDIAPIPE = False


# ---------------------------------------------------------------------------
# STAGE 1: GEMINI WORD-LEVEL VIDEO ANALYSIS & CLIP DETECTION PROMPT
# ---------------------------------------------------------------------------

GEMINI_CLIP_DETECTION_PROMPT = """Analyze the attached long-form video track. Identify 3 to 10 high-engagement, standalone segments that meet the following criteria:
1. Duration: Strictly between 30 and 60 seconds per clip.
2. Hook (0–5 seconds): Starts with a strong statement, surprising fact, controversial opinion, or emotional reaction.
3. Standalone Context: The clip must tell a complete story or deliver a clear value point without requiring context from the rest of the full video.
4. Clean Cut Boundaries: Ensure start and end timestamps align with sentence pauses (do not cut mid-word).
5. Word-Level Timestamps: Break each caption phrase into word-level timing offsets (`word`, `start_time`, `end_time` in seconds relative to clip start) so the ASS Karaoke engine can highlight each spoken word.

Return ONLY a raw JSON array matching this format:
[
  {
    "clip_id": 1,
    "title": "Catchy Hook Title",
    "start_time": "00:04:12.500",
    "end_time": "00:04:58.200",
    "duration_seconds": 45.7,
    "virality_score": 92,
    "hook_transcript": "First 5 seconds of spoken text",
    "reasoning": "Why this moment is highly engaging",
    "transcript_lines": [
      {
        "start_offset": 0.0,
        "end_offset": 3.2,
        "text": "Spoken caption line for this segment",
        "words": [
          {"word": "Spoken", "start_time": 0.0, "end_time": 0.55},
          {"word": "caption", "start_time": 0.55, "end_time": 1.15},
          {"word": "line", "start_time": 1.15, "end_time": 1.60},
          {"word": "for", "start_time": 1.60, "end_time": 1.95},
          {"word": "this", "start_time": 1.95, "end_time": 2.40},
          {"word": "segment", "start_time": 2.40, "end_time": 3.20}
        ]
      }
    ]
  }
]
"""

CLIP_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    description="List of 3 to 10 viral-worthy 30-60 second video clip segments with word-level timestamps.",
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "clip_id": types.Schema(type=types.Type.INTEGER),
            "title": types.Schema(type=types.Type.STRING),
            "start_time": types.Schema(
                type=types.Type.STRING,
                description="Start timestamp in HH:MM:SS.mmm format",
            ),
            "end_time": types.Schema(
                type=types.Type.STRING,
                description="End timestamp in HH:MM:SS.mmm format",
            ),
            "duration_seconds": types.Schema(type=types.Type.NUMBER),
            "virality_score": types.Schema(type=types.Type.INTEGER),
            "hook_transcript": types.Schema(type=types.Type.STRING),
            "reasoning": types.Schema(type=types.Type.STRING),
            "transcript_lines": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "start_offset": types.Schema(type=types.Type.NUMBER),
                        "end_offset": types.Schema(type=types.Type.NUMBER),
                        "text": types.Schema(type=types.Type.STRING),
                        "words": types.Schema(
                            type=types.Type.ARRAY,
                            items=types.Schema(
                                type=types.Type.OBJECT,
                                properties={
                                    "word": types.Schema(type=types.Type.STRING),
                                    "start_time": types.Schema(type=types.Type.NUMBER),
                                    "end_time": types.Schema(type=types.Type.NUMBER),
                                },
                                required=["word", "start_time", "end_time"],
                            ),
                        ),
                    },
                    required=["start_offset", "end_offset", "text"],
                ),
            ),
        },
        required=[
            "clip_id",
            "title",
            "start_time",
            "end_time",
            "duration_seconds",
            "virality_score",
            "hook_transcript",
            "reasoning",
        ],
    ),
)


# ---------------------------------------------------------------------------
# DATA MODELS & CAPTION STYLE PRESETS
# ---------------------------------------------------------------------------

@dataclass
class WordTiming:
    word: str
    start_time: float
    end_time: float


@dataclass
class TranscriptChunk:
    start_offset: float
    end_offset: float
    text: str
    words: List[WordTiming] = field(default_factory=list)


@dataclass
class ViralClip:
    clip_id: int
    title: str
    start_time: str
    end_time: str
    duration_seconds: float
    virality_score: int
    hook_transcript: str
    reasoning: str
    transcript_lines: List[TranscriptChunk] = field(default_factory=list)


@dataclass
class CaptionStylePreset:
    name: str
    font_name: str
    font_size: int
    # ASS uses &HAABBGGRR hex format
    primary_ass_color: str      # Active / highlighted word color
    secondary_ass_color: str    # Inactive / upcoming word color
    outline_ass_color: str      # Stroke / box color
    back_ass_color: str         # Shadow / box fill
    border_style: int           # 1 = Outline + Drop Shadow, 3 = Opaque Box
    outline_width: int
    shadow_depth: int
    margin_v: int
    # RGB tuples for Live PIL Sample Frame Preview
    active_rgb: Tuple[int, int, int]
    inactive_rgb: Tuple[int, int, int]
    outline_rgb: Tuple[int, int, int]


CAPTION_PRESETS: Dict[str, CaptionStylePreset] = {
    "Hormozi Pop": CaptionStylePreset(
        name="Hormozi Pop",
        font_name="Impact",
        font_size=72,
        primary_ass_color="&H0000FFFF",    # Neon Yellow (&H0000FFFF in BGR)
        secondary_ass_color="&H00FFFFFF",  # Crisp White for inactive words
        outline_ass_color="&H00000000",    # Heavy Black Stroke
        back_ass_color="&H80000000",
        border_style=1,
        outline_width=5,
        shadow_depth=3,
        margin_v=520,
        active_rgb=(250, 204, 21),
        inactive_rgb=(255, 255, 255),
        outline_rgb=(0, 0, 0),
    ),
    "Minimalist Clean": CaptionStylePreset(
        name="Minimalist Clean",
        font_name="Montserrat",
        font_size=58,
        primary_ass_color="&H00FFFFFF",    # Active pure White
        secondary_ass_color="&H00B4B4B4",  # Muted Silver inactive
        outline_ass_color="&H60181818",    # Subtle translucent dark box
        back_ass_color="&H90101010",
        border_style=3,                    # Opaque/translucent box background
        outline_width=14,
        shadow_depth=0,
        margin_v=500,
        active_rgb=(255, 255, 255),
        inactive_rgb=(180, 188, 200),
        outline_rgb=(20, 24, 33),
    ),
    "Cyber Neon": CaptionStylePreset(
        name="Cyber Neon",
        font_name="Arial Black",
        font_size=68,
        primary_ass_color="&H00FFFF00",    # Electric Cyan (&H00FFFF00 in BGR)
        secondary_ass_color="&H00FFFFFF",  # White inactive
        outline_ass_color="&H00661100",    # Deep navy/cyan glow stroke
        back_ass_color="&H90FF8800",
        border_style=1,
        outline_width=6,
        shadow_depth=4,
        margin_v=520,
        active_rgb=(34, 211, 238),
        inactive_rgb=(248, 250, 252),
        outline_rgb=(8, 47, 73),
    ),
}

# Contextual Keyword -> Emoji Dictionary for Feature 1
CONTEXTUAL_EMOJI_MAP: Dict[str, str] = {
    "money": "💰",
    "cash": "💰",
    "revenue": "💰",
    "profit": "💰",
    "fire": "🔥",
    "viral": "🔥",
    "hot": "🔥",
    "insane": "🔥",
    "rocket": "🚀",
    "launch": "🚀",
    "scale": "🚀",
    "growth": "🚀",
    "jump": "🚀",
    "jumps": "🚀",
    "brain": "🧠",
    "smart": "🧠",
    "ai": "🧠",
    "gemini": "🧠",
    "mind": "🧠",
    "time": "⏱️",
    "seconds": "⏱️",
    "intervals": "⏱️",
    "hours": "⏱️",
    "fast": "⚡",
    "speed": "⚡",
    "instant": "⚡",
    "crash": "💥",
    "crashed": "💥",
    "destroying": "💥",
    "fail": "💥",
    "win": "🏆",
    "winner": "🏆",
    "best": "🏆",
    "secret": "🔑",
    "hidden": "🔑",
    "unlock": "🔑",
    "data": "📊",
    "metrics": "📊",
    "percent": "📈",
    "hundred": "💯",
    "100%": "💯",
    "video": "🎬",
    "camera": "🎥",
    "captions": "💬",
    "audio": "🔊",
}


# ---------------------------------------------------------------------------
# TIMESTAMP & WORD TIMING UTILITIES
# ---------------------------------------------------------------------------

def timestamp_to_seconds(ts: str) -> float:
    ts = ts.strip()
    parts = ts.split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return float(ts)
    except ValueError:
        return 0.0


def seconds_to_timestamp(total_seconds: float) -> str:
    total_seconds = max(0.0, total_seconds)
    hours = int(total_seconds // 3600)
    remainder = total_seconds % 3600
    minutes = int(remainder // 60)
    seconds = remainder % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"


def seconds_to_ass_time(total_seconds: float) -> str:
    total_seconds = max(0.0, total_seconds)
    hours = int(total_seconds // 3600)
    remainder = total_seconds % 3600
    minutes = int(remainder // 60)
    seconds = remainder % 60
    return f"{hours:d}:{minutes:02d}:{seconds:05.2f}"


def synthesize_word_timings(
    text: str, start_offset: float, end_offset: float
) -> List[WordTiming]:
    """Fallback word timing generator when only phrase-level start/end are present."""
    raw_words = [w for w in text.strip().split() if w]
    if not raw_words:
        return []
    total_dur = max(0.4, end_offset - start_offset)
    total_chars = sum(len(w) for w in raw_words) or 1
    cursor = start_offset
    result: List[WordTiming] = []
    for idx, w in enumerate(raw_words):
        weight = len(w) / total_chars
        w_dur = total_dur * weight
        w_end = end_offset if idx == len(raw_words) - 1 else round(cursor + w_dur, 3)
        result.append(WordTiming(word=w, start_time=round(cursor, 3), end_time=w_end))
        cursor = w_end
    return result


# ---------------------------------------------------------------------------
# FEATURE 1: ALEX HORMOZI-STYLE ANIMATED KARAOKE CAPTIONS & EMOJI INJECTION
# ---------------------------------------------------------------------------

def detect_contextual_emojis(text: str) -> str:
    """
    Scans a caption phrase for high-impact keywords and returns up to 2
    contextual emojis to display above or beside the caption block.
    """
    tokens = re.findall(r"[a-zA-Z0-9%]+", text.lower())
    matched: List[str] = []
    for tok in tokens:
        if tok in CONTEXTUAL_EMOJI_MAP:
            emoji = CONTEXTUAL_EMOJI_MAP[tok]
            if emoji not in matched:
                matched.append(emoji)
        if len(matched) >= 2:
            break
    return " ".join(matched)


def generate_karaoke_ass_subtitles(
    clip: ViralClip,
    output_ass_path: str,
    preset_name: str = "Hormozi Pop",
    enable_karaoke: bool = True,
    enable_emojis: bool = True,
) -> str:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file featuring:
    1. Word-level Karaoke (`\\k` centisecond tags) + active word scale bump (`\\fscx110\\fscy110`)
       where the currently spoken word lights up in Neon Yellow / Green / Cyan while
       inactive words remain crisp White with a 5px black stroke (`Outline=5`).
    2. Automatic Contextual Emoji Insertion rendered above/beside high-impact phrases.
    """
    preset = CAPTION_PRESETS.get(preset_name, CAPTION_PRESETS["Hormozi Pop"])

    ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: KaraokeMain,{preset.font_name},{preset.font_size},{preset.primary_ass_color},{preset.secondary_ass_color},{preset.outline_ass_color},{preset.back_ass_color},-1,0,0,0,100,100,1,0,{preset.border_style},{preset.outline_width},{preset.shadow_depth},2,70,70,{preset.margin_v},1
Style: EmojiOverlay,Arial,82,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,2,70,70,{preset.margin_v + 125},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: List[str] = []
    chunks = clip.transcript_lines or [
        TranscriptChunk(
            start_offset=0.0,
            end_offset=min(5.0, clip.duration_seconds),
            text=clip.hook_transcript,
            words=synthesize_word_timings(
                clip.hook_transcript, 0.0, min(5.0, clip.duration_seconds)
            ),
        )
    ]

    for chunk in chunks:
        words = chunk.words or synthesize_word_timings(
            chunk.text, chunk.start_offset, chunk.end_offset
        )
        chunk_start = seconds_to_ass_time(chunk.start_offset)
        chunk_end = seconds_to_ass_time(min(clip.duration_seconds, chunk.end_offset))

        # Automatic Contextual Emoji Overlay line above caption block
        if enable_emojis:
            emoji_str = detect_contextual_emojis(chunk.text)
            if emoji_str:
                events.append(
                    f"Dialogue: 2,{chunk_start},{chunk_end},EmojiOverlay,,0,0,0,,"
                    r"{\fad(60,60)\fscx115\fscy115}" + emoji_str
                )

        if not enable_karaoke or not words:
            clean_line = (
                chunk.text.replace("\n", " ").replace("{", "").replace("}", "").upper()
            )
            events.append(
                f"Dialogue: 1,{chunk_start},{chunk_end},KaraokeMain,,0,0,0,,"
                r"{\fad(60,60)\fscx105\fscy105}" + clean_line
            )
            continue

        # Emit 1) a base `\k` karaoke timing line AND 2) per-word active `\fscx110\fscy110` pop layers
        k_tokens: List[str] = []
        for w in words:
            dur_cs = max(5, int(round((w.end_time - w.start_time) * 100)))
            clean_w = w.word.replace("{", "").replace("}", "").upper()
            k_tokens.append(f"{{\\k{dur_cs}}}{clean_w}")
        events.append(
            f"Dialogue: 0,{chunk_start},{chunk_end},KaraokeMain,,0,0,0,,{' '.join(k_tokens)}"
        )

        # Per-word active highlight state: active word gets PrimaryColour + \fscx110\fscy110 bump
        for active_idx, active_w in enumerate(words):
            w_start = seconds_to_ass_time(active_w.start_time)
            w_end = seconds_to_ass_time(min(clip.duration_seconds, active_w.end_time))
            rendered_tokens: List[str] = []
            for idx, w in enumerate(words):
                clean_w = w.word.replace("{", "").replace("}", "").upper()
                if idx == active_idx:
                    rendered_tokens.append(
                        f"{{\\1c{preset.primary_ass_color}\\fscx110\\fscy110}}{clean_w}"
                        f"{{\\fscx100\\fscy100\\1c{preset.secondary_ass_color}}}"
                    )
                else:
                    rendered_tokens.append(
                        f"{{\\1c{preset.secondary_ass_color}\\fscx100\\fscy100}}{clean_w}"
                    )
            events.append(
                f"Dialogue: 1,{w_start},{w_end},KaraokeMain,,0,0,0,,{' '.join(rendered_tokens)}"
            )

    Path(output_ass_path).write_text(
        ass_header + "\n".join(events) + "\n", encoding="utf-8"
    )
    return output_ass_path


# ---------------------------------------------------------------------------
# FEATURE 2: DYNAMIC PUNCH-IN ZOOMS & VISUAL CUTS
# ---------------------------------------------------------------------------

def build_dynamic_zoom_filter(clip: ViralClip) -> str:
    """
    Calculates sentence transition zoom beats from Gemini transcript chunks and
    returns an FFmpeg filter expression that alternates between 1.0x (normal) and
    1.12x (punch-in zoom: `scale=iw*1.12:-1,crop=iw/1.12:ih/1.12`) on odd-indexed
    sentence chunks or the opening 0-4.5s hook to reset viewer visual fatigue.
    """
    zoom_windows: List[str] = []
    lines = clip.transcript_lines

    if lines:
        for idx, line in enumerate(lines):
            # Punch-in 1.12x on every alternating sentence boundary
            if idx % 2 == 1:
                s = round(max(0.0, line.start_offset), 2)
                e = round(min(clip.duration_seconds, line.end_offset), 2)
                if e > s:
                    zoom_windows.append(f"between(t,{s},{e})")
    else:
        # Fallback: alternate 1.12x punch-in every 5 seconds
        t = 4.0
        while t < clip.duration_seconds:
            end_t = min(clip.duration_seconds, t + 4.0)
            zoom_windows.append(f"between(t,{t:.1f},{end_t:.1f})")
            t += 8.0

    if not zoom_windows:
        return "null"

    enable_expr = "+".join(zoom_windows)
    # Use split +conditional overlay so 1.12x punch-in applies cleanly on sentence beats
    return (
        f"split[zbase][zsrc];"
        f"[zsrc]scale=iw*1.12:-1,crop=iw/1.12:ih/1.12[zzoom];"
        f"[zbase][zzoom]overlay=0:0:enable='{enable_expr}'"
    )


# ---------------------------------------------------------------------------
# FEATURE 3: SMART FACE TRACKING AUTO-REFRAMING (OPENCV + MEDIAPIPE + EMA)
# ---------------------------------------------------------------------------

def compute_smoothed_face_crop_offset(
    video_path: str,
    target_crop_width: int = 1080,
    ema_alpha: float = 0.15,
    sample_stride: int = 5,
) -> Tuple[int, List[int]]:
    """
    Scans video frames using MediaPipe Face Detection (or OpenCV Haar cascade fallback)
    to locate the active speaker's face center ($X_{face}$).
    Calculates the horizontal crop offset:
        x = clamp(X_face - 540, 0, max_x)
    Applies Exponential Moving Average (EMA) smoothing across frames to prevent
    abrupt camera jitter when speakers shift position.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0, [0]

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080

    # Scale factor if input is scaled to 1920 height first
    scaled_w = int(round(frame_w * (1920.0 / max(1, frame_h))))
    max_x = max(0, scaled_w - target_crop_width)
    half_crop = target_crop_width // 2  # 540 for 1080px width

    detector = None
    haar_cascade = None
    if HAS_MEDIAPIPE and hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
        detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )
    else:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        if os.path.exists(cascade_path):
            haar_cascade = cv2.CascadeClassifier(cascade_path)

    smoothed_x: Optional[float] = None
    trajectory: List[int] = []
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_stride == 0:
                x_face_norm = 0.5  # Default center if no face in frame

                if detector is not None:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = detector.process(rgb)
                    if results.detections:
                        # Pick largest/highest-confidence speaker bounding box
                        best_det = max(
                            results.detections,
                            key=lambda d: (
                                d.location_data.relative_bounding_box.width
                                * d.location_data.relative_bounding_box.height
                            ),
                        )
                        bbox = best_det.location_data.relative_bounding_box
                        x_face_norm = bbox.xmin + (bbox.width / 2.0)
                elif haar_cascade is not None:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = haar_cascade.detectMultiScale(gray, 1.1, 4)
                    if len(faces) > 0:
                        fx, fy, fw, fh = max(faces, key=lambda b: b[2] * b[3])
                        x_face_norm = (fx + fw / 2.0) / max(1, frame_w)

                x_face_px = x_face_norm * scaled_w
                raw_crop_x = max(0.0, min(float(max_x), x_face_px - half_crop))

                if smoothed_x is None:
                    smoothed_x = raw_crop_x
                else:
                    smoothed_x = (ema_alpha * raw_crop_x) + (
                        (1.0 - ema_alpha) * smoothed_x
                    )

                trajectory.append(int(round(smoothed_x)))

            frame_idx += 1
    finally:
        cap.release()
        if detector is not None:
            detector.close()

    if not trajectory:
        default_center = max_x // 2
        return default_center, [default_center]

    median_smoothed_x = int(np.median(trajectory))
    return median_smoothed_x, trajectory


# ---------------------------------------------------------------------------
# FEATURE 4: BACKGROUND MUSIC OVERLAY & SIDECHAIN AUDIO DUCKING
# ---------------------------------------------------------------------------

def synthesize_ambient_music_wav(output_wav_path: str, duration_sec: float = 60.0) -> str:
    """
    Generates a warm, royalty-free stereo ambient synth pad WAV file using FFmpeg
    `aevalsrc` if the user has not uploaded a custom MP3/WAV track.
    """
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", (
            f"aevalsrc='0.12*sin(2*PI*110*t)+0.08*sin(2*PI*164.81*t)"
            f"+0.06*sin(2*PI*220*t)+0.04*sin(2*PI*277.18*t)':s=44100:d={duration_sec:.1f}"
        ),
        "-c:a", "pcm_s16le",
        output_wav_path,
    ]
    subprocess.run(cmd, capture_output=True, text=True)
    return output_wav_path


def apply_sidechain_audio_ducking(
    speech_video_path: str,
    music_audio_path: str,
    output_video_path: str,
    music_volume: float = 0.15,
) -> str:
    """
    Compresses background music whenever primary speech is present using FFmpeg's
    `sidechaincompress` filter and mixes both into the final output track:
      [1:a]volume=0.15,aloop=loop=-1:size=2e+09[bg];
      [0:a]asplit=2[sc][speech];
      [bg][sc]sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300[ducked_bg];
      [speech][ducked_bg]amix=inputs=2:duration=first:dropout_transition=2[aout]
    """
    filter_complex = (
        f"[1:a]volume={music_volume:.2f},aloop=loop=-1:size=2e+09[bg];"
        f"[0:a]asplit=2[sc][speech];"
        f"[bg][sc]sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300[ducked_bg];"
        f"[speech][ducked_bg]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", speech_video_path,
        "-i", music_audio_path,
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_video_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg sidechain audio ducking failed:\n{proc.stderr[-800:]}")
    return output_video_path


# ---------------------------------------------------------------------------
# STAGE 1 EXECUTION: GEMINI MULTIMODAL FILE UPLOAD & ANALYSIS
# ---------------------------------------------------------------------------

def get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is missing. "
            "Set it via `export GEMINI_API_KEY='your_key'` before running."
        )
    return genai.Client(api_key=api_key)


def analyze_video_with_gemini(
    video_path: str,
    model_name: str = "gemini-2.5-flash",
    progress_callback=None,
) -> List[ViralClip]:
    client = get_gemini_client()

    if progress_callback:
        progress_callback(15, "Uploading video to Gemini File API...")

    uploaded_file = client.files.upload(file=video_path)

    try:
        poll_attempt = 0
        while uploaded_file.state.name == "PROCESSING":
            poll_attempt += 1
            if progress_callback:
                pct = min(45, 15 + poll_attempt * 3)
                progress_callback(
                    pct,
                    f"Gemini processing video track (state: {uploaded_file.state.name})...",
                )
            time.sleep(5)
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state.name != "ACTIVE":
            raise RuntimeError(
                f"Gemini File API processing failed with state: {uploaded_file.state.name}"
            )

        if progress_callback:
            progress_callback(55, "Running Gemini word-level viral clip detection...")

        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, GEMINI_CLIP_DETECTION_PROMPT],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are an expert short-form viral video editor. "
                    "Analyze both audio cadence and visual reactions to pick "
                    "30 to 60 second standalone clips with clean sentence boundaries "
                    "and accurate word-level timing offsets."
                ),
                response_mime_type="application/json",
                response_schema=CLIP_RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )

        if progress_callback:
            progress_callback(75, "Parsing word-level timestamps & hook scores...")

        raw_text = (response.text or "[]").strip()
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        parsed = json.loads(raw_text)

        clips: List[ViralClip] = []
        for idx, item in enumerate(parsed, start=1):
            start_sec = timestamp_to_seconds(item.get("start_time", "00:00:00.000"))
            end_sec = timestamp_to_seconds(item.get("end_time", "00:00:45.000"))
            if end_sec <= start_sec:
                end_sec = start_sec + float(item.get("duration_seconds", 45.0))
            duration = round(end_sec - start_sec, 2)

            raw_lines = item.get("transcript_lines") or []
            transcript_chunks: List[TranscriptChunk] = []
            for line in raw_lines:
                s_off = float(line.get("start_offset", 0.0))
                e_off = float(line.get("end_offset", 3.0))
                txt = str(line.get("text", "")).strip()

                raw_words = line.get("words") or []
                word_objs: List[WordTiming] = []
                for rw in raw_words:
                    word_objs.append(
                        WordTiming(
                            word=str(rw.get("word", "")).strip(),
                            start_time=float(rw.get("start_time", s_off)),
                            end_time=float(rw.get("end_time", e_off)),
                        )
                    )
                if not word_objs and txt:
                    word_objs = synthesize_word_timings(txt, s_off, e_off)

                transcript_chunks.append(
                    TranscriptChunk(
                        start_offset=s_off,
                        end_offset=e_off,
                        text=txt,
                        words=word_objs,
                    )
                )

            if not transcript_chunks and item.get("hook_transcript"):
                hook_txt = str(item["hook_transcript"])
                transcript_chunks.append(
                    TranscriptChunk(
                        start_offset=0.0,
                        end_offset=min(5.0, duration),
                        text=hook_txt,
                        words=synthesize_word_timings(hook_txt, 0.0, min(5.0, duration)),
                    )
                )

            clips.append(
                ViralClip(
                    clip_id=int(item.get("clip_id", idx)),
                    title=str(item.get("title", f"Viral Clip #{idx}")),
                    start_time=seconds_to_timestamp(start_sec),
                    end_time=seconds_to_timestamp(end_sec),
                    duration_seconds=duration,
                    virality_score=int(item.get("virality_score", 85)),
                    hook_transcript=str(item.get("hook_transcript", "")),
                    reasoning=str(item.get("reasoning", "")),
                    transcript_lines=transcript_chunks,
                )
            )

        return clips

    finally:
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# STAGE 2: SOTA FFMPEG RENDERING PIPELINE
# ---------------------------------------------------------------------------

def check_ffmpeg_installed() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def probe_has_audio_stream(video_path: str) -> bool:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "a",
        "-show_entries", "stream=index", "-of", "csv=p=0", video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return bool(result.stdout.strip())


def escape_ffmpeg_filter_path(file_path: str) -> str:
    escaped = file_path.replace("\\", "/")
    escaped = escaped.replace(":", "\\:")
    escaped = escaped.replace("'", "\\'")
    return escaped


def render_sota_vertical_short(
    input_video_path: str,
    clip: ViralClip,
    work_dir: str,
    preset_name: str = "Hormozi Pop",
    enable_karaoke: bool = True,
    enable_zoom_cuts: bool = True,
    enable_face_tracking: bool = True,
    enable_audio_ducking: bool = False,
    custom_music_path: Optional[str] = None,
) -> str:
    """
    Executes the full SOTA FFmpeg rendering pipeline:
    1. Frame-accurate timestamp trim (`-ss` / `-to`).
    2. Optional OpenCV/MediaPipe Smart Face Tracking (`x = clamp(X_face - 540, 0, max_x)`)
       or Dual-Layer Gaussian Blur 9:16 formatting (`1080x1920`).
    3. Optional Dynamic 1.12x Punch-In Zoom Cuts on sentence boundaries.
    4. Burn-in Alex Hormozi-style ASS Karaoke captions + contextual emojis.
    5. Optional Background Music Overlay with FFmpeg `sidechaincompress` audio ducking.
    """
    if not check_ffmpeg_installed():
        raise RuntimeError(
            "FFmpeg / FFprobe binaries were not found on PATH. "
            "Install FFmpeg (`apt install ffmpeg` or `brew install ffmpeg`)."
        )

    raw_cut_path = os.path.join(work_dir, f"clip_{clip.clip_id}_raw.mp4")
    ass_path = os.path.join(work_dir, f"clip_{clip.clip_id}_karaoke.ass")
    visual_out_path = os.path.join(work_dir, f"clip_{clip.clip_id}_visual_9x16.mp4")
    final_output_path = os.path.join(work_dir, f"clip_{clip.clip_id}_sota_9x16.mp4")

    has_audio = probe_has_audio_stream(input_video_path)

    # Step 1: Trim clip segment
    cut_cmd = [
        "ffmpeg", "-y",
        "-ss", clip.start_time,
        "-to", clip.end_time,
        "-i", input_video_path,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
    ]
    if has_audio:
        cut_cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    else:
        cut_cmd.append("-an")
    cut_cmd.append(raw_cut_path)

    proc_cut = subprocess.run(cut_cmd, capture_output=True, text=True)
    if proc_cut.returncode != 0:
        raise RuntimeError(f"FFmpeg trim step failed:\n{proc_cut.stderr[-800:]}")

    # Step 2: Reframe to 9:16 (1080x1920) — Smart Face Tracking Crop OR Dual-Layer Blur Fill
    if enable_face_tracking:
        smoothed_crop_x, _ = compute_smoothed_face_crop_offset(
            raw_cut_path, target_crop_width=1080, ema_alpha=0.15
        )
        # Scale height to 1920 and crop 1080 width centered on EMA-smoothed speaker X coordinate
        base_reframe_filter = (
            f"scale=-2:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920:{smoothed_crop_x}:0"
        )
    else:
        base_reframe_filter = (
            "split[a][b];"
            "[a]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,boxblur=25:5[bg];"
            "[b]scale=1080:-2[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )

    filter_stages = [base_reframe_filter]

    # Step 3: Dynamic 1.12x Punch-In Zoom Cuts on Sentence Transitions
    if enable_zoom_cuts:
        zoom_filter = build_dynamic_zoom_filter(clip)
        if zoom_filter != "null":
            filter_stages.append(zoom_filter)

    # Step 4: Alex Hormozi ASS Karaoke Captions + Contextual Emoji Burn-In
    generate_karaoke_ass_subtitles(
        clip=clip,
        output_ass_path=ass_path,
        preset_name=preset_name,
        enable_karaoke=enable_karaoke,
        enable_emojis=True,
    )
    escaped_ass = escape_ffmpeg_filter_path(ass_path)
    filter_stages.append(f"subtitles='{escaped_ass}'")

    vf_chain = ",".join(filter_stages)

    render_cmd = [
        "ffmpeg", "-y",
        "-i", raw_cut_path,
        "-vf", vf_chain,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-pix_fmt", "yuv420p",
    ]
    if has_audio:
        render_cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    else:
        render_cmd.append("-an")
    render_cmd.append(visual_out_path)

    proc_render = subprocess.run(render_cmd, capture_output=True, text=True)
    if proc_render.returncode != 0:
        raise RuntimeError(f"FFmpeg 9:16 SOTA render failed:\n{proc_render.stderr[-800:]}")

    # Step 5: Optional Background Music Overlay & Sidechain Audio Ducking
    if enable_audio_ducking and has_audio:
        bg_music = custom_music_path
        if not bg_music or not os.path.exists(bg_music):
            bg_music = os.path.join(work_dir, "ambient_synth_pad.wav")
            synthesize_ambient_music_wav(bg_music, duration_sec=clip.duration_seconds + 5.0)
        apply_sidechain_audio_ducking(
            speech_video_path=visual_out_path,
            music_audio_path=bg_music,
            output_video_path=final_output_path,
            music_volume=0.15,
        )
        try:
            os.remove(visual_out_path)
        except OSError:
            pass
    else:
        shutil.move(visual_out_path, final_output_path)

    if os.path.exists(raw_cut_path):
        try:
            os.remove(raw_cut_path)
        except OSError:
            pass

    return final_output_path


# ---------------------------------------------------------------------------
# FEATURE 5: LIVE STATIC PRESET PREVIEW GENERATOR (PIL / OPENCV)
# ---------------------------------------------------------------------------

def render_live_preset_preview_image(
    preset_name: str,
    enable_karaoke: bool = True,
    enable_zoom_cuts: bool = True,
    enable_face_tracking: bool = True,
) -> Image.Image:
    """
    Renders a static 540x960 (9:16) sample preview frame illustrating the
    chosen Caption Style Preset, active word karaoke highlight, contextual emoji,
    and MarginV safe-zone positioning before initiating full FFmpeg renders.
    """
    W, H = 540, 960
    preset = CAPTION_PRESETS.get(preset_name, CAPTION_PRESETS["Hormozi Pop"])

    img = Image.new("RGB", (W, H), (14, 20, 34))
    draw = ImageDraw.Draw(img, "RGBA")

    # Simulated 9:16 studio background + speaker framing guide
    for y in range(H):
        r = int(15 + (y / H) * 18)
        g = int(23 + (y / H) * 24)
        b = int(42 + (y / H) * 35)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Draw simulated 16:9 or Smart Face-Tracked viewport window
    fg_y1, fg_y2 = 220, 560
    draw.rectangle([20, fg_y1, W - 20, fg_y2], fill=(22, 32, 52), outline=(71, 85, 105), width=2)

    if enable_face_tracking:
        # Draw MediaPipe EMA Face Tracking bounding box indicator
        draw.rectangle(
            [185, 270, 355, 480],
            outline=(56, 189, 248, 220),
            width=2,
        )
        draw.text(
            (192, 248),
            "EMA FACE LOCK: x=clamp(X_face-540)",
            fill=(56, 189, 248),
        )

    if enable_zoom_cuts:
        draw.text(
            (32, fg_y1 + 14),
            "ZOOM BEAT: 1.12x PUNCH-IN ACTIVE",
            fill=(250, 204, 21),
        )

    # Safe-zone MarginV guide line
    safe_y = H - int(preset.margin_v * (H / 1920.0))
    draw.line([(30, safe_y + 45), (W - 30, safe_y + 45)], fill=(255, 255, 255, 45), width=1)
    draw.text(
        (35, safe_y + 52),
        f"ASS MarginV={preset.margin_v}px Safe Zone ({preset.name})",
        fill=(148, 163, 184),
    )

    # Optional translucent background box for Minimalist Clean preset
    if preset.border_style == 3:
        draw.rounded_rectangle(
            [45, safe_y - 38, W - 45, safe_y + 32],
            radius=10,
            fill=(15, 23, 42, 215),
        )

    # Contextual Emoji Header above caption block
    draw.text((W // 2 - 28, safe_y - 78), "🔥 🚀", fill=(255, 255, 255))

    # Sample Karaoke Caption Tokens: "RETENTION" [ACTIVE: "JUMPS"] "10X FASTER"
    sample_tokens = [
        ("RETENTION", False),
        ("JUMPS", True),
        ("10X FASTER", False),
    ]

    try:
        font = ImageFont.load_default(size=26)
        font_active = ImageFont.load_default(size=30)
    except TypeError:
        font = ImageFont.load_default()
        font_active = font

    cursor_x = 68
    for word_str, is_active in sample_tokens:
        use_font = font_active if (is_active and enable_karaoke) else font
        fill_col = (
            preset.active_rgb if (is_active and enable_karaoke) else preset.inactive_rgb
        )
        # Black stroke outline
        for ox in (-2, 0, 2):
            for oy in (-2, 0, 2):
                if ox != 0 or oy != 0:
                    draw.text(
                        (cursor_x + ox, safe_y - 14 + oy),
                        word_str,
                        font=use_font,
                        fill=preset.outline_rgb,
                    )
        draw.text((cursor_x, safe_y - 14), word_str, font=use_font, fill=fill_col)
        cursor_x += len(word_str) * 16 + 18

    return img


def download_youtube_video(youtube_url: str, dest_dir: str) -> str:
    output_template = os.path.join(dest_dir, "yt_source.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        youtube_url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"YouTube download failed:\n{proc.stderr[-600:]}")
    return os.path.join(dest_dir, "yt_source.mp4")


# ---------------------------------------------------------------------------
# STAGE 3: STREAMLIT FRONTEND INTERFACE (WITH SOTA ENGAGEMENT CONTROLS)
# ---------------------------------------------------------------------------

def init_session_state():
    if "work_dir" not in st.session_state:
        st.session_state.work_dir = tempfile.mkdtemp(prefix="ai_short_clipper_sota_")
    if "source_video_path" not in st.session_state:
        st.session_state.source_video_path = None
    if "bg_music_path" not in st.session_state:
        st.session_state.bg_music_path = None
    if "clips" not in st.session_state:
        st.session_state.clips = []
    if "rendered_files" not in st.session_state:
        st.session_state.rendered_files = {}


def cleanup_temp_file(filepath: str):
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
    except OSError:
        pass


def adjust_clip_timestamp(clip_idx: int, field_name: str, delta_seconds: float):
    clip: ViralClip = st.session_state.clips[clip_idx]
    start_sec = timestamp_to_seconds(clip.start_time)
    end_sec = timestamp_to_seconds(clip.end_time)

    if field_name == "start":
        new_start = max(0.0, start_sec + delta_seconds)
        if end_sec - new_start >= 5.0:
            start_sec = new_start
    elif field_name == "end":
        new_end = max(start_sec + 5.0, end_sec + delta_seconds)
        end_sec = new_end

    clip.start_time = seconds_to_timestamp(start_sec)
    clip.end_time = seconds_to_timestamp(end_sec)
    clip.duration_seconds = round(end_sec - start_sec, 2)


def main():
    st.set_page_config(
        page_title="AI Short-Form Video Clipper — SOTA Engagement Engine",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    init_session_state()

    st.title("AI Short-Form Video Clipper Engine (SOTA Engagement Edition)")
    st.caption(
        "Alex Hormozi ASS Karaoke Captions · Dynamic 1.12x Zoom Cuts · "
        "MediaPipe/OpenCV EMA Face Tracking · Sidechain Audio Ducking"
    )

    # Sidebar: Caption Presets, SOTA Feature Toggles & Ambient Music Upload
    with st.sidebar:
        st.header("Caption Style Preset")
        caption_preset = st.selectbox(
            "Select Caption Theme",
            options=list(CAPTION_PRESETS.keys()),
            index=0,
            help="Hormozi Pop (Impact/Yellow), Minimalist Clean (Box/White), or Cyber Neon (Glow/Cyan).",
        )

        st.divider()
        st.header("SOTA Engagement Toggles")
        enable_karaoke = st.checkbox(
            "Enable Word-by-Word Karaoke Highlighting", value=True
        )
        enable_zoom_cuts = st.checkbox("Enable Dynamic Zoom Cuts (1.12x)", value=True)
        enable_face_tracking = st.checkbox(
            "Enable Smart Face Tracking Auto-Crop", value=True
        )
        enable_audio_ducking = st.checkbox(
            "Enable Background Music Ducking", value=True
        )

        if enable_audio_ducking:
            uploaded_music = st.file_uploader(
                "Optional Ambient Music (MP3/WAV)",
                type=["mp3", "wav"],
                help="Leave empty to auto-synthesize a warm royalty-free ambient pad.",
            )
            if uploaded_music is not None:
                music_dest = os.path.join(st.session_state.work_dir, uploaded_music.name)
                with open(music_dest, "wb") as mf:
                    shutil.copyfileobj(uploaded_music, mf)
                st.session_state.bg_music_path = music_dest

        st.divider()
        st.subheader("Live Preset Preview")
        preview_img = render_live_preset_preview_image(
            preset_name=caption_preset,
            enable_karaoke=enable_karaoke,
            enable_zoom_cuts=enable_zoom_cuts,
            enable_face_tracking=enable_face_tracking,
        )
        st.image(
            preview_img,
            caption=f"Preset: {caption_preset} (9:16 Safe Zone)",
            use_container_width=True,
        )

        model_choice = st.selectbox(
            "Gemini Multimodal Model",
            options=["gemini-2.5-flash", "gemini-2.5-pro"],
            index=0,
        )

    # Step 1: Source Long-Form Video Input
    st.subheader("1. Source Long-Form Video (30 mins – 2 hours)")
    input_tab_upload, input_tab_yt = st.tabs(
        ["Upload Video File (MP4, MOV, WebM up to 2GB)", "YouTube URL"]
    )

    with input_tab_upload:
        uploaded_video = st.file_uploader(
            "Select a long-form video file",
            type=["mp4", "mov", "webm"],
        )
        if uploaded_video is not None:
            dest_path = os.path.join(st.session_state.work_dir, uploaded_video.name)
            if st.session_state.source_video_path != dest_path:
                with open(dest_path, "wb") as f:
                    shutil.copyfileobj(uploaded_video, f)
                st.session_state.source_video_path = dest_path

    with input_tab_yt:
        yt_url = st.text_input("Paste a public YouTube URL")
        if st.button("Fetch YouTube Video") and yt_url.strip():
            with st.spinner("Downloading source video with yt-dlp..."):
                try:
                    st.session_state.source_video_path = download_youtube_video(
                        yt_url.strip(), st.session_state.work_dir
                    )
                    st.success("YouTube video downloaded to workspace.")
                except Exception as exc:
                    st.error(str(exc))

    # Step 2: Gemini Word-Level Video Analysis
    if st.session_state.source_video_path and os.path.exists(
        st.session_state.source_video_path
    ):
        if st.button("Analyze Video & Extract Word-Level Viral Clips", type="primary"):
            progress_bar = st.progress(0, text="Uploading -> Gemini Video Analysis...")
            try:
                detected_clips = analyze_video_with_gemini(
                    video_path=st.session_state.source_video_path,
                    model_name=model_choice,
                    progress_callback=lambda pct, msg: progress_bar.progress(
                        pct, text=msg
                    ),
                )
                st.session_state.clips = detected_clips
                st.session_state.rendered_files = {}
                progress_bar.progress(
                    100,
                    text=f"Segment Detection Complete — {len(detected_clips)} viral clips ready.",
                )
            except Exception as exc:
                st.error(f"Analysis failed: {exc}")

    # Step 3: Candidate Clip Cards & SOTA 9:16 Rendering
    if st.session_state.clips:
        st.divider()
        st.subheader(
            f"2. Candidate Viral Clips ({len(st.session_state.clips)} Detected)"
        )

        for idx, clip in enumerate(st.session_state.clips):
            with st.container(border=True):
                col_meta, col_preview = st.columns([3, 2], gap="large")
                with col_meta:
                    st.markdown(
                        f"### Clip #{clip.clip_id}: {clip.title} ({clip.virality_score}/100)"
                    )
                    st.markdown(f"**Hook (0–5s):** *\"{clip.hook_transcript}\"*")
                    st.caption(f"**Reasoning:** {clip.reasoning}")

                    emojis = detect_contextual_emojis(clip.hook_transcript)
                    if emojis:
                        st.caption(f"**Auto-Injected Contextual Emojis:** {emojis}")

                    t_col1, t_col2, t_col3 = st.columns(3)
                    with t_col1:
                        st.write(f"**Start:** `{clip.start_time}`")
                        if st.button("-2s Start", key=f"s_sub_{clip.clip_id}"):
                            adjust_clip_timestamp(idx, "start", -2.0)
                            st.rerun()
                        if st.button("+2s Start", key=f"s_add_{clip.clip_id}"):
                            adjust_clip_timestamp(idx, "start", 2.0)
                            st.rerun()
                    with t_col2:
                        st.write(f"**End:** `{clip.end_time}`")
                        if st.button("-2s End", key=f"e_sub_{clip.clip_id}"):
                            adjust_clip_timestamp(idx, "end", -2.0)
                            st.rerun()
                        if st.button("+2s End", key=f"e_add_{clip.clip_id}"):
                            adjust_clip_timestamp(idx, "end", 2.0)
                            st.rerun()
                    with t_col3:
                        st.metric("Duration", f"{clip.duration_seconds:.1f}s")
                        if st.button(
                            "Render SOTA 9:16 Short",
                            key=f"ren_{clip.clip_id}",
                            type="primary",
                        ):
                            with st.spinner(
                                "Running Face Tracking, 1.12x Zoom Cuts, ASS Karaoke & Audio Ducking..."
                            ):
                                out_file = render_sota_vertical_short(
                                    input_video_path=st.session_state.source_video_path,
                                    clip=clip,
                                    work_dir=st.session_state.work_dir,
                                    preset_name=caption_preset,
                                    enable_karaoke=enable_karaoke,
                                    enable_zoom_cuts=enable_zoom_cuts,
                                    enable_face_tracking=enable_face_tracking,
                                    enable_audio_ducking=enable_audio_ducking,
                                    custom_music_path=st.session_state.bg_music_path,
                                )
                                st.session_state.rendered_files[clip.clip_id] = out_file

                with col_preview:
                    rendered_path = st.session_state.rendered_files.get(clip.clip_id)
                    if rendered_path and os.path.exists(rendered_path):
                        st.video(rendered_path)
                        with open(rendered_path, "rb") as f:
                            st.download_button(
                                label="Download SOTA Clip (1080x1920 MP4)",
                                data=f.read(),
                                file_name=f"sota_short_clip_{clip.clip_id}.mp4",
                                mime="video/mp4",
                                key=f"dl_{clip.clip_id}",
                                on_click=cleanup_temp_file,
                                args=(rendered_path,),
                            )


if __name__ == "__main__":
    main()
