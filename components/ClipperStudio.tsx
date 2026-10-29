'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Youtube,
  Sparkles,
  Scissors,
  Download,
  Copy,
  Check,
  Code2,
  AlertCircle,
  Film,
  Terminal,
  Loader2,
  Plus,
  Clapperboard,
  SlidersHorizontal,
  Play,
  Flame,
  Clock,
  Wand2,
} from 'lucide-react';
import VerticalShortPlayer, {
  ViralClipSegment,
  CaptionPresetName,
  timestampToSeconds,
} from './VerticalShortPlayer';
import PipelineProgressModal from './PipelineProgressModal';
import {
  STREAMLIT_APP_PY_CODE,
  REQUIREMENTS_TXT,
  GEMINI_CLIP_DETECTION_PROMPT,
  FFMPEG_SOTA_FILTER_COMPLEX,
  detectContextualEmojis,
} from '@/lib/python-script';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type PipelineStep =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'detecting'
  | 'rendering';

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
      'Opens with a direct, contrarian technical claim in the first 3.5 seconds, then delivers a complete 3-part explanation with natural sentence boundaries.',
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
  },
  {
    clip_id: 2,
    title: 'The Zero-Jitter EMA Face Reframing Formula Explained',
    start_time: '00:11:30.000',
    end_time: '00:12:14.400',
    duration_seconds: 44.4,
    virality_score: 92,
    hook_transcript:
      'Never center-crop a two-person podcast without an exponential moving average filter.',
    reasoning:
      'Delivers an immediately applicable computer-vision formula (x = clamp(X_face - 540)) with a strong visual payoff.',
    transcript_lines: [
      {
        start_offset: 0.0,
        end_offset: 5.0,
        text: 'Never center-crop a podcast without exponential smoothing',
      },
      {
        start_offset: 5.0,
        end_offset: 13.0,
        text: 'raw MediaPipe bounding boxes jitter on every head nod.',
      },
      {
        start_offset: 13.0,
        end_offset: 24.0,
        text: 'Clamp X_face minus 540 and apply a 0.15 EMA weight',
      },
      {
        start_offset: 24.0,
        end_offset: 35.0,
        text: 'so the 9:16 virtual camera glides like a human operator.',
      },
      {
        start_offset: 35.0,
        end_offset: 44.4,
        text: 'That is how top creators win retention on Shorts.',
      },
    ],
  },
  {
    clip_id: 3,
    title: 'The Hidden Cost of Unbuffered FFmpeg Subprocess Calls',
    start_time: '00:18:04.000',
    end_time: '00:18:46.500',
    duration_seconds: 42.5,
    virality_score: 87,
    hook_transcript:
      'We crashed a 64-core render node in twelve seconds because of one missing FFmpeg flag.',
    reasoning:
      'High-stakes engineering war story hook with immediate curiosity gap and a clear, actionable resolution for developers.',
    transcript_lines: [
      {
        start_offset: 0.0,
        end_offset: 5.0,
        text: 'We crashed a 64-core render node in twelve seconds',
      },
      {
        start_offset: 5.0,
        end_offset: 11.5,
        text: 'because of one hidden FFmpeg filter flag.',
      },
      {
        start_offset: 11.5,
        end_offset: 20.0,
        text: 'When you scale 4K video and run sidechain audio ducking',
      },
      {
        start_offset: 20.0,
        end_offset: 31.0,
        text: 'always trim timestamps before applying boxblur or zoompan.',
      },
      {
        start_offset: 31.0,
        end_offset: 42.5,
        text: 'That single secret cut cloud money cost by 84 percent.',
      },
    ],
  },
  {
    clip_id: 4,
    title: 'Why Lower-Third Safe Zones Decide Short-Form Click-Through',
    start_time: '00:37:20.100',
    end_time: '00:38:11.600',
    duration_seconds: 51.5,
    virality_score: 81,
    hook_transcript:
      'If your captions sit in the bottom 250 pixels of a vertical video, nobody can read them.',
    reasoning:
      'Addresses a universal creator pain point with concrete visual geometry rules (MarginV 520px in ASS subtitles).',
    transcript_lines: [
      {
        start_offset: 0.0,
        end_offset: 5.2,
        text: 'If your captions sit in the bottom 250 pixels',
      },
      {
        start_offset: 5.2,
        end_offset: 12.0,
        text: 'of a viral vertical video, nobody can read them.',
      },
      {
        start_offset: 12.0,
        end_offset: 24.0,
        text: 'TikTok, Reels, and Shorts cover the bottom fifth with UI chrome.',
      },
      {
        start_offset: 24.0,
        end_offset: 38.0,
        text: 'Lock your ASS karaoke MarginV at 520 pixels on a 1920 canvas',
      },
      {
        start_offset: 38.0,
        end_offset: 51.5,
        text: 'so every Hormozi yellow caption stays 100% unobstructed.',
      },
    ],
  },
];

function secondsToTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const remainder = safe % 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
}

export default function ClipperStudio() {
  // Real API Key connection status from backend health check
  const [apiKeyReady, setApiKeyReady] = useState<boolean>(true);

  // Left Panel: Source Media & Control Center State
  const [sourceTab, setSourceTab] = useState<string>('upload');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(2700);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [transcriptContext, setTranscriptContext] = useState<string>(
    'Deep-dive engineering interview covering multimodal AI video editing, FFmpeg filterchains, 9:16 vertical framing, and short-form viewer retention mechanics.'
  );

  // Model selector dropdown (Gemini 2.5 Flash / Gemini 2.5 Pro)
  const [selectedModel, setSelectedModel] = useState<
    'gemini-2.5-flash' | 'gemini-2.5-pro'
  >('gemini-2.5-flash');

  // Settings Toggles ("Burn-in Captions", "Dynamic Zoom", "Auto Face Centering", + "Audio Ducking")
  const [burnInCaptions, setBurnInCaptions] = useState<boolean>(true);
  const [dynamicZoom, setDynamicZoom] = useState<boolean>(true);
  const [autoFaceCentering, setAutoFaceCentering] = useState<boolean>(true);
  const [enableAudioDucking, setEnableAudioDucking] = useState<boolean>(true);
  const [captionPreset, setCaptionPreset] =
    useState<CaptionPresetName>('Hormozi Pop');

  // Pipeline & Gemini analysis state
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelinePercent, setPipelinePercent] = useState<number>(0);
  const [pipelineStatusText, setPipelineStatusText] = useState<string>(
    'Ready to analyze long-form video track'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Right Panel: Viral Clip Candidates & Timeline Preview State
  const [clips, setClips] = useState<ViralClipSegment[]>(INITIAL_DEMO_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<number>(1);
  const [candidateFilterTab, setCandidateFilterTab] = useState<string>('all');
  const [renderedClipIds, setRenderedClipIds] = useState<number[]>([]);
  const [renderingClipId, setRenderingClipId] = useState<number | null>(null);

  // Code Modal / Tab state
  const [activeCodeTab, setActiveCodeTab] = useState<
    'app_py' | 'stage1_prompt' | 'stage2_ffmpeg' | 'requirements'
  >('app_py');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  // Check server-side Gemini API key availability on mount
  useEffect(() => {
    fetch('/api/analyze')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.apiKeyConfigured === 'boolean') {
          setApiKeyReady(d.apiKeyConfigured);
        }
      })
      .catch(() => {});
  }, []);

  // Always keep clips ordered by Virality Score descending
  const sortedClips = [...clips].sort(
    (a, b) => b.virality_score - a.virality_score
  );

  const filteredClips = sortedClips.filter((clip) => {
    if (candidateFilterTab === 'high') return clip.virality_score >= 90;
    if (candidateFilterTab === 'medium')
      return clip.virality_score >= 75 && clip.virality_score < 90;
    return true;
  });

  const selectedClip =
    sortedClips.find((c) => c.clip_id === selectedClipId) || sortedClips[0];

  const loadSelectedVideoFile = (file: File) => {
    setErrorMessage(null);
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoFileUrl(url);

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration && Number.isFinite(tempVideo.duration)) {
        setVideoDurationSec(Math.round(tempVideo.duration));
      }
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadSelectedVideoFile(file);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadSelectedVideoFile(file);
  };

  // Sample up to 4 keyframes from uploaded local video for multimodal Gemini analysis
  const extractKeyframesFromVideo = async (
    fileUrl: string
  ): Promise<Array<{ mimeType: string; data: string }>> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = fileUrl;
      video.muted = true;
      video.playsInline = true;
      const frames: Array<{ mimeType: string; data: string }> = [];

      video.onloadeddata = async () => {
        const dur = Number.isFinite(video.duration) ? video.duration : 60;
        const sampleTimes = [0.15, 0.4, 0.65, 0.85].map((p) => p * dur);
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');

        for (const t of sampleTimes) {
          try {
            await new Promise<void>((res) => {
              const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                res();
              };
              video.addEventListener('seeked', onSeeked);
              video.currentTime = t;
            });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
              const base64 = dataUrl.split(',')[1];
              if (base64) {
                frames.push({ mimeType: 'image/jpeg', data: base64 });
              }
            }
          } catch {
            // Continue if seek fails
          }
        }
        resolve(frames);
      };

      video.onerror = () => resolve([]);
    });
  };

  // Primary Action: Analyze & Detect Clips
  const handleAnalyzeAndDetectClips = async () => {
    setErrorMessage(null);

    if (sourceTab === 'youtube' && !youtubeUrl.trim()) {
      setErrorMessage(
        'Please paste a valid YouTube URL in the import box or switch to File Upload.'
      );
      return;
    }

    try {
      setPipelineStep('uploading');
      setPipelinePercent(22);
      setPipelineStatusText(
        'Stage 1/4: Ingesting media stream & sampling keyframes...'
      );

      let sampledFrames: Array<{ mimeType: string; data: string }> = [];
      if (videoFileUrl) {
        sampledFrames = await extractKeyframesFromVideo(videoFileUrl);
      }

      setPipelineStep('analyzing');
      setPipelinePercent(56);
      setPipelineStatusText(
        `Stage 2/4: Analyzing multimodal track with ${
          selectedModel === 'gemini-2.5-pro'
            ? 'Gemini 2.5 Pro'
            : 'Gemini 2.5 Flash'
        }...`
      );

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle:
            videoFile?.name ||
            (youtubeUrl
              ? `YouTube: ${youtubeUrl}`
              : 'ClipperX Studio Podcast Session'),
          videoDurationSeconds: videoDurationSec,
          youtubeUrl: sourceTab === 'youtube' ? youtubeUrl : '',
          transcriptContext,
          selectedModel,
          frames: sampledFrames,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(
          data.error || 'Gemini video analysis returned an error.'
        );
      }

      setPipelineStep('detecting');
      setPipelinePercent(86);
      setPipelineStatusText(
        'Stage 3/4: Ranking Virality Scores & word-level karaoke boundaries...'
      );

      await new Promise((r) => setTimeout(r, 300));

      if (Array.isArray(data.clips) && data.clips.length > 0) {
        setClips(data.clips);
        setSelectedClipId(data.clips[0].clip_id);
        setCandidateFilterTab('all');
      }

      setPipelineStep('rendering');
      setPipelinePercent(100);
      setPipelineStatusText(
        `Analysis Complete — ${
          data.clips?.length || clips.length
        } viral segments ranked by Virality Score`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to analyze video track.';
      setErrorMessage(msg);
      setPipelineStep('idle');
      setPipelinePercent(0);
      setPipelineStatusText('Analysis interrupted — review message below.');
    }
  };

  // Inline ±2s Start/End Timestamp Adjustments
  const handleAdjustTimestamp = (
    clipId: number,
    boundary: 'start' | 'end',
    deltaSeconds: number
  ) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.clip_id !== clipId) return c;
        let startSec = timestampToSeconds(c.start_time);
        let endSec = timestampToSeconds(c.end_time);

        if (boundary === 'start') {
          const candidate = Math.max(0, startSec + deltaSeconds);
          if (endSec - candidate >= 5) {
            startSec = candidate;
          }
        } else {
          const candidate = Math.max(startSec + 5, endSec + deltaSeconds);
          endSec = candidate;
        }

        const newDuration = Number((endSec - startSec).toFixed(1));
        return {
          ...c,
          start_time: secondsToTimestamp(startSec),
          end_time: secondsToTimestamp(endSec),
          duration_seconds: newDuration,
        };
      })
    );
  };

  // Trigger 9:16 Short Render for a specific card
  const handleTriggerCardRender = (clip: ViralClipSegment) => {
    setSelectedClipId(clip.clip_id);
    setRenderingClipId(clip.clip_id);
    previewSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
    window.setTimeout(() => {
      setRenderedClipIds((prev) =>
        prev.includes(clip.clip_id) ? prev : [...prev, clip.clip_id]
      );
      setRenderingClipId(null);
    }, 900);
  };

  // Header "New Project" Button Handler
  const handleNewProject = () => {
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
    }
    setVideoFile(null);
    setVideoFileUrl(null);
    setYoutubeUrl('');
    setErrorMessage(null);
    setRenderedClipIds([]);
    setPipelineStep('idle');
    setPipelinePercent(0);
    setPipelineStatusText('New project initialized — upload video or paste URL');
    setClips(INITIAL_DEMO_CLIPS);
    setSelectedClipId(1);
  };

  const handleDownloadPythonFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const getDisplayedCode = () => {
    if (activeCodeTab === 'app_py') return STREAMLIT_APP_PY_CODE;
    if (activeCodeTab === 'stage1_prompt') return GEMINI_CLIP_DETECTION_PROMPT;
    if (activeCodeTab === 'stage2_ffmpeg') return FFMPEG_SOTA_FILTER_COMPLEX;
    return REQUIREMENTS_TXT;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getDisplayedCode());
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const isAnalyzing =
    pipelineStep === 'uploading' ||
    pipelineStep === 'analyzing' ||
    pipelineStep === 'detecting';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 relative overflow-x-hidden">
      {/* Subtle Violet / Cyan Ambient Glow Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-violet-600/12 blur-[130px]" />
        <div className="absolute top-20 -right-40 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[130px]" />
      </div>

      {/* 1. HEADER BAR: App Logo with Gradient Badge ("ClipperX AI"), API Key Status Indicator, and "New Project" Button */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Brand Logo + Gradient Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-sm shadow-violet-500/20">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
                ClipperX
              </span>
              <Badge variant="gradient">ClipperX AI</Badge>
            </div>
          </div>

          {/* Center Status & SOTA Pipeline Summary */}
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <span className="font-mono">
              9:16 Dual-Layer &amp; Face Reframing
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Hormozi ASS Karaoke</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setCandidateFilterTab('code')}
              className="hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Python app.py</span>
            </button>
          </div>

          {/* Right Actions: API Key Status Indicator (Green Pill Dot) + New Project Button */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              title="Server-side GEMINI_API_KEY status"
              className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  apiKeyReady
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400'
                }`}
              />
              <span className="whitespace-nowrap">
                {apiKeyReady ? 'API Key Ready' : 'API Key Missing'}
              </span>
            </div>

            <Button
              variant="secondary"
              size="default"
              onClick={handleNewProject}
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              New Project
            </Button>
          </div>
        </div>
      </header>

      {/* 2. MAIN GRID: Two-Column Split (Left 40% / Right 60%) */}
      <main className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ===============================================================
              LEFT PANEL (40% width -> 5 of 12 cols): Source Media & Control Center
             =============================================================== */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="border-slate-800/90 bg-slate-900/55 shadow-lg shadow-violet-950/10">
              <CardHeader className="pb-4 border-b border-slate-800/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-violet-400" />
                    <CardTitle>Source Media &amp; Control Center</CardTitle>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    Max 2GB · 30m–2h
                  </span>
                </div>
                <CardDescription>
                  Ingest horizontal 16:9 footage or YouTube streams, configure
                  Gemini multimodal detection, and toggle SOTA 9:16 rendering
                  filters.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-5 space-y-6">
                {/* Video Input Tabs: "File Upload (Drag & Drop up to 2GB)" and "YouTube URL Import" */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-200 block">
                    1. Source Video Input
                  </label>
                  <Tabs value={sourceTab} onValueChange={setSourceTab}>
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="upload">
                        <Upload className="w-3.5 h-3.5 text-violet-400" />
                        File Upload (≤2GB)
                      </TabsTrigger>
                      <TabsTrigger value="youtube">
                        <Youtube className="w-3.5 h-3.5 text-cyan-400" />
                        YouTube URL Import
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Drag & Drop File Upload up to 2GB */}
                    <TabsContent value="upload" className="space-y-3">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={handleDropFile}
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
                          isDraggingOver
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : videoFile
                              ? 'border-violet-500/50 bg-violet-500/5'
                              : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="mx-auto w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2.5">
                          <Upload className="w-4 h-4 text-violet-400" />
                        </div>
                        {videoFile ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-white truncate max-w-xs mx-auto">
                              {videoFile.name}
                            </p>
                            <p className="text-[11px] font-mono text-cyan-300 tabular-nums">
                              {(videoFile.size / (1024 * 1024)).toFixed(1)} MB ·
                              Duration {secondsToTimestamp(videoDurationSec)}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-200">
                              Drag &amp; drop MP4, MOV, or WebM here, or click
                              to browse
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Supports long-form 16:9 recordings up to 2GB
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Tab 2: YouTube URL Import */}
                    <TabsContent value="youtube" className="space-y-3">
                      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <label className="block text-xs font-medium text-slate-300">
                          Public YouTube Video URL
                        </label>
                        <div className="relative">
                          <input
                            type="url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-3.5 py-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Uses <code className="font-mono text-slate-300">yt-dlp</code>{' '}
                          stream extraction + Gemini multimodal transcript
                          analysis.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Optional Topic / Transcript Context */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Topic / Audio Context Hint</span>
                      <span className="font-mono tabular-nums">
                        Source length: {Math.floor(videoDurationSec / 60)}m
                      </span>
                    </div>
                    <input
                      type="text"
                      value={transcriptContext}
                      onChange={(e) => setTranscriptContext(e.target.value)}
                      placeholder="Describe podcast topic or paste transcript excerpt..."
                      className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {/* Model Selector Dropdown (Gemini 2.5 Flash / Gemini 2.5 Pro) */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="model-select"
                      className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>2. Multimodal Analysis Model</span>
                    </label>
                    <span className="text-[11px] font-mono text-violet-300">
                      Structured JSON Schema
                    </span>
                  </div>

                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) =>
                      setSelectedModel(
                        e.target.value as 'gemini-2.5-flash' | 'gemini-2.5-pro'
                      )
                    }
                    className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-100 focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash — Fast Multimodal Hook &amp; Timestamp
                      Detection
                    </option>
                    <option value="gemini-2.5-pro">
                      Gemini 2.5 Pro — Deep Semantic Narrative &amp; Virality
                      Reasoning
                    </option>
                  </select>
                </div>

                {/* Settings Toggles: "Burn-in Captions", "Dynamic Zoom", "Auto Face Centering" */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
                      <span>3. SOTA 9:16 Rendering Settings</span>
                    </span>
                    <select
                      aria-label="Caption Preset Theme"
                      value={captionPreset}
                      onChange={(e) =>
                        setCaptionPreset(e.target.value as CaptionPresetName)
                      }
                      className="h-7 px-2 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-medium text-cyan-300 focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="Hormozi Pop">Preset: Hormozi Pop</option>
                      <option value="Minimalist Clean">
                        Preset: Minimalist Clean
                      </option>
                      <option value="Cyber Neon">Preset: Cyber Neon</option>
                    </select>
                  </div>

                  <div className="space-y-2.5">
                    {/* Toggle 1: Burn-in Captions */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-2.5">
                      <div className="pr-3">
                        <div className="text-xs font-medium text-slate-100">
                          Burn-in Captions (ASS Karaoke)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Word-by-word highlight + contextual emojis in safe
                          zone
                        </div>
                      </div>
                      <Switch
                        checked={burnInCaptions}
                        onCheckedChange={setBurnInCaptions}
                      />
                    </div>

                    {/* Toggle 2: Dynamic Zoom */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-2.5">
                      <div className="pr-3">
                        <div className="text-xs font-medium text-slate-100">
                          Dynamic Zoom (1.12x Punch-In)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Alternates 1.0x / 1.12x scale on sentence cut beats
                        </div>
                      </div>
                      <Switch
                        checked={dynamicZoom}
                        onCheckedChange={setDynamicZoom}
                      />
                    </div>

                    {/* Toggle 3: Auto Face Centering */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-2.5">
                      <div className="pr-3">
                        <div className="text-xs font-medium text-slate-100">
                          Auto Face Centering (MediaPipe EMA)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Smooths horizontal speaker crop{' '}
                          <code className="font-mono text-slate-300">
                            x=clamp(X_face-540)
                          </code>
                        </div>
                      </div>
                      <Switch
                        checked={autoFaceCentering}
                        onCheckedChange={setAutoFaceCentering}
                      />
                    </div>

                    {/* Toggle 4: Sidechain Audio Ducking */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-2.5">
                      <div className="pr-3">
                        <div className="text-xs font-medium text-slate-100">
                          Background Music Sidechain Ducking
                        </div>
                        <div className="text-[11px] text-slate-400">
                          FFmpeg{' '}
                          <code className="font-mono text-slate-300">
                            sidechaincompress
                          </code>{' '}
                          (-12dB under voice)
                        </div>
                      </div>
                      <Switch
                        checked={enableAudioDucking}
                        onCheckedChange={setEnableAudioDucking}
                      />
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Primary Action Button: "Analyze & Detect Clips" with Loading Spinner */}
                <div className="space-y-3 pt-1">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleAnalyzeAndDetectClips}
                    disabled={isAnalyzing}
                    className="w-full shadow-md shadow-violet-600/20"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing &amp; Detecting Viral Clips...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Analyze &amp; Detect Clips</span>
                      </>
                    )}
                  </Button>

                  {/* 4-Stage Pipeline Progress Bar & Expandable Modal */}
                  <PipelineProgressModal
                    pipelineStep={pipelineStep}
                    pipelinePercent={pipelinePercent}
                    pipelineStatusText={pipelineStatusText}
                    fileSizeBytes={videoFile?.size ?? null}
                    fileName={
                      videoFile?.name ||
                      (youtubeUrl ? youtubeUrl : 'podcast_master_1080p.mp4')
                    }
                    errorMessage={errorMessage}
                    onRetry={handleAnalyzeAndDetectClips}
                    onSimulateRun={handleAnalyzeAndDetectClips}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Live 9:16 Vertical Preview & Timeline Monitor Docked Under Control Center on Desktop */}
            <div ref={previewSectionRef}>
              {selectedClip && (
                <VerticalShortPlayer
                  clip={selectedClip}
                  videoFileUrl={videoFileUrl}
                  videoFileName={videoFile?.name || 'input.mp4'}
                  captionPreset={captionPreset}
                  enableKaraoke={burnInCaptions}
                  enableZoomCuts={dynamicZoom}
                  enableFaceTracking={autoFaceCentering}
                  enableAudioDucking={enableAudioDucking}
                  onRenderSuccess={(id) =>
                    setRenderedClipIds((prev) =>
                      prev.includes(id) ? prev : [...prev, id]
                    )
                  }
                />
              )}
            </div>
          </div>

          {/* ===============================================================
              RIGHT PANEL (60% width -> 7 of 12 cols): Viral Clip Candidates & Timeline Preview
             =============================================================== */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="border-slate-800/90 bg-slate-900/55 shadow-lg shadow-cyan-950/10">
              <CardHeader className="pb-4 border-b border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-cyan-400" />
                      <CardTitle>
                        Viral Clip Candidates &amp; Timeline Preview
                      </CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      Ordered by Gemini Virality Score (0–100). Fine-tune cut
                      boundaries by ±2s and trigger 9:16 vertical FFmpeg
                      renders.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownloadPythonFile(
                          'app.py',
                          STREAMLIT_APP_PY_CODE
                        )
                      }
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      Export app.py
                    </Button>
                  </div>
                </div>

                {/* Source Video Visual Timeline Overview Bar */}
                <div className="mt-4 pt-3 border-t border-slate-800/70 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>SOURCE TIMELINE DISTRIBUTION</span>
                    </span>
                    <span>
                      00:00:00 → {secondsToTimestamp(videoDurationSec)}
                    </span>
                  </div>
                  <div className="relative w-full h-6 rounded-md bg-slate-950 border border-slate-800 overflow-hidden">
                    {sortedClips.map((c) => {
                      const sSec = timestampToSeconds(c.start_time);
                      const eSec = timestampToSeconds(c.end_time);
                      const total = Math.max(60, videoDurationSec);
                      const leftPct = Math.min(
                        94,
                        Math.max(1, (sSec / total) * 100)
                      );
                      const widthPct = Math.max(
                        3.5,
                        Math.min(25, ((eSec - sSec) / total) * 100)
                      );
                      const isActive = c.clip_id === selectedClip?.clip_id;
                      const isGreen = c.virality_score >= 90;

                      return (
                        <button
                          key={c.clip_id}
                          type="button"
                          onClick={() => setSelectedClipId(c.clip_id)}
                          title={`Clip #${c.clip_id}: ${c.title} (${c.virality_score}/100)`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          className={`absolute top-1 bottom-1 rounded transition-all cursor-pointer ${
                            isActive
                              ? 'ring-2 ring-white z-10'
                              : 'opacity-80 hover:opacity-100'
                          } ${
                            isGreen
                              ? 'bg-emerald-500/70 border border-emerald-400'
                              : 'bg-amber-500/70 border border-amber-400'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-5">
                {/* Tabbed List of Generated Candidate Clips Ordered by Virality Score */}
                <Tabs
                  value={candidateFilterTab}
                  onValueChange={setCandidateFilterTab}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <TabsList>
                      <TabsTrigger value="all">
                        All Candidates ({sortedClips.length})
                      </TabsTrigger>
                      <TabsTrigger value="high">
                        High Viral &gt;90 (
                        {
                          sortedClips.filter((c) => c.virality_score >= 90)
                            .length
                        }
                        )
                      </TabsTrigger>
                      <TabsTrigger value="medium">
                        Strong 75–89 (
                        {
                          sortedClips.filter(
                            (c) =>
                              c.virality_score >= 75 && c.virality_score < 90
                          ).length
                        }
                        )
                      </TabsTrigger>
                      <TabsTrigger value="code">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        Python app.py
                      </TabsTrigger>
                    </TabsList>

                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      Sorted by Virality Score ↓
                    </span>
                  </div>

                  {/* Candidate Clip Cards List */}
                  {candidateFilterTab !== 'code' ? (
                    <div className="space-y-4">
                      {filteredClips.map((clip, rankIdx) => {
                        const isSelected =
                          clip.clip_id === selectedClip?.clip_id;
                        const isGreenTier = clip.virality_score >= 90;
                        const isRendered = renderedClipIds.includes(
                          clip.clip_id
                        );
                        const isRenderingNow = renderingClipId === clip.clip_id;
                        const emojis = detectContextualEmojis(
                          `${clip.title} ${clip.hook_transcript}`
                        );

                        return (
                          <div
                            key={clip.clip_id}
                            onClick={() => setSelectedClipId(clip.clip_id)}
                            className={`rounded-xl border p-5 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-violet-500/70 bg-slate-900/95 shadow-md shadow-violet-950/20'
                                : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                            }`}
                          >
                            {/* Top Row: Clip Title + Virality Score Badge (Green >90, Yellow 75-89) */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 tabular-nums">
                                  <span className="text-cyan-400 font-semibold">
                                    RANK #{rankIdx + 1}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {clip.start_time} → {clip.end_time}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-slate-200 font-semibold">
                                    {clip.duration_seconds.toFixed(1)}s
                                  </span>
                                  {emojis && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{emojis}</span>
                                    </>
                                  )}
                                </div>
                                <h4 className="text-base font-semibold text-white leading-snug">
                                  {clip.title}
                                </h4>
                              </div>

                              {/* Virality Score Badge (Green >90, Yellow 75–89) */}
                              <Badge
                                variant={isGreenTier ? 'green' : 'yellow'}
                                className="text-xs px-3 py-1"
                              >
                                <Flame className="w-3.5 h-3.5" />
                                <span>
                                  Virality {clip.virality_score}/100
                                </span>
                              </Badge>
                            </div>

                            {/* 0-5s Hook Text Box */}
                            <div className="mt-3.5 rounded-lg border border-slate-800/80 bg-slate-900/70 p-3 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-mono text-violet-300">
                                <span>0–5s SPOKEN HOOK TRANSCRIPT</span>
                                <span>
                                  {burnInCaptions
                                    ? `Preset: ${captionPreset}`
                                    : 'Captions Off'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-100 font-medium leading-relaxed">
                                &ldquo;{clip.hook_transcript}&rdquo;
                              </p>
                              <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                                <strong className="text-slate-300 font-medium">
                                  Why it hits:{' '}
                                </strong>
                                {clip.reasoning}
                              </p>
                            </div>

                            {/* Bottom Controls: Inline Timestamp Adjustment Buttons (±2s Start/End) + "Render 9:16 Short" Button */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Start ±2s Controls */}
                                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
                                  <span className="text-[11px] font-mono text-slate-400 px-1">
                                    Start:
                                  </span>
                                  <span className="text-xs font-mono tabular-nums text-white font-semibold pr-1">
                                    {clip.start_time}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustTimestamp(
                                        clip.clip_id,
                                        'start',
                                        -2.0
                                      )
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                                  >
                                    -2s Start
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustTimestamp(
                                        clip.clip_id,
                                        'start',
                                        2.0
                                      )
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                                  >
                                    +2s Start
                                  </button>
                                </div>

                                {/* End ±2s Controls */}
                                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
                                  <span className="text-[11px] font-mono text-slate-400 px-1">
                                    End:
                                  </span>
                                  <span className="text-xs font-mono tabular-nums text-white font-semibold pr-1">
                                    {clip.end_time}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustTimestamp(
                                        clip.clip_id,
                                        'end',
                                        -2.0
                                      )
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                                  >
                                    -2s End
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustTimestamp(
                                        clip.clip_id,
                                        'end',
                                        2.0
                                      )
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono tabular-nums text-slate-200 transition-colors cursor-pointer"
                                  >
                                    +2s End
                                  </button>
                                </div>
                              </div>

                              {/* "Render 9:16 Short" Action Button per Card */}
                              <Button
                                variant={isRendered ? 'emerald' : 'default'}
                                size="default"
                                onClick={() => handleTriggerCardRender(clip)}
                              >
                                {isRenderingNow ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Rendering 9:16...</span>
                                  </>
                                ) : isRendered ? (
                                  <>
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Previewing 9:16 Short</span>
                                  </>
                                ) : (
                                  <>
                                    <Film className="w-3.5 h-3.5" />
                                    <span>Render 9:16 Short</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Python app.py & FFmpeg SOTA Code Inspector Tab */
                    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70">
                        <div className="flex items-center gap-1 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab('app_py')}
                            className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                              activeCodeTab === 'app_py'
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            app.py (Complete SOTA Script)
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab('stage1_prompt')}
                            className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                              activeCodeTab === 'stage1_prompt'
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Gemini Prompt
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab('stage2_ffmpeg')}
                            className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                              activeCodeTab === 'stage2_ffmpeg'
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            FFmpeg SOTA Filter
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab('requirements')}
                            className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                              activeCodeTab === 'requirements'
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            requirements.txt
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyCode}
                          >
                            {copiedCode ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Code
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[640px] leading-relaxed">
                        <code>{getDisplayedCode()}</code>
                      </pre>
                    </div>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
