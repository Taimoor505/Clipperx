"""
ClipperX Backend Worker — FastAPI + Gemini Multimodal API + FFmpeg 9:16 Pipeline
"""

import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, Field
from vidgrab import DownloadManager
from vidgrab.server import build_router as build_download_router

from app import edits, reframe, transcript_pipeline

app = FastAPI(
    title="ClipperX FastAPI + FFmpeg Worker",
    version="2.0.0",
    description="Multimodal viral clip detection and 9:16 vertical FFmpeg rendering worker.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_CLIP_DETECTION_PROMPT = """Analyze the attached long-form video track. Identify 3 to 10 high-engagement, standalone segments that meet the following criteria:
1. Duration: Strictly between 30 and 60 seconds per clip.
2. Hook (0–5 seconds): Starts with a strong statement, surprising fact, controversial opinion, or emotional reaction.
3. Standalone Context: The clip must tell a complete story or deliver a clear value point without requiring context from the rest of the full video.
4. Clean Cut Boundaries: Ensure start and end timestamps align with sentence pauses (do not cut mid-word).
5. Word-Level Timestamps: Break each caption phrase into word-level timing offsets ("word", "start_time", "end_time" in seconds relative to clip start).

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
        "text": "Spoken caption line",
        "words": [
          {"word": "Spoken", "start_time": 0.0, "end_time": 0.55},
          {"word": "caption", "start_time": 0.55, "end_time": 1.15},
          {"word": "line", "start_time": 1.15, "end_time": 1.60}
        ]
      }
    ]
  }
]
"""

# Uploaded source videos are kept here so /api/render can reuse them by id
UPLOAD_DIR = Path(tempfile.gettempdir()) / "clipperx_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_ID_PATTERN = re.compile(r"^[0-9a-f]{32}\.(mp4|mov|webm|mkv)$")

# Link imports: vidgrab downloads here, then /api/downloads/{id}/import moves the file
# into UPLOAD_DIR so every analyze/render endpoint can use it by video_id
downloads = DownloadManager(
    UPLOAD_DIR / "downloads",
    max_parallel=2,
    connections=8,
    max_height=1080,
    media_only=True,
    max_bytes=int(os.environ.get("MAX_DOWNLOAD_MB", "4096")) * 1024 * 1024,
)


YOUTUBE_URL_PATTERN = re.compile(
    r"^https://(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/|live/)|youtu\.be/)[\w-]{11}"
)
MAX_CLIPS_LIMIT = 40
# Word-level timing for many clips overflows a single Gemini response; above this
# count clips come back with caption lines only (render falls back to line captions)
WORD_TIMING_CLIP_LIMIT = 12


def build_clip_prompt(
    max_clips: int, word_timing: bool, title: str, duration: Optional[float]
) -> str:
    prompt = GEMINI_CLIP_DETECTION_PROMPT.replace(
        "Identify 3 to 10 high-engagement",
        f"Identify as many qualifying high-engagement (up to {max_clips})"
        if max_clips > 10
        else f"Identify up to {max_clips} high-engagement",
    )
    if not word_timing:
        prompt += (
            "\nOMIT the \"words\" arrays entirely; give only caption lines "
            "(start_offset, end_offset, text) to keep the response compact."
        )
    prompt += f"\n\nVideo Title: {title}\n"
    if duration:
        prompt += (
            f"Total Duration: {duration:.1f} seconds "
            f"(all timestamps must fall between 00:00:00.000 and {seconds_to_timestamp(duration)}).\n"
            "If the video is shorter than 30 seconds, return one clip covering the whole video.\n"
        )
    prompt += (
        "Clips must not overlap each other. Spread them across the whole video.\n"
        "Order clips from highest to lowest virality_score."
    )
    return prompt


def generate_clips(client: genai.Client, model_name: str, contents: list) -> List[dict]:
    # Overload (500/503) is usually transient; back off and retry. 429 is not retried:
    # on the free tier it is often a daily quota that only resets hours later.
    try:
        for attempt in range(5):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                        max_output_tokens=65536,
                    ),
                )
                break
            except genai_errors.APIError as exc:
                if exc.code not in (500, 503) or attempt == 4:
                    raise
                time.sleep(5 * 2**attempt)
    except genai_errors.APIError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini error ({model_name}): {exc.message}")

    try:
        raw = json.loads(response.text or "[]")
        clips = [ViralClipCandidate(**item).model_dump() for item in raw]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini returned malformed clips: {exc}")

    clips.sort(key=lambda c: c["virality_score"], reverse=True)
    for i, clip in enumerate(clips, start=1):
        clip["clip_id"] = i  # Gemini sometimes repeats ids across many clips
    return clips


def store_upload(video: UploadFile) -> tuple:
    """Saves an uploaded video under UPLOAD_DIR; returns (video_id, path)."""
    suffix = Path(video.filename or "").suffix.lower().lstrip(".")
    if suffix not in ("mp4", "mov", "webm", "mkv"):
        suffix = "mp4"
    video_id = f"{uuid.uuid4().hex}.{suffix}"
    stored_path = UPLOAD_DIR / video_id
    with stored_path.open("wb") as f:
        shutil.copyfileobj(video.file, f)
    return video_id, stored_path


def resolve_source(video: Optional[UploadFile], video_id: Optional[str]) -> tuple:
    """Accepts a fresh upload or the id of a stored/imported video; returns (video_id, path, name)."""
    if video is not None:
        new_id, path = store_upload(video)
        return new_id, path, video.filename or "Uploaded video"
    if video_id:
        if not VIDEO_ID_PATTERN.match(video_id) or not (UPLOAD_DIR / video_id).exists():
            raise HTTPException(status_code=404, detail="Unknown video_id; import the video again.")
        return video_id, UPLOAD_DIR / video_id, video_id
    raise HTTPException(status_code=400, detail="Provide either `video` or `video_id`.")


def resolve_model(requested: Optional[str]) -> str:
    """GEMINI_MODEL env var overrides whatever model the UI requests."""
    return os.environ.get("GEMINI_MODEL") or requested or "gemini-flash-latest"


def run_ffmpeg(cmd: List[str], cwd: Optional[Path] = None) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"FFmpeg failed: {proc.stderr.strip()[-1500:]}",
        )


def probe_video_stream(path: Path) -> tuple:
    """Returns (width, height, fps_expr) of the first video stream."""
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        stream = json.loads(proc.stdout)["streams"][0]
        fps = stream.get("r_frame_rate") or "30"
        return int(stream["width"]), int(stream["height"]), fps
    except (ValueError, KeyError, IndexError):
        return 1920, 1080, "30"


def probe_duration_seconds(path: Path) -> float:
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return 0.0


def seconds_to_timestamp(total: float) -> str:
    safe = max(0.0, total)
    hrs = int(safe // 3600)
    mins = int((safe % 3600) // 60)
    secs = safe % 60
    return f"{hrs:02d}:{mins:02d}:{secs:06.3f}"


class WordTimingModel(BaseModel):
    word: str
    start_time: float
    end_time: float


class TranscriptLineModel(BaseModel):
    start_offset: float
    end_offset: float
    text: str
    words: Optional[List[WordTimingModel]] = None


class ViralClipCandidate(BaseModel):
    clip_id: int
    title: str
    start_time: str
    end_time: str
    duration_seconds: float
    virality_score: int = Field(ge=0, le=100)
    hook_transcript: str
    reasoning: str
    transcript_lines: Optional[List[TranscriptLineModel]] = None


class AnalyzeRequest(BaseModel):
    videoTitle: Optional[str] = "Long-Form Studio Session"
    videoDurationSeconds: Optional[float] = 1800.0
    youtubeUrl: Optional[str] = ""
    transcriptContext: Optional[str] = ""
    selectedModel: Optional[str] = "gemini-flash-latest"


NUMBER_PATTERN = re.compile(r"[\d$%€£]")
PRESET_ACTIVE_COLORS = {"Hormozi Pop": "#FFFF00", "Cyber Neon": "#00FFFF", "Red Highlight": "#FF0000"}
# Bundled (open licence) so captions look the same in Docker and the desktop app
CAPTION_FONTS = ("Anton", "Bebas Neue", "Archivo Black", "Poppins ExtraBold", "Bangers", "Lilita One",
                 "Impact", "Arial Black")
# ASS sizes text by the font's line height, so fonts with tall line spacing look small:
# scale each to Impact's capital height (the original caption look)
FONT_SCALE = {"Anton": 1.31, "Bebas Neue": 1.2, "Archivo Black": 1.27, "Poppins ExtraBold": 1.61,
              "Bangers": 1.58, "Lilita One": 1.05, "Impact": 1.0, "Arial Black": 1.28}
CAPTION_POSITIONS = {"bottom": 14, "lower": 30, "middle": 46, "top": 72}  # % of the video area, from the bottom
CORNER_ALIGN = {"top-left": 7, "top-right": 9, "bottom-left": 1, "bottom-right": 3, "center": 5}
FONTS_DIR = next(
    (p for p in (Path(os.environ.get("CLIPPERX_FONTS_DIR") or "-"), Path(__file__).resolve().parent.parent / "fonts")
     if p.is_dir()),
    Path("-"),
)


def ass_color(hex_color: str, alpha: int = 0) -> str:
    """'#RRGGBB' to ASS '&HAABBGGRR' (ASS is blue-green-red, alpha 0 is opaque)."""
    h = (hex_color or "").lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        h = "FFFFFF"
    return f"&H{alpha:02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


class CaptionStyle(BaseModel):
    """How captions look; every field has a default so a partial JSON object works."""
    font: str = "Anton"
    size: float = Field(1.0, ge=0.5, le=1.8)  # multiple of the default size
    text_color: str = "#FFFFFF"  # words not yet spoken (karaoke) / every word (no animation)
    active_color: str = ""  # spoken / current word; empty takes the caption preset's colour
    highlight_color: str = "#3DDC84"  # numbers, money, names and brands
    outline_color: str = "#000000"
    uppercase: bool = True
    words_per_line: int = Field(0, ge=0, le=12)  # 0 keeps the transcript's lines (up to 6 words)
    animation: str = "karaoke"  # karaoke | pop | none
    position: str = "lower"  # bottom | lower | middle | top
    y: Optional[float] = Field(None, ge=3, le=95)  # custom height, % of the video area from the bottom
    box: bool = False  # a dark box behind each line

    def font_name(self) -> str:
        return self.font if self.font in CAPTION_FONTS else "Anton"


def parse_caption_style(raw: str, preset: str) -> CaptionStyle:
    try:
        style = CaptionStyle(**json.loads(raw or "{}"))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"caption_style isn't valid: {exc}")
    if not style.active_color:
        style.active_color = PRESET_ACTIVE_COLORS.get(preset, "#FFFF00")
    if style.animation not in ("karaoke", "pop", "none"):
        style.animation = "karaoke"
    return style


def _ass_text(text: str) -> str:
    """Plain text safe for an ASS event: braces would start override tags."""
    return text.replace("{", "(").replace("}", ")").replace("\\", "/").replace("\n", " ").strip()


def _is_keyword(word: str, terms: set) -> bool:
    bare = re.sub(r"[^\w$%€£']", "", word).lower()
    return bool(NUMBER_PATTERN.search(word)) or (bare and bare in terms)


def keyword_terms(highlight_terms: Optional[List[str]]) -> set:
    return {
        re.sub(r"[^\w$%€£']", "", part).lower()
        for term in (highlight_terms or [])
        for part in term.split()
        if len(part) > 2
    }


def fmt_ass_time(seconds: float) -> str:
    safe = max(0.0, seconds)
    hrs = int(safe // 3600)
    mins = int((safe % 3600) // 60)
    secs = safe % 60
    return f"{hrs}:{mins:02d}:{secs:05.2f}"


def _text_lines(text: str, font_size: int, box_width: int) -> int:
    """Roughly how many lines `text` wraps to: bold display fonts run about 0.55 em per character."""
    per_line = max(8, int(box_width / (font_size * 0.55)))
    return max(1, -(-len(text) // per_line))


def generate_ass_subtitles(
    transcript_lines: List[dict],
    output_ass_path: Path,
    preset: str = "Hormozi Pop",
    width: int = 1080,
    height: int = 1920,
    margin_v: int = 480,
    highlight_terms: Optional[List[str]] = None,
    hook_text: str = "",
    hook_seconds: float = 3.0,
    hook_margin_top: int = 160,
    style: Optional[CaptionStyle] = None,
    title_text: str = "",
    watermark_text: str = "",
    watermark_position: str = "bottom-right",
    watermark_margin: tuple = (60, 60),  # (from the top, from the bottom) in pixels
    end_text: str = "",
    end_seconds: float = 3.0,
    duration: float = 0.0,
) -> None:
    """
    Writes an Advanced SubStation Alpha (.ASS) file with every text element of the clip:
    - captions `margin_v` from the bottom, animated karaoke (\\k fill), pop (current word
      grows) or none; numbers, money and `highlight_terms` (names, brands) in a highlight colour
    - `title_text`: a boxed title at the top for the whole clip; `hook_text` boxed below it
      (or at the top) for the first `hook_seconds`
    - `watermark_text` (an @handle) small and semi-transparent in a corner
    - `end_text`: an end card over a dimmed frame for the last `end_seconds` of `duration`
    """
    style = style or parse_caption_style("{}", preset)
    font = style.font_name()
    unit = min(width, height) / 1080 * FONT_SCALE.get(font, 1.0)
    font_size = round(72 * unit * style.size)
    outline = max(3, round(5 * min(width, height) / 1080 * style.size))
    side = round(width * 0.055)
    hook_size = round(72 * unit * 0.95)
    title_size = round(72 * unit * 0.8)
    mark_size = round(72 * unit * 0.5)
    end_size = round(72 * unit * 1.2)
    text_c, active_c = ass_color(style.text_color), ass_color(style.active_color)
    key_c, outline_c = ass_color(style.highlight_color), ass_color(style.outline_color)
    terms = keyword_terms(highlight_terms)
    # Karaoke shows SecondaryColour before a word is said and PrimaryColour after
    primary, secondary = (active_c, text_c) if style.animation == "karaoke" else (text_c, text_c)
    border, back = (3, "&H66000000") if style.box else (1, "&H80000000")

    title_top = hook_margin_top
    if title_text.strip():
        lines = _text_lines(title_text, title_size, width - 2 * side)
        hook_margin_top = title_top + round(lines * title_size * 1.25 + title_size * 0.9)
    mark_align = CORNER_ALIGN.get(watermark_position, 3)
    mark_v = watermark_margin[0] if mark_align in (7, 9) else watermark_margin[1]

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{font_size},{primary},{secondary},{outline_c},{back},-1,0,0,0,100,100,0,0,{border},{outline},2,2,{side},{side},{margin_v},1
Style: Hook,{font},{hook_size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,3,{round(hook_size * 0.28)},0,8,{side},{side},{hook_margin_top},1
Style: Title,{font},{title_size},&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,{round(title_size * 0.3)},0,8,{side},{side},{title_top},1
Style: Mark,{font},{mark_size},&H70FFFFFF,&H70FFFFFF,&H90000000,&H00000000,-1,0,0,0,100,100,1,0,1,{max(1, round(2 * unit))},0,{mark_align},{side},{side},{mark_v},1
Style: End,{font},{end_size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,{max(3, round(6 * unit))},0,5,{side},{side},0,1
Style: Shade,Arial,10,&H50000000,&H50000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    end_start = max(0.0, duration - end_seconds) if end_text.strip() and duration else None
    caption_end = end_start if end_start is not None else float("inf")
    full = fmt_ass_time(duration or 24 * 3600)
    events: List[str] = []
    if title_text.strip():
        events.append(f"Dialogue: 1,{fmt_ass_time(0)},{full},Title,,0,0,0,,{_ass_text(title_text)}")
    if hook_text.strip():
        events.append(
            f"Dialogue: 1,{fmt_ass_time(0)},{fmt_ass_time(hook_seconds)},Hook,,0,0,0,,{_ass_text(hook_text)}"
        )
    if watermark_text.strip():
        events.append(f"Dialogue: 4,{fmt_ass_time(0)},{full},Mark,,0,0,0,,{_ass_text(watermark_text)}")
    if end_start is not None:
        shade = f"{{\\p1}}m 0 0 l {width} 0 {width} {height} 0 {height}{{\\p0}}"
        fade = "{\\fad(250,0)}"
        events.append(f"Dialogue: 2,{fmt_ass_time(end_start)},{full},Shade,,0,0,0,,{fade}{shade}")
        events.append(
            f"Dialogue: 3,{fmt_ass_time(end_start)},{full},End,,0,0,0,,{fade}{_ass_text(end_text)}"
        )

    def show(word: str) -> str:
        text = _ass_text(word)
        return text.upper() if style.uppercase else text

    def colored(word: str, color: str, base: str) -> str:
        # Both karaoke colours set, so the word keeps its colour before and after it's said
        return f"{{\\1c{color}\\2c{color}}}{show(word)}{{\\1c{base}\\2c{secondary}}}"

    for line in transcript_lines:
        start, end = line["start_offset"], min(line["end_offset"], caption_end)
        if end - start < 0.05:
            continue
        words = line.get("words") or []
        if not words:
            events.append(
                f"Dialogue: 0,{fmt_ass_time(start)},{fmt_ass_time(end)},Default,,0,0,0,,{show(line['text'])}"
            )
            continue
        if style.animation == "pop":
            # One event per word: the line stays, the current word takes the active colour and pops
            for i, w in enumerate(words):
                w_start = start if i == 0 else w["start_time"]
                w_end = min(words[i + 1]["start_time"] if i + 1 < len(words) else end, caption_end)
                if w_end - w_start < 0.02:
                    continue
                tokens = []
                for j, other in enumerate(words):
                    if j == i:
                        pop = "\\fscx80\\fscy80\\t(0,90,\\fscx112\\fscy112)\\t(90,170,\\fscx100\\fscy100)"
                        tokens.append(f"{{\\1c{active_c}{pop}}}{show(other['word'])}{{\\1c{text_c}\\fscx100\\fscy100}}")
                    elif _is_keyword(other["word"], terms):
                        tokens.append(colored(other["word"], key_c, text_c))
                    else:
                        tokens.append(show(other["word"]))
                events.append(
                    f"Dialogue: 0,{fmt_ass_time(w_start)},{fmt_ass_time(w_end)},Default,,0,0,0,,{' '.join(tokens)}"
                )
            continue
        tokens = []
        for w in words:
            word = colored(w["word"], key_c, primary) if _is_keyword(w["word"], terms) else show(w["word"])
            if style.animation == "karaoke":
                dur_cs = max(5, int(round((w["end_time"] - w["start_time"]) * 100)))
                word = f"{{\\k{dur_cs}}}{word}"
            tokens.append(word)
        events.append(
            f"Dialogue: 0,{fmt_ass_time(start)},{fmt_ass_time(end)},Default,,0,0,0,,{' '.join(tokens)}"
        )

    output_ass_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


@app.get("/api/health")
async def health_check():
    ffmpeg_bin = shutil.which("ffmpeg")
    return {
        "status": "ok",
        "service": "clipperx-fastapi-worker",
        "ffmpeg_available": bool(ffmpeg_bin),
        "ffmpeg_path": ffmpeg_bin,
        "apiKeyConfigured": bool(os.environ.get("GEMINI_API_KEY")),
        "openrouterKeyConfigured": bool(os.environ.get("OPENROUTER_API_KEY")),
        "whisperModel": transcript_pipeline.WHISPER_MODEL,
        "defaultOpenrouterModel": transcript_pipeline.DEFAULT_OPENROUTER_MODEL,
    }


@app.get("/api/analyze")
async def analyze_status():
    return {
        "apiKeyConfigured": bool(os.environ.get("GEMINI_API_KEY")),
        "service": "clipperx-fastapi-worker",
    }


@app.post("/api/analyze-video")
def analyze_uploaded_video(
    video: Optional[UploadFile] = File(None),
    video_id: Optional[str] = Form(None),
    selectedModel: str = Form("gemini-flash-latest"),
    max_clips: int = Form(10),
):
    """
    Uploads the real video to the Gemini Files API, detects viral clips with word-level
    timing, and keeps a local copy so /api/render can cut it by `video_id`.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not configured.",
        )

    video_id, stored_path, source_name = resolve_source(video, video_id)
    duration = probe_duration_seconds(stored_path)
    client = genai.Client(api_key=api_key)
    model_name = resolve_model(selectedModel)
    max_clips = max(1, min(MAX_CLIPS_LIMIT, max_clips))

    mime_type = (video.content_type if video else None) or (
        mimetypes.guess_type(stored_path.name)[0] or "video/mp4"
    )
    gemini_file = client.files.upload(file=str(stored_path), config={"mime_type": mime_type})
    try:
        deadline = time.time() + 600
        while gemini_file.state and gemini_file.state.name == "PROCESSING":
            if time.time() > deadline:
                raise HTTPException(status_code=504, detail="Gemini file processing timed out.")
            time.sleep(3)
            gemini_file = client.files.get(name=gemini_file.name)
        if gemini_file.state and gemini_file.state.name == "FAILED":
            raise HTTPException(status_code=502, detail="Gemini could not process this video.")

        prompt = build_clip_prompt(
            max_clips=max_clips,
            word_timing=max_clips <= WORD_TIMING_CLIP_LIMIT,
            title=source_name,
            duration=duration,
        )
        clips = generate_clips(client, model_name, [gemini_file, prompt])
    finally:
        try:
            client.files.delete(name=gemini_file.name)
        except Exception:
            pass

    return {
        "clips": clips,
        "model": model_name,
        "video_id": video_id,
        "duration_seconds": duration,
    }


