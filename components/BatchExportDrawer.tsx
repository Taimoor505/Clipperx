'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  Film,
  Download,
  CheckSquare,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings2,
  Archive,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ViralClipSegment,
  CaptionPresetName,
  generateKaraokeAssFileContent,
} from './VerticalShortPlayer';

export type BatchJobStatus = 'queued' | 'rendering' | 'complete' | 'failed';

export interface BatchExportConfig {
  format: 'MP4' | 'MOV';
  resolution: '1080x1920' | '720x1280';
  fps: '60fps' | '30fps';
  bitrateMode: 'CRF 18 (High)' | 'CBR 12 Mbps' | 'VBR 8 Mbps';
}

export interface BatchClipJobState {
  clipId: number;
  status: BatchJobStatus;
  progress: number; // 0 to 100
  error?: string;
}

export interface BatchExportDrawerProps {
  clips: ViralClipSegment[];
  selectedClipIds: number[];
  onToggleSelectClip: (clipId: number) => void;
  onSelectAllClips: () => void;
  onDeselectAll: () => void;
  captionPreset?: CaptionPresetName;
  enableKaraoke?: boolean;
  onClipRenderComplete?: (clipId: number) => void;
}

export default function BatchExportDrawer({
  clips,
  selectedClipIds,
  onSelectAllClips,
  onDeselectAll,
  captionPreset = 'Hormozi Pop',
  enableKaraoke = true,
  onClipRenderComplete,
}: BatchExportDrawerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showExportSettings, setShowExportSettings] = useState<boolean>(true);
  const [exportConfig, setExportConfig] = useState<BatchExportConfig>({
    format: 'MP4',
    resolution: '1080x1920',
    fps: '60fps',
    bitrateMode: 'CRF 18 (High)',
  });

  const [jobsByClipId, setJobsByClipId] = useState<
    Record<number, BatchClipJobState>
  >({});
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [zipDownloading, setZipDownloading] = useState<boolean>(false);
  const [zipDownloadedSuccess, setZipDownloadedSuccess] =
    useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  // Sync job map whenever selectedClipIds changes while not actively rendering
  useEffect(() => {
    setJobsByClipId((prev) => {
      const next: Record<number, BatchClipJobState> = { ...prev };
      selectedClipIds.forEach((id) => {
        if (!next[id]) {
          next[id] = {
            clipId: id,
            status: 'queued',
            progress: 0,
          };
        }
      });
      return next;
    });
  }, [selectedClipIds]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const selectedClips = useMemo(
    () => clips.filter((c) => selectedClipIds.includes(c.clip_id)),
    [clips, selectedClipIds]
  );

  // Compute global queue completion %
  const queueStats = useMemo(() => {
    if (selectedClips.length === 0) {
      return {
        totalProgress: 0,
        completedCount: 0,
        renderingCount: 0,
        queuedCount: 0,
        failedCount: 0,
      };
    }

    let sumProgress = 0;
    let completedCount = 0;
    let renderingCount = 0;
    let queuedCount = 0;
    let failedCount = 0;

    selectedClips.forEach((clip) => {
      const job = jobsByClipId[clip.clip_id];
      if (!job || job.status === 'queued') {
        queuedCount++;
      } else if (job.status === 'rendering') {
        renderingCount++;
        sumProgress += job.progress;
      } else if (job.status === 'complete') {
        completedCount++;
        sumProgress += 100;
      } else if (job.status === 'failed') {
        failedCount++;
      }
    });

    const totalProgress = Math.round(sumProgress / selectedClips.length);
    return {
      totalProgress,
      completedCount,
      renderingCount,
      queuedCount,
      failedCount,
    };
  }, [selectedClips, jobsByClipId]);

  // Trigger sequential/staggered 9:16 rendering for all selected clips
  const handleStartBatchRender = () => {
    if (selectedClips.length === 0 || isBatchRunning) return;

    setIsExpanded(true);
    setIsBatchRunning(true);
    setZipDownloadedSuccess(false);

    // Initialize all selected clips to queued (0%) before starting
    const orderedIds = selectedClips.map((c) => c.clip_id);
    setJobsByClipId((prev) => {
      const reset: Record<number, BatchClipJobState> = { ...prev };
      orderedIds.forEach((id, idx) => {
        reset[id] = {
          clipId: id,
          status: idx === 0 ? 'rendering' : 'queued',
          progress: idx === 0 ? 8 : 0,
        };
      });
      return reset;
    });

    let activeIdx = 0;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      setJobsByClipId((prev) => {
        const currentClipId = orderedIds[activeIdx];
        if (currentClipId === undefined) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setIsBatchRunning(false);
          return prev;
        }

        const currentJob = prev[currentClipId] || {
          clipId: currentClipId,
          status: 'rendering',
          progress: 0,
        };

        const nextProgress = Math.min(100, currentJob.progress + 18);
        const updated: Record<number, BatchClipJobState> = { ...prev };

        if (nextProgress >= 100) {
          updated[currentClipId] = {
            clipId: currentClipId,
            status: 'complete',
            progress: 100,
          };
          onClipRenderComplete?.(currentClipId);
          activeIdx += 1;

          if (activeIdx < orderedIds.length) {
            const nextId = orderedIds[activeIdx];
            updated[nextId] = {
              clipId: nextId,
              status: 'rendering',
              progress: 10,
            };
          } else {
            if (timerRef.current) window.clearInterval(timerRef.current);
            setIsBatchRunning(false);
          }
        } else {
          updated[currentClipId] = {
            ...currentJob,
            status: 'rendering',
            progress: nextProgress,
          };
        }

        return updated;
      });
    }, 260);
  };

  // Retry or re-render a single clip job in the queue
  const handleRetrySingleClip = (clipId: number) => {
    setJobsByClipId((prev) => ({
      ...prev,
      [clipId]: {
        clipId,
        status: 'rendering',
        progress: 25,
      },
    }));

    window.setTimeout(() => {
      setJobsByClipId((prev) => ({
        ...prev,
        [clipId]: {
          clipId,
          status: 'complete',
          progress: 100,
        },
      }));
      onClipRenderComplete?.(clipId);
    }, 650);
  };

  // Build and download a real .ZIP archive (uncompressed PKZIP format) containing
  // each selected clip's .ASS karaoke subtitle file, FFmpeg render script, and JSON manifest
  const handleDownloadAllZip = () => {
    if (selectedClips.length === 0) return;
    setZipDownloading(true);

    window.setTimeout(() => {
      try {
        const [resW, resH] = exportConfig.resolution.split('x').map(Number);
        const fpsNum = exportConfig.fps === '60fps' ? 60 : 30;
        const ext = exportConfig.format.toLowerCase();

        // Construct archive payload files
        const filesToPack: { name: string; content: string }[] = [];

        // 1. Manifest JSON
        filesToPack.push({
          name: 'clipperx_batch_manifest.json',
          content: JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              export_config: exportConfig,
              caption_preset: captionPreset,
              total_clips: selectedClips.length,
              clips: selectedClips.map((c) => ({
                clip_id: c.clip_id,
                title: c.title,
                start_time: c.start_time,
                end_time: c.end_time,
                duration_seconds: c.duration_seconds,
                virality_score: c.virality_score,
                output_file: `clip_${c.clip_id}_${resW}x${resH}_${fpsNum}fps.${ext}`,
              })),
            },
            null,
            2
          ),
        });

        // 2. Per-clip .ASS subtitle file & FFmpeg shell script
        const shellLines: string[] = [
          '#!/usr/bin/env bash',
          '# ClipperX AI — Batch 9:16 FFmpeg Render Pipeline',
          'set -e',
          '',
        ];

        selectedClips.forEach((clip) => {
          const assContent = generateKaraokeAssFileContent(
            clip,
            captionPreset,
            enableKaraoke
          );
          const assFilename = `clip_${clip.clip_id}_captions.ass`;
          const outFilename = `clip_${clip.clip_id}_${resW}x${resH}_${fpsNum}fps.${ext}`;

          filesToPack.push({
            name: assFilename,
            content: assContent,
          });

          const bitrateFlags =
            exportConfig.bitrateMode === 'CRF 18 (High)'
              ? '-crf 18 -preset fast'
              : exportConfig.bitrateMode === 'CBR 12 Mbps'
              ? '-b:v 12M -maxrate 12M -bufsize 24M'
              : '-b:v 8M -maxrate 10M -bufsize 16M';

          shellLines.push(
            `echo "Rendering Clip #${clip.clip_id}: ${clip.title}..."`,
            `ffmpeg -y -ss ${clip.start_time} -to ${clip.end_time} -i input.mp4 \\`,
            `  -vf "split[a][b];[a]scale=${resW}:${resH}:force_original_aspect_ratio=increase,crop=${resW}:${resH},boxblur=25:5[bg];[b]scale=${resW}:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles=${assFilename}" \\`,
            `  -r ${fpsNum} -c:v libx264 ${bitrateFlags} -c:a aac -b:a 192k "${outFilename}"`,
            ''
          );
        });

        filesToPack.push({
          name: 'run_batch_ffmpeg.sh',
          content: shellLines.join('\n'),
        });

        // Create a valid uncompressed ZIP binary blob
        const zipBlob = createStoreZipBlob(filesToPack);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ClipperX_Batch_Export_${selectedClips.length}_Clips_${exportConfig.resolution}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);

        setZipDownloadedSuccess(true);
      } finally {
        setZipDownloading(false);
      }
    }, 350);
  };

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none flex justify-center">
      <div className="w-full max-w-[1380px] pointer-events-auto">
        <div className="rounded-2xl border border-line bg-canvas shadow-lg overflow-hidden">
          {/* =================================================================
              EXPANDABLE MULTI-JOB PROGRESS MONITOR & EXPORT CONFIGURATION DRAWER
             ================================================================= */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="overflow-hidden border-b border-line"
              >
                <div className="p-5 space-y-4 max-h-[62vh] overflow-y-auto">
                  {/* Drawer Header + Global Queue Progress Bar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Layers className="w-4 h-4 text-ink" />
                        <h3 className="text-sm font-bold text-ink tracking-tight">
                          Batch Render &amp; Export Queue Monitor
                        </h3>
                        <Badge
                          variant="gradient"
                          className="font-mono text-[10px]"
                        >
                          {queueStats.completedCount}/{selectedClips.length}{' '}
                          Complete
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Multi-job 9:16 FFmpeg dual-layer vertical render queue
                        with word-synchronized .ASS subtitle burn-in.
                      </p>
                    </div>

                    {/* Global Progress Bar for Total Queue Completion */}
                    <div className="w-full lg:w-80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-on-accent">
                          TOTAL QUEUE COMPLETION
                        </span>
                        <span className="text-on-accent font-bold">
                          {queueStats.totalProgress}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface border border-line overflow-hidden">
                        <motion.div
                          className="h-full bg-accent "
                          initial={{ width: 0 }}
                          animate={{ width: `${queueStats.totalProgress}%` }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. EXPORT CONFIGURATION BAR (Format, Resolution, FPS, Bitrate Mode) */}
                  {showExportSettings && (
                    <div className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-ink flex items-center gap-1.5">
                          <Settings2 className="w-3.5 h-3.5 text-ink" />
                          <span>Batch FFmpeg Export Configuration</span>
                        </span>
                        <span className="text-[11px] font-mono text-ink">
                          {exportConfig.format} · {exportConfig.resolution} @{' '}
                          {exportConfig.fps} · {exportConfig.bitrateMode}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Video Format Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-ink-muted block">
                            Video Format
                          </label>
                          <select
                            aria-label="Batch Video Format"
                            value={exportConfig.format}
                            onChange={(e) =>
                              setExportConfig((prev) => ({
                                ...prev,
                                format: e.target.value as 'MP4' | 'MOV',
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
                          >
                            <option value="MP4">MP4 (H.264 + AAC)</option>
                            <option value="MOV">MOV (QuickTime ProRes)</option>
                          </select>
                        </div>

                        {/* Resolution Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-ink-muted block">
                            Vertical Resolution (9:16)
                          </label>
                          <select
                            aria-label="Batch Vertical Resolution"
                            value={exportConfig.resolution}
                            onChange={(e) =>
                              setExportConfig((prev) => ({
                                ...prev,
                                resolution: e.target.value as
                                  | '1080x1920'
                                  | '720x1280',
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
                          >
                            <option value="1080x1920">
                              1080×1920 (Full HD 9:16)
                            </option>
                            <option value="720x1280">
                              720×1280 (Fast HD 9:16)
                            </option>
                          </select>
                        </div>

                        {/* Frame Rate Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-ink-muted block">
                            Frame Rate
                          </label>
                          <select
                            aria-label="Batch Frame Rate"
                            value={exportConfig.fps}
                            onChange={(e) =>
                              setExportConfig((prev) => ({
                                ...prev,
                                fps: e.target.value as '60fps' | '30fps',
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
                          >
                            <option value="60fps">
                              60fps (Smooth Motion)
                            </option>
                            <option value="30fps">30fps (Standard)</option>
                          </select>
                        </div>

                        {/* Bitrate Mode Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-ink-muted block">
                            Bitrate Mode
                          </label>
                          <select
                            aria-label="Batch Bitrate Mode"
                            value={exportConfig.bitrateMode}
                            onChange={(e) =>
                              setExportConfig((prev) => ({
                                ...prev,
                                bitrateMode: e.target
                                  .value as BatchExportConfig['bitrateMode'],
                              }))
                            }
                            className="w-full h-8 px-2.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
                          >
                            <option value="CRF 18 (High)">
                              CRF 18 (Lossless-Grade ~16 Mbps)
                            </option>
                            <option value="CBR 12 Mbps">
                              CBR 12 Mbps (TikTok/Reels Optimal)
                            </option>
                            <option value="VBR 8 Mbps">
                              VBR 8 Mbps (Compact Fast Upload)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. MULTI-JOB PROGRESS LIST */}
                  {selectedClips.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-surface p-6 text-center space-y-2">
                      <p className="text-xs text-ink-muted">
                        No clips currently selected in the batch queue. Use the
                        checkboxes on any Viral Clip Card or click below to
                        select all candidates.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onSelectAllClips}
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-ink" />
                        <span>Select All {clips.length} Clips</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {selectedClips.map((clip) => {
                        const job = jobsByClipId[clip.clip_id] || {
                          clipId: clip.clip_id,
                          status: 'queued',
                          progress: 0,
                        };

                        return (
                          <div
                            key={clip.clip_id}
                            className={`rounded-xl border p-3 transition-colors ${
                              job.status === 'rendering'
                                ? 'border-accent bg-surface'
                                : job.status === 'complete'
                                ? 'border-success/40 bg-success/10'
                                : job.status === 'failed'
                                ? 'border-danger/40 bg-danger/10'
                                : 'border-line bg-surface'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink-muted tabular-nums">
                                  <span className="text-ink font-semibold">
                                    CLIP #{clip.clip_id}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {clip.start_time} → {clip.end_time}
                                  </span>
                                  <span>·</span>
                                  <span>{exportConfig.resolution}</span>
                                </div>
                                <div className="text-xs font-semibold text-ink truncate mt-0.5">
                                  {clip.title}
                                </div>
                              </div>

                              {/* Individual Job Status Badge (Queued, Rendering [X%], Complete, Failed) */}
                              <div className="shrink-0 flex items-center gap-1.5">
                                {job.status === 'queued' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-line bg-surface-2 text-[10px] font-mono text-ink">
                                    <Clock className="w-3 h-3 text-ink-muted" />
                                    <span>Queued</span>
                                  </span>
                                )}
                                {job.status === 'rendering' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent bg-accent-soft text-[10px] font-mono font-semibold text-ink tabular-nums">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Rendering {job.progress}%</span>
                                  </span>
                                )}
                                {job.status === 'complete' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-success/40 bg-success/10 text-[10px] font-mono font-semibold text-success">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Complete</span>
                                  </span>
                                )}
                                {job.status === 'failed' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-danger/40 bg-danger/10 text-[10px] font-mono font-semibold text-danger">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>Failed</span>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRetrySingleClip(clip.clip_id)
                                  }
                                  title="Render / Re-render this clip"
                                  className="p-1 rounded border border-line bg-surface text-ink-muted hover:text-ink cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Individual Clip Progress Bar */}
                            <div className="mt-2.5 w-full h-1.5 rounded-full bg-canvas overflow-hidden">
                              <div
                                style={{ width: `${job.progress}%` }}
                                className={`h-full transition-all duration-200 ${
                                  job.status === 'complete'
                                    ? 'bg-success'
                                    : job.status === 'rendering'
                                    ? 'bg-accent '
                                    : 'bg-surface-2'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* =================================================================
              1. STICKY BOTTOM ACTION BAR
              Shows: "[X] Clips Selected", "Render Selected (9:16)",
              "Download All (.ZIP)", and "Deselect All"
             ================================================================= */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-canvas">
            {/* Left: Selection Counter + Select/Deselect Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-accent bg-accent-soft text-xs font-mono font-semibold text-ink hover:bg-accent-soft transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-ink" />
                <span>
                  {selectedClips.length}{' '}
                  {selectedClips.length === 1 ? 'Clip' : 'Clips'} Selected
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-ink" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-ink" />
                )}
              </button>

              {selectedClips.length < clips.length && (
                <button
                  type="button"
                  onClick={onSelectAllClips}
                  className="text-xs font-mono text-ink hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors cursor-pointer"
                >
                  Select All ({clips.length})
                </button>
              )}

              <button
                type="button"
                onClick={onDeselectAll}
                disabled={selectedClips.length === 0}
                className="inline-flex items-center gap-1 text-xs font-mono text-ink-muted hover:text-ink disabled:opacity-40 px-2 py-1 rounded hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Deselect All</span>
              </button>

              {/* Compact inline format badge on desktop */}
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(true);
                  setShowExportSettings(true);
                }}
                className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line bg-surface text-[11px] font-mono text-ink hover:border-line cursor-pointer"
              >
                <Settings2 className="w-3 h-3 text-ink" />
                <span>
                  {exportConfig.format} · {exportConfig.resolution} ·{' '}
                  {exportConfig.fps} · {exportConfig.bitrateMode}
                </span>
              </button>
            </div>

            {/* Right: Primary Batch Actions ("Render Selected (9:16)" + "Download All (.ZIP)") */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={selectedClips.length === 0 || isBatchRunning}
                onClick={handleStartBatchRender}
                className="cursor-pointer"
              >
                {isBatchRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Rendering Queue ({queueStats.totalProgress}%)...
                    </span>
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5" />
                    <span>
                      Render Selected (9:16) ({selectedClips.length})
                    </span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="emerald"
                size="sm"
                disabled={selectedClips.length === 0 || zipDownloading}
                onClick={handleDownloadAllZip}
                className="cursor-pointer"
              >
                {zipDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Packing .ZIP...</span>
                  </>
                ) : zipDownloadedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Downloaded .ZIP ({selectedClips.length})</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All (.ZIP)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded((v) => !v)}
                className="border-line bg-surface hover:bg-surface-2 text-ink cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-ink" />
                <span>{isExpanded ? 'Hide Queue' : 'Open Queue'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generates a standard uncompressed PKZIP archive Blob in browser memory
 * so "Download All (.ZIP)" downloads a real, extractable .zip file.
 */
function createStoreZipBlob(
  files: { name: string; content: string }[]
): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32Uint8(dataBytes);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: store (0)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true); // crc32
    lv.setUint32(18, dataBytes.length, true); // compressed size
    lv.setUint32(22, dataBytes.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // filename length
    lv.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // compression: store (0)
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0, true); // mod date
    cv.setUint32(16, crc, true); // crc32
    cv.setUint32(20, dataBytes.length, true); // compressed size
    cv.setUint32(24, dataBytes.length, true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // filename length
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob(
    [...localParts, ...centralParts, eocd] as unknown as BlobPart[],
    {
      type: 'application/zip',
    }
  );
}

function crc32Uint8(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
