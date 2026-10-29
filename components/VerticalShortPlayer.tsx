'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  FileCode2,
  Eye,
  Volume2,
  VolumeX,
  Check,
  ChevronDown,
  Share2,
  Heart,
  MessageCircle,
  Bookmark,
  Disc3,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { detectContextualEmojis } from '@/lib/python-script';

export type CaptionPresetName =
  | 'Hormozi Pop'
  | 'Minimalist Clean'
  | 'Cyber Neon';

export interface WordTiming {
  word: string;
  start_time: number;
  end_time: number;
}

export interface TranscriptLine {
  start_offset: number;
  end_offset: number;
  text: string;
  words?: WordTiming[];
}

export interface ViralClipSegment {
  clip_id: number;
  title: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  virality_score: number;
  hook_transcript: string;
  reasoning: string;
  transcript_lines: TranscriptLine[];
}

export interface VerticalShortPlayerProps {
  clip?: ViralClipSegment;
  videoFileUrl?: string | null;
  videoFileName?: string;
  captionPreset?: CaptionPresetName;
  enableKaraoke?: boolean;
  enableZoomCuts?: boolean;
  enableFaceTracking?: boolean;
  enableAudioDucking?: boolean;
  customMusicUrl?: string | null;
  onRenderSuccess?: (clipId: number) => void;
}

const DEFAULT_SAMPLE_CLIP: ViralClipSegment = {
  clip_id: 1,
  title: 'Why 90% of AI Video Pipelines Fail at Frame Pacing',
  start_time: '00:04:12.500',
  end_time: '00:04:58.200',
  duration_seconds: 45.7,
  virality_score: 96,
  hook_transcript:
    'Stop cutting short-form video on fixed time intervals—you are destroying the speaker cadence.',
  reasoning:
    'Opens with a contrarian technical hook in the first 3.5 seconds and lands on clean sentence boundaries.',
  transcript_lines: [
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
      text: 'you are destroying the natural speaker cadence.',
    },
    {
      start_offset: 9.2,
      end_offset: 16.0,
      text: 'When Gemini brain analyzes acoustic pauses and facial motion',
    },
    {
      start_offset: 16.0,
      end_offset: 24.5,
      text: 'every fast cut lands cleanly on a breath boundary.',
    },
    {
      start_offset: 24.5,
      end_offset: 34.0,
      text: 'Pair that with smart face tracking and 1.12x zoom cuts',
    },
    {
      start_offset: 34.0,
      end_offset: 45.7,
      text: 'and viewer retention jumps 100% without losing context.',
    },
  ],
};

export function timestampToSeconds(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    return (
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseFloat(parts[2])
    );
  }
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(ts) || 0;
}

