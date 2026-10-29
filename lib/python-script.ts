export const GEMINI_CLIP_DETECTION_PROMPT = `Analyze the attached long-form video track. Identify 3 to 10 high-engagement, standalone segments that meet the following criteria:
1. Duration: Strictly between 30 and 60 seconds per clip.
2. Hook (0–5 seconds): Starts with a strong statement, surprising fact, controversial opinion, or emotional reaction.
3. Standalone Context: The clip must tell a complete story or deliver a clear value point without requiring context from the rest of the full video.
4. Clean Cut Boundaries: Ensure start and end timestamps align with sentence pauses (do not cut mid-word).
5. Word-Level Timestamps: Break each caption phrase into word-level timing offsets ("word", "start_time", "end_time" in seconds relative to clip start) so the ASS Karaoke engine can highlight each spoken word.

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
]`;

export const FFMPEG_DUAL_LAYER_FILTER =
  'split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[b]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';

export const FFMPEG_SOTA_FILTER_COMPLEX = `# 1. Smart Face Tracking Auto-Reframing + 1.12x Dynamic Punch-In Zooms + ASS Karaoke Burn-In
ffmpeg -y -i raw_cut.mp4 -vf "scale=-2:1920:force_original_aspect_ratio=increase,crop=1080:1920:420:0,split[zbase][zsrc];[zsrc]scale=iw*1.12:-1,crop=iw/1.12:ih/1.12[zzoom];[zbase][zzoom]overlay=0:0:enable='between(t,4.5,9.2)+between(t,16.0,24.5)',subtitles='clip_1_karaoke.ass'" -c:v libx264 -preset fast -crf 20 visual_9x16.mp4

# 2. Background Music Overlay & Sidechain Audio Ducking
ffmpeg -y -i visual_9x16.mp4 -i music.mp3 -filter_complex "[1:a]volume=0.15,aloop=loop=-1:size=2e+09[bg];[0:a]asplit=2[sc][speech];[bg][sc]sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300[ducked_bg];[speech][ducked_bg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest sota_short_9x16.mp4`;

export const REQUIREMENTS_TXT = `streamlit>=1.41.0
google-genai>=1.5.0
yt-dlp>=2025.1.15
opencv-python>=4.10.0
mediapipe>=0.10.18
numpy>=1.26.0
pillow>=10.4.0
`;

export const CONTEXTUAL_EMOJI_MAP: Record<string, string> = {
  money: '💰',
  cash: '💰',
  revenue: '💰',
  profit: '💰',
  fire: '🔥',
  viral: '🔥',
  hot: '🔥',
  insane: '🔥',
  rocket: '🚀',
  launch: '🚀',
  scale: '🚀',
  growth: '🚀',
  jump: '🚀',
  jumps: '🚀',
  brain: '🧠',
  smart: '🧠',
  ai: '🧠',
  gemini: '🧠',
  mind: '🧠',
  time: '⏱️',
  seconds: '⏱️',
  intervals: '⏱️',
  hours: '⏱️',
  fast: '⚡',
  speed: '⚡',
  instant: '⚡',
  crash: '💥',
  crashed: '💥',
  destroying: '💥',
  fail: '💥',
  win: '🏆',
  winner: '🏆',
  best: '🏆',
  secret: '🔑',
  hidden: '🔑',
  unlock: '🔑',
  data: '📊',
  metrics: '📊',
  percent: '📈',
  hundred: '💯',
  '100%': '💯',
  video: '🎬',
  camera: '🎥',
  captions: '💬',
  audio: '🔊',
};

export function detectContextualEmojis(text: string): string {
  const tokens = text.toLowerCase().match(/[a-z0-9%]+/g) || [];
  const matched: string[] = [];
  for (const tok of tokens) {
    const emoji = CONTEXTUAL_EMOJI_MAP[tok];
    if (emoji && !matched.includes(emoji)) {
      matched.push(emoji);
    }
    if (matched.length >= 2) break;
  }
  return matched.join(' ');
}

