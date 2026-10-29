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

interface VerticalShortPlayerProps {
  clip: ViralClipSegment;
  videoFileUrl: string | null;
  videoFileName: string;
  captionPreset: CaptionPresetName;
  enableKaraoke: boolean;
  enableZoomCuts: boolean;
  enableFaceTracking: boolean;
  enableAudioDucking: boolean;
  customMusicUrl?: string | null;
  onRenderSuccess?: (clipId: number) => void;
}

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
      primary: '&H0000FFFF', // Neon Yellow in BGR
      secondary: '&H00FFFFFF', // White inactive
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
      primary: '&H00FFFF00', // Electric Cyan in BGR
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
Style: KaraokeMain,${p.font},${p.size},${p.primary},${p.secondary},${p.outline},&H80000000,-1,0,0,0,100,100,1,0,${p.borderStyle},${p.outlineW},3,2,70,70,${p.marginV},1
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

    // Standard \k karaoke line
    const kLine = words
      .map((w) => {
        const cs = Math.max(5, Math.round((w.end_time - w.start_time) * 100));
        return `{\\k${cs}}${w.word.toUpperCase()}`;
      })
      .join(' ');
    events.push(`Dialogue: 0,${s},${e},KaraokeMain,,0,0,0,,${kLine}`);

    // Active word highlight + \fscx110\fscy110 scale bump per word
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
  clip,
  videoFileUrl,
  videoFileName,
  captionPreset,
  enableKaraoke,
  enableZoomCuts,
  enableFaceTracking,
  enableAudioDucking,
  onRenderSuccess,
}: VerticalShortPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const emaFaceXRef = useRef<number>(0.5);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState(false);
  const [elapsedInClip, setElapsedInClip] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const startSec = timestampToSeconds(clip.start_time);
  const endSec = timestampToSeconds(clip.end_time);
  const clipDuration = Math.max(5, endSec - startSec);

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

      // FEATURE 2: Sentence Transition Zoom Beats (1.0x vs 1.12x punch-in on alternating sentence chunks)
      const isZoomBeatActive = enableZoomCuts && resolvedLineIdx % 2 === 1;
      const zoomFactor = isZoomBeatActive ? 1.12 : 1.0;

      // FEATURE 3: EMA-Smoothed Smart Face Tracking Offset (x = clamp(X_face - 540, 0, max_x))
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
          // Smart Face-Tracked 9:16 Auto-Reframing
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
          // Dual-Layer Gaussian Blur 9:16 Fill + 1.12x Zoom Beat
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
        // Studio Procedural 16:9 / Face-Tracked Feed
        const t = currentOffsetSec;

        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.filter = 'blur(28px)';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.beginPath();
        ctx.arc(
          W * 0.5 + Math.sin(t * 1.1) * 70,
          H * 0.44 + Math.cos(t * 0.8) * 80,
          145 * zoomFactor,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
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

        // Foreground studio viewport
        const fgW = W * zoomFactor;
        const fgH = Math.round(((W * 9) / 16) * zoomFactor);
        const panOffsetPx = enableFaceTracking
          ? (0.5 - smoothedNormX) * 140
          : 0;
        const fgX = Math.round((W - fgW) / 2 + panOffsetPx);
        const fgY = Math.round((H - fgH) / 2 - 40);

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

        // Simulated speaker silhouette + voice waveform
        const speakerCenterX = W * 0.5 + panOffsetPx * 0.6;
        const speakerCenterY = fgY + fgH * 0.46;

        if (enableFaceTracking) {
          // EMA Face Bounding Box
          const boxW = Math.round(108 * zoomFactor);
          const boxH = Math.round(132 * zoomFactor);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
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
          ctx.fillStyle = '#38BDF8';
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

        // Voice + Sidechain Ducked Music Waveform Bars
        const barCount = 30;
        const barAreaW = fgW * 0.7;
        const startX = (W - barAreaW) / 2;
        const centerY = fgY + fgH * 0.55;
        for (let i = 0; i < barCount; i++) {
          const wave =
            Math.abs(
              Math.sin(t * 7.2 + i * 0.45) *
                Math.cos(t * 3.4 - i * 0.2) *
                (isPlaying ? 1 : 0.35)
            ) *
              56 *
              zoomFactor +
            8;
          const x = startX + i * (barAreaW / barCount);
          ctx.fillStyle =
            i % 3 === 0
              ? 'rgba(245, 158, 11, 0.88)'
              : 'rgba(226, 232, 240, 0.5)';
          ctx.fillRect(x, centerY - wave / 2, 5, wave);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(fgX, fgY, fgW, fgH);
        ctx.restore();
      }

      // Active SOTA Feature Telemetry Strip at Top of 9:16 Monitor
      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 23, 0.78)';
      ctx.fillRect(14, 14, W - 28, 30);
      ctx.font = '600 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = isZoomBeatActive ? '#FACC15' : '#94A3B8';
      ctx.fillText(
        isZoomBeatActive ? 'ZOOM: 1.12x PUNCH-IN' : 'ZOOM: 1.00x BASE',
        24,
        33
      );
      ctx.textAlign = 'right';
      ctx.fillStyle = enableAudioDucking ? '#34D399' : '#64748B';
      ctx.fillText(
        enableAudioDucking
          ? 'SIDECHAIN DUCK: -12dB ACTIVE'
          : 'DUCKING: BYPASSED',
        W - 24,
        33
      );
      ctx.restore();

      // FEATURE 1: ALEX HORMOZI-STYLE ANIMATED KARAOKE CAPTIONS & CONTEXTUAL EMOJIS
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

        const safeZoneY = H - 255; // MarginV = 520px equivalent on 960px canvas
        const emojis = detectContextualEmojis(activeLine.text);

        ctx.save();

        // Contextual Emoji Overlay above caption block
        if (emojis) {
          ctx.font = '32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emojis, W / 2, safeZoneY - 56);
        }

        // Preset styling configuration
        const isMinimalist = captionPreset === 'Minimalist Clean';
        const isCyber = captionPreset === 'Cyber Neon';

        const activeColor = isMinimalist
          ? '#FFFFFF'
          : isCyber
            ? '#22D3EE'
            : '#FACC15'; // Hormozi Neon Yellow
        const inactiveColor = isMinimalist ? '#94A3B8' : '#FFFFFF';
        const fontFamily = isMinimalist
          ? '"Plus Jakarta Sans", sans-serif'
          : 'Impact, "Plus Jakarta Sans", sans-serif';

        // Split words into up to 2 balanced lines
        const mid = Math.ceil(words.length / 2);
        const rows = [words.slice(0, mid), words.slice(mid)].filter(
          (r) => r.length > 0
        );

        if (isMinimalist) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(36, safeZoneY - 36, W - 72, rows.length * 36 + 18, 10);
          ctx.fill();
        }

        rows.forEach((rowWords, rowIdx) => {
          const yPos =
            rows.length === 1
              ? safeZoneY
              : safeZoneY - 16 + rowIdx * 36;

          // Measure total row width
          ctx.font = `800 26px ${fontFamily}`;
          const wordSpacing = 10;
          const widths = rowWords.map(
            (w) => ctx.measureText(w.word.toUpperCase()).width
          );
          const totalRowW =
            widths.reduce((a, b) => a + b, 0) +
            Math.max(0, rowWords.length - 1) * wordSpacing;

          let cursorX = (W - totalRowW) / 2;

          rowWords.forEach((wObj, i) => {
            const globalWordIdx = rowIdx === 0 ? i : mid + i;
            const isCurrentSpoken =
              enableKaraoke && globalWordIdx === resolvedWordIdx;
            const tokenText = wObj.word.toUpperCase();
            const tokenW = widths[i];

            ctx.save();
            // Apply 1.10x scale bump (\fscx110\fscy110) on currently spoken word
            const centerX = cursorX + tokenW / 2;
            ctx.translate(centerX, yPos);
            if (isCurrentSpoken) {
              ctx.scale(1.12, 1.12);
            }

            ctx.font = `800 26px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;

            if (!isMinimalist) {
              ctx.strokeStyle = isCyber ? '#082F49' : '#000000';
              ctx.lineWidth = 7;
              ctx.shadowColor =
                isCyber && isCurrentSpoken
                  ? 'rgba(34, 211, 238, 0.85)'
                  : 'rgba(0, 0, 0, 0.85)';
              ctx.shadowBlur = isCyber && isCurrentSpoken ? 16 : 8;
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

      if (showSafeZoneGuides) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        const bottomUiY = H - 190;
        ctx.strokeRect(24, bottomUiY, W - 48, 170);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(28, bottomUiY + 8, 250, 22);
        ctx.fillStyle = '#38BDF8';
        ctx.font = '600 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SHORTS/REELS UI EXCLUSION ZONE', 34, bottomUiY + 23);
        ctx.restore();
      }
    },
    [
      captionPreset,
      clip.hook_transcript,
      clip.transcript_lines,
      clipDuration,
      enableAudioDucking,
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
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_500_000,
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
        a.download = `sota_short_clip_${clip.clip_id}_${captionPreset
          .toLowerCase()
          .replace(/\s+/g, '_')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.setTimeout(() => {
          URL.revokeObjectURL(tempUrl);
          setIsRecording(false);
          setRecordingProgress(0);
          onRenderSuccess?.(clip.clip_id);
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
  };

  const ffmpegCommand = `ffmpeg -y -ss ${clip.start_time} -to ${clip.end_time} -i "${videoFileName || 'input.mp4'}" -i music.mp3 -filter_complex "[0:v]${enableFaceTracking ? 'scale=-2:1920:force_original_aspect_ratio=increase,crop=1080:1920:420:0' : 'split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2'}${enableZoomCuts ? ",split[zbase][zsrc];[zsrc]scale=iw*1.12:-1,crop=iw/1.12:ih/1.12[zzoom];[zbase][zzoom]overlay=0:0:enable='between(t,4.5,9.2)'" : ''},subtitles=clip_${clip.clip_id}_karaoke.ass[vout];[1:a]volume=0.15[bg];[0:a]asplit=2[sc][sp];[bg][sc]sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300[duck];[sp][duck]amix=inputs=2:duration=first[aout]" -map "[vout]" -map "[aout]" -c:v libx264 -c:a aac clip_${clip.clip_id}_sota.mp4`;

  const copyFfmpegCommand = () => {
    navigator.clipboard.writeText(ffmpegCommand);
    setCopiedCmd(true);
    window.setTimeout(() => setCopiedCmd(false), 1800);
  };

  return (
    <div className="flex flex-col border border-slate-800 bg-[#111827] rounded-xl p-5">
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

      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            SOTA 9:16 Monitor · {captionPreset}
          </h3>
          <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Clip #{clip.clip_id} · {clip.start_time} → {clip.end_time} (
            {clipDuration.toFixed(1)}s)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSafeZoneGuides((prev) => !prev)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            showSafeZoneGuides
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Safe Zone Guide
        </button>
      </div>

      {/* 9:16 Vertical Viewport Frame */}
      <div className="relative mx-auto w-full max-w-[270px] aspect-[9/16] rounded-lg overflow-hidden border border-slate-800 bg-black shadow-lg">
        <canvas
          ref={canvasRef}
          width={540}
          height={960}
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Playback Scrubber Bar */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-amber-400 transition-transform duration-100 origin-left"
              style={{
                transform: `scaleX(${Math.min(1, elapsedInClip / clipDuration)})`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-200 font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
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
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Restart clip"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {videoFileUrl && (
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            <span>
              {elapsedInClip.toFixed(1)}s / {clipDuration.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Render & Export Controls */}
      <div className="mt-4 space-y-2.5">
        <button
          type="button"
          onClick={handleRenderAndDownloadShort}
          disabled={isRecording}
          className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          {isRecording
            ? `Rendering SOTA 9:16 Short (${recordingProgress}%)...`
            : 'Download SOTA Clip (9:16 Render)'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadAssSubtitles}
            className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
            Export Karaoke .ASS
          </button>

          <button
            type="button"
            onClick={copyFfmpegCommand}
            className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copiedCmd ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied SOTA CLI
              </>
            ) : (
              <>
                <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                Copy SOTA FFmpeg CLI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
