"""
ClipperX Backend Worker — FastAPI + Gemini Multimodal API + FFmpeg 9:16 Pipeline
"""

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

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, Field
from vidgrab import DownloadManager
from vidgrab.server import build_router as build_download_router

from app import transcript_pipeline

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


def generate_ass_subtitles(
    transcript_lines: List[TranscriptLineModel],
    output_ass_path: Path,
    preset: str = "Hormozi Pop",
) -> None:
    """Writes an Advanced SubStation Alpha (.ASS) subtitle file with word-level \\k karaoke tags."""
    primary_color = "&H0000FFFF"  # Neon Yellow in ASS BGR
    if preset == "Cyber Neon":
        primary_color = "&H00FFFF00"  # Cyan in ASS BGR
    elif preset == "Red Highlight":
        primary_color = "&H000000FF"  # Red in ASS BGR

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,72,{primary_color},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,60,60,480,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    def fmt_ass_time(seconds: float) -> str:
        safe = max(0.0, seconds)
        hrs = int(safe // 3600)
        mins = int((safe % 3600) // 60)
        secs = safe % 60
        return f"{hrs}:{mins:02d}:{secs:05.2f}"

    events: List[str] = []
    for line in transcript_lines:
        s_str = fmt_ass_time(line.start_offset)
        e_str = fmt_ass_time(line.end_offset)
        if line.words:
            k_tokens = []
            for w in line.words:
                dur_cs = max(5, int(round((w.end_time - w.start_time) * 100)))
                k_tokens.append(f"{{\\k{dur_cs}}}{w.word.upper()}")
            events.append(
                f"Dialogue: 0,{s_str},{e_str},Default,,0,0,0,,{' '.join(k_tokens)}"
            )
        else:
            events.append(
                f"Dialogue: 0,{s_str},{e_str},Default,,0,0,0,,{line.text.upper()}"
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
    video_id, stored_path, _ = resolve_source(video, video_id)
    duration = probe_duration_seconds(stored_path)
    workdir = Path(tempfile.mkdtemp(prefix="clipperx_transcribe_"))
    try:
        started = time.time()
        segments = transcript_pipeline.transcribe(stored_path, workdir)
        transcribe_seconds = time.time() - started
        if not segments:
            raise HTTPException(status_code=422, detail="No speech was found in this video.")
        started = time.time()
        candidates = transcript_pipeline.select_clips(segments, max_clips, llm_model)
        select_seconds = time.time() - started
        clips = transcript_pipeline.build_clips(candidates, segments, duration)
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
            "select_seconds": round(select_seconds, 1),
        },
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
):
    """
    Executes the FFmpeg 9:16 Dual-Layer Blur Fill + Dynamic Zoom + .ASS Subtitle Burn-In pipeline.
    """
    workdir = Path(tempfile.mkdtemp(prefix="clipperx_render_"))
    raw_cut_path = workdir / "output_raw.mp4"
    ass_path = workdir / "clip.ass"
    final_path = workdir / "short_1080x1920.mp4"

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

    # 1. Timestamp Extraction & Cutting
    cut_cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        start_time,
        "-to",
        end_time,
        "-i",
        str(input_path),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        str(raw_cut_path),
    ]
    run_ffmpeg(cut_cmd)

    # 2. 9:16 Vertical Formatting (Dual-Layer Blur Fill) + Optional 1.12x Zoom + .ASS Subtitles
    if dynamic_zoom:
        # zoompan needs an explicit size and frame rate; its defaults (hd720-ish, 25 fps)
        # distort non-16:9 sources and stretch 30/60 fps clips out of audio sync
        src_w, src_h, src_fps = probe_video_stream(raw_cut_path)
        fg_h = max(2, round(1080 * src_h / src_w / 2) * 2)
        fg_scale = (
            f"scale=1080:{fg_h},zoompan=z='if(mod(floor(time/4.5),2),1.12,1.0)':d=1"
            f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x{fg_h}:fps={src_fps}"
        )
    else:
        fg_scale = "scale=1080:-2"

    vf_chain = (
        "split[a][b];"
        "[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
        f"[b]{fg_scale}[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2"
    )

    if burn_captions:
        raw_lines = json.loads(transcript_json)
        parsed_lines = [TranscriptLineModel(**item) for item in raw_lines]
        if parsed_lines:
            generate_ass_subtitles(parsed_lines, ass_path, preset=caption_preset)
            # Relative name (FFmpeg runs in workdir) avoids filter-escaping drive letters like C:
            vf_chain += f",subtitles={ass_path.name}"

    render_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(raw_cut_path),
        "-vf",
        vf_chain,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(final_path),
    ]
    run_ffmpeg(render_cmd, cwd=workdir)

    return FileResponse(
        path=str(final_path),
        media_type="video/mp4",
        filename="clipperx_short_1080x1920.mp4",
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )
