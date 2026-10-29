'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Youtube,
  Sparkles,
  Scissors,
  Download,
  Copy,
  Check,
  Code2,
  Sliders,
  AlertCircle,
  Film,
  Terminal,
  Trash2,
  Music,
  ScanFace,
  ZoomIn,
  Type as TypeIcon,
} from 'lucide-react';
import VerticalShortPlayer, {
  ViralClipSegment,
  CaptionPresetName,
  timestampToSeconds,
} from './VerticalShortPlayer';
import {
  STREAMLIT_APP_PY_CODE,
  REQUIREMENTS_TXT,
  GEMINI_CLIP_DETECTION_PROMPT,
  FFMPEG_SOTA_FILTER_COMPLEX,
  detectContextualEmojis,
} from '@/lib/python-script';

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
    virality_score: 94,
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
    title: 'The Hidden Cost of Unbuffered FFmpeg Subprocess Calls',
    start_time: '00:18:04.000',
    end_time: '00:18:46.500',
    duration_seconds: 42.5,
    virality_score: 89,
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
    clip_id: 3,
    title: 'Why Lower-Third Safe Zones Decide Short-Form Click-Through',
    start_time: '00:37:20.100',
    end_time: '00:38:11.600',
    duration_seconds: 51.5,
    virality_score: 86,
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
  // Source input state
  const [inputMode, setInputMode] = useState<'upload' | 'youtube' | 'sample'>(
    'upload'
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(2700);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [transcriptContext, setTranscriptContext] = useState<string>(
    'Deep-dive engineering interview covering multimodal AI video editing, FFmpeg filterchains, 9:16 vertical framing, and short-form viewer retention mechanics.'
  );

  // SOTA Engagement Feature 5 State: Caption Presets & 4 Feature Toggles
  const [captionPreset, setCaptionPreset] =
    useState<CaptionPresetName>('Hormozi Pop');
  const [enableKaraoke, setEnableKaraoke] = useState<boolean>(true);
  const [enableZoomCuts, setEnableZoomCuts] = useState<boolean>(true);
  const [enableFaceTracking, setEnableFaceTracking] = useState<boolean>(true);
  const [enableAudioDucking, setEnableAudioDucking] = useState<boolean>(true);
  const [musicFileName, setMusicFileName] = useState<string>(
    'Auto-Synthesized Ambient Synth Pad (44.1kHz WAV)'
  );

  // Pipeline & Gemini analysis state
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle');
  const [pipelinePercent, setPipelinePercent] = useState<number>(0);
  const [pipelineStatusText, setPipelineStatusText] = useState<string>(
    'Ready for source video upload or YouTube URL'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clips & selection state
  const [clips, setClips] = useState<ViralClipSegment[]>(INITIAL_DEMO_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<number>(1);
  const [renderedClipIds, setRenderedClipIds] = useState<number[]>([]);

  // Code inspector state
  const [activeCodeTab, setActiveCodeTab] = useState<
    'app_py' | 'stage1_prompt' | 'stage2_ffmpeg' | 'requirements'
  >('app_py');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClip =
    clips.find((c) => c.clip_id === selectedClipId) || clips[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const handleMusicFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMusicFileName(`${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
  };

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
            // Continue if frame seek fails
          }
        }
        resolve(frames);
      };

      video.onerror = () => resolve([]);
    });
  };

  const handleRunGeminiAnalysis = async () => {
    setErrorMessage(null);

    if (inputMode === 'youtube' && !youtubeUrl.trim()) {
      setErrorMessage('Please enter a valid YouTube URL before running analysis.');
      return;
    }

    try {
      setPipelineStep('uploading');
      setPipelinePercent(20);
      setPipelineStatusText(
        'Stage 1/4: Uploading video track & extracting keyframes...'
      );

      let sampledFrames: Array<{ mimeType: string; data: string }> = [];
      if (videoFileUrl) {
        sampledFrames = await extractKeyframesFromVideo(videoFileUrl);
      }

      setPipelineStep('analyzing');
      setPipelinePercent(52);
      setPipelineStatusText(
        'Stage 2/4: Running Gemini Word-Level Multimodal Video Analysis...'
      );

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle:
            videoFile?.name ||
            (youtubeUrl
              ? `YouTube: ${youtubeUrl}`
              : 'Founder Engineering Podcast'),
          videoDurationSeconds: videoDurationSec,
          youtubeUrl: inputMode === 'youtube' ? youtubeUrl : '',
          transcriptContext,
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
      setPipelinePercent(84);
      setPipelineStatusText(
        'Stage 3/4: Building ASS Karaoke word offsets & EMA face-tracking windows...'
      );

      await new Promise((r) => setTimeout(r, 350));

      if (Array.isArray(data.clips) && data.clips.length > 0) {
        setClips(data.clips);
        setSelectedClipId(data.clips[0].clip_id);
      }

      setPipelineStep('rendering');
      setPipelinePercent(100);
      setPipelineStatusText(
        `Stage 4/4: Ready — ${data.clips?.length || clips.length} viral segments loaded into SOTA 9:16 Renderer`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to analyze video track.';
      setErrorMessage(msg);
      setPipelineStep('idle');
      setPipelinePercent(0);
      setPipelineStatusText('Analysis interrupted — check error details below.');
    }
  };

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

  const handlePurgeTempWorkspace = () => {
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
    }
    setVideoFile(null);
    setVideoFileUrl(null);
    setYoutubeUrl('');
    setRenderedClipIds([]);
    setPipelineStep('idle');
    setPipelinePercent(0);
    setPipelineStatusText('Workspace temporary files purged.');
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      {/* 3-Zone Top Navigation Bar */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-[#0B0F17]/95 sticky top-0 z-30 backdrop-blur-md">
        <a
          href="#studio"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          ClipForge AI
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#studio"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            SOTA Studio
          </a>
          <a
            href="#sota-presets"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Presets & Toggles
          </a>
          <a
            href="#candidates"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Clip Candidates
          </a>
          <a
            href="#python-code"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Streamlit app.py
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              handleDownloadPythonFile('app.py', STREAMLIT_APP_PY_CODE)
            }
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download SOTA app.py
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8 space-y-12">
        {/* Hero & Pipeline Header */}
        <section id="studio" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono text-amber-400 tracking-wide">
                HORMOZI ASS KARAOKE · 1.12x ZOOM BEATS · MEDIAPIPE FACE LOCK ·
                SIDECHAIN DUCKING
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                AI Short-Form Video Clipper Engine (SOTA Edition)
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Extract word-level timestamps with Gemini, render Alex
                Hormozi-style ASS karaoke captions with contextual emojis,
                apply 1.12x punch-in zoom beats, auto-reframe speakers with
                OpenCV/MediaPipe EMA smoothing, and duck ambient music via
                FFmpeg sidechain compression.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="#python-code"
                className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Code2 className="w-4 h-4 text-amber-400" />
                Inspect Refactored app.py
              </a>
              <button
                type="button"
                onClick={handlePurgeTempWorkspace}
                className="px-3.5 py-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge Temp Files
              </button>
            </div>
          </div>

          {/* 4-Stage Pipeline Progress Tracker */}
          <div className="border border-slate-800 bg-[#111827] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Film className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{pipelineStatusText}</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                Pipeline Completion: {pipelinePercent}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                style={{ transform: `scaleX(${pipelinePercent / 100})` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-xs font-mono tabular-nums">
              <div
                className={`${
                  pipelinePercent >= 20 ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                01. Uploading Source
              </div>
              <div
                className={`${
                  pipelinePercent >= 50 ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                02. Gemini Word-Level Analysis
              </div>
              <div
                className={`${
                  pipelinePercent >= 80 ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                03. Karaoke & Face Lock
              </div>
              <div
                className={`${
                  pipelinePercent === 100
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                04. FFmpeg SOTA 9:16 Render
              </div>
            </div>
          </div>

          {/* Source Video Input Bar */}
          <div className="border border-slate-800 bg-[#111827] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  01. Source Long-Form Video Track
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload MP4, MOV, or WebM up to 2GB, paste a YouTube URL, or
                  analyze the studio podcast track with Gemini.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    inputMode === 'upload'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Video Upload (≤2GB)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('youtube')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    inputMode === 'youtube'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  YouTube URL
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('sample')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    inputMode === 'sample'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  Podcast Track
                </button>
              </div>
            </div>

            {inputMode === 'upload' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="lg:col-span-2 border border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-900/50 rounded-lg p-5 cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-200">
                      {videoFile
                        ? `${videoFile.name} (${(
                            videoFile.size /
                            (1024 * 1024)
                          ).toFixed(1)} MB)`
                        : 'Click to select MP4, MOV, or WebM video file (up to 2GB)'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">
                      {videoFile
                        ? `Detected Duration: ${secondsToTimestamp(
                            videoDurationSec
                          )} · Keyframe & face detection ready`
                        : 'Or run Gemini multimodal analysis directly with the transcript context on the right'}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-md bg-slate-800 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0">
                    Browse File
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Audio / Topic Context for Gemini Prompt
                  </label>
                  <input
                    type="text"
                    value={transcriptContext}
                    onChange={(e) => setTranscriptContext(e.target.value)}
                    placeholder="Optional speaker topic or transcript notes..."
                    className="w-full px-3 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {inputMode === 'youtube' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Public YouTube Video URL (30 mins – 2 hours)
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Episode Context / Notes
                  </label>
                  <input
                    type="text"
                    value={transcriptContext}
                    onChange={(e) => setTranscriptContext(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {inputMode === 'sample' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                <div className="lg:col-span-2 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Podcast / Interview Topic or Transcript Excerpt for Gemini
                    Detection
                  </label>
                  <input
                    type="text"
                    value={transcriptContext}
                    onChange={(e) => setTranscriptContext(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Source Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={120}
                    max={7200}
                    value={videoDurationSec}
                    onChange={(e) =>
                      setVideoDurationSec(Number(e.target.value) || 2700)
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
              <p className="text-xs text-slate-400 font-mono">
                Schema: Word-level timestamps (`word`, `start_time`, `end_time`)
                + contextual emoji extraction
              </p>

              <button
                type="button"
                onClick={handleRunGeminiAnalysis}
                disabled={
                  pipelineStep === 'uploading' ||
                  pipelineStep === 'analyzing' ||
                  pipelineStep === 'detecting'
                }
                className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/50 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                {pipelineStep === 'uploading' ||
                pipelineStep === 'analyzing' ||
                pipelineStep === 'detecting'
                  ? 'Running Gemini Word-Level Analysis...'
                  : 'Run Gemini Clip & Karaoke Detection'}
              </button>
            </div>
          </div>
        </section>

        {/* FEATURE 5: SOTA Engagement Controls, Caption Style Presets & Live Static Preset Preview */}
        <section
          id="sota-presets"
          className="border border-slate-800 bg-[#111827] rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                02. SOTA Engagement Configuration & Live Preset Preview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure Caption Style Presets, Word-by-Word ASS Karaoke,
                1.12x Zoom Cuts, MediaPipe EMA Face Tracking, and Sidechain
                Audio Ducking.
              </p>
            </div>

            {/* Caption Style Preset Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">
                Caption Preset:
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                {(
                  [
                    'Hormozi Pop',
                    'Minimalist Clean',
                    'Cyber Neon',
                  ] as CaptionPresetName[]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCaptionPreset(preset)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      captionPreset === preset
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 7 Columns: 4 SOTA Feature Toggles + Ambient Music Upload */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="border border-slate-800 bg-slate-900/60 hover:border-slate-700 rounded-lg p-4 cursor-pointer flex items-start gap-3 transition-colors">
                <input
                  type="checkbox"
                  checked={enableKaraoke}
                  onChange={(e) => setEnableKaraoke(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-400 focus:ring-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <TypeIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Enable Word-by-Word Karaoke Highlighting</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Uses ASS <code className="font-mono text-slate-300">\k</code>{' '}
                    centisecond tags + active word{' '}
                    <code className="font-mono text-slate-300">
                      \fscx110\fscy110
                    </code>{' '}
                    pop and automatic contextual emoji injection.
                  </p>
                </div>
              </label>

              <label className="border border-slate-800 bg-slate-900/60 hover:border-slate-700 rounded-lg p-4 cursor-pointer flex items-start gap-3 transition-colors">
                <input
                  type="checkbox"
                  checked={enableZoomCuts}
                  onChange={(e) => setEnableZoomCuts(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-400 focus:ring-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                    <span>Enable Dynamic Zoom Cuts (1.12x)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Alternates 1.0x and 1.12x punch-in zoom (
                    <code className="font-mono text-slate-300">
                      scale=iw*1.12:-1,crop=iw/1.12:ih/1.12
                    </code>
                    ) on sentence transitions.
                  </p>
                </div>
              </label>

              <label className="border border-slate-800 bg-slate-900/60 hover:border-slate-700 rounded-lg p-4 cursor-pointer flex items-start gap-3 transition-colors">
                <input
                  type="checkbox"
                  checked={enableFaceTracking}
                  onChange={(e) => setEnableFaceTracking(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-400 focus:ring-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <ScanFace className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enable Smart Face Tracking Auto-Crop</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    MediaPipe / OpenCV speaker bounding box detection with EMA
                    smoothing (
                    <code className="font-mono text-slate-300">
                      x = clamp(X_face - 540, 0, max_x)
                    </code>
                    ).
                  </p>
                </div>
              </label>

              <div className="border border-slate-800 bg-slate-900/60 hover:border-slate-700 rounded-lg p-4 flex flex-col justify-between gap-3 transition-colors">
                <label className="cursor-pointer flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableAudioDucking}
                    onChange={(e) => setEnableAudioDucking(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-400 focus:ring-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Music className="w-3.5 h-3.5 text-amber-400" />
                      <span>Enable Background Music Ducking</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      FFmpeg{' '}
                      <code className="font-mono text-slate-300">
                        sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300
                      </code>
                      .
                    </p>
                  </div>
                </label>

                {enableAudioDucking && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <input
                      ref={musicInputRef}
                      type="file"
                      accept="audio/mpeg,audio/wav,.mp3,.wav"
                      onChange={handleMusicFileChange}
                      className="hidden"
                    />
                    <span className="text-[11px] font-mono text-slate-400 truncate">
                      {musicFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => musicInputRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 whitespace-nowrap shrink-0"
                    >
                      Upload MP3/WAV
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Columns: Live Static Sample Frame Preview (Feature 5.3) */}
            <div className="lg:col-span-5 border border-slate-800 bg-slate-950 rounded-lg p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span>LIVE STATIC PRESET PREVIEW</span>
                <span>MarginV: {captionPreset === 'Minimalist Clean' ? '500px' : '520px'}</span>
              </div>

              <div className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900 via-[#0F172A] to-slate-950 flex flex-col items-center justify-center p-4">
                {/* Face Tracking & Zoom Beat Indicators */}
                <div className="absolute top-2.5 inset-x-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>
                    {enableFaceTracking
                      ? 'EMA FACE LOCK: x=clamp(X_face-540)'
                      : 'STATIC CENTER CROP'}
                  </span>
                  <span>
                    {enableZoomCuts ? '1.12x ZOOM BEAT' : '1.00x STATIC'}
                  </span>
                </div>

                {/* Contextual Emoji Preview */}
                <div className="text-xl mb-1 select-none" aria-hidden="true">
                  🔥 🚀
                </div>

                {/* Styled Caption Sample Frame */}
                <div
                  className={`px-4 py-2 rounded-lg text-center ${
                    captionPreset === 'Minimalist Clean'
                      ? 'bg-slate-900/90 border border-slate-800 font-sans font-bold text-base tracking-tight'
                      : 'font-sans font-black text-lg tracking-wide'
                  }`}
                >
                  <span
                    className={
                      captionPreset === 'Minimalist Clean'
                        ? 'text-slate-400'
                        : 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]'
                    }
                  >
                    RETENTION{' '}
                  </span>
                  <span
                    className={`inline-block transition-transform ${
                      enableKaraoke ? 'scale-110 mx-1' : ''
                    } ${
                      captionPreset === 'Hormozi Pop'
                        ? 'text-yellow-400 drop-shadow-[0_2px_3px_rgba(0,0,0,1)]'
                        : captionPreset === 'Cyber Neon'
                          ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.85)]'
                          : 'text-white'
                    }`}
                  >
                    JUMPS
                  </span>
                  <span
                    className={
                      captionPreset === 'Minimalist Clean'
                        ? 'text-slate-400'
                        : 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]'
                    }
                  >
                    {' '}
                    10X FASTER
                  </span>
                </div>

                {/* Safe-Zone Margin Line */}
                <div className="absolute bottom-3 inset-x-4 border-t border-dashed border-sky-500/40 pt-1 flex items-center justify-between text-[10px] font-mono text-sky-400/80">
                  <span>SAFE ZONE BOUNDARY (MarginV)</span>
                  <span>1080×1920 ASS</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Preset:{' '}
                <strong className="text-slate-200">{captionPreset}</strong> ·{' '}
                {enableKaraoke
                  ? 'Active word 110% scale + \\k centisecond tags'
                  : 'Static phrase captions'}
              </p>
            </div>
          </div>
        </section>

        {/* Stage 3: Candidate Clips & 9:16 Vertical Preview Split Workbench */}
        <section id="candidates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                03. Candidate Viral Clips & ±2s Cut Boundary Editor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Strictly 30–60s standalone segments with word-level karaoke
                offsets, automatic contextual emojis, and sentence-pause
                alignment.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {clips.length} segments detected · {renderedClipIds.length}{' '}
              exported
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Candidate Clip Cards */}
            <div className="lg:col-span-7 space-y-4">
              {clips.map((clip) => {
                const isSelected = clip.clip_id === selectedClip.clip_id;
                const isDurationValid =
                  clip.duration_seconds >= 30 && clip.duration_seconds <= 60;
                const hookEmojis = detectContextualEmojis(
                  `${clip.title} ${clip.hook_transcript}`
                );

                return (
                  <div
                    key={clip.clip_id}
                    onClick={() => setSelectedClipId(clip.clip_id)}
                    className={`border rounded-xl p-5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-amber-400/70 bg-[#131C2E]'
                        : 'border-slate-800 bg-[#111827] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-400 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-semibold">
                          CLIP #{String(clip.clip_id).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {clip.start_time} → {clip.end_time}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isDurationValid
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                          }
                        >
                          {clip.duration_seconds.toFixed(1)}s
                        </span>
                        {hookEmojis && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Emojis: {hookEmojis}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-semibold">
                          Virality Score: {clip.virality_score}/100
                        </span>
                        {renderedClipIds.includes(clip.clip_id) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400">Exported</span>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-semibold text-white">
                      {clip.title}
                    </h3>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-200 leading-relaxed">
                        <span className="text-slate-400 font-medium">
                          Hook (0–5s):{' '}
                        </span>
                        &ldquo;{clip.hook_transcript}&rdquo;
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        <span className="text-slate-500 font-medium">
                          Editorial Reasoning:{' '}
                        </span>
                        {clip.reasoning}
                      </p>
                    </div>

                    {/* Interactive ±2s & ±0.5s Timestamp Tweaker Bar */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-4 pt-4 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div>
                          <span className="block text-[11px] text-slate-400">
                            Start Cut
                          </span>
                          <span className="text-xs font-mono tabular-nums text-white font-semibold">
                            {clip.start_time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'start', -2.0)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            -2s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'start', -0.5)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'start', 0.5)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            +0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'start', 2.0)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            +2s
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                        <div>
                          <span className="block text-[11px] text-slate-400">
                            End Cut
                          </span>
                          <span className="text-xs font-mono tabular-nums text-white font-semibold">
                            {clip.end_time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'end', -2.0)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            -2s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'end', -0.5)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'end', 0.5)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            +0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustTimestamp(clip.clip_id, 'end', 2.0)
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono tabular-nums text-slate-200 transition-colors whitespace-nowrap shrink-0"
                          >
                            +2s
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 Columns: Live SOTA 9:16 Monitor */}
            <div className="lg:col-span-5 lg:sticky lg:top-20">
              {selectedClip && (
                <VerticalShortPlayer
                  clip={selectedClip}
                  videoFileUrl={videoFileUrl}
                  videoFileName={videoFile?.name || 'input.mp4'}
                  captionPreset={captionPreset}
                  enableKaraoke={enableKaraoke}
                  enableZoomCuts={enableZoomCuts}
                  enableFaceTracking={enableFaceTracking}
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
        </section>

        {/* SOTA Architecture Summary */}
        <section
          id="ffmpeg-architecture"
          className="border border-slate-800 bg-[#111827] rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                04. SOTA Engagement Architecture & FFmpeg Filter Graph
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                How the refactored Python pipeline combines OpenCV/MediaPipe,
                ASS Karaoke, 1.12x Zoom Cuts, and Sidechain Ducking.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400">
              pip install streamlit google-genai yt-dlp opencv-python mediapipe
              numpy pillow
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <TypeIcon className="w-4 h-4 text-amber-400" />
                <span>1. ASS Karaoke & Emojis</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extracts word-level offsets and emits ASS{' '}
                <code className="font-mono text-slate-200">\k</code> tags +
                active word{' '}
                <code className="font-mono text-slate-200">
                  \fscx110\fscy110
                </code>{' '}
                scale bump and automatic keyword emojis (💰, 🔥, 🚀, 🧠, ⏱️).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ZoomIn className="w-4 h-4 text-sky-400" />
                <span>2. 1.12x Dynamic Zooms</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Applies{' '}
                <code className="font-mono text-slate-200">
                  scale=iw*1.12:-1,crop=iw/1.12:ih/1.12
                </code>{' '}
                with{' '}
                <code className="font-mono text-slate-200">
                  enable=&apos;between(t,s,e)&apos;
                </code>{' '}
                on alternating sentence chunks to reset viewer visual fatigue.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ScanFace className="w-4 h-4 text-emerald-400" />
                <span>3. EMA Face Auto-Reframing</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                MediaPipe / OpenCV detects speaker $X_{'{face}'}$ and smooths{' '}
                <code className="font-mono text-slate-200">
                  x = clamp(X_face - 540, 0, max_x)
                </code>{' '}
                via Exponential Moving Average ($\alpha = 0.15$).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>4. Sidechain Audio Ducking</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ducks ambient background music whenever speech is active via{' '}
                <code className="font-mono text-slate-200">
                  sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300
                </code>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Complete Refactored Python app.py Code Inspector & Downloader */}
        <section id="python-code" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                05. Complete Refactored Python Script (app.py — SOTA Edition)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Includes <code className="font-mono text-slate-300">opencv-python</code>,{' '}
                <code className="font-mono text-slate-300">mediapipe</code>,{' '}
                <code className="font-mono text-slate-300">google-genai</code>,
                and <code className="font-mono text-slate-300">ffmpeg</code>{' '}
                filter graphs. Saved directly to{' '}
                <code className="font-mono text-amber-300">/app.py</code>.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDownloadPythonFile('app.py', STREAMLIT_APP_PY_CODE)
                }
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download SOTA app.py
              </button>
            </div>
          </div>

          <div className="border border-slate-800 bg-[#111827] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('app_py')}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === 'app_py'
                      ? 'bg-slate-800 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  app.py (Refactored SOTA Script)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('stage1_prompt')}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === 'stage1_prompt'
                      ? 'bg-slate-800 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Feature 1: Word-Level Gemini Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('stage2_ffmpeg')}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === 'stage2_ffmpeg'
                      ? 'bg-slate-800 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Features 2–4: FFmpeg Zoom & Sidechain CLI
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('requirements')}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === 'requirements'
                      ? 'bg-slate-800 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  requirements.txt
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>streamlit run app.py --server.maxUploadSize=2048</span>
              </div>
            </div>

            <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[640px] leading-relaxed">
              <code>{getDisplayedCode()}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-6 px-6 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            ClipForge AI — SOTA Short-Form Video Clipper Engine (Hormozi ASS
            Karaoke · 1.12x Zoom Cuts · MediaPipe EMA Face Lock · Sidechain
            Ducking)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                handleDownloadPythonFile('app.py', STREAMLIT_APP_PY_CODE)
              }
              className="hover:text-slate-300 transition-colors"
            >
              Download app.py
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                handleDownloadPythonFile('requirements.txt', REQUIREMENTS_TXT)
              }
              className="hover:text-slate-300 transition-colors"
            >
              Download requirements.txt
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
