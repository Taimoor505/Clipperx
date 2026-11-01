'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CloudUpload,
  Link2,
  Settings,
  Download,
  Pencil,
  Palette,
  BarChart3,
  Play,
  Pause,
  Sparkles,
  Plus,
  X,
  Check,
  Loader2,
  Scissors,
  Music,
  Share2,
  Code2,
} from 'lucide-react';
import {
  ViralClipSegment,
  TranscriptLine,
  CaptionPresetName,
  timestampToSeconds,
} from './VerticalShortPlayer';
import TranscriptEditor from './TranscriptEditor';
import CaptionStylePicker from './CaptionStylePicker';
import ViralityInsightsModal from './ViralityInsightsModal';
import BatchExportDrawer from './BatchExportDrawer';
import SocialPublishModal from './SocialPublishModal';
import AudioStudioDrawer from './AudioStudioDrawer';
import {
  STREAMLIT_APP_PY_CODE,
  detectContextualEmojis,
} from '@/lib/python-script';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type WorkflowStep = 'import' | 'processing' | 'results';

type ActiveModalType =
  | 'transcript'
  | 'style'
  | 'insights'
  | 'audio'
  | 'publish'
  | 'settings'
  | null;

const INITIAL_DEMO_CLIPS: ViralClipSegment[] = [
  {
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
    ],
  },
  {
    clip_id: 2,
    title: 'The 3-Second Visual Reset Rule Used by Top Creators',
    start_time: '00:11:05.000',
    end_time: '00:11:44.800',
    duration_seconds: 39.8,
    virality_score: 92,
    hook_transcript:
      'Every 4 seconds without a visual change costs you 18% of your cold TikTok audience.',
    reasoning:
      'Quantifies retention loss immediately with a hard metric and explains the 1.12x punch-in zoom technique.',
    transcript_lines: [
      {
        start_offset: 0.0,
        end_offset: 4.8,
        text: 'Every 4 seconds without a cut costs 18% retention',
      },
      {
        start_offset: 4.8,
        end_offset: 9.6,
        text: 'Alternate 1.0x and 1.12x scale on key spoken hooks',
      },
      {
        start_offset: 9.6,
        end_offset: 14.4,
        text: 'Pair it with sidechain audio ducking for clean speech',
      },
    ],
  },
  {
    clip_id: 3,
    title: 'How Dual-Layer Gaussian Blur Beats Static Cropping',
    start_time: '00:18:20.100',
    end_time: '00:19:08.500',
    duration_seconds: 48.4,
    virality_score: 88,
    hook_transcript:
      'Never center-crop a wide studio shot without a blurred ambient canvas behind it.',
    reasoning:
      'Clear visual before-and-after explanation with actionable FFmpeg filter parameters.',
    transcript_lines: [
      {
        start_offset: 0.0,
        end_offset: 4.6,
        text: 'Never center crop wide footage into raw black bars',
      },
      {
        start_offset: 4.6,
        end_offset: 9.4,
        text: 'Scale background to 1080x1920 with boxblur 25:5',
      },
      {
        start_offset: 9.4,
        end_offset: 14.2,
        text: 'Then track the speaker face with EMA smoothing',
      },
    ],
  },
];

// FastAPI + FFmpeg worker (apps/api). When unset, the app falls back to the
// metadata-only /api/analyze route and in-browser canvas export.
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

// Clip pickers for the transcript engine (ids from https://openrouter.ai/models)
const OPENROUTER_MODELS = [
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash (cheapest)' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 (best picks)' },
  { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (free, rate-limited)' },
];

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.detail || data.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

const YOUTUBE_LINK = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//;

// How rendered clips look: output shape, framing, and campaign banner/logo overlays.
// Images are kept as data URLs so the settings survive a reload (localStorage).
type ExportLayout = {
  aspectRatio: '9:16' | '4:5' | '1:1' | '16:9';
  framing: 'auto' | 'speaker' | 'fit';
  bannerDataUrl: string | null;
  bannerName: string;
  bannerPosition: 'bottom' | 'top';
  logoDataUrl: string | null;
  logoName: string;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoSize: number; // share of canvas width
  logoOpacity: number;
};

const DEFAULT_EXPORT_LAYOUT: ExportLayout = {
  aspectRatio: '9:16',
  framing: 'auto',
  bannerDataUrl: null,
  bannerName: '',
  bannerPosition: 'bottom',
  logoDataUrl: null,
  logoName: '',
  logoPosition: 'top-right',
  logoSize: 0.16,
  logoOpacity: 0.9,
};

const EXPORT_LAYOUT_KEY = 'clipperx.exportLayout';
const CANVAS_LABELS: Record<ExportLayout['aspectRatio'], string> = {
  '9:16': '1080x1920',
  '4:5': '1080x1350',
  '1:1': '1080x1080',
  '16:9': '1920x1080',
};

function loadExportLayout(): ExportLayout {
  try {
    const saved = window.localStorage.getItem(EXPORT_LAYOUT_KEY);
    return saved ? { ...DEFAULT_EXPORT_LAYOUT, ...JSON.parse(saved) } : DEFAULT_EXPORT_LAYOUT;
  } catch {
    return DEFAULT_EXPORT_LAYOUT;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error('Use a PNG, JPG or WebP image.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Images must be under 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

/** Adds the export layout fields (and banner/logo images) to a /api/render request. */
async function appendExportLayout(form: FormData, layout: ExportLayout): Promise<void> {
  form.append('aspect_ratio', layout.aspectRatio);
  form.append('framing', layout.framing);
  if (layout.bannerDataUrl) {
    form.append('banner', await dataUrlToBlob(layout.bannerDataUrl), layout.bannerName || 'banner.png');
    form.append('banner_position', layout.bannerPosition);
  }
  if (layout.logoDataUrl) {
    form.append('logo', await dataUrlToBlob(layout.logoDataUrl), layout.logoName || 'logo.png');
    form.append('logo_position', layout.logoPosition);
    form.append('logo_size', String(layout.logoSize));
    form.append('logo_opacity', String(layout.logoOpacity));
  }
}

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

/**
 * Downloads a link on the backend (vidgrab: any site, parallel connections) and returns the
 * stored video_id. `onProgress` gets a 0-1 fraction (null while the size is unknown) and a label.
 */
async function downloadFromLink(
  url: string,
  onProgress: (fraction: number | null, label: string) => void
): Promise<string> {
  const start = await fetch(`${BACKEND_URL}/api/downloads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!start.ok) throw new Error(await readErrorDetail(start));
  const { id } = await start.json();

  for (;;) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    const res = await fetch(`${BACKEND_URL}/api/downloads/${id}`);
    if (!res.ok) throw new Error(await readErrorDetail(res));
    const job = await res.json();
    if (job.status === 'done') break;
    if (job.status === 'error' || job.status === 'canceled') {
      throw new Error(job.error || 'The download failed.');
    }
    if (job.phase === 'merging') {
      onProgress(1, 'Merging video and audio...');
    } else if (job.phase === 'downloading') {
      const fraction = job.total ? Math.min(1, job.downloaded / job.total) : null;
      const speed = job.speed ? ` · ${formatBytes(job.speed)}/s` : '';
      const amount = job.total
        ? `${Math.round((fraction ?? 0) * 100)}% of ${formatBytes(job.total)}`
        : formatBytes(job.downloaded);
      onProgress(fraction, `Downloading video: ${amount}${speed}`);
    } else {
      onProgress(null, 'Finding the video...');
    }
  }

  const imported = await fetch(`${BACKEND_URL}/api/downloads/${id}/import`, { method: 'POST' });
  if (!imported.ok) throw new Error(await readErrorDetail(imported));
  return (await imported.json()).video_id;
}

function secondsToTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const rem = safe - hrs * 3600 - mins * 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
    2,
    '0'
  )}:${rem.toFixed(3).padStart(6, '0')}`;
}

/**
 * Self-contained 9:16 Vertical Card Previewer that plays on hover or click,
 * renders animated karaoke captions in the safe zone, and supports 1-click MP4/WebM download.
 */
interface MinimalVerticalClipCardProps {
  clip: ViralClipSegment;
  videoFileUrl: string | null;
  sourceVideoId: string | null;
  exportLayout: ExportLayout;
  captionPreset: CaptionPresetName;
  burnInCaptions: boolean;
  dynamicZoom: boolean;
  isBatchSelected: boolean;
  onToggleBatchSelect: () => void;
  onChangeTitle: (newTitle: string) => void;
  onAdjustTrim: (edge: 'start' | 'end', delta: number) => void;
  onOpenModal: (modal: ActiveModalType) => void;
}

function MinimalVerticalClipCard({
  clip,
  videoFileUrl,
  exportLayout,
  sourceVideoId,
  captionPreset,
  burnInCaptions,
  dynamicZoom,
  isBatchSelected,
  onToggleBatchSelect,
  onChangeTitle,
  onAdjustTrim,
  onOpenModal,
}: MinimalVerticalClipCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadedDone, setDownloadedDone] = useState<boolean>(false);

  const startSec = timestampToSeconds(clip.start_time);
  const duration = Math.max(5, clip.duration_seconds);

  const drawPreviewFrame = useCallback(
    (tSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const sentenceIdx = Math.floor(tSec / 4.5);
      const zoom = dynamicZoom && sentenceIdx % 2 === 1 ? 1.12 : 1.0;

      const vid = videoRef.current;
      const hasReadyVideo = vid && videoFileUrl && vid.readyState >= 2;

      if (hasReadyVideo && vid) {
        // Blurred 9:16 fill background
        ctx.save();
        ctx.filter = 'blur(18px) brightness(0.5)';
        ctx.drawImage(vid, -30, -30, W + 60, H + 60);
        ctx.restore();

        // Foreground centered 16:9 frame
        const fgW = W * zoom;
        const fgH = ((W * 9) / 16) * zoom;
        const fgX = (W - fgW) / 2;
        const fgY = (H - fgH) / 2 - 24;
        ctx.save();
        ctx.drawImage(vid, fgX, fgY, fgW, fgH);
        ctx.restore();
      } else {
        // Clean dark studio procedural canvas
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#131129');
        bgGrad.addColorStop(0.5, '#0B0F17');
        bgGrad.addColorStop(1, '#090D16');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Ambient violet glow orb
        const radGrad = ctx.createRadialGradient(
          W * 0.5,
          H * 0.42,
          10,
          W * 0.5,
          H * 0.42,
          W * 0.6
        );
        radGrad.addColorStop(0, 'rgba(124, 58, 237, 0.28)');
        radGrad.addColorStop(1, 'rgba(11, 15, 23, 0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, W, H);

        // Foreground 16:9 frame with audio waveform
        const fgW = W * zoom;
        const fgH = ((W * 9) / 16) * zoom;
        const fgX = (W - fgW) / 2;
        const fgY = (H - fgH) / 2 - 20;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(fgX, fgY, fgW, fgH);
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(fgX, fgY, fgW, fgH);

        const bars = 24;
        const barSpan = fgW * 0.66;
        const baseX = (W - barSpan) / 2;
        const midY = fgY + fgH * 0.52;

        for (let i = 0; i < bars; i++) {
          const amp =
            Math.abs(
              Math.sin(tSec * 6.8 + i * 0.45) *
                Math.cos(tSec * 3.1 - i * 0.25) *
                (isPlaying ? 1 : 0.35)
            ) *
              42 *
              zoom +
            6;
          ctx.fillStyle =
            i % 2 === 0
              ? 'rgba(124, 58, 237, 0.9)'
              : 'rgba(167, 139, 250, 0.65)';
          ctx.fillRect(
            baseX + i * (barSpan / bars),
            midY - amp / 2,
            4,
            amp
          );
        }
      }

      // Burn-in Karaoke Captions in lower-third safe zone
      if (burnInCaptions) {
        const lines =
          clip.transcript_lines && clip.transcript_lines.length > 0
            ? clip.transcript_lines
            : [{ start_offset: 0, end_offset: 5, text: clip.hook_transcript }];
        const loopTime = tSec % 14;
        const activeLine =
          lines.find(
            (l) => loopTime >= l.start_offset && loopTime <= l.end_offset
          ) || lines[0];

        if (activeLine && activeLine.text) {
          const rawWords = activeLine.text
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7);
          const span = Math.max(
            0.5,
            activeLine.end_offset - activeLine.start_offset
          );
          const rel = Math.max(0, loopTime - activeLine.start_offset);
          const activeWordIdx = Math.min(
            rawWords.length - 1,
            Math.floor((rel / span) * rawWords.length)
          );

          const safeY = H * 0.72;
          const emojis = detectContextualEmojis(activeLine.text);

          if (emojis) {
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(emojis, W / 2, safeY - 36);
          }

          const isMinimalist =
            captionPreset === 'Clean Minimalist' ||
            captionPreset === 'Minimalist Clean';
          const isCyber = captionPreset === 'Cyber Neon';
          const isRed = captionPreset === 'Red Highlight';

          const highlightHex = isMinimalist
            ? '#38BDF8'
            : isCyber
            ? '#00FFFF'
            : isRed
            ? '#FF0000'
            : '#FFFF00';

          const mid = Math.ceil(rawWords.length / 2);
          const rows = [rawWords.slice(0, mid), rawWords.slice(mid)].filter(
            (r) => r.length > 0
          );

          if (isMinimalist) {
            ctx.fillStyle = 'rgba(11, 15, 23, 0.85)';
            ctx.beginPath();
            ctx.roundRect(22, safeY - 24, W - 44, rows.length * 26 + 14, 8);
            ctx.fill();
          }

          rows.forEach((rowTokens, rIdx) => {
            const y = safeY + rIdx * 26;
            ctx.font = '900 18px Impact, "Montserrat", sans-serif';
            const spacing = 7;
            const widths = rowTokens.map(
              (w) => ctx.measureText(w.toUpperCase()).width
            );
            const rowW =
              widths.reduce((a, b) => a + b, 0) +
              Math.max(0, rowTokens.length - 1) * spacing;
            let x = W / 2 - rowW / 2;

            rowTokens.forEach((tok, i) => {
              const globalIdx = rIdx === 0 ? i : mid + i;
              const isSpoken = globalIdx === activeWordIdx;
              const text = tok.toUpperCase();
              const w = widths[i];

              ctx.save();
              ctx.translate(x + w / 2, y);
              if (isSpoken) ctx.scale(1.1, 1.1);
              ctx.font = '900 18px Impact, "Montserrat", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              if (!isMinimalist) {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4.5;
                ctx.strokeText(text, 0, 0);
              }
              ctx.fillStyle = isSpoken ? highlightHex : '#FFFFFF';
              ctx.fillText(text, 0, 0);
              ctx.restore();

              x += w + spacing;
            });
          });
        }
      }
    },
    [
      burnInCaptions,
      captionPreset,
      clip.hook_transcript,
      clip.transcript_lines,
      dynamicZoom,
      isPlaying,
      videoFileUrl,
    ]
  );

  // Animation loop when hovered or playing
  useEffect(() => {
    drawPreviewFrame(elapsed);
  }, [elapsed, drawPreviewFrame]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setElapsed((prev) => {
        const next = prev + dt;
        return next >= duration ? 0 : next;
      });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, duration]);

  const handleStartPlay = () => {
    setIsPlaying(true);
    if (videoRef.current && videoFileUrl) {
      videoRef.current.currentTime = startSec;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleStopPlay = () => {
    setIsPlaying(false);
    if (videoRef.current && videoFileUrl) {
      videoRef.current.pause();
    }
  };

  // Primary CTA: Download MP4 / WebM
  const handleDownloadClip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);

    // Real FFmpeg render on the backend worker
    if (BACKEND_URL && sourceVideoId) {
      const form = new FormData();
      form.append('video_id', sourceVideoId);
      form.append('start_time', clip.start_time);
      form.append('end_time', clip.end_time);
      form.append('burn_captions', String(burnInCaptions));
      form.append('dynamic_zoom', String(dynamicZoom));
      form.append('caption_preset', captionPreset);
      form.append('transcript_json', JSON.stringify(clip.transcript_lines ?? []));
      appendExportLayout(form, exportLayout)
        .then(() => fetch(`${BACKEND_URL}/api/render`, { method: 'POST', body: form }))
        .then(async (response) => {
          if (!response.ok) throw new Error(await readErrorDetail(response));
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `clipperx_short_${clip.clip_id}_${CANVAS_LABELS[exportLayout.aspectRatio]}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setDownloadedDone(true);
          window.setTimeout(() => setDownloadedDone(false), 2500);
        })
        .catch((err: unknown) => {
          window.alert(
            `Render failed: ${err instanceof Error ? err.message : String(err)}`
          );
        })
        .finally(() => setIsDownloading(false));
      return;
    }

    if (BACKEND_URL) {
      window.alert(
        'These clips came from a link, so there is no video file to cut. ' +
          'Upload the video file to render MP4s.'
      );
      setIsDownloading(false);
      return;
    }

    handleStartPlay();

    const canvas = canvasRef.current;
    if (
      canvas &&
      typeof MediaRecorder !== 'undefined' &&
      typeof canvas.captureStream === 'function'
    ) {
      try {
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm',
        });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `clipperx_short_${clip.clip_id}_1080x1920.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setIsDownloading(false);
          setDownloadedDone(true);
          handleStopPlay();
          window.setTimeout(() => setDownloadedDone(false), 2500);
        };
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 1600);
        return;
      } catch {
        // Fallback below
      }
    }

    window.setTimeout(() => {
      setIsDownloading(false);
      setDownloadedDone(true);
      handleStopPlay();
      window.setTimeout(() => setDownloadedDone(false), 2500);
    }, 900);
  };

  return (
    <div className="group rounded-2xl border border-white/10 bg-[#121723] overflow-hidden shadow-xl transition-all hover:border-[#7C3AED]/60 flex flex-col">
      {/* Hidden source video for real file playback */}
      {videoFileUrl && (
        <video
          ref={videoRef}
          src={videoFileUrl}
          muted
          playsInline
          className="hidden"
        />
      )}

      {/* 1. 9:16 VERTICAL VIDEO PREVIEWER (Plays on hover or click) */}
      <div
        onMouseEnter={handleStartPlay}
        onMouseLeave={handleStopPlay}
        onClick={() => (isPlaying ? handleStopPlay() : handleStartPlay())}
        className="relative w-full aspect-[9/16] bg-[#0B0F17] cursor-pointer overflow-hidden select-none"
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={640}
          className="w-full h-full object-cover"
        />

        {/* 2. TOP OVERLAY: Small Virality Badge ("🔥 96% Viral") + Subtle Batch Checkbox */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20">
          <label
            onClick={(e) => e.stopPropagation()}
            title="Select for batch export"
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center cursor-pointer"
          >
            <input
              type="checkbox"
              aria-label={`Select Clip #${clip.clip_id}`}
              checked={isBatchSelected}
              onChange={onToggleBatchSelect}
              className="w-3.5 h-3.5 accent-[#7C3AED] cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal('insights');
            }}
            className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs font-semibold text-white flex items-center gap-1 shadow-md hover:border-[#7C3AED] transition-colors cursor-pointer"
          >
            <span>🔥 {clip.virality_score}% Viral</span>
          </button>
        </div>

        {/* Center Play/Pause Hover Indicator */}
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
            isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-black/65 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </div>
        </div>

        {/* Minimal ±2s Quick Trim Pill on Hover */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 inset-x-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20"
        >
          <div className="inline-flex items-center gap-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
            <button
              type="button"
              onClick={() => onAdjustTrim('start', -2)}
              className="hover:text-white px-1 cursor-pointer"
            >
              -2s
            </button>
            <span className="text-white/40">|</span>
            <button
              type="button"
              onClick={() => onAdjustTrim('end', 2)}
              className="hover:text-white px-1 cursor-pointer"
            >
              +2s
            </button>
          </div>

          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300 tabular-nums">
            {clip.duration_seconds.toFixed(0)}s
          </span>
        </div>
      </div>

      {/* 3. BOTTOM BAR: Editable 1-Line Title + Solid "Download MP4" CTA + Secondary Icon Row */}
      <div className="p-4 space-y-3 bg-[#121723]">
        {/* Short Editable Title (1 Line) */}
        <input
          type="text"
          value={clip.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          aria-label="Clip title"
          className="w-full bg-transparent text-sm font-semibold text-white truncate border-b border-transparent hover:border-white/15 focus:border-[#7C3AED] focus:outline-none pb-0.5 transition-colors"
        />

        {/* Primary CTA Button + Secondary Icon Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadClip}
            disabled={isDownloading}
            className="flex-1 h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-[#7C3AED]/30 transition-all cursor-pointer disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rendering...</span>
              </>
            ) : downloadedDone ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved MP4</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download MP4</span>
              </>
            )}
          </button>

          {/* Secondary Icon Row for Power Users: ✏️ Edit Captions, 🎨 Style Captions, 📊 Score Breakdown */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenModal('transcript')}
              title="Edit Captions"
              aria-label="Edit Captions"
              className="w-9 h-9 rounded-xl border border-white/10 bg-[#0B0F17] hover:border-[#7C3AED] hover:text-white text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('style')}
              title="Style Captions"
              aria-label="Style Captions"
              className="w-9 h-9 rounded-xl border border-white/10 bg-[#0B0F17] hover:border-[#7C3AED] hover:text-white text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('insights')}
              title="Score Breakdown"
              aria-label="Score Breakdown"
              className="w-9 h-9 rounded-xl border border-white/10 bg-[#0B0F17] hover:border-[#7C3AED] hover:text-white text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('publish')}
              title="Publish Short"
              aria-label="Publish Short"
              className="w-9 h-9 rounded-xl border border-white/10 bg-[#0B0F17] hover:border-[#7C3AED] hover:text-white text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClipperStudio() {
  // 3-Step Linear Workflow State ('import' -> 'processing' -> 'results')
  const [step, setStep] = useState<WorkflowStep>('import');
  const [importTab, setImportTab] = useState<string>('upload');

  // Source Media State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [sourceVideoId, setSourceVideoId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [maxClips, setMaxClips] = useState<number>(10);
  const [analysisEngine, setAnalysisEngine] = useState<'transcript' | 'gemini'>(
    'transcript'
  );
  const [llmModel, setLlmModel] = useState<string>(OPENROUTER_MODELS[0].id);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Processing Progress State (Step 2)
  const [progressPct, setProgressPct] = useState<number>(0);
  const [progressStageLabel, setProgressStageLabel] = useState<string>(
    'Analyzing viral hooks...'
  );

  // Advanced Settings (Hidden inside top-right gear icon)
  const [selectedModel, setSelectedModel] = useState<
    'gemini-flash-latest' | 'gemini-pro-latest'
  >('gemini-flash-latest');
  const [burnInCaptions, setBurnInCaptions] = useState<boolean>(true);
  const [dynamicZoom, setDynamicZoom] = useState<boolean>(true);
  const [exportLayout, setExportLayout] = useState<ExportLayout>(DEFAULT_EXPORT_LAYOUT);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const layoutLoaded = useRef(false);

  useEffect(() => {
    setExportLayout(loadExportLayout());
    layoutLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!layoutLoaded.current) return;
    try {
      window.localStorage.setItem(EXPORT_LAYOUT_KEY, JSON.stringify(exportLayout));
    } catch {
      setLayoutError('Too big to remember after a reload; it still applies until you close the page.');
    }
  }, [exportLayout]);

  const updateLayout = (changes: Partial<ExportLayout>) =>
    setExportLayout((prev) => ({ ...prev, ...changes }));

  const pickLayoutImage = async (kind: 'banner' | 'logo', file: File | undefined) => {
    if (!file) return;
    setLayoutError(null);
    try {
      const dataUrl = await readImageFile(file);
      updateLayout(
        kind === 'banner'
          ? { bannerDataUrl: dataUrl, bannerName: file.name }
          : { logoDataUrl: dataUrl, logoName: file.name }
      );
    } catch (err: unknown) {
      setLayoutError(err instanceof Error ? err.message : String(err));
    }
  };
  const [enableAudioDucking, setEnableAudioDucking] = useState<boolean>(true);
  const [captionPreset, setCaptionPreset] =
    useState<CaptionPresetName>('Hormozi Pop');

  // Clips & Active Modal State (Step 3)
  const [clips, setClips] = useState<ViralClipSegment[]>(INITIAL_DEMO_CLIPS);
  const [activeClipId, setActiveClipId] = useState<number>(1);
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [batchSelectedClipIds, setBatchSelectedClipIds] = useState<number[]>(
    []
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoFileUrl) URL.revokeObjectURL(videoFileUrl);
    };
  }, [videoFileUrl]);

  const activeClip =
    clips.find((c) => c.clip_id === activeClipId) || clips[0] || null;

  // Trigger Step 1 -> Step 2 (Generating) -> Step 3 (Results Gallery)
  const runGenerationPipeline = async (fileOverride?: File | null) => {
    const targetFile = fileOverride ?? videoFile;
    setStep('processing');
    setProgressPct(12);
    setProgressStageLabel('Analyzing viral hooks...');
    setPipelineError(null);

    const linkUrl = importTab === 'link' ? youtubeUrl.trim() : '';
    if (BACKEND_URL && (linkUrl || targetFile)) {
      const useTranscript = analysisEngine === 'transcript';
      setSourceVideoId(null);

      // Links are downloaded on the backend first (0-30% of the bar), then analyzed by id
      let downloadedId: string | null = null;
      let geminiReadsLink = false;
      if (linkUrl) {
        setProgressPct(2);
        setProgressStageLabel('Finding the video...');
        try {
          downloadedId = await downloadFromLink(linkUrl, (fraction, label) => {
            setProgressStageLabel(label);
            if (fraction !== null) setProgressPct(2 + Math.round(fraction * 28));
          });
        } catch (err: unknown) {
          if (!useTranscript && YOUTUBE_LINK.test(linkUrl)) {
            geminiReadsLink = true; // Gemini can still watch public YouTube links itself
          } else {
            setPipelineError(err instanceof Error ? err.message : String(err));
            setProgressPct(0);
            setStep('import');
            return;
          }
        }
        setProgressPct(30);
      }

      setProgressStageLabel(
        geminiReadsLink
          ? 'Sending link to Gemini...'
          : downloadedId
            ? useTranscript
              ? 'Transcribing audio with Whisper...'
              : 'Uploading video to Gemini...'
            : useTranscript
              ? 'Uploading video...'
              : 'Uploading video to Gemini...'
      );
      // Real analysis takes a while; creep toward 92% until the backend answers
      const slowTimer = window.setInterval(() => {
        setProgressPct((prev) => {
          const next = Math.min(92, prev + 1);
          if (next >= 25) {
            setProgressStageLabel(
              useTranscript
                ? next < 80
                  ? 'Transcribing audio with Whisper...'
                  : 'Picking the best moments...'
                : 'Gemini is watching your video...'
            );
          }
          return next;
        });
      }, 3000);
      try {
        const form = new FormData();
        if (geminiReadsLink) {
          form.append('url', linkUrl);
        } else if (downloadedId) {
          form.append('video_id', downloadedId);
        } else if (targetFile) {
          form.append('video', targetFile);
        }
        form.append('max_clips', String(maxClips));
        if (useTranscript) {
          form.append('llm_model', llmModel);
        } else {
          form.append('selectedModel', selectedModel);
        }
        const endpoint = geminiReadsLink
          ? 'analyze-url'
          : useTranscript
            ? 'analyze-transcript'
            : 'analyze-video';
        const response = await fetch(`${BACKEND_URL}/api/${endpoint}`, {
          method: 'POST',
          body: form,
        });
        if (!response.ok) throw new Error(await readErrorDetail(response));
        const data = await response.json();
        if (!Array.isArray(data.clips) || data.clips.length === 0) {
          throw new Error('No clips were found in this video.');
        }
        setClips(
          data.clips.map((c: ViralClipSegment) => ({
            ...c,
            transcript_lines: c.transcript_lines ?? [],
          }))
        );
        setActiveClipId(data.clips[0].clip_id);
        setSourceVideoId(data.video_id ?? null);
        setProgressPct(100);
        setStep('results');
      } catch (err: unknown) {
        setPipelineError(err instanceof Error ? err.message : String(err));
        setProgressPct(0);
        setStep('import');
      } finally {
        window.clearInterval(slowTimer);
      }
      return;
    }

    const progressTimer = window.setInterval(() => {
      setProgressPct((prev) => {
        const next = Math.min(92, prev + 9);
        if (next >= 55) {
          setProgressStageLabel('Rendering 9:16 Shorts...');
        }
        return next;
      });
    }, 220);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle:
            targetFile?.name ||
            (youtubeUrl ? `YouTube: ${youtubeUrl}` : 'ClipperX Session'),
          videoDurationSeconds: 1800,
          youtubeUrl: importTab === 'link' ? youtubeUrl : '',
          transcriptContext: '',
          selectedModel,
          frames: [],
        }),
      });

      const data = await response.json();
      if (response.ok && Array.isArray(data.clips) && data.clips.length > 0) {
        setClips(data.clips);
        setActiveClipId(data.clips[0].clip_id);
      }
    } catch {
      // Fallback to curated demo clips if offline
    } finally {
      window.clearInterval(progressTimer);
      setProgressPct(100);
      setProgressStageLabel('Rendering 9:16 Shorts...');
      window.setTimeout(() => {
        setStep('results');
      }, 320);
    }
  };

  const handleSelectFile = (file: File) => {
    if (videoFileUrl) URL.revokeObjectURL(videoFileUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileUrl(url);
    runGenerationPipeline(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      handleSelectFile(dropped);
    }
  };

  const handleResetToStep1 = () => {
    setStep('import');
    setProgressPct(0);
    setActiveModal(null);
    setBatchSelectedClipIds([]);
  };

  const handleUpdateClipTitle = (clipId: number, newTitle: string) => {
    setClips((prev) =>
      prev.map((c) => (c.clip_id === clipId ? { ...c, title: newTitle } : c))
    );
  };

  const handleAdjustClipTimestamp = (
    clipId: number,
    edge: 'start' | 'end',
    deltaSeconds: number
  ) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.clip_id !== clipId) return c;
        let s = timestampToSeconds(c.start_time);
        let e = timestampToSeconds(c.end_time);
        if (edge === 'start') {
          s = Math.max(0, Math.min(e - 10, s + deltaSeconds));
        } else {
          e = Math.max(s + 10, e + deltaSeconds);
        }
        return {
          ...c,
          start_time: secondsToTimestamp(s),
          end_time: secondsToTimestamp(e),
          duration_seconds: Number((e - s).toFixed(1)),
        };
      })
    );
  };

  const handleUpdateClipTranscript = (
    clipId: number,
    updatedLines: TranscriptLine[]
  ) => {
    setClips((prev) =>
      prev.map((c) =>
        c.clip_id === clipId
          ? {
              ...c,
              hook_transcript: updatedLines[0]?.text || c.hook_transcript,
              transcript_lines: updatedLines,
            }
          : c
      )
    );
  };

  const handleDownloadPythonApp = () => {
    const blob = new Blob([STREAMLIT_APP_PY_CODE], {
      type: 'text/x-python;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col selection:bg-[#7C3AED] selection:text-white">
      {/* =====================================================================
          MINIMALIST HEADER BAR
          Logo on left, subtle Advanced Settings gear icon on right
         ===================================================================== */}
      <header className="h-16 border-b border-white/5 px-6 flex items-center justify-between max-w-6xl w-full mx-auto">
        <button
          type="button"
          onClick={handleResetToStep1}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center shadow-md shadow-[#7C3AED]/30 group-hover:scale-105 transition-transform">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            ClipperX
          </span>
        </button>

        <div className="flex items-center gap-2">
          {step === 'results' && (
            <>
              <button
                type="button"
                onClick={() => setActiveModal('audio')}
                title="Audio & Ducking Studio"
                aria-label="Audio Studio"
                className="h-9 px-3 rounded-xl border border-white/10 bg-[#121723] hover:border-[#7C3AED] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span className="hidden sm:inline">Audio</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStep1}
                className="h-9 px-3 rounded-xl border border-white/10 bg-[#121723] hover:border-[#7C3AED] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>New Video</span>
              </button>
            </>
          )}

          {/* Subtle Gear Icon ("Advanced Settings") */}
          <button
            type="button"
            onClick={() => setActiveModal('settings')}
            title="Advanced Settings"
            aria-label="Advanced Settings"
            className="w-9 h-9 rounded-xl border border-white/10 bg-[#121723] hover:border-[#7C3AED] text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =====================================================================
          SINGLE-COLUMN LINEAR WORKFLOW CONTAINER (Step 1 -> Step 2 -> Step 3)
         ===================================================================== */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* =================================================================
              STEP 1: HERO & IMPORT ZONE (State: No Video Uploaded)
             ================================================================= */}
          {step === 'import' && (
            <motion.div
              key="step-import"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="min-h-[70vh] flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full"
            >
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-8">
                Turn Long Videos into Viral Shorts in 1 Click
              </h1>

              {pipelineError && (
                <div
                  role="alert"
                  className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  {pipelineError}
                </div>
              )}

              {/* Single Unified Input Box with Two Tabs: Upload | Link */}
              <div className="w-full rounded-2xl border border-white/10 bg-[#121723] p-5 shadow-2xl">
                <Tabs value={importTab} onValueChange={setImportTab}>
                  <TabsList className="w-full grid grid-cols-2 mb-4 bg-[#0B0F17] p-1 rounded-xl border border-white/5">
                    <TabsTrigger
                      value="upload"
                      className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="link"
                      className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Link</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: UPLOAD */}
                  <TabsContent value="upload">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`rounded-xl border-2 border-dashed py-12 px-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                        isDragging
                          ? 'border-[#7C3AED] bg-[#7C3AED]/10'
                          : 'border-white/15 bg-[#0B0F17]/70 hover:border-[#7C3AED]/70 hover:bg-[#0B0F17]'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSelectFile(file);
                        }}
                        className="hidden"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/40 flex items-center justify-center text-[#7C3AED]">
                        <CloudUpload className="w-7 h-7" />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        Drop MP4 or MOV here
                      </span>
                    </div>
                  </TabsContent>

                  {/* TAB 2: LINK */}
                  <TabsContent value="link">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        runGenerationPipeline();
                      }}
                      className="flex flex-col sm:flex-row gap-2.5 pt-1"
                    >
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="Paste any video link: YouTube, X, Reddit, TikTok, direct .mp4..."
                        className="flex-1 h-11 px-4 rounded-xl bg-[#0B0F17] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#7C3AED]"
                      />
                      <button
                        type="submit"
                        className="h-11 px-6 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/30 transition-all cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Clips</span>
                      </button>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>

              {/* 1-Click Instant Demo Trigger for First-Time Visitors */}
              <button
                type="button"
                onClick={() => runGenerationPipeline()}
                className="mt-5 text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Or try instant sample video</span>
              </button>
            </motion.div>
          )}

          {/* =================================================================
              STEP 2: GENERATING STATE (State: Processing)
             ================================================================= */}
          {step === 'processing' && (
            <motion.div
              key="step-processing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="min-h-[65vh] flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121723] p-8 shadow-2xl text-center space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/40 flex items-center justify-center text-[#7C3AED] mx-auto">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>

                <div className="space-y-1">
                  <div className="text-base font-bold text-white">
                    {progressStageLabel}
                  </div>
                  <div className="text-xs font-mono text-slate-400 tabular-nums">
                    {progressPct}%
                  </div>
                </div>

                {/* Single Animated Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#0B0F17] overflow-hidden border border-white/5">
                  <motion.div
                    className="h-full bg-[#7C3AED]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* =================================================================
              STEP 3: RESULTS GALLERY (State: Clips Ready)
             ================================================================= */}
          {step === 'results' && (
            <motion.div
              key="step-results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24 }}
              className="space-y-6 pb-20"
            >
              {/* Minimal Top Bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {clips.length} Viral Shorts Ready
                </h2>
                <span className="text-xs text-slate-400">
                  Preset: <strong className="text-white">{captionPreset}</strong>
                </span>
              </div>

              {/* 3-Column 9:16 Vertical Clip Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...clips]
                  .sort((a, b) => b.virality_score - a.virality_score)
                  .map((clip) => (
                    <MinimalVerticalClipCard
                      key={clip.clip_id}
                      clip={clip}
                      videoFileUrl={videoFileUrl}
                      sourceVideoId={sourceVideoId}
                      exportLayout={exportLayout}
                      captionPreset={captionPreset}
                      burnInCaptions={burnInCaptions}
                      dynamicZoom={dynamicZoom}
                      isBatchSelected={batchSelectedClipIds.includes(
                        clip.clip_id
                      )}
                      onToggleBatchSelect={() =>
                        setBatchSelectedClipIds((prev) =>
                          prev.includes(clip.clip_id)
                            ? prev.filter((id) => id !== clip.clip_id)
                            : [...prev, clip.clip_id]
                        )
                      }
                      onChangeTitle={(newTitle) =>
                        handleUpdateClipTitle(clip.clip_id, newTitle)
                      }
                      onAdjustTrim={(edge, delta) =>
                        handleAdjustClipTimestamp(clip.clip_id, edge, delta)
                      }
                      onOpenModal={(modalType) => {
                        setActiveClipId(clip.clip_id);
                        setActiveModal(modalType);
                      }}
                    />
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* =====================================================================
          ON-DEMAND MODALS & DRAWERS (Hidden until user clicks an icon button)
         ===================================================================== */}

      {/* 1. ✏️ Edit Captions Modal (`TranscriptEditor`) */}
      <AnimatePresence>
        {activeModal === 'transcript' && activeClip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close Transcript Editor"
                className="sticky top-3 float-right mr-3 mt-3 z-50 w-8 h-8 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <TranscriptEditor
                clipId={activeClip.clip_id}
                clipTitle={activeClip.title}
                clipDuration={activeClip.duration_seconds}
                transcriptLines={activeClip.transcript_lines}
                onChangeTranscript={(updatedLines) =>
                  handleUpdateClipTranscript(activeClip.clip_id, updatedLines)
                }
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 🎨 Style Captions Modal (`CaptionStylePicker`) */}
      <AnimatePresence>
        {activeModal === 'style' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close Style Picker"
                className="sticky top-3 float-right mr-3 mt-3 z-50 w-8 h-8 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <CaptionStylePicker
                selectedPreset={captionPreset}
                onSelectPreset={(presetId) => setCaptionPreset(presetId)}
                sampleHookText={
                  activeClip?.transcript_lines?.[0]?.text ||
                  activeClip?.hook_transcript ||
                  'Stop cutting viral video on fixed time intervals 🔥'
                }
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. 📊 Score Breakdown Modal (`ViralityInsightsModal`) */}
      <ViralityInsightsModal
        clip={activeClip}
        isOpen={activeModal === 'insights'}
        onClose={() => setActiveModal(null)}
      />

      {/* 4. 🚀 Social Publish Modal (`SocialPublishModal`) */}
      <SocialPublishModal
        clip={activeClip}
        isOpen={activeModal === 'publish'}
        onClose={() => setActiveModal(null)}
      />

      {/* 5. 🎵 Audio Studio Modal (`AudioStudioDrawer`) */}
      <AnimatePresence>
        {activeModal === 'audio' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close Audio Studio"
                className="sticky top-3 float-right mr-3 mt-3 z-50 w-8 h-8 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <AudioStudioDrawer
                enableAudioDucking={enableAudioDucking}
                onToggleAudioDucking={(enabled) =>
                  setEnableAudioDucking(enabled)
                }
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. ⚙️ Advanced Settings Modal (Triggered from top-right gear icon) */}
      <AnimatePresence>
        {activeModal === 'settings' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121723] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#7C3AED]" />
                  <h3 className="text-sm font-bold text-white">
                    Advanced Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">
                    Analysis Engine
                  </label>
                  <select
                    value={analysisEngine}
                    onChange={(e) =>
                      setAnalysisEngine(e.target.value as 'transcript' | 'gemini')
                    }
                    className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value="transcript">Transcript (Whisper + OpenRouter)</option>
                    <option value="gemini">Gemini watches the video</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {analysisEngine === 'transcript'
                      ? 'Precise word captions from the audio, no daily quota.'
                      : 'Sees visuals too, but slow on long videos and has a daily quota.'}
                  </p>
                </div>

                {analysisEngine === 'transcript' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 block">
                      Clip-Picking Model
                    </label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                    >
                      {OPENROUTER_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  className={`space-y-1.5 ${analysisEngine === 'gemini' ? '' : 'hidden'}`}
                >
                  <label className="text-xs font-medium text-slate-300 block">
                    Gemini Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) =>
                      setSelectedModel(
                        e.target.value as 'gemini-flash-latest' | 'gemini-pro-latest'
                      )
                    }
                    className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value="gemini-flash-latest">Gemini Flash (latest)</option>
                    <option value="gemini-pro-latest">Gemini Pro (latest)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">
                    Number of Clips
                  </label>
                  <select
                    value={maxClips}
                    onChange={(e) => setMaxClips(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value={5}>Up to 5</option>
                    <option value={10}>Up to 10</option>
                    <option value={20}>
                      Up to 20{analysisEngine === 'gemini' ? ' (line captions)' : ''}
                    </option>
                    <option value={40}>
                      As many as possible
                      {analysisEngine === 'gemini' ? ' (line captions)' : ''}
                    </option>
                  </select>
                </div>

                <div className="space-y-3 rounded-xl border border-white/10 p-3.5">
                  <p className="text-xs font-semibold text-white">Export Layout</p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <label htmlFor="layout-ratio" className="text-xs font-medium text-slate-300 block">
                        Aspect Ratio
                      </label>
                      <select
                        id="layout-ratio"
                        value={exportLayout.aspectRatio}
                        onChange={(e) => updateLayout({ aspectRatio: e.target.value as ExportLayout['aspectRatio'] })}
                        className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="9:16">9:16 Shorts / Reels</option>
                        <option value="4:5">4:5 Feed</option>
                        <option value="1:1">1:1 Square</option>
                        <option value="16:9">16:9 Landscape</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="layout-framing" className="text-xs font-medium text-slate-300 block">
                        Framing
                      </label>
                      <select
                        id="layout-framing"
                        value={exportLayout.framing}
                        onChange={(e) => updateLayout({ framing: e.target.value as ExportLayout['framing'] })}
                        className="w-full h-9 px-3 rounded-xl bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="auto">Auto</option>
                        <option value="speaker">Speaker crop</option>
                        <option value="fit">Fit with blur</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {exportLayout.framing === 'auto'
                      ? 'People talking: crops onto the speaker. Anything else: fits the whole frame over a blur.'
                      : exportLayout.framing === 'speaker'
                        ? 'Always crops onto the person speaking.'
                        : 'Always shows the whole frame over a blurred copy.'}
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">Banner</span>
                    {exportLayout.bannerDataUrl ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={exportLayout.bannerDataUrl} alt="" className="h-8 max-w-[96px] rounded object-contain bg-black/40" />
                        <select
                          aria-label="Banner position"
                          value={exportLayout.bannerPosition}
                          onChange={(e) => updateLayout({ bannerPosition: e.target.value as ExportLayout['bannerPosition'] })}
                          className="flex-1 h-8 px-2 rounded-lg bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                        >
                          <option value="bottom">Footer</option>
                          <option value="top">Header</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => updateLayout({ bannerDataUrl: null, bannerName: '' })}
                          className="h-8 px-2.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-9 items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-slate-400 hover:text-white hover:border-[#7C3AED] cursor-pointer">
                        Upload campaign banner (PNG/JPG)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            pickLayoutImage('banner', e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">Logo / Watermark</span>
                    {exportLayout.logoDataUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={exportLayout.logoDataUrl} alt="" className="h-8 w-8 rounded object-contain bg-black/40" />
                          <select
                            aria-label="Logo position"
                            value={exportLayout.logoPosition}
                            onChange={(e) => updateLayout({ logoPosition: e.target.value as ExportLayout['logoPosition'] })}
                            className="flex-1 h-8 px-2 rounded-lg bg-[#0B0F17] border border-white/10 text-xs text-white focus:outline-none focus:border-[#7C3AED]"
                          >
                            <option value="top-left">Top left</option>
                            <option value="top-right">Top right</option>
                            <option value="bottom-left">Bottom left</option>
                            <option value="bottom-right">Bottom right</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => updateLayout({ logoDataUrl: null, logoName: '' })}
                            className="h-8 px-2.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="w-14">Size</span>
                          <input
                            type="range" min={0.05} max={0.4} step={0.01}
                            value={exportLayout.logoSize}
                            onChange={(e) => updateLayout({ logoSize: Number(e.target.value) })}
                            className="flex-1 accent-[#7C3AED]"
                          />
                          <span className="w-9 text-right tabular-nums">{Math.round(exportLayout.logoSize * 100)}%</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="w-14">Opacity</span>
                          <input
                            type="range" min={0.2} max={1} step={0.05}
                            value={exportLayout.logoOpacity}
                            onChange={(e) => updateLayout({ logoOpacity: Number(e.target.value) })}
                            className="flex-1 accent-[#7C3AED]"
                          />
                          <span className="w-9 text-right tabular-nums">{Math.round(exportLayout.logoOpacity * 100)}%</span>
                        </label>
                      </div>
                    ) : (
                      <label className="flex h-9 items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-slate-400 hover:text-white hover:border-[#7C3AED] cursor-pointer">
                        Upload logo (PNG with transparency works best)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            pickLayoutImage('logo', e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {layoutError && <p role="alert" className="text-[11px] text-red-400">{layoutError}</p>}
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between rounded-xl bg-[#0B0F17] px-3.5 py-2.5 border border-white/5">
                    <span className="text-xs font-medium text-slate-200">
                      Burn-in Captions
                    </span>
                    <Switch
                      checked={burnInCaptions}
                      onCheckedChange={setBurnInCaptions}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-[#0B0F17] px-3.5 py-2.5 border border-white/5">
                    <span className="text-xs font-medium text-slate-200">
                      Dynamic Zoom (1.12x)
                    </span>
                    <Switch
                      checked={dynamicZoom}
                      onCheckedChange={setDynamicZoom}
                    />
                  </div>


                  <div className="flex items-center justify-between rounded-xl bg-[#0B0F17] px-3.5 py-2.5 border border-white/5">
                    <span className="text-xs font-medium text-slate-200">
                      Audio Ducking
                    </span>
                    <Switch
                      checked={enableAudioDucking}
                      onCheckedChange={setEnableAudioDucking}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPythonApp}
                    className="text-xs cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Export Python app.py</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveModal(null)}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs cursor-pointer"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Batch Export Drawer (Appears ONLY in Step 3 when user checks 1+ clip cards) */}
      {step === 'results' && batchSelectedClipIds.length > 0 && (
        <BatchExportDrawer
          clips={clips}
          selectedClipIds={batchSelectedClipIds}
          onToggleSelectClip={(id) =>
            setBatchSelectedClipIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onSelectAllClips={() =>
            setBatchSelectedClipIds(clips.map((c) => c.clip_id))
          }
          onDeselectAll={() => setBatchSelectedClipIds([])}
          captionPreset={captionPreset}
          enableKaraoke={burnInCaptions}
        />
      )}
    </div>
  );
}
