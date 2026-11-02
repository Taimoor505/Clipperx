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
  MoreHorizontal,
  Image as ImageIcon,
  Trash2,
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
import {
  CampaignOptions,
  CampaignSettingsSections,
  DEFAULT_CAMPAIGN_OPTIONS,
  PostCaptionPanel,
  PresetBar,
  appendCampaignOptions,
} from './CampaignSettings';
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
  | 'broll'
  | 'post'
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
// The desktop app saves clips into a folder instead of browser downloads
const IS_DESKTOP = process.env.NEXT_PUBLIC_CLIPPERX_DESKTOP === '1';

// Clip pickers for the transcript engine (ids from https://openrouter.ai/models)
const OPENROUTER_MODELS: { id: string; label: string; free: boolean }[] = [
  // auto:free tries the backend's free-model chain in order and falls back when one is busy
  { id: 'auto:free', label: 'Best free model (auto)', free: true },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra: fuller stories', free: true },
  { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'Nemotron 3.5 Super: fastest', free: true },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash (about $0.0003 a video)', free: false },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', free: false },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 (best picks)', free: false },
  { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', free: false },
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
  bannerPosition: 'bottom' | 'top' | 'background';
  logoDataUrl: string | null;
  logoName: string;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoSize: number; // share of canvas width
  logoOpacity: number;
  hookLine: boolean; // clip title as a boxed line at the top for the first 3 seconds
  terms: string; // names/brands: steer Whisper's spelling and get highlighted in captions
} & CampaignOptions;

/** A user-supplied image or video cut in over a clip at `start` seconds. */
type BrollInsert = { id: string; file: File; start: number; duration: number; mode: 'full' | 'pip' };

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
  hookLine: true,
  terms: '',
  ...DEFAULT_CAMPAIGN_OPTIONS,
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
  form.append('highlight_terms', layout.terms);
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

type DesktopInfo = {
  output_dir: string;
  keys: { openrouter: boolean; gemini: boolean };
  whisper_ready: boolean;
  whisper_error: string;
};

type RenderOptions = {
  broll: BrollInsert[];
  burnInCaptions: boolean;
  dynamicZoom: boolean;
  captionPreset: CaptionPresetName;
  exportLayout: ExportLayout;
};

function clipFileName(clip: ViralClipSegment): string {
  const title = clip.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 70) || 'clip';
  return `${String(clip.clip_id).padStart(2, '0')} - ${title}.mp4`;
}

/**
 * Renders one clip on the backend (real FFmpeg) and saves the MP4: into the clips folder in
 * the desktop app (returns its path), or as a browser download (returns null).
 */