@app.post("/api/analyze-transcript")
def analyze_with_transcript(
    video: Optional[UploadFile] = File(None),
    video_id: Optional[str] = Form(None),
    llm_model: str = Form(transcript_pipeline.DEFAULT_OPENROUTER_MODEL),
    max_clips: int = Form(10),
    vocabulary: str = Form(""),  # names/terms, comma separated: guests, brands, shows
    min_seconds: float = Form(15),  # the campaign's clip length rules
    max_seconds: float = Form(90),
):
    """
    Transcribes the upload locally with Whisper, then lets an OpenRouter text model pick
    clips from the transcript. Captions use Whisper's measured word timings.
    """
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY environment variable is not configured.",
        )
    max_clips = max(1, min(MAX_CLIPS_LIMIT, max_clips))
    min_seconds = min(max(min_seconds, 5.0), 170.0)
    max_seconds = min(max(max_seconds, min_seconds + 5), 180.0)
    video_id, stored_path, _ = resolve_source(video, video_id)
    duration = probe_duration_seconds(stored_path)
    workdir = Path(tempfile.mkdtemp(prefix="clipperx_transcribe_"))
    try:
        started = time.time()
        terms = transcript_pipeline.parse_vocabulary(vocabulary)
        segments = transcript_pipeline.cached_transcript(stored_path, terms)
        transcript_reused = segments is not None
        if segments is None:
            segments = transcript_pipeline.transcribe(stored_path, workdir, terms)
            transcript_pipeline.save_transcript(stored_path, segments, terms)
        transcribe_seconds = time.time() - started
        if not segments:
            raise HTTPException(status_code=422, detail="No speech was found in this video.")
        started = time.time()
        candidates, llm_model = transcript_pipeline.pick_clips(
            segments, max_clips, llm_model, min_seconds, max_seconds
        )
        select_seconds = time.time() - started
        clips = transcript_pipeline.build_clips(
            candidates, segments, duration, min_seconds, max_seconds
        )
    except transcript_pipeline.PipelineError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    if not clips:
        raise HTTPException(status_code=422, detail="The model found no usable clips in this video.")
    return {
        "clips": clips,
        "model": llm_model,
        "video_id": video_id,
        "duration_seconds": duration,
        "timings": {
            "transcribe_seconds": round(transcribe_seconds, 1),
            "transcript_reused": transcript_reused,
            "select_seconds": round(select_seconds, 1),
        },
    }


