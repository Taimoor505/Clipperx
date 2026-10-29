'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Type,
  Sparkles,
  RotateCcw,
  Clock,
  Scissors,
  Check,
  X,
  Plus,
  Minus,
  GripVertical,
  Flame,
  Film,
  Wand2,
  Edit3,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TranscriptLine, WordTiming } from './VerticalShortPlayer';

export interface TranscriptEditorProps {
  clipId?: number;
  clipTitle?: string;
  clipDuration?: number;
  transcriptLines: TranscriptLine[];
  onChangeTranscript?: (updatedLines: TranscriptLine[]) => void;
  onSeekPreviewTime?: (timeSeconds: number) => void;
}

const VIRAL_EMOJI_PALETTE = [
  { emoji: '💰', label: 'Money' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '🧠', label: 'Brain' },
  { emoji: '⚡', label: 'Zap' },
  { emoji: '⏱️', label: 'Time' },
  { emoji: '🎯', label: 'Target' },
  { emoji: '📈', label: 'Growth' },
];

const KEYWORD_EMOJI_MAP: Record<string, string> = {
  money: '💰',
  revenue: '💰',
  cash: '💰',
  profit: '💰',
  price: '💰',
  cost: '💰',
  viral: '🔥',
  fire: '🔥',
  hot: '🔥',
  insane: '🔥',
  crazy: '🔥',
  hook: '🔥',
  stop: '🔥',
  rocket: '🚀',
  scale: '🚀',
  launch: '🚀',
  growth: '🚀',
  fast: '🚀',
  boost: '🚀',
  brain: '🧠',
  smart: '🧠',
  ai: '🧠',
  gemini: '🧠',
  neurological: '🧠',
  mind: '🧠',
  time: '⏱️',
  seconds: '⏱️',
  intervals: '⏱️',
  moment: '⏱️',
  retention: '📈',
  attention: '⚡',
  spike: '⚡',
  power: '⚡',
  dynamic: '⚡',
};

const DEFAULT_FALLBACK_LINES: TranscriptLine[] = [
  {
    start_offset: 0.0,
    end_offset: 4.5,
    text: 'Stop cutting viral video on fixed time intervals',
    words: [
      { word: 'Stop', start_time: 0.0, end_time: 0.5 },
      { word: 'cutting', start_time: 0.5, end_time: 1.1 },
      { word: 'viral', start_time: 1.1, end_time: 1.7 },
      { word: 'video', start_time: 1.7, end_time: 2.3 },
      { word: 'on', start_time: 2.3, end_time: 2.6 },
      { word: 'fixed', start_time: 2.6, end_time: 3.1 },
      { word: 'time', start_time: 3.1, end_time: 3.7 },
      { word: 'intervals', start_time: 3.7, end_time: 4.5 },
    ],
  },
  {
    start_offset: 4.5,
    end_offset: 9.2,
    text: 'Wait for the natural sentence pause before punching in',
    words: [
      { word: 'Wait', start_time: 4.5, end_time: 5.0 },
      { word: 'for', start_time: 5.0, end_time: 5.3 },
      { word: 'the', start_time: 5.3, end_time: 5.6 },
      { word: 'natural', start_time: 5.6, end_time: 6.3 },
      { word: 'sentence', start_time: 6.3, end_time: 7.0 },
      { word: 'pause', start_time: 7.0, end_time: 7.6 },
      { word: 'before', start_time: 7.6, end_time: 8.2 },
      { word: 'punching', start_time: 8.2, end_time: 8.8 },
      { word: 'in', start_time: 8.8, end_time: 9.2 },
    ],
  },
  {
    start_offset: 9.2,
    end_offset: 14.0,
    text: 'That single 1.12x zoom resets viewer attention span',
    words: [
      { word: 'That', start_time: 9.2, end_time: 9.7 },
      { word: 'single', start_time: 9.7, end_time: 10.3 },
      { word: '1.12x', start_time: 10.3, end_time: 11.0 },
      { word: 'zoom', start_time: 11.0, end_time: 11.6 },
      { word: 'resets', start_time: 11.6, end_time: 12.3 },
      { word: 'viewer', start_time: 12.3, end_time: 12.9 },
      { word: 'attention', start_time: 12.9, end_time: 13.5 },
      { word: 'span', start_time: 13.5, end_time: 14.0 },
    ],
  },
];

