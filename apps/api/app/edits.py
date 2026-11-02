"""
Time edits for one clip, worked out from its word timings before FFmpeg runs:
trimming, regrouping caption lines, cutting silences, speed, and finding words to bleep.

All times are seconds from the clip's start. A `TimeMap` turns a time in the cut clip into
its time in the final video (after removed pauses and the speed change).
"""
import re
from bisect import bisect_right
from typing import Iterable, List, Optional, Tuple

Interval = Tuple[float, float]


def flatten_words(lines: List[dict]) -> List[dict]:
    """Every word of every caption line, in order, as {word, start_time, end_time}."""
    words = []
    for line in lines:
        if line.get("words"):
            words += [dict(w) for w in line["words"]]
        elif line.get("text", "").strip():
            # A line without word timings: spread its words evenly over the line
            parts = line["text"].split()
            span = max(0.05, line["end_offset"] - line["start_offset"]) / len(parts)
            for i, part in enumerate(parts):
                start = line["start_offset"] + i * span
                words.append({"word": part, "start_time": start, "end_time": start + span})
    return words


def group_lines(words: List[dict], max_words: int) -> List[dict]:
    """Caption lines of at most `max_words`, also breaking on pauses and sentence ends."""
    lines, current = [], []
    for i, w in enumerate(words):
        current.append(w)
        next_gap = words[i + 1]["start_time"] - w["end_time"] if i + 1 < len(words) else 99
        if len(current) >= max_words or next_gap > 0.6 or w["word"][-1:] in ".?!":
            lines.append({
                "start_offset": current[0]["start_time"],
                "end_offset": current[-1]["end_time"],
                "text": " ".join(x["word"] for x in current),
                "words": current,
            })
            current = []
    return lines


def shift_words(words: List[dict], by: float, length: float) -> List[dict]:
    """Moves words by `by` seconds and drops the ones that fall outside 0..length."""
    out = []
    for w in words:
        s, e = w["start_time"] + by, w["end_time"] + by
        if e > 0.05 and s < length - 0.05:
            out.append({**w, "start_time": max(0.0, s), "end_time": min(length, e)})
    return out


def speech_intervals(words: List[dict], length: float, min_gap: float, pad: float = 0.12) -> List[Interval]:
    """
    The parts of the clip to keep when cutting silences: speech plus a little padding, with
    pauses longer than `min_gap` removed. Returns [(start, end)] covering 0..length when
    nothing is worth cutting.
    """
    if not words:
        return [(0.0, length)]
    keep: List[List[float]] = []
    for w in words:
        s, e = max(0.0, w["start_time"] - pad), min(length, w["end_time"] + pad)
        if keep and s - keep[-1][1] < min_gap:
            keep[-1][1] = max(keep[-1][1], e)
        else:
            keep.append([s, e])
    # Keep the clip's opening and closing frames when speech starts/ends right at the edges
    if keep[0][0] < min_gap:
        keep[0][0] = 0.0
    if length - keep[-1][1] < min_gap:
        keep[-1][1] = length
    return [(round(s, 3), round(e, 3)) for s, e in keep if e - s > 0.05]


class TimeMap:
    """Maps clip time to final-video time for kept intervals played at `speed`."""

    def __init__(self, keep: List[Interval], speed: float = 1.0):
        self.keep = keep
        self.speed = speed
        self.starts = [s for s, _ in keep]
        self.before = []  # kept seconds before each interval
        total = 0.0
        for s, e in keep:
            self.before.append(total)
            total += e - s
        self.kept_seconds = total

    @property
    def duration(self) -> float:
        return self.kept_seconds / self.speed

    def __call__(self, t: float) -> float:
        i = bisect_right(self.starts, t) - 1
        if i < 0:
            return 0.0
        s, e = self.keep[i]
        return (self.before[i] + min(t, e) - s) / self.speed

    @property
    def cuts_anything(self) -> bool:
        return len(self.keep) > 1 or self.keep[0][0] > 0.01


def remap_words(words: List[dict], tmap: TimeMap) -> List[dict]:
    out = []
    for w in words:
        s, e = tmap(w["start_time"]), tmap(w["end_time"])
        if e - s > 0.02:
            out.append({**w, "start_time": round(s, 3), "end_time": round(e, 3)})
    return out


def intersect(a: List[Interval], b: List[Interval]) -> List[Interval]:
    """The time covered by both lists of intervals."""
    out = []
    for s1, e1 in a:
        for s2, e2 in b:
            s, e = max(s1, s2), min(e1, e2)
            if e - s > 0.05:
                out.append((round(s, 3), round(e, 3)))
    return sorted(out)


def select_expr(keep: List[Interval]) -> str:
    """An FFmpeg select/aselect expression that keeps only these intervals."""
    return "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in keep)


def _bare(word: str) -> str:
    return re.sub(r"[^\w']", "", word).lower()


def find_words(words: List[dict], targets: Iterable[str]) -> List[Interval]:
    """Times of words matching `targets` (case-insensitive; "damn*" matches every damn... word)."""
    exact, prefixes = set(), []
    for t in targets:
        t = t.strip().lower()
        if t.endswith("*") and len(t) > 1:
            prefixes.append(_bare(t[:-1]))
        elif _bare(t):
            exact.add(_bare(t))
    hits = []
    for w in words:
        bare = _bare(w["word"])
        if bare and (bare in exact or any(bare.startswith(p) for p in prefixes)):
            hits.append((w["start_time"], w["end_time"]))
    return hits


def mask_word(word: str) -> str:
    """F*** for a bleeped word, keeping its punctuation."""
    match = re.search(r"[A-Za-z0-9]", word)
    if not match:
        return word
    i = match.start()
    letters = len(re.sub(r"[^\w]", "", word))
    return word[: i + 1] + "*" * max(2, letters - 1) + re.sub(r"[\w']", "", word[i + 1:])


def punch_moments(words: List[dict], is_key, hold: float = 1.2, spacing: float = 4.0) -> List[Interval]:
    """Moments to zoom in on: highlighted words, at least `spacing` seconds apart."""
    moments: List[Interval] = []
    for w in words:
        if is_key(w["word"]) and (not moments or w["start_time"] - moments[-1][0] >= spacing):
            moments.append((w["start_time"], w["start_time"] + hold))
    return moments


def parse_seconds(value: str) -> Optional[float]:
    """'00:01:02.500' or '62.5' to seconds."""
    try:
        parts = [float(p) for p in str(value).strip().split(":")]
    except ValueError:
        return None
    total = 0.0
    for p in parts:
        total = total * 60 + p
    return total
