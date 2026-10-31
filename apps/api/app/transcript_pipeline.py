"""
Transcript-first clip detection: local Whisper transcription + any OpenRouter text model.

Whisper gives real word-level timings from the audio, so captions come from measured
timestamps rather than model guesses, and the LLM only reads a compact transcript
(~15k tokens per hour of video) instead of the video itself.
"""

import json
import os
import subprocess
import wave
from pathlib import Path
from typing import List, Optional

import httpx
import numpy as np

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-v4.1-flash")

CLIP_SELECTION_PROMPT = """You are an expert short-form video editor. Below is a timestamped transcript of a long video. Each line is "[start-end] text" in seconds.

Pick up to {max_clips} standalone segments that would perform well as vertical Shorts:
1. Duration: ideally 30 to 60 seconds. A complete moment may be as short as 15 seconds; never pad a clip with unrelated speech to reach 30. Start and end on line boundaries from the transcript.
2. Hook: the first 5 seconds open with a bold claim, surprising fact, strong opinion, or emotional moment.
3. Standalone: the clip makes sense without the rest of the video.
4. Clips must not overlap. Spread them across the whole video.

Return ONLY a JSON object in this exact shape:
{"clips": [{"start_seconds": 12.3, "end_seconds": 58.1, "title": "Catchy hook title", "virality_score": 92, "hook_transcript": "First sentence spoken", "reasoning": "Why this moment works"}]}
virality_score is 0-100. Order clips from highest to lowest virality_score.

TRANSCRIPT:
{transcript}"""

_whisper = None


class PipelineError(RuntimeError):
    pass


def _get_whisper():
    # Loaded lazily: the first call downloads the model into HF_HOME (cached on a volume)
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel

        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _whisper


def transcribe(video_path: Path, workdir: Path) -> List[dict]:
    """Returns segments [{start, end, text, words: [{word, start, end}]}] in absolute seconds."""
    audio_path = workdir / "audio.wav"
    proc = subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise PipelineError(f"Could not extract audio: {proc.stderr.strip()[-500:]}")

    # Pass raw samples instead of a path: faster-whisper's own decoder (PyAV) breaks
    # across library versions, and FFmpeg has already produced 16 kHz mono PCM
    with wave.open(str(audio_path), "rb") as wav:
        pcm = wav.readframes(wav.getnframes())
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

    segments, _info = _get_whisper().transcribe(
        samples, word_timestamps=True, vad_filter=True
    )
    result = []
    for seg in segments:
        words = []
        for w in seg.words or []:
            if not w.word.strip():
                continue
            # Tokens without a leading space continue the previous word ("$10" + ",000")
            if words and not w.word.startswith(" "):
                words[-1]["word"] += w.word.strip()
                words[-1]["end"] = float(w.end)
            else:
                words.append({"word": w.word.strip(), "start": float(w.start), "end": float(w.end)})
        if words:
            result.append(
                {"start": float(seg.start), "end": float(seg.end), "text": seg.text.strip(), "words": words}
            )
    return result


def select_clips(segments: List[dict], max_clips: int, model: Optional[str]) -> List[dict]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise PipelineError("OPENROUTER_API_KEY environment variable is not configured.")

    transcript = "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in segments)
    prompt = CLIP_SELECTION_PROMPT.replace("{max_clips}", str(max_clips)).replace(
        "{transcript}", transcript
    )
    model_name = model or DEFAULT_OPENROUTER_MODEL
    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {api_key}", "X-Title": "ClipperX"},
            json={
                "model": model_name,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            timeout=300,
        )
    except httpx.HTTPError as exc:
        raise PipelineError(f"Could not reach OpenRouter: {exc}")

    data = response.json() if response.content else {}
    if response.status_code != 200 or "error" in data:
        message = (data.get("error") or {}).get("message") or response.text[:300]
        raise PipelineError(f"OpenRouter error ({model_name}): {message}")

    content = data["choices"][0]["message"].get("content") or ""
    # Some models wrap JSON in prose or code fences; take the outermost object
    start, end = content.find("{"), content.rfind("}")
    try:
        return json.loads(content[start : end + 1])["clips"]
    except (ValueError, KeyError, TypeError):
        raise PipelineError(f"{model_name} returned malformed clips: {content[:200]}")


def _timestamp(total: float) -> str:
    safe = max(0.0, total)
    return f"{int(safe // 3600):02d}:{int((safe % 3600) // 60):02d}:{safe % 60:06.3f}"


def _caption_lines(words: List[dict], clip_start: float) -> List[dict]:
    """Groups words into short caption lines, breaking on pauses, punctuation, or 6 words."""
    lines, current = [], []
    for i, w in enumerate(words):
        current.append(w)
        next_gap = words[i + 1]["start"] - w["end"] if i + 1 < len(words) else 99
        if len(current) >= 6 or next_gap > 0.6 or w["word"][-1:] in ".?!":
            lines.append(
                {
                    "start_offset": round(current[0]["start"] - clip_start, 3),
                    "end_offset": round(current[-1]["end"] - clip_start, 3),
                    "text": " ".join(x["word"] for x in current),
                    "words": [
                        {
                            "word": x["word"],
                            "start_time": round(x["start"] - clip_start, 3),
                            "end_time": round(x["end"] - clip_start, 3),
                        }
                        for x in current
                    ],
                }
            )
            current = []
    return lines


MIN_CLIP_SECONDS = 15


def build_clips(candidates: List[dict], segments: List[dict], duration: float) -> List[dict]:
    """
    Resolves overlaps (higher score keeps its range, lower-scored picks are trimmed to the
    free space), snaps to real word boundaries, and attaches Whisper captions.
    """
    all_words = [w for s in segments for w in s["words"]]
    picks = []
    for cand in candidates:
        try:
            picks.append((float(cand["start_seconds"]), float(cand["end_seconds"]), cand))
        except (KeyError, TypeError, ValueError):
            continue
    picks.sort(key=lambda p: int(p[2].get("virality_score") or 0), reverse=True)

    kept_ranges, built = [], []
    for start, end, cand in picks:
        original_start = start
        # Trim against every already-kept clip; the model often pads neighbours into each other
        for k_start, k_end in kept_ranges:
            if k_start <= start < k_end:
                start = k_end
            if start < k_start < end:
                end = k_start
        words = [w for w in all_words if w["start"] >= start - 0.05 and w["end"] <= end + 0.5]
        if not words:
            continue
        clip_start = max(0.0, words[0]["start"] - 0.1)
        clip_end = words[-1]["end"] + 0.3
        if duration:
            clip_end = min(duration, clip_end)
        if clip_end - clip_start < MIN_CLIP_SECONDS:
            continue
        kept_ranges.append((clip_start, clip_end))
        lines = _caption_lines(words, clip_start)
        hook = str(cand.get("hook_transcript") or "")
        if start != original_start or not hook:
            hook = lines[0]["text"]  # the model's hook was cut off by trimming
        built.append(
            {
                "title": str(cand.get("title") or "Untitled clip"),
                "start_time": _timestamp(clip_start),
                "end_time": _timestamp(clip_end),
                "duration_seconds": round(clip_end - clip_start, 2),
                "virality_score": max(0, min(100, int(cand.get("virality_score") or 0))),
                "hook_transcript": hook,
                "reasoning": str(cand.get("reasoning") or ""),
                "transcript_lines": lines,
            }
        )

    for i, clip in enumerate(built, start=1):
        clip["clip_id"] = i
    return built
