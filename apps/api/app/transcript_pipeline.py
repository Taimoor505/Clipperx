"""
Transcript-first clip detection: local Whisper transcription + any OpenRouter text model.

Whisper gives real word-level timings from the audio, so captions come from measured
timestamps rather than model guesses, and the LLM only reads a compact transcript
(~15k tokens per hour of video) instead of the video itself.
"""

import hashlib
import json
import os
import subprocess
import time
import wave
from pathlib import Path
from typing import List, Optional

import httpx
import numpy as np

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_BATCH = int(os.environ.get("WHISPER_BATCH", "8"))
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# "auto:free" walks FREE_MODEL_CHAIN (see pick_clips). Order from a test on an 85-minute
# podcast transcript: Nemotron 3 Ultra picked the same moments as paid DeepSeek, as full
# stories across the whole episode (69 s); Nemotron 3.5 Super picked them in 6 s but tighter;
# openrouter/free routes to whichever free model is up; dots-3 clustered its picks early.
AUTO_FREE = "auto:free"
FREE_MODEL_CHAIN = [
    m.strip()
    for m in os.environ.get(
        "FREE_MODEL_CHAIN",
        "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-super-vl:free,"
        "openrouter/free,dots-studio/dots-3-note-preview:free",
    ).split(",")
    if m.strip()
]
DEFAULT_OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", AUTO_FREE)

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
    # Loaded lazily: the first call downloads the model into HF_HOME (cached on a volume).
    # Batched inference transcribes several voice chunks at once and every core is used;
    # together that's several times faster than one chunk on four threads (the default).
    global _whisper
    if _whisper is None:
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        model = WhisperModel(
            WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4
        )
        _whisper = BatchedInferencePipeline(model=model)
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
        samples, word_timestamps=True, vad_filter=True, batch_size=WHISPER_BATCH
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


def _transcript_dir() -> Path:
    # Next to the Whisper model on the persistent volume when there is one
    base = os.environ.get("TRANSCRIPT_CACHE_DIR") or os.path.join(os.environ.get("HF_HOME", "/tmp"), "transcripts")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _fingerprint(video_path: Path) -> str:
    """Identifies a video by size plus its first and last 8 MB: fast even for multi-GB files."""
    chunk = 8 * 1024 * 1024
    size = video_path.stat().st_size
    digest = hashlib.sha256(str(size).encode())
    with video_path.open("rb") as f:
        digest.update(f.read(chunk))
        if size > chunk:
            f.seek(max(chunk, size - chunk))
            digest.update(f.read(chunk))
    return digest.hexdigest()[:32]


def _transcript_path(video_path: Path) -> Path:
    return _transcript_dir() / f"{_fingerprint(video_path)}.{WHISPER_MODEL}.json"


def cached_transcript(video_path: Path) -> Optional[List[dict]]:
    """The saved transcript of this exact video, so picking clips again skips Whisper."""
    try:
        return json.loads(_transcript_path(video_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save_transcript(video_path: Path, segments: List[dict]) -> None:
    try:
        _transcript_path(video_path).write_text(json.dumps(segments), encoding="utf-8")
    except OSError:
        pass  # caching is an optimisation; a failed write must not fail the request


SELECT_DEADLINE = float(os.environ.get("CLIP_PICK_TIMEOUT", "180"))


def _complete(api_key: str, model_name: str, prompt: str) -> str:
    """
    Streams one chat completion and returns its text. A plain request can't enforce a total
    time limit: OpenRouter sends keep-alive comments while a model thinks, so a read timeout
    never fires. Streaming lets us stop at SELECT_DEADLINE no matter what.
    """
    deadline = time.monotonic() + SELECT_DEADLINE
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        # Picking moments needs judgement, not long chains of reasoning. On an 85-minute podcast
        # DeepSeek thought for ~19k tokens (229 s) even at effort "low"; with thinking off it
        # answered in 31 s at a fifth of the cost. Models without reasoning ignore this.
        "reasoning": {"enabled": False},
        "stream": True,
    }
    parts: List[str] = []
    try:
        with httpx.stream(
            "POST", OPENROUTER_URL, json=payload, timeout=httpx.Timeout(30.0, read=60.0),
            headers={"Authorization": f"Bearer {api_key}", "X-Title": "ClipperX"},
        ) as response:
            if response.status_code != 200:
                body = response.read().decode("utf-8", "replace")
                try:
                    body = json.loads(body).get("error", {}).get("message") or body
                except ValueError:
                    pass
                raise PipelineError(f"OpenRouter error ({model_name}): {str(body)[:300]}")
            for line in response.iter_lines():
                if time.monotonic() > deadline:
                    raise PipelineError(
                        f"{model_name} took over {int(SELECT_DEADLINE)} s to pick clips. "
                        "Try again, or choose a faster clip-picking model."
                    )
                if not line.startswith("data: "):
                    continue  # ": OPENROUTER PROCESSING" keep-alives and blank lines
                data = line[6:]
                if data == "[DONE]":
                    break
                chunk = json.loads(data)
                if "error" in chunk:
                    raise PipelineError(f"OpenRouter error ({model_name}): {chunk['error'].get('message')}")
                delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
                parts.append(delta.get("content") or "")
    except httpx.HTTPError as exc:
        raise PipelineError(f"Could not reach OpenRouter: {exc}")
    text = "".join(parts)
    if not text.strip():
        raise PipelineError(f"{model_name} sent back an empty answer. Try again, or pick another model.")
    return text


def select_clips(segments: List[dict], max_clips: int, model: Optional[str]) -> List[dict]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise PipelineError("OPENROUTER_API_KEY environment variable is not configured.")

    transcript = "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in segments)
    prompt = CLIP_SELECTION_PROMPT.replace("{max_clips}", str(max_clips)).replace(
        "{transcript}", transcript
    )
    model_name = model or DEFAULT_OPENROUTER_MODEL
    content = _complete(api_key, model_name, prompt)
    # Some models wrap JSON in prose or code fences; take the outermost object
    start, end = content.find("{"), content.rfind("}")
    try:
        return json.loads(content[start : end + 1])["clips"]
    except (ValueError, KeyError, TypeError):
        raise PipelineError(f"{model_name} returned malformed clips: {content[:200]}")


def pick_clips(segments: List[dict], max_clips: int, model: Optional[str]) -> tuple:
    """
    Returns (candidates, model that answered). With AUTO_FREE, tries the free models in
    FREE_MODEL_CHAIN order: free models have daily limits and get busy, so when one is
    rate-limited or returns nothing usable the next one answers instead.
    """
    if model != AUTO_FREE:
        return select_clips(segments, max_clips, model), model or DEFAULT_OPENROUTER_MODEL
    failures = []
    for candidate in FREE_MODEL_CHAIN:
        try:
            clips = select_clips(segments, max_clips, candidate)
            if clips:
                return clips, candidate
            failures.append(f"{candidate}: no clips")
        except PipelineError as exc:
            failures.append(str(exc)[:160])
    raise PipelineError(
        "Every free model was busy or failed. Try again in a few minutes, or pick a paid model. "
        + " | ".join(failures)
    )


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