export const STREAMLIT_APP_PY_CODE = `"""
AI Short-Form Video Clipper Engine — SOTA Engagement Edition (app.py)
=====================================================================
Refactored & upgraded full-stack Python pipeline featuring:
1. Alex Hormozi-Style Animated Karaoke Captions:
   - Word-level timing extraction (\`word\`, \`start_time\`, \`end_time\`) via Gemini Multimodal API.
   - Dynamic ASS Karaoke rendering (\`\\\\k\` tags + active word \`\\\\fscx110\\\\fscy110\` scale bump).
   - Automatic contextual emoji insertion (💰, 🔥, 🚀, 🧠, ⏱️, ⚡, 🏆, 📊) beside/above captions.
2. Dynamic Punch-In Zooms & Visual Cuts:
   - Alternating 1.0x (normal) and 1.12x (punch-in zoom) on sentence/hook transitions
     (\`scale=iw*1.12:-1,crop=iw/1.12:ih/1.12:enable='...'\`) to reset viewer visual fatigue.
3. Smart Face Tracking Auto-Reframing:
   - MediaPipe / OpenCV active speaker detection ($X_{face}$) with Exponential Moving Average (EMA)
     smoothing (\`x = clamp(X_face - 540, 0, max_x)\`) to prevent camera jitter.
4. Background Music Overlay & Sidechain Audio Ducking:
   - Ambient MP3/WAV overlay with FFmpeg \`sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300\`.
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
5. Word-Level Timestamps: Break each caption phrase into word-level timing offsets ("word", "start_time", "end_time" in seconds relative to clip start) so the ASS Karaoke engine can highlight each spoken word.

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
            "start_time": types.Schema(type=types.Type.STRING),
            "end_time": types.Schema(type=types.Type.STRING),
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
            "clip_id", "title", "start_time", "end_time",
            "duration_seconds", "virality_score", "hook_transcript", "reasoning",
        ],
    ),
)


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
    primary_ass_color: str
    secondary_ass_color: str
    outline_ass_color: str
    back_ass_color: str
    border_style: int
    outline_width: int
    shadow_depth: int
    margin_v: int
    active_rgb: Tuple[int, int, int]
    inactive_rgb: Tuple[int, int, int]
    outline_rgb: Tuple[int, int, int]


CAPTION_PRESETS: Dict[str, CaptionStylePreset] = {
    "Hormozi Pop": CaptionStylePreset(
        name="Hormozi Pop",
        font_name="Impact",
        font_size=72,
        primary_ass_color="&H0000FFFF",    # Neon Yellow
        secondary_ass_color="&H00FFFFFF",  # Crisp White
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
        primary_ass_color="&H00FFFFFF",
        secondary_ass_color="&H00B4B4B4",
        outline_ass_color="&H60181818",
        back_ass_color="&H90101010",
        border_style=3,
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
        primary_ass_color="&H00FFFF00",    # Electric Cyan (BGR)
        secondary_ass_color="&H00FFFFFF",
        outline_ass_color="&H00661100",
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

CONTEXTUAL_EMOJI_MAP: Dict[str, str] = {
    "money": "💰", "cash": "💰", "revenue": "💰", "profit": "💰",
    "fire": "🔥", "viral": "🔥", "hot": "🔥", "insane": "🔥",
    "rocket": "🚀", "launch": "🚀", "scale": "🚀", "growth": "🚀", "jump": "🚀", "jumps": "🚀",
    "brain": "🧠", "smart": "🧠", "ai": "🧠", "gemini": "🧠", "mind": "🧠",
    "time": "⏱️", "seconds": "⏱️", "intervals": "⏱️", "hours": "⏱️",
    "fast": "⚡", "speed": "⚡", "instant": "⚡",
    "crash": "💥", "crashed": "💥", "destroying": "💥", "fail": "💥",
    "win": "🏆", "winner": "🏆", "best": "🏆",
    "secret": "🔑", "hidden": "🔑", "unlock": "🔑",
    "data": "📊", "metrics": "📊", "percent": "📈", "hundred": "💯", "100%": "💯",
}


# ---------------------------------------------------------------------------
# FEATURE 1: ALEX HORMOZI-STYLE ANIMATED KARAOKE CAPTIONS & EMOJI INJECTION
# ---------------------------------------------------------------------------

def detect_contextual_emojis(text: str) -> str:
    tokens = re.findall(r"[a-zA-Z0-9%]+", text.lower())
    matched: List[str] = []
    for tok in tokens:
        if tok in CONTEXTUAL_EMOJI_MAP and CONTEXTUAL_EMOJI_MAP[tok] not in matched:
            matched.append(CONTEXTUAL_EMOJI_MAP[tok])
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
    for chunk in clip.transcript_lines:
        chunk_start = seconds_to_ass_time(chunk.start_offset)
        chunk_end = seconds_to_ass_time(min(clip.duration_seconds, chunk.end_offset))

        if enable_emojis:
            emoji_str = detect_contextual_emojis(chunk.text)
            if emoji_str:
                events.append(
                    f"Dialogue: 2,{chunk_start},{chunk_end},EmojiOverlay,,0,0,0,,"
                    r"{\\fad(60,60)\\fscx115\\fscy115}" + emoji_str
                )

        if not enable_karaoke or not chunk.words:
            clean_line = chunk.text.replace("\\n", " ").upper()
            events.append(
                f"Dialogue: 1,{chunk_start},{chunk_end},KaraokeMain,,0,0,0,,"
                r"{\\fad(60,60)\\fscx105\\fscy105}" + clean_line
            )
            continue

        # Base \\k karaoke line + per-word active \\fscx110\\fscy110 highlight state
        k_tokens = [
            f"{{\\\\k{max(5, int(round((w.end_time - w.start_time) * 100)))}}}{w.word.upper()}"
            for w in chunk.words
        ]
        events.append(
            f"Dialogue: 0,{chunk_start},{chunk_end},KaraokeMain,,0,0,0,,{' '.join(k_tokens)}"
        )

        for active_idx, active_w in enumerate(chunk.words):
            w_start = seconds_to_ass_time(active_w.start_time)
            w_end = seconds_to_ass_time(min(clip.duration_seconds, active_w.end_time))
            rendered_tokens: List[str] = []
            for idx, w in enumerate(chunk.words):
                clean_w = w.word.upper()
                if idx == active_idx:
                    rendered_tokens.append(
                        f"{{\\\\1c{preset.primary_ass_color}\\\\fscx110\\\\fscy110}}{clean_w}"
                        f"{{\\\\fscx100\\\\fscy100\\\\1c{preset.secondary_ass_color}}}"
                    )
                else:
                    rendered_tokens.append(
                        f"{{\\\\1c{preset.secondary_ass_color}\\\\fscx100\\\\fscy100}}{clean_w}"
                    )
            events.append(
                f"Dialogue: 1,{w_start},{w_end},KaraokeMain,,0,0,0,,{' '.join(rendered_tokens)}"
            )

    Path(output_ass_path).write_text(ass_header + "\\n".join(events) + "\\n", encoding="utf-8")
    return output_ass_path


# ---------------------------------------------------------------------------
# FEATURE 2: DYNAMIC PUNCH-IN ZOOMS & VISUAL CUTS
# ---------------------------------------------------------------------------

def build_dynamic_zoom_filter(clip: ViralClip) -> str:
    zoom_windows: List[str] = []
    for idx, line in enumerate(clip.transcript_lines):
        if idx % 2 == 1:
            s = round(max(0.0, line.start_offset), 2)
            e = round(min(clip.duration_seconds, line.end_offset), 2)
            if e > s:
                zoom_windows.append(f"between(t,{s},{e})")
    if not zoom_windows:
        return "null"
    enable_expr = "+".join(zoom_windows)
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
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0, [0]

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
    scaled_w = int(round(frame_w * (1920.0 / max(1, frame_h))))
    max_x = max(0, scaled_w - target_crop_width)
    half_crop = target_crop_width // 2  # 540

    detector = None
    if HAS_MEDIAPIPE and hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
        detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )

    smoothed_x: Optional[float] = None
    trajectory: List[int] = []
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_stride == 0:
                x_face_norm = 0.5
                if detector is not None:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = detector.process(rgb)
                    if results.detections:
                        best_det = max(
                            results.detections,
                            key=lambda d: (
                                d.location_data.relative_bounding_box.width
                                * d.location_data.relative_bounding_box.height
                            ),
                        )
                        bbox = best_det.location_data.relative_bounding_box
                        x_face_norm = bbox.xmin + (bbox.width / 2.0)

                x_face_px = x_face_norm * scaled_w
                raw_crop_x = max(0.0, min(float(max_x), x_face_px - half_crop))
                smoothed_x = (
                    raw_crop_x
                    if smoothed_x is None
                    else (ema_alpha * raw_crop_x) + ((1.0 - ema_alpha) * smoothed_x)
                )
                trajectory.append(int(round(smoothed_x)))
            frame_idx += 1
    finally:
        cap.release()
        if detector is not None:
            detector.close()

    if not trajectory:
        return max_x // 2, [max_x // 2]
    return int(np.median(trajectory)), trajectory


# ---------------------------------------------------------------------------
# FEATURE 4: BACKGROUND MUSIC OVERLAY & SIDECHAIN AUDIO DUCKING
# ---------------------------------------------------------------------------

def apply_sidechain_audio_ducking(
    speech_video_path: str,
    music_audio_path: str,
    output_video_path: str,
    music_volume: float = 0.15,
) -> str:
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
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", output_video_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg sidechain audio ducking failed:\\n{proc.stderr[-800:]}")
    return output_video_path
`;