export function secondsToAssTime(sec: number): string {
  const safe = Math.max(0, sec);
  const hrs = Math.floor(safe / 3600);
  const rem = safe % 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

export function formatPlayerTime(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
}

export function synthesizeWordsForLine(line: TranscriptLine): WordTiming[] {
  if (line.words && line.words.length > 0) {
    return line.words;
  }
  const tokens = line.text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const totalDur = Math.max(0.4, line.end_offset - line.start_offset);
  const totalChars = tokens.reduce((acc, w) => acc + w.length, 0) || 1;
  let cursor = line.start_offset;

  return tokens.map((w, idx) => {
    const dur = totalDur * (w.length / totalChars);
    const end =
      idx === tokens.length - 1
        ? line.end_offset
        : Number((cursor + dur).toFixed(3));
    const item = {
      word: w,
      start_time: Number(cursor.toFixed(3)),
      end_time: end,
    };
    cursor = end;
    return item;
  });
}

export function generateKaraokeAssFileContent(
  clip: ViralClipSegment,
  presetName: CaptionPresetName,
  enableKaraoke: boolean
): string {
  const presetMap: Record<
    CaptionPresetName,
    {
      font: string;
      size: number;
      primary: string;
      secondary: string;
      outline: string;
      borderStyle: number;
      outlineW: number;
      marginV: number;
    }
  > = {
    'Hormozi Pop': {
      font: 'Impact',
      size: 72,
      primary: '&H0000FFFF',
      secondary: '&H00FFFFFF',
      outline: '&H00000000',
      borderStyle: 1,
      outlineW: 5,
      marginV: 520,
    },
    'Minimalist Clean': {
      font: 'Montserrat',
      size: 58,
      primary: '&H00FFFFFF',
      secondary: '&H00B4B4B4',
      outline: '&H60181818',
      borderStyle: 3,
      outlineW: 14,
      marginV: 500,
    },
    'Cyber Neon': {
      font: 'Arial Black',
      size: 68,
      primary: '&H00FFFF00',
      secondary: '&H00FFFFFF',
      outline: '&H00661100',
      borderStyle: 1,
      outlineW: 6,
      marginV: 520,
    },
  };

  const p = presetMap[presetName];
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: KaraokeMain,${p.font},${p.size},${p.primary},${p.secondary},${p.outline},&H80000000,-1,0,0,0,100,100,1,0,${p.borderStyle},${p.outlineW},3,2,70,70,{p.marginV},1
Style: EmojiOverlay,Arial,82,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,2,70,70,${p.marginV + 125},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines =
    clip.transcript_lines && clip.transcript_lines.length > 0
      ? clip.transcript_lines
      : [
          {
            start_offset: 0,
            end_offset: Math.min(5, clip.duration_seconds),
            text: clip.hook_transcript,
          },
        ];

  const events: string[] = [];

  for (const line of lines) {
    const words = synthesizeWordsForLine(line);
    const s = secondsToAssTime(line.start_offset);
    const e = secondsToAssTime(Math.min(clip.duration_seconds, line.end_offset));
    const emojis = detectContextualEmojis(line.text);

    if (emojis) {
      events.push(
        `Dialogue: 2,${s},${e},EmojiOverlay,,0,0,0,,{\\fad(60,60)\\fscx115\\fscy115}${emojis}`
      );
    }

    if (!enableKaraoke || words.length === 0) {
      events.push(
        `Dialogue: 1,${s},${e},KaraokeMain,,0,0,0,,{\\fad(60,60)\\fscx105\\fscy105}${line.text.toUpperCase()}`
      );
      continue;
    }

    const kLine = words
      .map((w) => {
        const cs = Math.max(5, Math.round((w.end_time - w.start_time) * 100));
        return `{\\k${cs}}${w.word.toUpperCase()}`;
      })
      .join(' ');
    events.push(`Dialogue: 0,${s},${e},KaraokeMain,,0,0,0,,${kLine}`);

    words.forEach((activeWord, activeIdx) => {
      const ws = secondsToAssTime(activeWord.start_time);
      const we = secondsToAssTime(
        Math.min(clip.duration_seconds, activeWord.end_time)
      );
      const styledTokens = words.map((w, idx) => {
        const clean = w.word.toUpperCase();
        if (idx === activeIdx) {
          return `{\\1c${p.primary}\\fscx110\\fscy110}${clean}{\\fscx100\\fscy100\\1c${p.secondary}}`;
        }
        return `{\\1c${p.secondary}\\fscx100\\fscy100}${clean}`;
      });
      events.push(
        `Dialogue: 1,${ws},${we},KaraokeMain,,0,0,0,,${styledTokens.join(' ')}`
      );
    });
  }

  return `${header}${events.join('\n')}\n`;
}

export default function VerticalShortPlayer({
  clip = DEFAULT_SAMPLE_CLIP,
  videoFileUrl = null,
  videoFileName = 'input.mp4',
  captionPreset = 'Hormozi Pop',
  enableKaraoke = true,
  enableZoomCuts = true,
  enableFaceTracking = true,
  enableAudioDucking = true,
  onRenderSuccess,
}: VerticalShortPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const emaFaceXRef = useRef<number>(0.5);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState(true);
  const [elapsedInClip, setElapsedInClip] = useState(0);
  const [qualityMode, setQualityMode] = useState<'1080p 60fps' | '4K 60fps'>(
    '1080p 60fps'
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const startSec = timestampToSeconds(clip.start_time);
  const endSec = timestampToSeconds(clip.end_time);
  const clipDuration = Math.max(5, endSec - startSec);

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setElapsedInClip(0);
    setIsPlaying(false);
    emaFaceXRef.current = 0.5;
    if (videoRef.current && videoFileUrl) {
      const vid = videoRef.current;
      const targetTime =
        vid.duration && Number.isFinite(vid.duration)
          ? startSec % Math.max(1, vid.duration)
          : 0;
      vid.currentTime = targetTime;
      vid.pause();
    }
  }, [clip.clip_id, clip.start_time, clip.end_time, startSec, videoFileUrl]);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    window.setTimeout(() => setFeedbackToast(null), 2200);
  };

  // Draw 9:16 vertical frame with SOTA Engagement stack
  const renderFrameToCanvas = useCallback(
    (currentOffsetSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width; // 540
      const H = canvas.height; // 960

      ctx.clearRect(0, 0, W, H);

      const lines =
        clip.transcript_lines && clip.transcript_lines.length > 0
          ? clip.transcript_lines
          : [
              {
                start_offset: 0,
                end_offset: clipDuration,
                text: clip.hook_transcript,
              },
            ];

      const activeLineIdx = lines.findIndex(
        (l) =>
          currentOffsetSec >= l.start_offset && currentOffsetSec <= l.end_offset
      );
      const resolvedLineIdx =
        activeLineIdx >= 0
          ? activeLineIdx
          : Math.min(
              lines.length - 1,
              Math.floor((currentOffsetSec / clipDuration) * lines.length)
            );
      const activeLine = lines[resolvedLineIdx];

      // Sentence Transition Zoom Beats (1.0x vs 1.12x punch-in)
      const isZoomBeatActive = enableZoomCuts && resolvedLineIdx % 2 === 1;
      const zoomFactor = isZoomBeatActive ? 1.12 : 1.0;

      // EMA-Smoothed Smart Face Tracking Offset (x = clamp(X_face - 540, 0, max_x))
      const rawSpeakerNormX =
        0.5 +
        Math.sin(currentOffsetSec * 0.65) * 0.12 +
        Math.cos(currentOffsetSec * 0.35) * 0.06;
      const emaAlpha = 0.15;
      emaFaceXRef.current =
        emaAlpha * rawSpeakerNormX + (1 - emaAlpha) * emaFaceXRef.current;
      const smoothedNormX = enableFaceTracking ? emaFaceXRef.current : 0.5;

      const vid = videoRef.current;
      const hasValidVideoFrame =
        videoFileUrl && vid && vid.readyState >= 2 && vid.videoWidth > 0;

      if (hasValidVideoFrame && vid) {
        const vw = vid.videoWidth;
        const vh = vid.videoHeight;

        if (enableFaceTracking) {
          ctx.save();
          const scaleToFillH = (H / vh) * zoomFactor;
          const scaledW = vw * scaleToFillH;
          const scaledH = vh * scaleToFillH;
          const maxCropX = Math.max(0, scaledW - W);
          const cropX = Math.max(
            0,
            Math.min(maxCropX, smoothedNormX * scaledW - W / 2)
          );
          const cropY = (scaledH - H) / 2;
          ctx.drawImage(vid, -cropX, -cropY, scaledW, scaledH);
          ctx.restore();
        } else {
          ctx.save();
          ctx.filter = 'blur(22px) brightness(0.55) saturate(1.25)';
          const bgScale = Math.max(W / vw, H / vh);
          const bgW = vw * bgScale;
          const bgH = vh * bgScale;
          ctx.drawImage(
            vid,
            (W - bgW) / 2 - 24,
            (H - bgH) / 2 - 24,
            bgW + 48,
            bgH + 48
          );
          ctx.restore();

          ctx.fillStyle = 'rgba(8, 12, 20, 0.28)';
          ctx.fillRect(0, 0, W, H);

          const fgW = W * zoomFactor;
          const fgH = (vh / vw) * fgW;
          const fgX = (W - fgW) / 2;
          const fgY = (H - fgH) / 2;

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
          ctx.shadowBlur = 24;
          ctx.drawImage(vid, fgX, fgY, fgW, fgH);
          ctx.restore();
        }
      } else {
        const t = currentOffsetSec;

        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.filter = 'blur(28px)';
        ctx.fillStyle = 'rgba(139, 92, 246, 0.24)';
        ctx.beginPath();
        ctx.arc(
          W * 0.5 + Math.sin(t * 1.1) * 70,
          H * 0.44 + Math.cos(t * 0.8) * 80,
          145 * zoomFactor,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
        ctx.beginPath();
        ctx.arc(
          W * 0.35 + Math.cos(t * 0.9) * 60,
          H * 0.52 + Math.sin(t * 1.2) * 70,
          125 * zoomFactor,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        const fgW = W * zoomFactor;
        const fgH = Math.round(((W * 9) / 16) * zoomFactor);
        const panOffsetPx = enableFaceTracking
          ? (0.5 - smoothedNormX) * 140
          : 0;
        const fgX = Math.round((W - fgW) / 2 + panOffsetPx);
        const fgY = Math.round((H - fgH) / 2 - 48);

        ctx.save();
        ctx.fillStyle = '#090D16';
        ctx.fillRect(fgX, fgY, fgW, fgH);

        const studioGrad = ctx.createRadialGradient(
          W * 0.5 + panOffsetPx * 0.4,
          fgY + fgH * 0.5,
          20,
          W * 0.5,
          fgY + fgH * 0.5,
          fgW * 0.65
        );
        studioGrad.addColorStop(0, '#1E293B');
        studioGrad.addColorStop(1, '#0B0F17');
        ctx.fillStyle = studioGrad;
        ctx.fillRect(fgX, fgY, fgW, fgH);

        const speakerCenterX = W * 0.5 + panOffsetPx * 0.6;
        const speakerCenterY = fgY + fgH * 0.46;

        if (enableFaceTracking) {
          const boxW = Math.round(108 * zoomFactor);
          const boxH = Math.round(132 * zoomFactor);
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            speakerCenterX - boxW / 2,
            speakerCenterY - boxH / 2,
            boxW,
            boxH
          );
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(
            speakerCenterX - boxW / 2,
            speakerCenterY - boxH / 2 - 20,
            154,
            18
          );
          ctx.fillStyle = '#22D3EE';
          ctx.font = '600 10px monospace';
          ctx.textAlign = 'left';
          const cropPx = Math.round(
            Math.max(0, Math.min(840, smoothedNormX * 1920 - 540))
          );
          ctx.fillText(
            `EMA FACE X=${cropPx}px`,
            speakerCenterX - boxW / 2 + 5,
            speakerCenterY - boxH / 2 - 7
          );
        }

        const barCount = 30;
        const barAreaW = fgW * 0.68;
        const startX = (W - barAreaW) / 2;
        const centerY = fgY + fgH * 0.55;
        for (let i = 0; i < barCount; i++) {
          const wave =
            Math.abs(
              Math.sin(t * 7.2 + i * 0.45) *
                Math.cos(t * 3.4 - i * 0.2) *
                (isPlaying ? 1 : 0.35)
            ) *
              54 *
              zoomFactor +
            8;
          const x = startX + i * (barAreaW / barCount);
          ctx.fillStyle =
            i % 3 === 0
              ? 'rgba(167, 139, 250, 0.9)'
              : 'rgba(34, 211, 238, 0.65)';
          ctx.fillRect(x, centerY - wave / 2, 5, wave);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(fgX, fgY, fgW, fgH);
        ctx.restore();
      }

      // ALEX HORMOZI-STYLE ANIMATED KARAOKE CAPTIONS & CONTEXTUAL EMOJIS
      if (activeLine && activeLine.text) {
        const words = synthesizeWordsForLine(activeLine);
        const activeWordIdx = words.findIndex(
          (w) =>
            currentOffsetSec >= w.start_time && currentOffsetSec <= w.end_time
        );
        const resolvedWordIdx =
          activeWordIdx >= 0
            ? activeWordIdx
            : Math.min(
                words.length - 1,
                Math.max(
                  0,
                  Math.floor(
                    ((currentOffsetSec - activeLine.start_offset) /
                      Math.max(
                        0.2,
                        activeLine.end_offset - activeLine.start_offset
                      )) *
                      words.length
                  )
                )
              );

        const safeZoneY = H - 275; // Placed inside middle-lower safe zone, above bottom captions & left of right action bar
        const safeCenterX = showSafeZoneGuides ? (W - 64) / 2 : W / 2;
        const emojis = detectContextualEmojis(activeLine.text);

        ctx.save();

        if (emojis) {
          ctx.font = '30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emojis, safeCenterX, safeZoneY - 54);
        }

        const isMinimalist = captionPreset === 'Minimalist Clean';
        const isCyber = captionPreset === 'Cyber Neon';

        const activeColor = isMinimalist
          ? '#FFFFFF'
          : isCyber
            ? '#22D3EE'
            : '#FACC15';
        const inactiveColor = isMinimalist ? '#94A3B8' : '#FFFFFF';
        const fontFamily = isMinimalist
          ? '"Plus Jakarta Sans", sans-serif'
          : 'Impact, "Plus Jakarta Sans", sans-serif';

        const mid = Math.ceil(words.length / 2);
        const rows = [words.slice(0, mid), words.slice(mid)].filter(
          (r) => r.length > 0
        );

        if (isMinimalist) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(
            24,
            safeZoneY - 34,
            (showSafeZoneGuides ? W - 96 : W - 48),
            rows.length * 34 + 16,
            10
          );
          ctx.fill();
        }

        rows.forEach((rowWords, rowIdx) => {
          const yPos =
            rows.length === 1
              ? safeZoneY
              : safeZoneY - 15 + rowIdx * 34;

          ctx.font = `800 24px ${fontFamily}`;
          const wordSpacing = 9;
          const widths = rowWords.map(
            (w) => ctx.measureText(w.word.toUpperCase()).width
          );
          const totalRowW =
            widths.reduce((a, b) => a + b, 0) +
            Math.max(0, rowWords.length - 1) * wordSpacing;

          let cursorX = safeCenterX - totalRowW / 2;

          rowWords.forEach((wObj, i) => {
            const globalWordIdx = rowIdx === 0 ? i : mid + i;
            const isCurrentSpoken =
              enableKaraoke && globalWordIdx === resolvedWordIdx;
            const tokenText = wObj.word.toUpperCase();
            const tokenW = widths[i];

            ctx.save();
            const centerX = cursorX + tokenW / 2;
            ctx.translate(centerX, yPos);
            if (isCurrentSpoken) {
              ctx.scale(1.12, 1.12);
            }

            ctx.font = `800 24px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;

            if (!isMinimalist) {
              ctx.strokeStyle = isCyber ? '#082F49' : '#000000';
              ctx.lineWidth = 6.5;
              ctx.shadowColor =
                isCyber && isCurrentSpoken
                  ? 'rgba(34, 211, 238, 0.85)'
                  : 'rgba(0, 0, 0, 0.85)';
              ctx.shadowBlur = isCyber && isCurrentSpoken ? 14 : 8;
              ctx.strokeText(tokenText, 0, 0);
            }

            ctx.fillStyle = isCurrentSpoken ? activeColor : inactiveColor;
            ctx.fillText(tokenText, 0, 0);
            ctx.restore();

            cursorX += tokenW + wordSpacing;
          });
        });

        ctx.restore();
      }
    },
    [
      captionPreset,
      clip.hook_transcript,
      clip.transcript_lines,
      clipDuration,
      enableFaceTracking,
      enableKaraoke,
      enableZoomCuts,
      isPlaying,
      showSafeZoneGuides,
      videoFileUrl,
    ]
  );

  useEffect(() => {
    let rafId: number;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying) {
        setElapsedInClip((prev) => {
          const next = prev + dt;
          if (next >= clipDuration) {
            if (videoRef.current && videoFileUrl) {
              const vid = videoRef.current;
              const startTarget =
                vid.duration && Number.isFinite(vid.duration)
                  ? startSec % Math.max(1, vid.duration)
                  : 0;
              vid.currentTime = startTarget;
            }
            return 0;
          }
          return next;
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, clipDuration, startSec, videoFileUrl]);

  useEffect(() => {
    renderFrameToCanvas(elapsedInClip);
  }, [elapsedInClip, renderFrameToCanvas]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (videoRef.current && videoFileUrl) {
      if (nextState) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  };

  const restartClip = () => {
    setElapsedInClip(0);
    if (videoRef.current && videoFileUrl) {
      const vid = videoRef.current;
      const target =
        vid.duration && Number.isFinite(vid.duration)
          ? startSec % Math.max(1, vid.duration)
          : 0;
      vid.currentTime = target;
    }
  };

  // Interactive Timeline Scrubber Seek Handler
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = scrubberRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clickRatio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const targetOffset = clickRatio * clipDuration;
    setElapsedInClip(targetOffset);

    if (videoRef.current && videoFileUrl) {
      const vid = videoRef.current;
      if (vid.duration && Number.isFinite(vid.duration)) {
        vid.currentTime = (startSec + targetOffset) % Math.max(1, vid.duration);
      }
    }
  };

  const handleRenderAndDownloadShort = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    setIsRecording(true);
    setRecordingProgress(5);
    restartClip();
    setIsPlaying(true);
    if (videoRef.current && videoFileUrl) {
      videoRef.current.play().catch(() => {});
    }

    try {
      const stream = canvas.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const renderSeconds = 4.0;
      const startMs = performance.now();

      const progressTimer = window.setInterval(() => {
        const elapsed = (performance.now() - startMs) / 1000;
        const pct = Math.min(95, Math.round((elapsed / renderSeconds) * 100));
        setRecordingProgress(pct);
      }, 150);

      recorder.onstop = () => {
        window.clearInterval(progressTimer);
        setRecordingProgress(100);
        const blob = new Blob(chunks, { type: mimeType });
        const tempUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = tempUrl;
        a.download = `clipperx_short_${clip.clip_id}_1080x1920.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.setTimeout(() => {
          URL.revokeObjectURL(tempUrl);
          setIsRecording(false);
          setRecordingProgress(0);
          onRenderSuccess?.(clip.clip_id);
          triggerToast('Downloaded 1080×1920 vertical render');
        }, 800);
      };

      recorder.start(100);
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, renderSeconds * 1000);
    } catch {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  const handleDownloadAssSubtitles = () => {
    const assContent = generateKaraokeAssFileContent(
      clip,
      captionPreset,
      enableKaraoke
    );
    const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
    const tempUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = tempUrl;
    a.download = `clip_${clip.clip_id}_karaoke.ass`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(tempUrl), 500);
    setIsDropdownOpen(false);
    triggerToast('Exported .ASS Karaoke Subtitles');
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://clipperx.ai'}/shorts/clip-${clip.clip_id}?t=${clip.start_time}`;
    navigator.clipboard.writeText(shareUrl);
    setIsDropdownOpen(false);
    triggerToast('Share link copied to clipboard');
  };

  const handleCopyFfmpegCli = () => {
    const ffmpegCommand = `ffmpeg -y -ss ${clip.start_time} -to ${clip.end_time} -i "${videoFileName}" -vf "scale=-2:1920,crop=1080:1920:420:0,subtitles=clip_${clip.clip_id}_karaoke.ass" -r 60 -c:v libx264 -c:a aac clip_${clip.clip_id}_1080x1920.mp4`;
    navigator.clipboard.writeText(ffmpegCommand);
    setIsDropdownOpen(false);
    triggerToast('FFmpeg 1080p 60fps CLI copied');
  };

  return (
    <div className="flex flex-col bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl shadow-violet-950/15 relative">
      {videoFileUrl && (
        <video
          ref={videoRef}
          src={videoFileUrl}
          muted={isMuted}
          playsInline
          crossOrigin="anonymous"
          className="hidden"
        />
      )}

      {/* Card Top Header: Title, Timecode & Safe-Zone Overlay Toggle */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <h3 className="text-sm font-semibold text-white truncate">
              9:16 Vertical Preview Card
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5 truncate">
            Clip #{clip.clip_id} · {clip.start_time} → {clip.end_time}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSafeZoneGuides((prev) => !prev)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            showSafeZoneGuides
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Safe-Zone Overlay</span>
        </button>
      </div>

      {/* 1. 9:16 Aspect Ratio Container (aspect-[9/16]) Centered in Sleek Glassmorphism Card */}
      <div className="relative mx-auto w-full max-w-[290px] aspect-[9/16] rounded-xl overflow-hidden border border-slate-800/90 bg-slate-950 shadow-2xl select-none">
        {/* Live 9:16 HTML5 Canvas Renderer */}
        <canvas
          ref={canvasRef}
          width={540}
          height={960}
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Top Bar Inside 9:16 Viewport: Quality Selector Badge (1080p 60fps) & Preset Tag */}
        <div className="pointer-events-none absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-700/80 text-[10px] font-mono text-slate-300 backdrop-blur-sm">
            {captionPreset}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQualityMode((q) =>
                q === '1080p 60fps' ? '4K 60fps' : '1080p 60fps'
              );
            }}
            className="pointer-events-auto px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/40 text-[10px] font-mono font-semibold text-violet-200 backdrop-blur-sm hover:bg-violet-500/30 transition-colors cursor-pointer"
          >
            {qualityMode}
          </button>
        </div>

        {/* 2. SIMULATED OVERLAY SAFE-ZONES (TikTok / Reels / Shorts UI Boundaries) */}
        {showSafeZoneGuides && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {/* Inner Safe Action Area Dashed Guide Box */}
            <div className="absolute top-12 left-3 right-14 bottom-32 border border-dashed border-cyan-400/55 rounded-lg">
              <span className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded bg-slate-950/85 text-[9px] font-mono text-cyan-300 tracking-wide">
                SAFE CAPTION &amp; FACE ZONE
              </span>
            </div>

            {/* Right-Side TikTok / Reels Action Buttons Exclusion Zone */}
            <div className="absolute right-2 bottom-28 w-11 py-2.5 rounded-xl border border-dashed border-rose-500/60 bg-rose-950/25 backdrop-blur-[2px] flex flex-col items-center gap-3.5">
              <span className="text-[8px] font-mono font-semibold text-rose-300 uppercase tracking-tighter">
                UI Zone
              </span>
              <div className="flex flex-col items-center gap-0.5 text-white/75">
                <Heart className="w-4 h-4 text-rose-400/80" />
                <span className="text-[8px] font-mono">48.2K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 text-white/75">
                <MessageCircle className="w-4 h-4" />
                <span className="text-[8px] font-mono">1,420</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 text-white/75">
                <Bookmark className="w-4 h-4" />
                <span className="text-[8px] font-mono">9.1K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 text-white/75">
                <Disc3 className="w-4 h-4 text-cyan-300 animate-spin" />
              </div>
            </div>

            {/* Bottom Captions / Author Handle / Audio Ticker Exclusion Zone */}
            <div className="absolute inset-x-2.5 bottom-14 h-14 rounded-lg border border-dashed border-amber-400/60 bg-amber-950/25 backdrop-blur-[2px] px-2.5 py-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[9px] font-mono text-amber-300">
                <span>@creator_handle · Follow</span>
                <span>BOTTOM UI EXCLUSION</span>
              </div>
              <div className="text-[9px] text-slate-300/80 truncate font-sans">
                {clip.title} #shorts #viral #ai
              </div>
            </div>
          </div>
        )}

        {/* 3. CUSTOM VIDEO CONTROL BAR (Play/Pause, Timeline Scrubber, Timecode & Quality Badge) */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-5 pb-2.5 px-3">
          {/* Interactive Timeline Scrubber Bar */}
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            className="group relative w-full h-2 flex items-center cursor-pointer mb-2"
          >
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 origin-left"
                style={{
                  transform: `scaleX(${Math.min(1, elapsedInClip / clipDuration)})`,
                }}
              />
            </div>
            <div
              className="absolute h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)] -translate-x-1/2 transition-transform group-hover:scale-125"
              style={{
                left: `${Math.min(100, (elapsedInClip / clipDuration) * 100)}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-200 font-mono tabular-nums">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={restartClip}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Restart clip"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                )}
              </button>
            </div>

            {/* Current Time vs Total Duration */}
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold">
                {formatPlayerTime(elapsedInClip)}
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">
                {formatPlayerTime(clipDuration)}
              </span>
            </div>

            {/* Quality Selector Badge */}
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-cyan-300 font-semibold">
              {qualityMode}
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification Feedback */}
      {feedbackToast && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* 4. DOWNLOAD ACTIONS: Primary Glow Button + Export Options Dropdown */}
      <div className="mt-4 flex items-center gap-2 relative" ref={dropdownRef}>
        {/* Primary Glow "Download MP4 (1080x1920)" Button */}
        <button
          type="button"
          onClick={handleRenderAndDownloadShort}
          disabled={isRecording}
          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold text-xs shadow-[0_0_24px_rgba(139,92,246,0.45)] hover:shadow-[0_0_30px_rgba(34,211,238,0.55)] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>
            {isRecording
              ? `Rendering ${qualityMode} (${recordingProgress}%)...`
              : 'Download MP4 (1080x1920)'}
          </span>
        </button>

        {/* Dropdown Menu Trigger for "Copy Share Link" and "Export Subtitles (.ASS)" */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen((o) => !o)}
          aria-expanded={isDropdownOpen}
          aria-label="More export and share options"
          className="h-10 px-3 rounded-xl border border-slate-700/90 bg-slate-950/90 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>Options</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isDropdownOpen ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 bottom-12 w-56 rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl p-1.5 shadow-2xl z-30 space-y-1">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-900 hover:text-cyan-300 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div>
                <div className="font-semibold">Copy Share Link</div>
                <div className="text-[10px] text-slate-400">
                  Time-stamped preview URL
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadAssSubtitles}
              className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-900 hover:text-violet-300 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <div>
                <div className="font-semibold">Export Subtitles (.ASS)</div>
                <div className="text-[10px] text-slate-400">
                  Hormozi Karaoke \k tags
                </div>
              </div>
            </button>

            <div className="border-t border-slate-800/80 my-1" />

            <button
              type="button"
              onClick={handleCopyFfmpegCli}
              className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-slate-900 hover:text-emerald-300 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold">Copy FFmpeg 9:16 CLI</div>
                <div className="text-[10px] text-slate-400">
                  1080×1920 60fps render command
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