@app.post("/api/clips-from-timestamps")
def clips_from_timestamps(
    video: Optional[UploadFile] = File(None),
    video_id: Optional[str] = Form(None),
    timestamps: str = Form(...),  # one clip per line, e.g. "54:38 to 56:22 "hook line""
    vocabulary: str = Form(""),
):
    """
    Clips at the moments the user (or the campaign brief) gives, no AI picking. Only those
    parts are transcribed, unless the whole video's transcript is already saved.
    """
    moments = transcript_pipeline.parse_timestamps(timestamps)
    if not moments:
        raise HTTPException(status_code=400, detail="No timestamps found. Put each clip on its own line, like 54:38 to 56:22.")
    if len(moments) > MAX_CLIPS_LIMIT:
        raise HTTPException(status_code=400, detail=f"At most {MAX_CLIPS_LIMIT} clips at once.")
    video_id, stored_path, _ = resolve_source(video, video_id)
    duration = probe_duration_seconds(stored_path)
    late = [m for m in moments if duration and m["ranges"][0][0] >= duration]
    if late:
        raise HTTPException(
            status_code=400,
            detail=f"{len(late)} timestamp(s) start after the video ends ({seconds_to_timestamp(duration)[:8]}). "
                   "Check that you added the right video.",
        )
    terms = transcript_pipeline.parse_vocabulary(vocabulary)
    workdir = Path(tempfile.mkdtemp(prefix="clipperx_transcribe_"))
    try:
        started = time.time()
        segments = transcript_pipeline.cached_transcript(stored_path, terms)
        transcript_reused = segments is not None
        if segments is None:
            ranges = [r for m in moments for r in m["ranges"]]
            segments = transcript_pipeline.transcribe_ranges(stored_path, workdir, ranges, terms)
        clips = transcript_pipeline.build_timestamp_clips(moments, segments, duration)
    except transcript_pipeline.PipelineError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return {
        "clips": clips,
        "model": "your timestamps",
        "video_id": video_id,
        "duration_seconds": duration,
        "timings": {"transcribe_seconds": round(time.time() - started, 1), "transcript_reused": transcript_reused},
    }


