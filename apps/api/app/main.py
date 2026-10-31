"""
ClipperX Backend Worker — FastAPI + Gemini Multimodal API + FFmpeg 9:16 Pipeline
"""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

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
    "reasoning": "Why this moment is highly engaging"
  }
]
"""


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
    selectedModel: Optional[str] = "gemini-2.5-flash"


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
    }


@app.get("/api/analyze")
async def analyze_status():
    return {
        "apiKeyConfigured": bool(os.environ.get("GEMINI_API_KEY")),
        "service": "clipperx-fastapi-worker",
    }


@app.post("/api/analyze")
async def analyze_video(payload: AnalyzeRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not configured.",
        )

    client = genai.Client(api_key=api_key)
    model_name = payload.selectedModel or "gemini-2.5-flash"

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
async def render_vertical_short(
    video: UploadFile = File(...),
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
    input_path = workdir / "input.mp4"
    raw_cut_path = workdir / "output_raw.mp4"
    ass_path = workdir / "clip.ass"
    final_path = workdir / "short_1080x1920.mp4"

    with input_path.open("wb") as f:
        shutil.copyfileobj(video.file, f)

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
    subprocess.run(cut_cmd, check=True, capture_output=True)

    # 2. 9:16 Vertical Formatting (Dual-Layer Blur Fill) + Optional 1.12x Zoom + .ASS Subtitles
    fg_scale = (
        "scale=1080:-1,zoompan=z='if(mod(floor(time/4.5),2),1.12,1.0)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x608"
        if dynamic_zoom
        else "scale=1080:-1"
    )

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
            vf_chain += f",subtitles={ass_path.as_posix()}"

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
    subprocess.run(render_cmd, check=True, capture_output=True)

    return FileResponse(
        path=str(final_path),
        media_type="video/mp4",
        filename="clipperx_short_1080x1920.mp4",
    )