function normalizeLinesWithWords(lines: TranscriptLine[]): TranscriptLine[] {
  const source = lines && lines.length > 0 ? lines : DEFAULT_FALLBACK_LINES;
  return source.map((line) => {
    const start = Number(line.start_offset.toFixed(2));
    const end = Number(Math.max(start + 0.4, line.end_offset).toFixed(2));
    if (line.words && line.words.length > 0) {
      const clonedWords = line.words.map((w) => ({
        word: w.word,
        start_time: Number(w.start_time.toFixed(2)),
        end_time: Number(w.end_time.toFixed(2)),
      }));
      return {
        start_offset: start,
        end_offset: end,
        text: clonedWords.map((w) => w.word).join(' '),
        words: clonedWords,
      };
    }

    const rawTokens = line.text
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const count = Math.max(1, rawTokens.length);
    const span = Math.max(0.4, end - start);
    const step = span / count;

    const synthesizedWords: WordTiming[] = rawTokens.map((tok, i) => ({
      word: tok,
      start_time: Number((start + i * step).toFixed(2)),
      end_time: Number((start + (i + 1) * step).toFixed(2)),
    }));

    return {
      start_offset: start,
      end_offset: end,
      text: synthesizedWords.map((w) => w.word).join(' '),
      words: synthesizedWords,
    };
  });
}