@app.post("/api/downloads/{job_id}/import")
def import_download(job_id: str):
    """Turns a finished link download into a stored video usable by analyze/render endpoints."""
    job = downloads.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown download.")
    if job.status != "done" or not job.path or not job.path.exists():
        raise HTTPException(status_code=409, detail="This download isn't finished.")

    suffix = job.path.suffix.lower().lstrip(".")
    if suffix in ("mp4", "mov", "webm", "mkv"):
        video_id = f"{uuid.uuid4().hex}.{suffix}"
        shutil.move(str(job.path), UPLOAD_DIR / video_id)
    else:
        # .flv, .ts, .3gp etc.: rewrap the same streams in MP4 without re-encoding
        video_id = f"{uuid.uuid4().hex}.mp4"
        run_ffmpeg(["ffmpeg", "-y", "-i", str(job.path), "-c", "copy", str(UPLOAD_DIR / video_id)])
        job.path.unlink(missing_ok=True)
    title = job.title
    downloads.remove(job_id)
    return {
        "video_id": video_id,
        "title": title,
        "duration_seconds": probe_duration_seconds(UPLOAD_DIR / video_id),
    }


app.include_router(build_download_router(downloads), prefix="/api/downloads")


@app.post("/api/analyze-url")
def analyze_youtube_url(
    url: str = Form(...),
    selectedModel: str = Form("gemini-flash-latest"),
    max_clips: int = Form(10),
):
    """
    Detects clips in a public YouTube video. Gemini fetches the video itself, so nothing is
    downloaded here and there is no `video_id`: rendering needs the file to be uploaded.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not configured.",
        )
    if not YOUTUBE_URL_PATTERN.match(url.strip()):
        raise HTTPException(status_code=400, detail="Only public YouTube video links are supported.")

    client = genai.Client(api_key=api_key)
    model_name = resolve_model(selectedModel)
    max_clips = max(1, min(MAX_CLIPS_LIMIT, max_clips))
    prompt = build_clip_prompt(
        max_clips=max_clips,
        word_timing=max_clips <= WORD_TIMING_CLIP_LIMIT,
        title=url.strip(),
        duration=None,
    )
    video_part = types.Part(file_data=types.FileData(file_uri=url.strip()))
    clips = generate_clips(client, model_name, [video_part, prompt])
    return {"clips": clips, "model": model_name, "video_id": None}


@app.post("/api/analyze")
async def analyze_video(payload: AnalyzeRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not configured.",
        )

    client = genai.Client(api_key=api_key)
    model_name = resolve_model(payload.selectedModel)

    prompt = (
        f"{GEMINI_CLIP_DETECTION_PROMPT}\n\n"
        f"Video Title: {payload.videoTitle}\n"
        f"Total Duration Seconds: {payload.videoDurationSeconds}\n"
        f"Source Context: {payload.transcriptContext or payload.youtubeUrl or 'Studio podcast analysis'}\n"
    )

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    raw_text = response.text or "[]"
    clips = json.loads(raw_text)
    return JSONResponse(content={"clips": clips, "model": model_name})


# Output canvases per aspect ratio
CANVAS_SIZES = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080), "16:9": (1920, 1080)}
IMAGE_TYPES = (".png", ".jpg", ".jpeg", ".webp")
MAX_IMAGE_BYTES = 10 * 1024 * 1024
LOGO_CORNERS = ("top-left", "top-right", "bottom-left", "bottom-right")


def even(value: float) -> int:
    return max(2, int(round(value / 2)) * 2)


def store_image(upload: Optional[UploadFile], workdir: Path, name: str) -> Optional[Path]:
    """Saves a banner/logo upload; returns its path, or None when nothing was sent."""
    if upload is None or not upload.filename:
        return None
    suffix = Path(upload.filename).suffix.lower()
    if suffix not in IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"{name.title()} must be a PNG, JPG or WebP image.")
    path = workdir / f"{name}{suffix}"
    with path.open("wb") as f:
        shutil.copyfileobj(upload.file, f)
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"{name.title()} image is over 10 MB.")
    return path


def save_to_output(rendered: Path, output_dir: Path, filename: str) -> Path:
    """Moves a render into the desktop app's clips folder under a safe, unused name."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", Path(filename).name).strip(" .") or "clip.mp4"
    if not name.lower().endswith(".mp4"):
        name += ".mp4"
    output_dir.mkdir(parents=True, exist_ok=True)
    dest = output_dir / name
    n = 1
    while dest.exists():
        dest = output_dir / f"{Path(name).stem} ({n}).mp4"
        n += 1
    shutil.move(str(rendered), dest)
    return dest