async function renderAndSaveClip(
  clip: ViralClipSegment,
  sourceVideoId: string,
  options: RenderOptions
): Promise<string | null> {
  const form = new FormData();
  form.append('video_id', sourceVideoId);
  // Captions are timed against the AI's original range; a trim is sent as offsets from it
  const originStart = clip.origin_start ?? clip.start_time;
  const originEnd = clip.origin_end ?? clip.end_time;
  form.append('start_time', originStart);
  form.append('end_time', originEnd);
  form.append('trim_start', String(timestampToSeconds(clip.start_time) - timestampToSeconds(originStart)));
  form.append('trim_end', String(timestampToSeconds(clip.end_time) - timestampToSeconds(originEnd)));
  form.append('burn_captions', String(options.burnInCaptions));
  form.append('dynamic_zoom', String(options.dynamicZoom));
  form.append('caption_preset', options.captionPreset);
  form.append('transcript_json', JSON.stringify(clip.transcript_lines ?? []));
  await appendExportLayout(form, options.exportLayout);
  appendCampaignOptions(form, options.exportLayout, clip.title);
  if (clip.segments?.length) form.append('segments_json', JSON.stringify(clip.segments));
  if (options.exportLayout.hookLine) form.append('hook_text', clip.title);
  for (const insert of options.broll) form.append('broll', insert.file, insert.file.name);
  form.append(
    'broll_json',
    JSON.stringify(options.broll.map(({ start, duration, mode }) => ({ start, duration, mode })))
  );
  if (IS_DESKTOP) {
    form.append('save', 'true');
    form.append('filename', clipFileName(clip));
  }
  const response = await fetch(`${BACKEND_URL}/api/render`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readErrorDetail(response));
  if (IS_DESKTOP) return (await response.json()).saved_to as string;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = clipFileName(clip);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

/** Desktop app: reveal a saved clip (or the clips folder) in File Explorer. */
function showInFolder(path?: string | null): void {
  fetch(`${BACKEND_URL}/api/desktop/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(path ? { path } : {}),
  }).catch(() => {});
}

const NO_SOURCE_MESSAGE =
  'The video for these clips is no longer available. Add it again to download clips.';

function formatClock(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
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
  broll: BrollInsert[];
  captionPreset: CaptionPresetName;
  burnInCaptions: boolean;
  dynamicZoom: boolean;
  isBatchSelected: boolean;
  onToggleBatchSelect: () => void;
  onChangeTitle: (newTitle: string) => void;
  onAdjustTrim: (edge: 'start' | 'end', delta: number) => void;
  onOpenModal: (modal: ActiveModalType) => void;
  onSaved: (path: string) => void;
}

function MinimalVerticalClipCard({
  clip,
  videoFileUrl,
  exportLayout,
  broll,
  sourceVideoId,
  captionPreset,
  burnInCaptions,
  dynamicZoom,
  isBatchSelected,
  onToggleBatchSelect,
  onChangeTitle,
  onAdjustTrim,
  onOpenModal,
  onSaved,
}: MinimalVerticalClipCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadedDone, setDownloadedDone] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

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

      if (hasReadyVideo && vid && exportLayout.framing !== 'fit' && vid.videoWidth > 0) {
        // Speaker framing preview: fill the frame, centred. The real render follows the
        // speaker's face; this is an approximation that matches its look.
        const scale = Math.max(W / vid.videoWidth, H / vid.videoHeight);
        const dw = vid.videoWidth * scale;
        const dh = vid.videoHeight * scale;
        ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else if (hasReadyVideo && vid) {
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
        // No local video (link imports): a quiet neutral placeholder with the captions
        ctx.fillStyle = '#1a1b1e';
        ctx.fillRect(0, 0, W, H);

        // Foreground 16:9 frame with audio waveform
        const fgW = W * zoom;
        const fgH = ((W * 9) / 16) * zoom;
        const fgX = (W - fgW) / 2;
        const fgY = (H - fgH) / 2 - 20;

        ctx.fillStyle = '#232428';
        ctx.fillRect(fgX, fgY, fgW, fgH);

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
          ctx.fillStyle = i % 2 === 0 ? 'rgba(236, 237, 239, 0.45)' : 'rgba(236, 237, 239, 0.25)';
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
      exportLayout.framing,
    ]
  );

  // Animation loop when hovered or playing
  useEffect(() => {
    drawPreviewFrame(elapsed);
  }, [elapsed, drawPreviewFrame]);

  // Poster: show a real frame from the clip before anyone hovers
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoFileUrl) return;
    const posterAt = startSec + Math.min(2, duration / 3);
    const seek = () => {
      if (vid.paused) vid.currentTime = posterAt;
    };
    const draw = () => drawPreviewFrame(0);
    vid.addEventListener('loadeddata', seek);
    vid.addEventListener('seeked', draw);
    if (vid.readyState >= 1) seek();
    return () => {
      vid.removeEventListener('loadeddata', seek);
      vid.removeEventListener('seeked', draw);
    };
  }, [videoFileUrl, startSec, duration, drawPreviewFrame]);

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
  const handleDownloadClip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    if (!BACKEND_URL || !sourceVideoId) {
      window.alert(NO_SOURCE_MESSAGE);
      return;
    }
    setIsDownloading(true);
    try {
      const savedTo = await renderAndSaveClip(clip, sourceVideoId, {
        broll,
        burnInCaptions,
        dynamicZoom,
        captionPreset,
        exportLayout,
      });
      if (savedTo) onSaved(savedTo);
      setDownloadedDone(true);
      window.setTimeout(() => setDownloadedDone(false), 2500);
    } catch (err: unknown) {
      window.alert(`Couldn't render this clip: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <article className="group rounded-xl border border-line bg-surface overflow-hidden flex flex-col">
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

      {/* Preview: plays on hover or click */}
      <div
        onMouseEnter={handleStartPlay}
        onMouseLeave={handleStopPlay}
        onClick={() => (isPlaying ? handleStopPlay() : handleStartPlay())}
        className="relative w-full aspect-[9/16] bg-black cursor-pointer overflow-hidden select-none"
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={640}
          className="w-full h-full object-cover"
        />

        <label
          onClick={(e) => e.stopPropagation()}
          title="Select for batch export"
          className={`absolute top-2.5 left-2.5 z-20 w-7 h-7 rounded-md bg-black/55 flex items-center justify-center cursor-pointer transition-opacity ${
            isBatchSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          }`}
        >
          <input
            type="checkbox"
            aria-label={`Select ${clip.title}`}
            checked={isBatchSelected}
            onChange={onToggleBatchSelect}
            className="w-3.5 h-3.5 accent-accent cursor-pointer"
          />
        </label>

        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${
            isPlaying ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center text-white">
            <Play className="w-5 h-5 ml-0.5" />
          </div>
        </div>

        <div className="absolute bottom-2.5 inset-x-2.5 flex items-end justify-between z-20 pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal('insights');
            }}
            title="Why this clip was picked"
            className="pointer-events-auto rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white tabular-nums cursor-pointer hover:bg-black/75"
          >
            {clip.from_timestamps ? 'Your pick' : `Score ${clip.virality_score}`}
          </button>
          <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white tabular-nums">
            {formatClock(clip.duration_seconds)}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        <div className="space-y-0.5">
          <input
            type="text"
            value={clip.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            aria-label="Clip title"
            className="w-full bg-transparent text-sm font-semibold text-ink truncate rounded px-1 -mx-1 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none transition-colors"
          />
          <div className="flex items-center justify-between text-xs text-ink-muted tabular-nums">
            <span>
              {formatClock(timestampToSeconds(clip.start_time))} to{' '}
              {formatClock(timestampToSeconds(clip.end_time))}
            </span>
            <span className="inline-flex items-center gap-1" aria-label="Adjust length">
              {(
                [
                  ['start', 'Start'],
                  ['end', 'End'],
                ] as const
              ).map(([edge, name]) => (
                <span key={edge} className="inline-flex items-center rounded-md border border-line">
                  <button
                    type="button"
                    onClick={() => onAdjustTrim(edge, -2)}
                    title={`${name} 2 seconds earlier`}
                    aria-label={`${name} 2 seconds earlier`}
                    className="px-1 py-0.5 hover:bg-surface-2 hover:text-ink cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-0.5 text-[10px]">{name}</span>
                  <button
                    type="button"
                    onClick={() => onAdjustTrim(edge, 2)}
                    title={`${name} 2 seconds later`}
                    aria-label={`${name} 2 seconds later`}
                    className="px-1 py-0.5 hover:bg-surface-2 hover:text-ink cursor-pointer"
                  >
                    +
                  </button>
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadClip}
            disabled={isDownloading}
            className="flex-1 h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rendering</span>
              </>
            ) : downloadedDone ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('transcript')}
            title="Edit captions"
            aria-label="Edit captions"
            className="w-9 h-9 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className="w-9 h-9 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                onMouseLeave={() => setMenuOpen(false)}
                className="absolute right-0 bottom-11 z-30 w-44 rounded-lg border border-line bg-surface p-1 shadow-lg"
              >
                {(
                  [
                    ['broll', broll.length ? `B-roll (${broll.length})` : 'B-roll', ImageIcon],
                    ['post', 'Post caption', Share2],
                    ['style', 'Caption style', Palette],
                    ['insights', 'Why this clip', BarChart3],
                  ] as const
                ).map(([modal, label, Icon]) => (
                  <button
                    key={modal}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenModal(modal);
                    }}
                    className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-surface-2 cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-ink-muted" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function BrollPanel({
  clip,
  inserts,
  onChange,
  onClose,
}: {
  clip: ViralClipSegment;
  inserts: BrollInsert[];
  onChange: (inserts: BrollInsert[]) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingAt, setPendingAt] = useState<number>(0);
  const length = clip.duration_seconds;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added = [...files]
      .filter((f) => /^(image|video)\//.test(f.type))
      .map((file, i) => ({
        id: `${Date.now()}-${i}`,
        file,
        start: Math.min(Math.max(0, pendingAt + i * 3), Math.max(0, length - 1)),
        duration: 2.5,
        mode: 'full' as const,
      }));
    onChange([...inserts, ...added].sort((a, b) => a.start - b.start));
  };
  const update = (id: string, changes: Partial<BrollInsert>) =>
    onChange(inserts.map((x) => (x.id === id ? { ...x, ...changes } : x)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-overlay"
    >
      <motion.div
        role="dialog"
        aria-label="B-roll"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md border-l border-line bg-surface overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 h-14">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold">B-roll</h3>
            <p className="text-xs text-ink-muted truncate">{clip.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close B-roll"
            className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <p className="text-sm text-ink-muted">
            Add your own photos or video over the clip at the moments that need them. Use real
            footage you&rsquo;re allowed to use, like the brand&rsquo;s own photos or clips you shot.
          </p>

          {Boolean(clip.broll_ideas?.length) && (
            <section className="space-y-2">
              <h4 className="text-xs font-medium text-ink-muted">Suggested moments</h4>
              <ul className="space-y-1.5">
                {clip.broll_ideas!.map((idea) => (
                  <li key={`${idea.at}-${idea.show}`} className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
                    <span className="text-xs font-semibold tabular-nums pt-0.5 w-9 shrink-0">
                      {formatClock(idea.at)}
                    </span>
                    <span className="text-sm flex-1">{idea.show}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAt(idea.at);
                        fileRef.current?.click();
                      }}
                      className="shrink-0 h-7 px-2.5 rounded-md border border-line text-xs font-medium hover:bg-surface cursor-pointer"
                    >
                      Add file
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-ink-muted">
                In this clip ({formatClock(length)} long)
              </h4>
              <button
                type="button"
                onClick={() => {
                  setPendingAt(0);
                  fileRef.current?.click();
                }}
                className="h-8 px-3 rounded-lg border border-line text-sm font-medium hover:bg-surface-2 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add images or videos
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {inserts.length === 0 ? (
              <p className="text-sm text-ink-subtle py-6 text-center border border-dashed border-line rounded-lg">
                No B-roll yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {inserts.map((x) => (
                  <li key={x.id} className="rounded-lg border border-line p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-ink-muted shrink-0" />
                      <span className="text-sm truncate flex-1">{x.file.name}</span>
                      <button
                        type="button"
                        onClick={() => onChange(inserts.filter((y) => y.id !== x.id))}
                        aria-label={`Remove ${x.file.name}`}
                        className="w-7 h-7 rounded-md text-ink-muted hover:text-danger hover:bg-surface-2 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="space-y-1">
                        <span className="text-ink-muted">Starts at (s)</span>
                        <input
                          type="number" min={0} max={Math.max(0, length - 0.5)} step={0.5}
                          value={x.start}
                          onChange={(e) => update(x.id, { start: Math.max(0, Number(e.target.value)) })}
                          className="w-full h-8 px-2 rounded-md bg-canvas border border-line tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-ink-muted">Shows for (s)</span>
                        <input
                          type="number" min={0.5} max={15} step={0.5}
                          value={x.duration}
                          onChange={(e) => update(x.id, { duration: Math.min(15, Math.max(0.5, Number(e.target.value))) })}
                          className="w-full h-8 px-2 rounded-md bg-canvas border border-line tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-ink-muted">Style</span>
                        <select
                          value={x.mode}
                          onChange={(e) => update(x.id, { mode: e.target.value as BrollInsert['mode'] })}
                          className="w-full h-8 px-1.5 rounded-md bg-canvas border border-line"
                        >
                          <option value="full">Full screen</option>
                          <option value="pip">Top panel</option>
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-[11px] text-ink-subtle">
            Captions and the hook line stay on top of B-roll. B-roll is kept until you close this
            page.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DesktopSettings({
  info,
  onChange,
}: {
  info: DesktopInfo;
  onChange: (info: DesktopInfo) => void;
}) {
  const [openrouter, setOpenrouter] = useState('');
  const [gemini, setGemini] = useState('');
  const [folder, setFolder] = useState(info.output_dir);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const post = async (path: string, body: object, done: string) => {
    setMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readErrorDetail(res));
      onChange(await res.json());
      setMessage({ text: done });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    }
  };

  const inputClass =
    'w-full h-9 px-3 rounded-lg bg-canvas border border-line text-sm placeholder:text-ink-subtle focus:outline-none focus:border-accent';

  return (
    <div className="space-y-4 pb-5 border-b border-line">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          post('/api/desktop/keys', { openrouter, gemini }, 'Keys saved').then(() => {
            setOpenrouter('');
            setGemini('');
          });
        }}
      >
        <p className="text-sm font-medium">API keys</p>
        <label className="block space-y-1">
          <span className="text-xs text-ink-muted">
            OpenRouter {info.keys.openrouter ? '(saved)' : '(needed to pick clips)'}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={openrouter}
            onChange={(e) => setOpenrouter(e.target.value)}
            placeholder={info.keys.openrouter ? 'Paste a new key to replace it' : 'sk-or-...'}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-ink-muted">
            Gemini {info.keys.gemini ? '(saved)' : '(optional)'}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={gemini}
            onChange={(e) => setGemini(e.target.value)}
            placeholder={info.keys.gemini ? 'Paste a new key to replace it' : 'Optional'}
            className={inputClass}
          />
        </label>
        <p className="text-xs text-ink-subtle">Stored in Windows Credential Manager on this PC.</p>
        <button
          type="submit"
          disabled={!openrouter.trim() && !gemini.trim()}
          className="h-9 px-3 rounded-lg border border-line text-sm font-medium hover:bg-surface-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Save keys
        </button>
      </form>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          post('/api/desktop/output-dir', { path: folder }, 'Folder saved');
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Save clips to</span>
          <input value={folder} onChange={(e) => setFolder(e.target.value)} className={inputClass} />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={folder.trim() === info.output_dir}
            className="h-9 px-3 rounded-lg border border-line text-sm font-medium hover:bg-surface-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            Save folder
          </button>
          <button
            type="button"
            onClick={() => showInFolder()}
            className="h-9 px-3 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
          >
            Open folder
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className={`text-xs ${message.error ? 'text-danger' : 'text-success'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export default function ClipperStudio() {
  // 3-Step Linear Workflow State ('import' -> 'processing' -> 'results')
  const [step, setStep] = useState<WorkflowStep>('import');

  // Source Media State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [sourceVideoId, setSourceVideoId] = useState<string | null>(null);
  const [sourceDuration, setSourceDuration] = useState<number>(0);
  const [pickedBy, setPickedBy] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [maxClips, setMaxClips] = useState<number>(10);
  // Exact moments to clip (e.g. from a campaign brief); when set, the AI doesn't pick
  const [timestampsText, setTimestampsText] = useState<string>('');
  const [showTimestamps, setShowTimestamps] = useState<boolean>(false);
  const [analysisEngine, setAnalysisEngine] = useState<'transcript' | 'gemini'>(
    'transcript'
  );
  const [llmModel, setLlmModel] = useState<string>(OPENROUTER_MODELS[0].id);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Processing Progress State (Step 2)
  const [progressPct, setProgressPct] = useState<number>(0);
  const [progressStageLabel, setProgressStageLabel] = useState<string>(
    'Getting started'
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
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedNotice, setSavedNotice] = useState<{ count: number; path: string | null } | null>(null);
  // B-roll files live in memory only: they belong to this session's clips
  const [brollByClip, setBrollByClip] = useState<Record<number, BrollInsert[]>>({});
  const [desktopInfo, setDesktopInfo] = useState<DesktopInfo | null>(null);

  useEffect(() => {
    if (!IS_DESKTOP) return;
    let timer = 0;
    const load = () =>
      fetch(`${BACKEND_URL}/api/desktop/info`)
        .then((r) => r.json())
        .then((info: DesktopInfo) => {
          setDesktopInfo(info);
          // Keep checking while the speech model downloads on first run
          if (!info.whisper_ready && !info.whisper_error) timer = window.setTimeout(load, 4000);
        })
        .catch(() => {
          timer = window.setTimeout(load, 2000);
        });
    load();
    return () => window.clearTimeout(timer);
  }, []);
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
    setProgressStageLabel('Getting started');
    setPipelineError(null);

    // One input box takes either: a dropped/chosen file wins, otherwise the pasted link
    const linkUrl = fileOverride ? '' : youtubeUrl.trim();
    if (BACKEND_URL && (linkUrl || targetFile)) {
      const fromTimestamps = Boolean(timestampsText.trim());
      const useTranscript = analysisEngine === 'transcript' || fromTimestamps;
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
                ? fromTimestamps
                  ? 'Transcribing your moments...'
                  : next < 80
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
        if (fromTimestamps) {
          form.append('timestamps', timestampsText);
          form.append('vocabulary', exportLayout.terms);
        } else if (useTranscript) {
          form.append('llm_model', llmModel);
          form.append('vocabulary', exportLayout.terms);
          form.append('min_seconds', String(exportLayout.minSeconds));
          form.append('max_seconds', String(exportLayout.maxSeconds));
        } else {
          form.append('selectedModel', selectedModel);
        }
        const endpoint = geminiReadsLink
          ? 'analyze-url'
          : fromTimestamps
            ? 'clips-from-timestamps'
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
        setSourceDuration(Number(data.duration_seconds) || 0);
        setPickedBy(typeof data.model === 'string' ? data.model : '');
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
          youtubeUrl: youtubeUrl.trim(),
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

  const handleDownloadSelected = async () => {
    if (!BACKEND_URL || !sourceVideoId) {
      window.alert(NO_SOURCE_MESSAGE);
      return;
    }
    const queue = rankedClips.filter((c) => batchSelectedClipIds.includes(c.clip_id));
    const failed: string[] = [];
    let saved = 0;
    for (let i = 0; i < queue.length; i++) {
      setBatchProgress({ done: i, total: queue.length });
      try {
        const savedTo = await renderAndSaveClip(queue[i], sourceVideoId, {
          broll: brollByClip[queue[i].clip_id] ?? [],
          burnInCaptions,
          dynamicZoom,
          captionPreset,
          exportLayout,
        });
        if (savedTo) saved += 1;
      } catch {
        failed.push(queue[i].title);
      }
    }
    setBatchProgress(null);
    setBatchSelectedClipIds([]);
    if (saved) setSavedNotice({ count: saved, path: null });
    if (failed.length) window.alert(`Couldn't render: ${failed.join(', ')}`);
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
          s = Math.max(0, Math.min(e - 5, s + deltaSeconds));
        } else {
          e = Math.max(s + 5, e + deltaSeconds);
        }
        return {
          ...c,
          origin_start: c.origin_start ?? c.start_time,
          origin_end: c.origin_end ?? c.end_time,
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

  const rankedClips = [...clips].sort((a, b) => b.virality_score - a.virality_score);
  const timelineDuration = Math.max(
    sourceDuration,
    ...clips.map((c) => timestampToSeconds(c.end_time))
  );
  const isLinkRun = !videoFile || Boolean(youtubeUrl.trim());
  const processingSteps = [
    isLinkRun ? 'Download the video' : 'Upload the video',
    'Transcribe the audio',
    'Pick the best moments',
  ];
  const stageText = progressStageLabel.toLowerCase();
  const currentProcessingStep = /pick|gemini|watching/.test(stageText)
    ? 2
    : /transcrib/.test(stageText)
      ? 1
      : 0;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="h-14 border-b border-line">
        <div className="h-full max-w-6xl mx-auto px-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToStep1}
            className="flex items-center gap-2 rounded-md cursor-pointer"
            aria-label="ClipperX home"
          >
            <span className="w-7 h-7 rounded-md bg-accent text-on-accent flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">ClipperX</span>
          </button>

          <div className="flex items-center gap-1.5">
            {step === 'results' && (
              <button
                type="button"
                onClick={handleResetToStep1}
                className="h-9 px-3 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New video
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              className="h-9 px-3 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 py-8 flex flex-col">
        {step === 'import' && (
          <section className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto -mt-8">
            <h1 className="text-[32px] sm:text-[40px] leading-[1.1] font-semibold tracking-tight text-center text-balance">
              Turn a long video into short clips
            </h1>
            <p className="mt-3 text-[15px] text-ink-muted text-center max-w-md">
              Paste a link or drop a file. ClipperX finds the best moments, frames the
              speaker and adds captions.
            </p>

            {pipelineError && (
              <div
                role="alert"
                className="mt-6 w-full rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                {pipelineError}
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`mt-8 w-full rounded-2xl border bg-surface transition-colors ${
                isDragging ? 'border-accent ring-4 ring-accent/20' : 'border-line'
              }`}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (youtubeUrl.trim()) runGenerationPipeline();
                }}
                className="flex items-center gap-2 p-2"
              >
                <Link2 className="w-4 h-4 ml-3 text-ink-subtle shrink-0" aria-hidden />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste a video link"
                  aria-label="Video link"
                  className="flex-1 min-w-0 h-11 bg-transparent text-[15px] placeholder:text-ink-subtle focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!youtubeUrl.trim()}
                  className="h-11 px-5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
                >
                  Get clips
                </button>
              </form>
              <div className="border-t border-line px-5 py-3.5 flex items-center justify-between gap-3 text-sm text-ink-muted">
                <span>{isDragging ? 'Drop to upload' : 'Or drop a video file here'}</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 rounded-lg border border-line text-ink hover:bg-surface-2 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4" />
                  Choose file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSelectFile(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-3 w-full">
              {showTimestamps || timestampsText ? (
                <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="timestamps" className="text-sm font-medium">
                      Clip these exact moments
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTimestampsText('');
                        setShowTimestamps(false);
                      }}
                      className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                    >
                      Let the AI pick instead
                    </button>
                  </div>
                  <textarea
                    id="timestamps"
                    rows={4}
                    value={timestampsText}
                    onChange={(e) => setTimestampsText(e.target.value)}
                    placeholder={'One clip per line, e.g.\nNate Soares on Tucker · 54:38 to 56:22 · \u201cThe AIs then started...\u201d\nCoxon on CNN · 0:00 to 0:10, then 0:25 to 0:53'}
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent resize-y"
                  />
                  <p className="text-xs text-ink-subtle">
                    Paste these first, then add the video above. Several ranges on one line make
                    one clip that jumps between them; a quoted line becomes the hook.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTimestamps(true)}
                  className="mx-auto block text-sm text-ink-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                >
                  Have exact timestamps? Clip those instead
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-ink-muted rounded-md px-2 py-1 hover:text-ink cursor-pointer"
              title="Change settings"
            >
              {[
                exportLayout.aspectRatio,
                exportLayout.framing === 'auto'
                  ? 'Auto framing'
                  : exportLayout.framing === 'speaker'
                    ? 'Speaker crop'
                    : 'Fit with blur',
                maxClips >= 40 ? 'As many clips as possible' : `Up to ${maxClips} clips`,
                ...(exportLayout.bannerDataUrl ? ['Banner'] : []),
                ...(exportLayout.logoDataUrl ? ['Logo'] : []),
              ].map((chip) => (
                <span key={chip} className="rounded-full bg-surface-2 px-2.5 py-1">
                  {chip}
                </span>
              ))}
              <span className="px-1 underline underline-offset-2">Change</span>
            </button>

            {IS_DESKTOP && desktopInfo && !desktopInfo.keys.openrouter && !desktopInfo.keys.gemini && (
              <p className="mt-6 text-sm text-ink-muted text-center">
                Add an OpenRouter API key to start.{' '}
                <button
                  type="button"
                  onClick={() => setActiveModal('settings')}
                  className="font-medium text-ink underline underline-offset-2 cursor-pointer"
                >
                  Open settings
                </button>
              </p>
            )}
            {IS_DESKTOP && desktopInfo && !desktopInfo.whisper_ready && (
              <p className="mt-3 text-xs text-ink-subtle text-center flex items-center gap-1.5">
                {desktopInfo.whisper_error ? (
                  <>Couldn&rsquo;t download the speech model: {desktopInfo.whisper_error}. It will retry when you start.</>
                ) : (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Downloading the speech model (first run only, about 480 MB)
                  </>
                )}
              </p>
            )}
          </section>
        )}

        {step === 'processing' && (
          <section className="flex-1 flex items-center justify-center" aria-live="polite">
            <div className="w-full max-w-md">
              <ol className="space-y-1">
                {processingSteps.map((label, i) => {
                  const state = i < currentProcessingStep ? 'done' : i === currentProcessingStep ? 'active' : 'todo';
                  return (
                    <li
                      key={label}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                        state === 'active' ? 'bg-surface border border-line' : 'border border-transparent'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                          state === 'done'
                            ? 'bg-accent text-on-accent'
                            : state === 'active'
                              ? 'border-2 border-accent text-ink'
                              : 'border border-line text-ink-subtle'
                        }`}
                      >
                        {state === 'done' ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <span className={`text-sm ${state === 'todo' ? 'text-ink-subtle' : 'text-ink font-medium'}`}>
                        {label}
                      </span>
                      {state === 'active' && <Loader2 className="w-4 h-4 ml-auto animate-spin text-ink-muted" />}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-6 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-ink-muted flex justify-between gap-4">
                <span className="truncate">{progressStageLabel}</span>
                <span className="tabular-nums shrink-0">{progressPct}%</span>
              </p>
              <p className="mt-6 text-xs text-ink-subtle">
                Long videos take a while to transcribe. You can leave this open; the clips appear
                here when they're ready.
              </p>
            </div>
          </section>
        )}

        {step === 'results' && (
          <section className="space-y-6 pb-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
                </h2>
                <p className="text-sm text-ink-muted">
                  Best first. Hover to preview, click a title to rename.
                  {pickedBy && (
                    <span className="text-ink-subtle">
                      {' '}Picked by{' '}
                      {OPENROUTER_MODELS.find((m) => m.id === pickedBy)?.label.split(':')[0] ||
                        pickedBy.split('/').pop()?.replace(':free', ' (free)')}
                      .
                    </span>
                  )}
                </p>
              </div>
            </div>

            {timelineDuration > 0 && (
              <div>
                <div className="relative h-9 rounded-lg bg-surface-2 overflow-hidden" role="list" aria-label="Where each clip comes from in the video">
                  {rankedClips.map((clip, i) => {
                    const start = timestampToSeconds(clip.start_time);
                    const end = timestampToSeconds(clip.end_time);
                    return (
                      <button
                        key={clip.clip_id}
                        type="button"
                        role="listitem"
                        title={`${i + 1}. ${clip.title} (${formatClock(start)} to ${formatClock(end)})`}
                        onClick={() =>
                          document.getElementById(`clip-${clip.clip_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                        className="absolute inset-y-1.5 rounded-sm bg-accent hover:bg-accent-hover cursor-pointer"
                        // 1px gap on each side so back-to-back clips read as separate pieces
                        style={{
                          left: `calc(${(start / timelineDuration) * 100}% + 1px)`,
                          width: `max(3px, calc(${((end - start) / timelineDuration) * 100}% - 2px))`,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-ink-subtle tabular-nums">
                  <span>0:00</span>
                  <span>{formatClock(timelineDuration)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {rankedClips.map((clip) => (
                <div key={clip.clip_id} id={`clip-${clip.clip_id}`}>
                  <MinimalVerticalClipCard
                    clip={clip}
                    videoFileUrl={videoFileUrl}
                    sourceVideoId={sourceVideoId}
                    exportLayout={exportLayout}
                    broll={brollByClip[clip.clip_id] ?? []}
                    captionPreset={captionPreset}
                    burnInCaptions={burnInCaptions}
                    dynamicZoom={dynamicZoom}
                    isBatchSelected={batchSelectedClipIds.includes(clip.clip_id)}
                    onToggleBatchSelect={() =>
                      setBatchSelectedClipIds((prev) =>
                        prev.includes(clip.clip_id)
                          ? prev.filter((id) => id !== clip.clip_id)
                          : [...prev, clip.clip_id]
                      )
                    }
                    onChangeTitle={(newTitle) => handleUpdateClipTitle(clip.clip_id, newTitle)}
                    onAdjustTrim={(edge, delta) => handleAdjustClipTimestamp(clip.clip_id, edge, delta)}
                    onOpenModal={(modalType) => {
                      setActiveClipId(clip.clip_id);
                      setActiveModal(modalType);
                    }}
                    onSaved={(path) => setSavedNotice({ count: 1, path })}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 "
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
                className="sticky top-3 float-right mr-3 mt-3 z-50 w-8 h-8 rounded-lg bg-surface border border-line text-ink hover:text-ink flex items-center justify-center cursor-pointer"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 "
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
                className="sticky top-3 float-right mr-3 mt-3 z-50 w-8 h-8 rounded-lg bg-surface border border-line text-ink hover:text-ink flex items-center justify-center cursor-pointer"
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

      <AnimatePresence>
        {activeModal === 'broll' && activeClip && (
          <BrollPanel
            clip={activeClip}
            inserts={brollByClip[activeClip.clip_id] ?? []}
            onChange={(inserts) =>
              setBrollByClip((prev) => ({ ...prev, [activeClip.clip_id]: inserts }))
            }
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'post' && activeClip && (
          <PostCaptionPanel clip={activeClip} options={exportLayout} onClose={() => setActiveModal(null)} />
        )}
      </AnimatePresence>

      {/* 3. 📊 Score Breakdown Modal (`ViralityInsightsModal`) */}
      <ViralityInsightsModal
        clip={activeClip}
        isOpen={activeModal === 'insights'}
        onClose={() => setActiveModal(null)}
      />



      {/* 6. ⚙️ Advanced Settings Modal (Triggered from top-right gear icon) */}
      <AnimatePresence>
        {activeModal === 'settings' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="fixed inset-0 z-50 flex justify-end bg-overlay"
          >
            <motion.div
              role="dialog"
              aria-label="Settings"
              initial={{ x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-md border-l border-line bg-surface overflow-y-auto"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 h-14">
                <h3 className="text-[15px] font-semibold">Settings</h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  aria-label="Close settings"
                  className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {IS_DESKTOP && desktopInfo && (
                  <DesktopSettings info={desktopInfo} onChange={setDesktopInfo} />
                )}

              <div className="space-y-4">
                <PresetBar
                  backendUrl={BACKEND_URL}
                  current={{ layout: exportLayout, captionPreset, burnInCaptions, dynamicZoom }}
                  onApply={(saved) => {
                    setExportLayout({ ...DEFAULT_EXPORT_LAYOUT, ...saved.layout });
                    if (saved.captionPreset) setCaptionPreset(saved.captionPreset);
                    setBurnInCaptions(saved.burnInCaptions ?? true);
                    setDynamicZoom(saved.dynamicZoom ?? true);
                  }}
                />

                <div className="space-y-1.5">
                  <label htmlFor="terms" className="text-xs font-medium text-ink block">
                    Names and terms
                  </label>
                  <textarea
                    id="terms"
                    rows={2}
                    value={exportLayout.terms}
                    onChange={(e) => updateLayout({ terms: e.target.value })}
                    placeholder="Greg LaVecchia, Bloom Nutrition, Iced Coffee Hour"
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="text-[11px] text-ink-subtle">
                    Spelled correctly in captions and highlighted, along with numbers. Separate with
                    commas.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink block">
                    Analysis engine
                  </label>
                  <select
                    value={analysisEngine}
                    onChange={(e) =>
                      setAnalysisEngine(e.target.value as 'transcript' | 'gemini')
                    }
                    className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                  >
                    <option value="transcript">Transcript (Whisper + OpenRouter)</option>
                    <option value="gemini">Gemini watches the video</option>
                  </select>
                  <p className="text-[11px] text-ink-subtle">
                    {analysisEngine === 'transcript'
                      ? 'Precise word captions from the audio, no daily quota.'
                      : 'Sees visuals too, but slow on long videos and has a daily quota.'}
                  </p>
                </div>

                {analysisEngine === 'transcript' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink block">
                      Clip-picking model
                    </label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                    >
                      <optgroup label="Free">
                        {OPENROUTER_MODELS.filter((m) => m.free).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Paid (needs OpenRouter credit)">
                        {OPENROUTER_MODELS.filter((m) => !m.free).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-[11px] text-ink-subtle">
                      Free models have a daily limit and can be busy; auto switches to the next
                      free one when that happens.
                    </p>
                  </div>
                )}

                <div
                  className={`space-y-1.5 ${analysisEngine === 'gemini' ? '' : 'hidden'}`}
                >
                  <label className="text-xs font-medium text-ink block">
                    Gemini model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) =>
                      setSelectedModel(
                        e.target.value as 'gemini-flash-latest' | 'gemini-pro-latest'
                      )
                    }
                    className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                  >
                    <option value="gemini-flash-latest">Gemini Flash (latest)</option>
                    <option value="gemini-pro-latest">Gemini Pro (latest)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink block">
                    Number of clips
                  </label>
                  <select
                    value={maxClips}
                    onChange={(e) => setMaxClips(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
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

                <div className="space-y-3 rounded-xl border border-line p-3.5">
                  <p className="text-xs font-semibold text-ink">Export layout</p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <label htmlFor="layout-ratio" className="text-xs font-medium text-ink block">
                        Aspect ratio
                      </label>
                      <select
                        id="layout-ratio"
                        value={exportLayout.aspectRatio}
                        onChange={(e) => updateLayout({ aspectRatio: e.target.value as ExportLayout['aspectRatio'] })}
                        className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                      >
                        <option value="9:16">9:16 Shorts / Reels</option>
                        <option value="4:5">4:5 Feed</option>
                        <option value="1:1">1:1 Square</option>
                        <option value="16:9">16:9 Landscape</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="layout-framing" className="text-xs font-medium text-ink block">
                        Framing
                      </label>
                      <select
                        id="layout-framing"
                        value={exportLayout.framing}
                        onChange={(e) => updateLayout({ framing: e.target.value as ExportLayout['framing'] })}
                        className="w-full h-9 px-3 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                      >
                        <option value="auto">Auto</option>
                        <option value="speaker">Speaker crop</option>
                        <option value="fit">Fit with blur</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-3 text-xs text-ink">
                    <span>
                      Hook line
                      <span className="block text-[11px] text-ink-subtle">
                        The clip&rsquo;s title at the top for the first 3 seconds
                      </span>
                    </span>
                    <Switch
                      checked={exportLayout.hookLine}
                      onCheckedChange={(on) => updateLayout({ hookLine: on })}
                    />
                  </label>
                  <p className="text-[11px] text-ink-subtle">
                    {exportLayout.framing === 'auto'
                      ? 'People talking: crops onto the speaker. Anything else: fits the whole frame over a blur.'
                      : exportLayout.framing === 'speaker'
                        ? 'Always crops onto the person speaking.'
                        : 'Always shows the whole frame over a blurred copy.'}
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-ink block">Banner</span>
                    {exportLayout.bannerDataUrl ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={exportLayout.bannerDataUrl} alt="" className="h-8 max-w-[96px] rounded object-contain bg-black/40" />
                        <select
                          aria-label="Banner position"
                          value={exportLayout.bannerPosition}
                          onChange={(e) => updateLayout({ bannerPosition: e.target.value as ExportLayout['bannerPosition'] })}
                          className="flex-1 h-8 px-2 rounded-lg bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                        >
                          <option value="bottom">Footer</option>
                          <option value="top">Header</option>
                          <option value="background">Behind the video</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => updateLayout({ bannerDataUrl: null, bannerName: '' })}
                          className="h-8 px-2.5 rounded-lg border border-line text-xs text-ink hover:text-ink cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-9 items-center justify-center rounded-xl border border-dashed border-line text-xs text-ink-muted hover:text-ink hover:border-line cursor-pointer">
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
                    <span className="text-xs font-medium text-ink block">Logo or watermark</span>
                    {exportLayout.logoDataUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={exportLayout.logoDataUrl} alt="" className="h-8 w-8 rounded object-contain bg-black/40" />
                          <select
                            aria-label="Logo position"
                            value={exportLayout.logoPosition}
                            onChange={(e) => updateLayout({ logoPosition: e.target.value as ExportLayout['logoPosition'] })}
                            className="flex-1 h-8 px-2 rounded-lg bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-line"
                          >
                            <option value="top-left">Top left</option>
                            <option value="top-right">Top right</option>
                            <option value="bottom-left">Bottom left</option>
                            <option value="bottom-right">Bottom right</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => updateLayout({ logoDataUrl: null, logoName: '' })}
                            className="h-8 px-2.5 rounded-lg border border-line text-xs text-ink hover:text-ink cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
                          <span className="w-14">Size</span>
                          <input
                            type="range" min={0.05} max={0.4} step={0.01}
                            value={exportLayout.logoSize}
                            onChange={(e) => updateLayout({ logoSize: Number(e.target.value) })}
                            className="flex-1 accent-[#7C3AED]"
                          />
                          <span className="w-9 text-right tabular-nums">{Math.round(exportLayout.logoSize * 100)}%</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
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
                      <label className="flex h-9 items-center justify-center rounded-xl border border-dashed border-line text-xs text-ink-muted hover:text-ink hover:border-line cursor-pointer">
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
                  {layoutError && <p role="alert" className="text-[11px] text-danger">{layoutError}</p>}
                </div>

                <CampaignSettingsSections
                  options={exportLayout}
                  onChange={(changes) => updateLayout(changes)}
                  backendUrl={BACKEND_URL}
                />

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between rounded-xl bg-canvas px-3.5 py-2.5 border border-line">
                    <span className="text-xs font-medium text-ink">
                      Burn-in captions
                    </span>
                    <Switch
                      checked={burnInCaptions}
                      onCheckedChange={setBurnInCaptions}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-canvas px-3.5 py-2.5 border border-line">
                    <span className="text-xs font-medium text-ink">
                      Zoom pulse (fit framing)
                    </span>
                    <Switch
                      checked={dynamicZoom}
                      onCheckedChange={setDynamicZoom}
                    />
                  </div>


                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full h-10 rounded-lg bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {savedNotice && (
        <div role="status" className="fixed bottom-5 left-5 z-40 flex items-center gap-3 rounded-xl border border-line bg-surface pl-4 pr-2 py-2 shadow-lg">
          <Check className="w-4 h-4 text-success" />
          <span className="text-sm">
            {savedNotice.count === 1 ? 'Clip saved' : `${savedNotice.count} clips saved`}
          </span>
          <button
            type="button"
            onClick={() => showInFolder(savedNotice.path)}
            className="h-8 px-3 rounded-lg text-sm font-medium hover:bg-surface-2 cursor-pointer"
          >
            Show in folder
          </button>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            aria-label="Dismiss"
            className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {step === 'results' && batchSelectedClipIds.length > 0 && (
        <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface pl-4 pr-2 py-2 shadow-lg">
            <span className="text-sm font-medium tabular-nums">
              {batchProgress
                ? `Rendering ${batchProgress.done + 1} of ${batchProgress.total}`
                : `${batchSelectedClipIds.length} selected`}
            </span>
            {!batchProgress && (
              <button
                type="button"
                onClick={() => setBatchSelectedClipIds(rankedClips.map((c) => c.clip_id))}
                className="h-9 px-3 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                Select all
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadSelected}
              disabled={Boolean(batchProgress)}
              className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {batchProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {batchProgress ? 'Downloading' : 'Download selected'}
            </button>
            {!batchProgress && (
              <button
                type="button"
                onClick={() => setBatchSelectedClipIds([])}
                aria-label="Clear selection"
                className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