function formatTimecode(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}s`;
}

export default function TranscriptEditor({
  clipId = 1,
  clipTitle = 'Selected Short-Form Clip',
  clipDuration = 45.7,
  transcriptLines,
  onChangeTranscript,
  onSeekPreviewTime,
}: TranscriptEditorProps) {
  // Store normalized original copy per clipId so "Reset Transcript" works cleanly
  const initialLines = useMemo(
    () => normalizeLinesWithWords(transcriptLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipId]
  );

  const [lines, setLines] = useState<TranscriptLine[]>(() =>
    normalizeLinesWithWords(transcriptLines)
  );

  // Sync when switching to a different clipId
  useEffect(() => {
    setLines(normalizeLinesWithWords(transcriptLines));
    setActiveWordCoords(null);
    setHoveredRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  // Active Word Popover State
  const [activeWordCoords, setActiveWordCoords] = useState<{
    lineIdx: number;
    wordIdx: number;
  } | null>(null);
  const [draftWordText, setDraftWordText] = useState<string>('');
  const [draftWordStart, setDraftWordStart] = useState<number>(0);
  const [draftWordEnd, setDraftWordEnd] = useState<number>(0.5);

  // Hover state for Live Sync Preview on Timeline Bar
  const [hoveredRange, setHoveredRange] = useState<{
    start: number;
    end: number;
    label: string;
    type: 'word' | 'sentence';
    lineIdx: number;
    wordIdx?: number;
  } | null>(null);

  // Action feedback badge state
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Dragging handle state for Sentence Cut Boundaries
  const [draggingHandle, setDraggingHandle] = useState<{
    lineIdx: number;
    edge: 'start' | 'end';
  } | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);

  const maxTimelineWindow = useMemo(() => {
    const highestEnd = lines.reduce(
      (acc, l) => Math.max(acc, l.end_offset),
      14.0
    );
    return Math.max(15.0, Number((highestEnd + 1.5).toFixed(1)));
  }, [lines]);

  const commitLines = useCallback(
    (nextLines: TranscriptLine[], feedbackMsg?: string) => {
      setLines(nextLines);
      onChangeTranscript?.(nextLines);
      if (feedbackMsg) {
        setStatusFeedback(feedbackMsg);
        window.setTimeout(() => {
          setStatusFeedback((prev) => (prev === feedbackMsg ? null : prev));
        }, 2200);
      }
    },
    [onChangeTranscript]
  );

  // Open Word Edit Popover
  const handleSelectWord = (lineIdx: number, wordIdx: number) => {
    const targetWord = lines[lineIdx]?.words?.[wordIdx];
    if (!targetWord) return;
    setActiveWordCoords({ lineIdx, wordIdx });
    setDraftWordText(targetWord.word);
    setDraftWordStart(Number(targetWord.start_time.toFixed(2)));
    setDraftWordEnd(Number(targetWord.end_time.toFixed(2)));
    onSeekPreviewTime?.(targetWord.start_time);
  };

  // Save Word Edit Popover changes
  const handleSaveWordEdit = () => {
    if (!activeWordCoords) return;
    const { lineIdx, wordIdx } = activeWordCoords;
    const cleanedText = draftWordText.trim();
    if (!cleanedText) return;

    const validStart = Math.max(0, Number(draftWordStart.toFixed(2)));
    const validEnd = Math.max(
      Number((validStart + 0.05).toFixed(2)),
      Number(draftWordEnd.toFixed(2))
    );

    const nextLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIdx) return line;
      const updatedWords = (line.words || []).map((w, wIdx) =>
        wIdx === wordIdx
          ? {
              word: cleanedText,
              start_time: validStart,
              end_time: validEnd,
            }
          : w
      );
      const newLineStart = Math.min(
        line.start_offset,
        ...updatedWords.map((w) => w.start_time)
      );
      const newLineEnd = Math.max(
        line.end_offset,
        ...updatedWords.map((w) => w.end_time)
      );
      return {
        ...line,
        start_offset: Number(newLineStart.toFixed(2)),
        end_offset: Number(newLineEnd.toFixed(2)),
        text: updatedWords.map((w) => w.word).join(' '),
        words: updatedWords,
      };
    });

    commitLines(nextLines, `Updated "${cleanedText}"`);
    setActiveWordCoords(null);
  };

  // Insert Emoji directly into active word draft (and immediately apply if desired)
  const handleAppendEmojiToDraft = (emoji: string) => {
    setDraftWordText((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(emoji)) return trimmed;
      return `${trimmed} ${emoji}`;
    });
  };

  // Delete a word chip
  const handleDeleteWord = () => {
    if (!activeWordCoords) return;
    const { lineIdx, wordIdx } = activeWordCoords;
    const targetLine = lines[lineIdx];
    if (!targetLine || !targetLine.words || targetLine.words.length <= 1) {
      return;
    }

    const nextLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIdx) return line;
      const updatedWords = (line.words || []).filter(
        (_, wIdx) => wIdx !== wordIdx
      );
      return {
        ...line,
        text: updatedWords.map((w) => w.word).join(' '),
        words: updatedWords,
      };
    });

    commitLines(nextLines, 'Removed word chip');
    setActiveWordCoords(null);
  };

  // Sentence Cut Boundary Step Adjustment (±0.1s precision)
  const handleAdjustSentenceBoundary = useCallback(
    (lineIdx: number, edge: 'start' | 'end', deltaSec: number) => {
      const nextLines = lines.map((line, idx) => {
        if (idx !== lineIdx) return line;

        const oldStart = line.start_offset;
        const oldEnd = line.end_offset;
        const oldSpan = Math.max(0.2, oldEnd - oldStart);

        let newStart = oldStart;
        let newEnd = oldEnd;

        if (edge === 'start') {
          newStart = Math.max(
            0,
            Math.min(oldEnd - 0.3, Number((oldStart + deltaSec).toFixed(1)))
          );
        } else {
          newEnd = Math.max(
            oldStart + 0.3,
            Number((oldEnd + deltaSec).toFixed(1))
          );
        }

        const newSpan = Math.max(0.3, newEnd - newStart);

        // Proportionally rescale word timings inside this sentence so words stay cleanly aligned
        const rescaledWords = (line.words || []).map((w) => {
          const relStart = Math.max(0, (w.start_time - oldStart) / oldSpan);
          const relEnd = Math.min(1, (w.end_time - oldStart) / oldSpan);
          return {
            ...w,
            start_time: Number((newStart + relStart * newSpan).toFixed(2)),
            end_time: Number(
              Math.max(
                newStart + relStart * newSpan + 0.05,
                newStart + relEnd * newSpan
              ).toFixed(2)
            ),
          };
        });

        return {
          ...line,
          start_offset: newStart,
          end_offset: newEnd,
          words: rescaledWords,
        };
      });

      commitLines(nextLines);
    },
    [lines, commitLines]
  );

  // Pointer drag support for draggable sentence boundary handles (0.1s precision)
  useEffect(() => {
    if (!draggingHandle) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!timelineTrackRef.current) return;
      const rect = timelineTrackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
      );
      const snappedTime = Number((ratio * maxTimelineWindow).toFixed(1));

      setLines((prev) => {
        const target = prev[draggingHandle.lineIdx];
        if (!target) return prev;
        const oldStart = target.start_offset;
        const oldEnd = target.end_offset;
        const oldSpan = Math.max(0.2, oldEnd - oldStart);

        let newStart = oldStart;
        let newEnd = oldEnd;

        if (draggingHandle.edge === 'start') {
          newStart = Math.max(0, Math.min(oldEnd - 0.3, snappedTime));
        } else {
          newEnd = Math.max(
            oldStart + 0.3,
            Math.min(maxTimelineWindow, snappedTime)
          );
        }

        const newSpan = Math.max(0.3, newEnd - newStart);
        const rescaledWords = (target.words || []).map((w) => {
          const relStart = Math.max(0, (w.start_time - oldStart) / oldSpan);
          const relEnd = Math.min(1, (w.end_time - oldStart) / oldSpan);
          return {
            ...w,
            start_time: Number((newStart + relStart * newSpan).toFixed(2)),
            end_time: Number(
              Math.max(
                newStart + relStart * newSpan + 0.05,
                newStart + relEnd * newSpan
              ).toFixed(2)
            ),
          };
        });

        const updated = prev.map((line, i) =>
          i === draggingHandle.lineIdx
            ? {
                ...line,
                start_offset: newStart,
                end_offset: newEnd,
                words: rescaledWords,
              }
            : line
        );
        onChangeTranscript?.(updated);
        return updated;
      });
    };

    const handlePointerUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingHandle, maxTimelineWindow, onChangeTranscript]);

  // ACTION BAR 1: Auto-Capitalize All
  const handleAutoCapitalizeAll = () => {
    const allAlreadyUpper = lines.every((l) =>
      (l.words || []).every((w) => w.word === w.word.toUpperCase())
    );

    const nextLines = lines.map((line) => {
      const updatedWords = (line.words || []).map((w, idx) => {
        if (allAlreadyUpper) {
          // Convert back to clean sentence case if already all-caps
          const lower = w.word.toLowerCase();
          return {
            ...w,
            word:
              idx === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower,
          };
        }
        return {
          ...w,
          word: w.word.toUpperCase(),
        };
      });
      return {
        ...line,
        text: updatedWords.map((w) => w.word).join(' '),
        words: updatedWords,
      };
    });

    commitLines(
      nextLines,
      allAlreadyUpper
        ? 'Restored Sentence Casing'
        : 'Auto-Capitalized All Words (HORMOZI CAPS)'
    );
  };

  // ACTION BAR 2: Apply Viral Emojis
  const handleApplyViralEmojis = () => {
    let injectedCount = 0;

    const nextLines = lines.map((line, lineIdx) => {
      let lineHasEmoji = false;
      const updatedWords = (line.words || []).map((w, wordIdx) => {
        const cleanAlpha = w.word
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '')
          .trim();

        const matchedEmoji = KEYWORD_EMOJI_MAP[cleanAlpha];
        if (matchedEmoji && !w.word.includes(matchedEmoji)) {
          injectedCount++;
          lineHasEmoji = true;
          return {
            ...w,
            word: `${w.word} ${matchedEmoji}`,
          };
        }

        // Guarantee every sentence gets at least one viral emoji on its final punch word
        const isLastWord = wordIdx === (line.words?.length || 1) - 1;
        if (
          isLastWord &&
          !lineHasEmoji &&
          !/[\u{1F300}-\u{1FAFF}]/u.test(line.text)
        ) {
          const fallbackEmojis = ['🔥', '🚀', '💰', '⚡'];
          const fallback = fallbackEmojis[lineIdx % fallbackEmojis.length];
          if (!w.word.includes(fallback)) {
            injectedCount++;
            return {
              ...w,
              word: `${w.word} ${fallback}`,
            };
          }
        }

        return w;
      });

      return {
        ...line,
        text: updatedWords.map((w) => w.word).join(' '),
        words: updatedWords,
      };
    });

    commitLines(
      nextLines,
      injectedCount > 0
        ? `Injected ${injectedCount} Contextual Viral Emojis (💰 🔥 🚀)`
        : 'Viral Emojis Already Applied'
    );
  };

  // ACTION BAR 3: Reset Transcript
  const handleResetTranscript = () => {
    const freshCopy = normalizeLinesWithWords(initialLines);
    setActiveWordCoords(null);
    setHoveredRange(null);
    commitLines(freshCopy, 'Reset Transcript to Original AI Timestamps');
  };

  const totalWordsCount = useMemo(
    () => lines.reduce((sum, l) => sum + (l.words?.length || 0), 0),
    [lines]
  );

  return (
    <Card className="border-slate-800/90 bg-slate-900/60 backdrop-blur-md shadow-xl shadow-violet-950/10 overflow-hidden">
      {/* =====================================================================
          HEADER & UTILITY ACTION BAR
         ===================================================================== */}
      <CardHeader className="pb-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="text-base">
                Interactive Word-Level Transcript &amp; Cut Editor
              </CardTitle>
              <Badge variant="gradient" className="font-mono text-[10px]">
                Clip #{clipId} · {totalWordsCount} words
              </Badge>
              {statusFeedback && (
                <Badge
                  variant="green"
                  className="font-mono text-[10px] animate-in fade-in duration-200"
                >
                  <Check className="w-3 h-3" />
                  <span>{statusFeedback}</span>
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-400">
              Click any word chip to edit text, inject viral emojis (💰, 🔥, 🚀),
              or fine-tune word &amp; sentence cut boundaries with ±0.1s precision.
            </CardDescription>
          </div>

          {/* 4. Action Bar: Auto-Capitalize All, Apply Viral Emojis, Reset Transcript */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoCapitalizeAll}
              className="border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-200 cursor-pointer"
            >
              <Type className="w-3.5 h-3.5 text-cyan-400" />
              <span>Auto-Capitalize All</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyViralEmojis}
              className="border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Apply Viral Emojis</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetTranscript}
              className="border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Transcript</span>
            </Button>
          </div>
        </div>

        {/* ===================================================================
            3. LIVE SYNC PREVIEW TIMELINE BAR
            Hovering over any word or sentence highlights its exact frame range
           =================================================================== */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300 font-semibold uppercase tracking-wider">
                Live Frame Sync Timeline
              </span>
              {hoveredRange ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>
                    {hoveredRange.type === 'word' ? 'WORD' : 'SENTENCE'}: &ldquo;
                    {hoveredRange.label}&rdquo;
                  </span>
                  <span className="text-cyan-300 font-semibold">
                    [{hoveredRange.start.toFixed(2)}s →{' '}
                    {hoveredRange.end.toFixed(2)}s]
                  </span>
                  <span className="text-slate-400">
                    · Frame #{Math.round(hoveredRange.start * 60)}–
                    {Math.round(hoveredRange.end * 60)} @ 60fps
                  </span>
                </span>
              ) : (
                <span className="text-slate-500">
                  Hover any word chip or sentence block below to inspect frame
                  sync
                </span>
              )}
            </div>

            <div className="text-slate-400">
              <span>Window: 0.0s → {maxTimelineWindow.toFixed(1)}s</span>
              <span className="mx-1.5 text-slate-600">|</span>
              <span>Clip Total: {clipDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Interactive Timeline Bar with Sentence Blocks, Draggable Handles & Word Markers */}
          <div
            ref={timelineTrackRef}
            className="relative w-full h-10 rounded-lg bg-slate-950 border border-slate-800/90 overflow-hidden select-none"
          >
            {/* Subtle 1-second ruler ticks */}
            {Array.from({ length: Math.ceil(maxTimelineWindow) + 1 }).map(
              (_, secIdx) => {
                const leftPct = (secIdx / maxTimelineWindow) * 100;
                if (leftPct > 100) return null;
                return (
                  <div
                    key={secIdx}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 border-l border-slate-800/60 pointer-events-none"
                  >
                    {secIdx % 2 === 0 && (
                      <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-600 tabular-nums">
                        {secIdx}s
                      </span>
                    )}
                  </div>
                );
              }
            )}

            {/* Sentence Blocks & Word Tick Subdivisions */}
            {lines.map((line, lIdx) => {
              const leftPct = Math.max(
                0,
                Math.min(100, (line.start_offset / maxTimelineWindow) * 100)
              );
              const widthPct = Math.max(
                1.5,
                Math.min(
                  100 - leftPct,
                  ((line.end_offset - line.start_offset) / maxTimelineWindow) *
                    100
                )
              );
              const isSentenceHovered =
                hoveredRange?.lineIdx === lIdx &&
                hoveredRange?.type === 'sentence';

              return (
                <div
                  key={lIdx}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className={`absolute top-3.5 bottom-1.5 rounded-md transition-colors ${
                    isSentenceHovered
                      ? 'bg-violet-500/35 border border-violet-400 z-10'
                      : 'bg-slate-800/75 border border-slate-700/80'
                  }`}
                >
                  {/* Draggable Left Start Handle */}
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ lineIdx: lIdx, edge: 'start' });
                    }}
                    title={`Drag to adjust Sentence #${lIdx + 1} Start (${line.start_offset.toFixed(1)}s)`}
                    className="absolute left-0 top-0 bottom-0 w-2 bg-violet-400/80 hover:bg-cyan-400 cursor-ew-resize rounded-l flex items-center justify-center z-20"
                  />

                  {/* Sentence Label inside Track */}
                  <div className="px-2.5 h-full flex items-center justify-between text-[10px] font-mono text-slate-300 truncate pointer-events-none">
                    <span className="truncate">
                      S{lIdx + 1}: {line.text}
                    </span>
                  </div>

                  {/* Draggable Right End Handle */}
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ lineIdx: lIdx, edge: 'end' });
                    }}
                    title={`Drag to adjust Sentence #${lIdx + 1} End (${line.end_offset.toFixed(1)}s)`}
                    className="absolute right-0 top-0 bottom-0 w-2 bg-violet-400/80 hover:bg-cyan-400 cursor-ew-resize rounded-r flex items-center justify-center z-20"
                  />
                </div>
              );
            })}

            {/* Highlighted Word or Sentence Overlay Pulse on Hover */}
            {hoveredRange && (
              <div
                style={{
                  left: `${Math.max(
                    0,
                    Math.min(100, (hoveredRange.start / maxTimelineWindow) * 100)
                  )}%`,
                  width: `${Math.max(
                    1,
                    Math.min(
                      100,
                      ((hoveredRange.end - hoveredRange.start) /
                        maxTimelineWindow) *
                        100
                    )
                  )}%`,
                }}
                className="absolute top-0 bottom-0 bg-cyan-400/30 border-x-2 border-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.45)] pointer-events-none z-30 transition-all duration-75"
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-cyan-400 text-slate-950 font-mono font-bold text-[9px] rounded-b whitespace-nowrap">
                  {hoveredRange.start.toFixed(2)}s
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* =====================================================================
          SENTENCE ROWS, INTERACTIVE WORD CHIPS & INLINE POPOVER EDITOR
         ===================================================================== */}
      <CardContent className="pt-4 space-y-3.5">
        {lines.map((line, lineIdx) => {
          const isLineHovered = hoveredRange?.lineIdx === lineIdx;
          const sentenceDuration = Math.max(
            0.1,
            line.end_offset - line.start_offset
          );

          return (
            <div
              key={lineIdx}
              onMouseEnter={() =>
                setHoveredRange({
                  start: line.start_offset,
                  end: line.end_offset,
                  label: line.text,
                  type: 'sentence',
                  lineIdx,
                })
              }
              onMouseLeave={() =>
                setHoveredRange((prev) =>
                  prev?.lineIdx === lineIdx ? null : prev
                )
              }
              className={`rounded-xl border p-3.5 transition-all ${
                isLineHovered
                  ? 'border-violet-500/60 bg-slate-900/95 shadow-md shadow-violet-950/15'
                  : 'border-slate-800/90 bg-slate-950/65 hover:border-slate-700/80'
              }`}
            >
              {/* 2. Sentence Cut Boundaries Bar (±0.1s precision step buttons + timecodes) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[11px] font-mono font-semibold text-violet-300 tabular-nums">
                    <Scissors className="w-3 h-3" />
                    <span>SENTENCE #{lineIdx + 1}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    Duration: {sentenceDuration.toFixed(1)}s ·{' '}
                    {line.words?.length || 0} words
                  </span>
                </div>

                {/* Sentence Start & End Numerical Step Controls (±0.1s precision) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Sentence Start Timecode ±0.1s */}
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1">
                    <GripVertical className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      In:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAdjustSentenceBoundary(lineIdx, 'start', -0.1)
                      }
                      title="Decrease sentence start by 0.1s"
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                    >
                      -0.1s
                    </button>
                    <span className="px-1.5 text-xs font-mono font-semibold text-cyan-300 tabular-nums">
                      {formatTimecode(line.start_offset)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAdjustSentenceBoundary(lineIdx, 'start', 0.1)
                      }
                      title="Increase sentence start by 0.1s"
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                    >
                      +0.1s
                    </button>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:block" />

                  {/* Sentence End Timecode ±0.1s */}
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Out:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAdjustSentenceBoundary(lineIdx, 'end', -0.1)
                      }
                      title="Decrease sentence end by 0.1s"
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                    >
                      -0.1s
                    </button>
                    <span className="px-1.5 text-xs font-mono font-semibold text-violet-300 tabular-nums">
                      {formatTimecode(line.end_offset)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAdjustSentenceBoundary(lineIdx, 'end', 0.1)
                      }
                      title="Increase sentence end by 0.1s"
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                    >
                      +0.1s
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Interactive Word Blocks (Clickable Word Chips) */}
              <div className="flex flex-wrap items-center gap-2">
                {(line.words || []).map((wordObj, wordIdx) => {
                  const isWordSelected =
                    activeWordCoords?.lineIdx === lineIdx &&
                    activeWordCoords?.wordIdx === wordIdx;
                  const isWordHovered =
                    hoveredRange?.type === 'word' &&
                    hoveredRange?.lineIdx === lineIdx &&
                    hoveredRange?.wordIdx === wordIdx;
                  const hasEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(wordObj.word);

                  return (
                    <div key={wordIdx} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSelectWord(lineIdx, wordIdx)}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredRange({
                            start: wordObj.start_time,
                            end: wordObj.end_time,
                            label: wordObj.word,
                            type: 'word',
                            lineIdx,
                            wordIdx,
                          });
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          setHoveredRange({
                            start: line.start_offset,
                            end: line.end_offset,
                            label: line.text,
                            type: 'sentence',
                            lineIdx,
                          });
                        }}
                        className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                          isWordSelected
                            ? 'border-cyan-400 bg-cyan-500/20 text-white ring-2 ring-cyan-400/40 shadow-sm'
                            : isWordHovered
                            ? 'border-violet-400/80 bg-violet-500/20 text-white'
                            : hasEmoji
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:border-amber-400/70'
                            : 'border-slate-800 bg-slate-900/90 text-slate-200 hover:border-slate-700 hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="tracking-tight">{wordObj.word}</span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 group-hover:text-cyan-300">
                          {wordObj.start_time.toFixed(1)}s
                        </span>
                      </button>

                      {/* Inline Popover to edit word text, insert emojis, or adjust word start/end timestamps */}
                      {isWordSelected && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 p-3.5 rounded-xl border border-cyan-500/50 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/80 z-40 w-72 sm:w-80 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-[11px] font-mono font-semibold text-cyan-300 uppercase tracking-wider">
                              Edit Word Chip #{wordIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveWordCoords(null)}
                              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Word Text Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-slate-400">
                              Spoken Word / Caption Text
                            </label>
                            <input
                              type="text"
                              value={draftWordText}
                              onChange={(e) => setDraftWordText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveWordEdit();
                                }
                              }}
                              autoFocus
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          {/* Quick Viral Emoji Picker (💰, 🔥, 🚀, etc.) */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-slate-400">
                              Insert Viral Emoji
                            </label>
                            <div className="flex flex-wrap items-center gap-1">
                              {VIRAL_EMOJI_PALETTE.map((item) => (
                                <button
                                  key={item.emoji}
                                  type="button"
                                  onClick={() =>
                                    handleAppendEmojiToDraft(item.emoji)
                                  }
                                  title={`Insert ${item.label} (${item.emoji})`}
                                  className="px-2 py-1 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-cyan-500/40 text-sm transition-colors cursor-pointer"
                                >
                                  {item.emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Word Start / End Timestamp Controls (±0.05s / ±0.1s) */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-1">
                              <span className="text-[10px] font-mono text-slate-400 block">
                                Word Start (s)
                              </span>
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftWordStart((v) =>
                                      Math.max(0, Number((v - 0.1).toFixed(2)))
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-mono font-semibold text-cyan-300 tabular-nums">
                                  {draftWordStart.toFixed(2)}s
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftWordStart((v) =>
                                      Math.min(
                                        draftWordEnd - 0.05,
                                        Number((v + 0.1).toFixed(2))
                                      )
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 space-y-1">
                              <span className="text-[10px] font-mono text-slate-400 block">
                                Word End (s)
                              </span>
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftWordEnd((v) =>
                                      Math.max(
                                        draftWordStart + 0.05,
                                        Number((v - 0.1).toFixed(2))
                                      )
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-mono font-semibold text-violet-300 tabular-nums">
                                  {draftWordEnd.toFixed(2)}s
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftWordEnd((v) =>
                                      Number((v + 0.1).toFixed(2))
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Popover Footer Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={handleDeleteWord}
                              disabled={(line.words?.length || 0) <= 1}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveWordCoords(null)}
                                className="h-7 px-2.5 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={handleSaveWordEdit}
                                className="h-7 px-3 text-xs"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