BROLL_VIDEO_TYPES = (".mp4", ".mov", ".webm", ".mkv")
MAX_BROLL_ITEMS = 12


def store_broll(files: List[UploadFile], spec_json: str, workdir: Path) -> List[dict]:
    """Pairs each uploaded B-roll file with its {start, duration, mode} from `spec_json`."""
    try:
        specs = json.loads(spec_json or "[]")
    except ValueError:
        raise HTTPException(status_code=400, detail="broll_json isn't valid JSON.")
    files = [f for f in files if f is not None and f.filename]
    if len(files) != len(specs):
        raise HTTPException(status_code=400, detail="Send one broll_json entry per B-roll file.")
    if len(files) > MAX_BROLL_ITEMS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_BROLL_ITEMS} B-roll inserts per clip.")
    items = []
    for i, (upload, spec) in enumerate(zip(files, specs)):
        suffix = Path(upload.filename).suffix.lower()
        if suffix not in IMAGE_TYPES + BROLL_VIDEO_TYPES:
            raise HTTPException(status_code=400, detail=f"B-roll {upload.filename} must be an image or a video.")
        path = workdir / f"broll{i}{suffix}"
        with path.open("wb") as f:
            shutil.copyfileobj(upload.file, f)
        try:
            start = max(0.0, float(spec.get("start", 0)))
            duration = min(max(float(spec.get("duration", 2.5)), 0.5), 15.0)
        except (TypeError, ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="B-roll start/duration must be numbers.")
        items.append({
            "path": path, "start": start, "duration": duration,
            "mode": "pip" if spec.get("mode") == "pip" else "full",
            "is_image": suffix in IMAGE_TYPES,
        })
    return items


def fit_inside(src_w: int, src_h: int, box_w: int, box_h: int) -> tuple:
    scale = min(box_w / src_w, box_h / src_h)
    return even(src_w * scale), even(src_h * scale)


def probe_has_audio(path: Path) -> bool:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return bool(proc.stdout.strip())


def fps_value(fps_expr: str) -> float:
    try:
        num, _, den = str(fps_expr).partition("/")
        value = float(num) / float(den or 1)
        return value if 1 <= value <= 240 else 30.0
    except (ValueError, ZeroDivisionError):
        return 30.0


# --- Saved campaign files (music, intros, outros) and campaign presets --------------------

_data_home = Path(os.environ.get("HF_HOME") or tempfile.gettempdir())
ASSET_DIR = Path(os.environ.get("CLIPPERX_ASSETS_DIR") or _data_home / "clipperx_assets")
PRESETS_FILE = Path(os.environ.get("CLIPPERX_PRESETS_FILE") or _data_home / "clipperx_presets.json")
AUDIO_TYPES = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac")
ASSET_ID_PATTERN = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{2,5}$")
MAX_ASSET_BYTES = 500 * 1024 * 1024
MAX_PRESETS_BYTES = 40 * 1024 * 1024


@app.post("/api/assets")
def upload_asset(file: UploadFile = File(...)):
    """Keeps a campaign file (music, intro/outro video, image) so renders can refer to it by id."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in IMAGE_TYPES + BROLL_VIDEO_TYPES + AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Send an image, a video or an audio file.")
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    tmp = ASSET_DIR / f"upload-{uuid.uuid4().hex}{suffix}"
    digest, size = hashlib.sha256(), 0
    with tmp.open("wb") as f:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_ASSET_BYTES:
                f.close()
                tmp.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="That file is over 500 MB.")
            digest.update(chunk)
            f.write(chunk)
    asset_id = f"{digest.hexdigest()[:32]}{suffix}"
    dest = ASSET_DIR / asset_id
    if dest.exists():
        tmp.unlink(missing_ok=True)  # the same file was saved before
    else:
        tmp.replace(dest)
    return {"asset_id": asset_id, "name": file.filename, "bytes": size}


def asset_path(asset_id: str, kinds: tuple, label: str) -> Optional[Path]:
    if not asset_id:
        return None
    path = ASSET_DIR / asset_id
    if not ASSET_ID_PATTERN.match(asset_id) or not path.exists():
        raise HTTPException(status_code=404, detail=f"The {label} file is missing; add it again.")
    if path.suffix not in kinds:
        raise HTTPException(status_code=400, detail=f"The {label} must be a {'video' if kinds == BROLL_VIDEO_TYPES else 'audio'} file.")
    return path


@app.get("/api/assets/{asset_id}")
def get_asset(asset_id: str):
    path = ASSET_DIR / asset_id
    if not ASSET_ID_PATTERN.match(asset_id) or not path.exists():
        raise HTTPException(status_code=404, detail="Unknown asset.")
    return FileResponse(path, media_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream")


@app.get("/api/presets")
def list_presets():
    try:
        return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"presets": []}


@app.put("/api/presets")
async def save_presets(request: Request):
    """Replaces the saved campaign presets: {"presets": [{"name": ..., ...settings}]}."""
    body = await request.body()
    if len(body) > MAX_PRESETS_BYTES:
        raise HTTPException(status_code=400, detail="Presets are too large; use smaller banner/logo images.")
    try:
        data = json.loads(body)
        assert isinstance(data.get("presets"), list)
    except (ValueError, AssertionError, AttributeError):
        raise HTTPException(status_code=400, detail='Send {"presets": [...]}.')
    PRESETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = PRESETS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(PRESETS_FILE)
    return {"saved": len(data["presets"])}


# --- Rendering ---------------------------------------------------------------------------

COLOR_FILTERS = {
    "none": "",
    "warm": "colorbalance=rs=0.06:gs=0.01:bs=-0.06,eq=saturation=1.08",
    "cool": "colorbalance=rs=-0.05:bs=0.06,eq=saturation=1.04",
    "contrast": "eq=contrast=1.12:saturation=1.15",
    "vivid": "eq=contrast=1.05:saturation=1.35",
    "cinematic": "eq=contrast=1.08:saturation=0.88,colorbalance=rh=0.04:bh=-0.04:rs=-0.02:bs=0.04",
    "bw": "hue=s=0,eq=contrast=1.1",
}
WATERMARK_POSITIONS = tuple(CORNER_ALIGN)


def extend_from_transcript(input_path: Path, vocabulary: List[str], words: List[dict],
                           start_s: float, end_s: float, new_start: float, new_end: float) -> List[dict]:
    """
    Adds caption words for time a trim added before/after the original clip, from the saved
    transcript (the clip only carries its own words). Words the user edited stay as they are.
    """
    if new_start >= start_s and new_end <= end_s:
        return words
    segments = transcript_pipeline.cached_transcript(input_path, vocabulary or None) or []
    extra = []
    for seg in segments:
        for w in seg.get("words") or []:
            outside = (new_start <= w["start"] < start_s) or (end_s < w["end"] <= new_end)
            if outside:
                extra.append({"word": w["word"].strip(), "start_time": round(w["start"] - new_start, 3),
                              "end_time": round(w["end"] - new_start, 3)})
    return sorted(words + extra, key=lambda w: w["start_time"])


def add_intro_outro(main: Path, intro: Optional[Path], outro: Optional[Path], workdir: Path,
                    W: int, H: int, fps: float) -> Path:
    """Joins intro + clip + outro, each scaled to the canvas; silent parts get silent audio."""
    parts = [p for p in (intro, main, outro) if p]
    inputs, chains, n = [], [], len(parts)
    for i, part in enumerate(parts):
        inputs += ["-i", str(part)]
    labels = []
    extra = n
    for i, part in enumerate(parts):
        chains.append(
            f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,"
            f"setsar=1,fps={fps:.3f},format=yuv420p[v{i}]"
        )
        if probe_has_audio(part):
            audio = f"[{i}:a]"
        else:
            inputs += ["-f", "lavfi", "-t", f"{probe_duration_seconds(part):.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
            audio = f"[{extra}:a]"
            extra += 1
        chains.append(f"{audio}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    chains.append(f"{''.join(labels)}concat=n={n}:v=1:a=1[v][a]")
    joined = workdir / "joined.mp4"
    run_ffmpeg([
        "ffmpeg", "-y", *inputs, "-filter_complex", ";".join(chains), "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(joined),
    ], cwd=workdir)
    return joined


@app.post("/api/render")
def render_vertical_short(
    video: Optional[UploadFile] = File(None),
    video_id: Optional[str] = Form(None),
    start_time: str = Form("00:00:00.000"),
    end_time: str = Form("00:00:45.000"),
    burn_captions: bool = Form(True),
    dynamic_zoom: bool = Form(True),
    caption_preset: str = Form("Hormozi Pop"),
    transcript_json: str = Form("[]"),
    aspect_ratio: str = Form("9:16"),
    framing: str = Form("auto"),  # auto | speaker | fit
    banner: Optional[UploadFile] = File(None),
    banner_position: str = Form("bottom"),  # bottom | top | background
    logo: Optional[UploadFile] = File(None),
    logo_position: str = Form("top-right"),
    logo_size: float = Form(0.16),  # share of the canvas width
    logo_opacity: float = Form(0.9),
    save: bool = Form(False),  # desktop app: write into CLIPPERX_OUTPUT_DIR instead of returning
    filename: str = Form(""),
    highlight_terms: str = Form(""),  # names/brands to colour in captions, comma separated
    hook_text: str = Form(""),  # boxed line at the top for the first hook_seconds
    hook_seconds: float = Form(3.0),
    broll: Optional[List[UploadFile]] = File(None),  # images/videos cut in over the clip
    broll_json: str = Form("[]"),  # [{"start": s, "duration": s, "mode": "full"|"pip"}] per file
    caption_style: str = Form("{}"),  # CaptionStyle JSON: font, size, colours, animation, position...
    title_text: str = Form(""),  # boxed title at the top for the whole clip
    watermark_text: str = Form(""),  # e.g. "@yourhandle", small and semi-transparent
    watermark_position: str = Form("bottom-right"),
    end_text: str = Form(""),  # end card, e.g. "Follow for more"
    end_seconds: float = Form(3.0),
    trim_start: float = Form(0.0),  # seconds added to the start (negative starts earlier)
    trim_end: float = Form(0.0),  # seconds added to the end (positive ends later)
    cut_silences: bool = Form(False),
    silence_gap: float = Form(0.6),  # pauses longer than this are cut
    speed: float = Form(1.0),
    color_filter: str = Form("none"),
    punch_zoom: bool = Form(False),  # zoom in briefly on highlighted words
    progress_bar: str = Form("none"),  # none | top | bottom
    progress_color: str = Form("#F2B705"),
    bleep_words: str = Form(""),  # comma separated; "word*" matches every word starting so
    bleep_mode: str = Form("beep"),  # beep | mute
    music_asset: str = Form(""),  # ids from /api/assets
    music_volume: float = Form(0.12),
    music_duck: bool = Form(True),  # music dips while people talk
    intro_asset: str = Form(""),
    outro_asset: str = Form(""),
    segments_json: str = Form(""),  # [[start, end], ...] from the clip start: keep only these parts
):
    """
    Renders one clip in a single FFmpeg pass (plus one to join an intro/outro):
    - framing: "speaker" crops a full-height shot that follows whoever is talking; "fit" shows
      the whole frame over a blurred copy; "auto" picks speaker crop when the clip is mostly
      people on camera
    - optional campaign banner as a header/footer (the video area shrinks to make room), or
      "background": the banner fills the frame behind the whole video
    - optional logo in a corner; B-roll images/videos over the video at given moments
    - captions in a chosen style, a hook line, a title, a text watermark and an end card
    - edits: trim, cut silences, speed, colour filter, punch-in zooms, progress bar,
      bleeped words, background music that ducks under speech
    """
    if aspect_ratio not in CANVAS_SIZES:
        raise HTTPException(status_code=400, detail=f"aspect_ratio must be one of {', '.join(CANVAS_SIZES)}.")
    if framing not in ("auto", "speaker", "fit"):
        raise HTTPException(status_code=400, detail="framing must be auto, speaker or fit.")
    if banner_position not in ("bottom", "top", "background") or logo_position not in LOGO_CORNERS:
        raise HTTPException(status_code=400, detail="Unknown banner or logo position.")
    if watermark_position not in WATERMARK_POSITIONS or progress_bar not in ("none", "top", "bottom"):
        raise HTTPException(status_code=400, detail="Unknown watermark or progress bar position.")
    if color_filter not in COLOR_FILTERS or bleep_mode not in ("beep", "mute"):
        raise HTTPException(status_code=400, detail="Unknown colour filter or bleep mode.")
    speed = min(max(speed, 0.75), 1.5)
    style = parse_caption_style(caption_style, caption_preset)

    workdir = Path(tempfile.mkdtemp(prefix="clipperx_render_"))
    ass_path = workdir / "clip.ass"
    final_path = workdir / "short.mp4"

    if video_id:
        if not VIDEO_ID_PATTERN.match(video_id) or not (UPLOAD_DIR / video_id).exists():
            raise HTTPException(status_code=404, detail="Unknown video_id; re-upload the video.")
        input_path = UPLOAD_DIR / video_id
    elif video is not None:
        input_path = workdir / "input.mp4"
        with input_path.open("wb") as f:
            shutil.copyfileobj(video.file, f)
    else:
        raise HTTPException(status_code=400, detail="Provide either `video` or `video_id`.")

    music_path = asset_path(music_asset, AUDIO_TYPES + BROLL_VIDEO_TYPES, "music")
    intro_path = asset_path(intro_asset, BROLL_VIDEO_TYPES, "intro")
    outro_path = asset_path(outro_asset, BROLL_VIDEO_TYPES, "outro")
    banner_path = store_image(banner, workdir, "banner")
    logo_path = store_image(logo, workdir, "logo")
    broll_items = store_broll(broll or [], broll_json, workdir)
    banner_behind = bool(banner_path) and banner_position == "background"
    W, H = CANVAS_SIZES[aspect_ratio]
    src_w, src_h, src_fps = probe_video_stream(input_path)
    fps = fps_value(src_fps)
    has_audio = probe_has_audio(input_path)

    # --- Time edits, worked out from the word timings
    start_s, end_s = edits.parse_seconds(start_time), edits.parse_seconds(end_time)
    if start_s is None or end_s is None:
        raise HTTPException(status_code=400, detail="start_time/end_time must look like 00:01:02.500.")
    new_start = max(0.0, start_s + trim_start)
    new_end = end_s + trim_end
    source_length = probe_duration_seconds(input_path)
    if source_length:
        new_end = min(new_end, source_length)
    length = new_end - new_start
    if length < 1:
        raise HTTPException(status_code=400, detail="The trimmed clip is shorter than a second.")
    start_time, end_time = seconds_to_timestamp(new_start), seconds_to_timestamp(new_end)

    vocabulary = transcript_pipeline.parse_vocabulary(highlight_terms)
    try:
        raw_lines = [TranscriptLineModel(**item).model_dump() for item in json.loads(transcript_json or "[]")]
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"transcript_json isn't valid: {exc}")
    words = edits.shift_words(edits.flatten_words(raw_lines), start_s - new_start, length)
    words = extend_from_transcript(input_path, vocabulary, words, start_s, end_s, new_start, new_end)
    terms = keyword_terms(vocabulary)
    bleeps = edits.find_words(words, bleep_words.split(",")) if bleep_words.strip() else []
    if bleeps:
        hits = set(bleeps)
        words = [{**w, "word": edits.mask_word(w["word"])} if (w["start_time"], w["end_time"]) in hits else w
                 for w in words]
    punches = edits.punch_moments(words, lambda word: _is_keyword(word, terms)) if punch_zoom else []
    keep = edits.speech_intervals(words, length, max(0.3, silence_gap)) if cut_silences else [(0.0, length)]
    if segments_json.strip():
        try:
            parts = [(float(s), float(e)) for s, e in json.loads(segments_json)]
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="segments_json must be [[start, end], ...].")
        # Same timeline as the words: shifted by any trim of the clip's start
        shift = start_s - new_start
        parts = [(max(0.0, s + shift), min(length, e + shift)) for s, e in parts]
        keep = edits.intersect(keep, [p for p in parts if p[1] - p[0] > 0.05]) or [(0.0, length)]
    tmap = edits.TimeMap(keep, speed)
    duration = tmap.duration
    caption_lines = edits.group_lines(edits.remap_words(words, tmap), style.words_per_line or 6)

    # Banner: full canvas width, at most 30% of the height; the video gets what's left
    BH = 0
    if banner_path and not banner_behind:
        b_w, b_h, _ = probe_video_stream(banner_path)
        BH = min(even(W * b_h / b_w), even(H * 0.3))
    AW, AH = W, H - BH

    inputs = ["-ss", start_time, "-to", end_time, "-i", str(input_path)]
    filters = []

    plan = None
    if framing != "fit" and not banner_behind:  # a background banner needs the whole frame visible
        plan = reframe.plan(
            input_path, start_time, end_time, src_w, src_h,
            out_aspect=AW / AH, force=(framing == "speaker"),
        )
    if plan:
        filters.append(f"[0:v]{reframe.crop_filter(plan, src_h, AW, AH)}[content]")
        layout = "speaker"
    else:
        fg_w, fg_h = fit_inside(src_w, src_h, AW, AH)
        if dynamic_zoom and not punches:
            # zoompan needs explicit size and fps, or it distorts and drifts out of audio sync
            fg = (f"scale={fg_w}:{fg_h},zoompan=z='if(mod(floor(time/4.5),2),1.12,1.0)':d=1"
                  f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={fg_w}x{fg_h}:fps={src_fps}")
        else:
            fg = f"scale={fg_w}:{fg_h}"
        next_input = 1
        if banner_behind:
            # The campaign's banner behind the video: a darkened, blurred copy fills the frame
            # and the whole banner sits sharp in the space above the video. (Stretching a wide
            # Twitch banner to fill a tall frame would only show a zoomed-in slice of it.)
            top_space = max(2, (AH - fg_h) // 2)
            bnr_w, bnr_h = fit_inside(*probe_video_stream(banner_path)[:2], AW, max(2, round(top_space * 0.62)))
            inputs += ["-loop", "1", "-i", str(banner_path)]
            filters += [
                f"[{next_input}:v]split[bannerbg][bannersharp]",
                f"[bannerbg]scale={AW}:{AH}:force_original_aspect_ratio=increase,crop={AW}:{AH},"
                f"boxblur=20:2,eq=brightness=-0.18,setsar=1[bg]",
                f"[bannersharp]scale={bnr_w}:{bnr_h},setsar=1[bannertop]",
                # just above the video, leaving the top of the frame free for the hook line
                f"[bg][bannertop]overlay=(W-w)/2:{max(0, top_space - bnr_h - 24)}[bgb]",
                f"[0:v]{fg},setsar=1[fg]",
                "[bgb][fg]overlay=(W-w)/2:(H-h)/2:shortest=1[content]",
            ]
            next_input += 1
        else:
            # Blur at quarter size and scale up: looks the same, a fraction of the work
            bw, bh = even(AW / 4), even(AH / 4)
            filters += [
                "[0:v]split[a][b]",
                f"[a]scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},"
                f"boxblur=8:2,scale={AW}:{AH},setsar=1[bg]",
                f"[b]{fg},setsar=1[fg]",
                "[bg][fg]overlay=(W-w)/2:(H-h)/2[content]",
            ]
        layout = "fit"
    if plan:
        next_input = 1

    canvas = "content"
    # Colour filter and punch-in zooms touch only the video, not banner, logo or B-roll
    looks = []
    if COLOR_FILTERS[color_filter]:
        looks.append(COLOR_FILTERS[color_filter])
    if punches:
        zoom_on = edits.select_expr(punches).replace("(t,", "(it,")  # zoompan's clock is `it`
        looks.append(f"zoompan=z='if({zoom_on},1.15,1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                     f":s={AW}x{AH}:fps={src_fps}")
    if looks:
        filters.append(f"[content]{','.join(looks)}[looked]")
        canvas = "looked"

    # B-roll cut-ins over the video area, each only during its own moment
    for i, item in enumerate(broll_items):
        start, dur = item["start"], item["duration"]
        if item["is_image"]:
            inputs += ["-loop", "1", "-t", f"{dur + 0.5:.2f}", "-i", str(item["path"])]
        else:
            inputs += ["-t", f"{dur:.2f}", "-i", str(item["path"])]
        if item["mode"] == "pip":
            pw = even(AW * 0.86)
            ph = even(pw * 9 / 16)
            fit = f"scale={pw}:{ph}:force_original_aspect_ratio=increase,crop={pw}:{ph}"
            pos = f"(W-w)/2:{round(AH * 0.1)}"
        else:
            fit = f"scale={AW}:{AH}:force_original_aspect_ratio=increase,crop={AW}:{AH}"
            pos = "0:0"
        filters.append(
            f"[{next_input}:v]{fit},setsar=1,format=yuv420p,setpts=PTS-STARTPTS+{start:.3f}/TB[broll{i}]"
        )
        filters.append(
            f"[{canvas}][broll{i}]overlay={pos}:enable='between(t,{start:.3f},{start + dur:.3f})'"
            f":eof_action=pass[withbroll{i}]"
        )
        canvas = f"withbroll{i}"
        next_input += 1
    if banner_path and not banner_behind:
        inputs += ["-loop", "1", "-i", str(banner_path)]
        filters.append(
            f"[{next_input}:v]scale={W}:{BH}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{BH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[banner]"
        )
        order = f"[banner][{canvas}]" if banner_position == "top" else f"[{canvas}][banner]"
        filters.append(f"{order}vstack=inputs=2:shortest=1[withbanner]")
        canvas = "withbanner"
        next_input += 1

    if logo_path:
        inputs += ["-loop", "1", "-i", str(logo_path)]
        lw = even(W * min(max(logo_size, 0.04), 0.5))
        opacity = min(max(logo_opacity, 0.05), 1.0)
        margin = round(W * 0.04)
        # Keep the logo inside the video area, clear of a header/footer banner
        top = margin + (BH if banner_path and banner_position == "top" else 0)
        bottom = f"H-h-{margin + (BH if banner_path and banner_position == 'bottom' else 0)}"
        x = str(margin) if logo_position.endswith("left") else f"W-w-{margin}"
        y = str(top) if logo_position.startswith("top") else bottom
        filters.append(f"[{next_input}:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa={opacity}[logo]")
        filters.append(f"[{canvas}][logo]overlay={x}:{y}:shortest=1[withlogo]")
        canvas = "withlogo"
        next_input += 1

    # Cut silences and change speed after compositing, so B-roll and zoom times stay in clip time
    keep_expr = edits.select_expr(keep)
    timing = []
    if tmap.cuts_anything:
        timing.append(f"select='{keep_expr}',setpts=N/{fps:.5f}/TB")
    if speed != 1:
        timing.append(f"setpts=PTS/{speed:.4f}")
    if timing:
        filters.append(f"[{canvas}]{','.join(timing)}[timed]")
        canvas = "timed"

    if progress_bar != "none":
        bar_h = even(H * 0.008)
        inputs += ["-f", "lavfi", "-i", f"color=c=0x{progress_color.lstrip('#')[:6] or 'F2B705'}:s={W}x{bar_h}:r={fps:.3f}"]
        bar_y = 0 if progress_bar == "top" else H - bar_h
        filters.append(f"[{canvas}][{next_input}:v]overlay=x='-w+w*t/{duration:.3f}':y={bar_y}:shortest=1[withbar]")
        canvas = "withbar"
        next_input += 1

    lines_to_burn = caption_lines if burn_captions else []
    if lines_to_burn or any(s.strip() for s in (hook_text, title_text, watermark_text, end_text)):
        # Captions 30% up the video area by default: clear of the Reels/Shorts buttons and
        # caption at the bottom, below faces; and above a footer banner when there is one
        lift = style.y if style.y is not None else CAPTION_POSITIONS.get(style.position, 30)
        margin_v = round(AH * lift / 100) + (BH if banner_path and banner_position == "bottom" else 0)
        top_bh = BH if banner_path and banner_position == "top" else 0
        bottom_bh = BH if banner_path and banner_position == "bottom" else 0
        hook_top = round(AH * 0.07) + top_bh
        generate_ass_subtitles(
            lines_to_burn, ass_path, preset=caption_preset, width=W, height=H, margin_v=margin_v,
            highlight_terms=vocabulary, hook_text=hook_text, hook_seconds=hook_seconds,
            hook_margin_top=hook_top, style=style, title_text=title_text,
            watermark_text=watermark_text, watermark_position=watermark_position,
            watermark_margin=(round(H * 0.04) + top_bh, round(AH * 0.2) + bottom_bh),
            end_text=end_text, end_seconds=min(max(end_seconds, 1.0), 10.0), duration=duration,
        )
        if FONTS_DIR.is_dir():
            shutil.copytree(FONTS_DIR, workdir / "fonts")
        # Relative names (FFmpeg runs in workdir) avoid filter-escaping drive letters like C:
        filters.append(f"[{canvas}]subtitles={ass_path.name}:fontsdir=fonts[out]")
        canvas = "out"

    # --- Audio: bleeps, then the same cuts and speed as the video, then music under it
    audio_filters, audio = [], None
    if has_audio:
        audio = "0:a"
        if bleeps:
            hit = edits.select_expr(bleeps)
            if bleep_mode == "beep":
                inputs += ["-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=48000"]
                audio_filters += [
                    f"[0:a]volume=0:enable='{hit}'[muted]",
                    f"[{next_input}:a]volume=0.25,volume=0:enable='not({hit})'[beep]",
                    "[muted][beep]amix=inputs=2:duration=first:normalize=0[bleeped]",
                ]
                next_input += 1
            else:
                audio_filters.append(f"[0:a]volume=0:enable='{hit}'[bleeped]")
            audio = "bleeped"
        timing = []
        if tmap.cuts_anything:
            timing.append(f"aselect='{keep_expr}',asetpts=N/SR/TB")
        if speed != 1:
            timing.append(f"atempo={speed:.4f}")
        if timing:
            audio_filters.append(f"[{audio}]{','.join(timing)}[atimed]")
            audio = "atimed"
    if music_path:
        inputs += ["-stream_loop", "-1", "-i", str(music_path)]
        volume = min(max(music_volume, 0.0), 1.0)
        audio_filters.append(
            f"[{next_input}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={volume:.3f}[music]"
        )
        next_input += 1
        if audio:
            audio_filters.append(f"[{audio}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[voice]")
            if music_duck:
                audio_filters += [
                    "[voice]asplit=2[voicemix][voicekey]",
                    "[music][voicekey]sidechaincompress=threshold=0.03:ratio=10:attack=15:release=350[ducked]",
                    "[voicemix][ducked]amix=inputs=2:duration=first:normalize=0[mixed]",
                ]
            else:
                audio_filters.append("[voice][music]amix=inputs=2:duration=first:normalize=0[mixed]")
        else:
            audio_filters.append(f"[music]atrim=0:{duration:.3f}[mixed]")
        audio = "mixed"

    audio_map = ["-map", f"[{audio}]"] if audio_filters else ["-map", "0:a?"]
    render_cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(filters + audio_filters),
        "-map", f"[{canvas}]", *audio_map,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-t", f"{duration:.3f}", "-shortest", "-movflags", "+faststart",
        str(final_path),
    ]
    run_ffmpeg(render_cmd, cwd=workdir)
    if intro_path or outro_path:
        final_path = add_intro_outro(final_path, intro_path, outro_path, workdir, W, H, fps)

    output_dir = os.environ.get("CLIPPERX_OUTPUT_DIR")
    if save and output_dir:
        saved = save_to_output(final_path, Path(output_dir), filename or f"clipperx_short_{W}x{H}.mp4")
        shutil.rmtree(workdir, ignore_errors=True)
        return {"saved_to": str(saved), "layout": layout}

    return FileResponse(
        path=str(final_path),
        media_type="video/mp4",
        filename=f"clipperx_short_{W}x{H}.mp4",
        headers={"X-ClipperX-Layout": layout},
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )
