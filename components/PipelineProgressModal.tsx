'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  UploadCloud,
  Sparkles,
  Captions,
  Film,
  Clock,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  Play,
  AlertTriangle,
} from 'lucide-react';

export type StageState = 'pending' | 'active' | 'complete' | 'failed';

export type PipelineOverallStep =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'detecting'
  | 'rendering'
  | 'complete'
  | 'failed';

export interface PipelineProgressModalProps {
  pipelineStep: PipelineOverallStep;
  pipelinePercent: number;
  pipelineStatusText?: string;
  fileSizeBytes?: number | null;
  fileName?: string;
  errorMessage?: string | null;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  onRetry?: () => void;
  onSimulateRun?: () => void;
}

interface StageDefinition {
  id: number;
  key: 'uploading' | 'analyzing' | 'detecting' | 'rendering';
  title: string;
  subtitle: string;
  telemetry: string;
  icon: React.ComponentType<{ className?: string }>;
}

function resolveStageState(
  stageIndex: number,
  pipelineStep: PipelineOverallStep,
  failedStageIndex: number | null
): StageState {
  if (pipelineStep === 'failed') {
    const failIdx = failedStageIndex ?? 1;
    if (stageIndex < failIdx) return 'complete';
    if (stageIndex === failIdx) return 'failed';
    return 'pending';
  }

  if (pipelineStep === 'complete') {
    return 'complete';
  }

  const activeIndexMap: Record<PipelineOverallStep, number> = {
    idle: -1,
    uploading: 0,
    analyzing: 1,
    detecting: 2,
    rendering: 3,
    complete: 4,
    failed: -1,
  };

  const activeIdx = activeIndexMap[pipelineStep];
  if (activeIdx === -1) return 'pending';
  if (stageIndex < activeIdx) return 'complete';
  if (stageIndex === activeIdx) return 'active';
  return 'pending';
}

export function formatEtaSeconds(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}s`;
}

export default function PipelineProgressModal({
  pipelineStep,
  pipelinePercent,
  pipelineStatusText,
  fileSizeBytes = null,
  fileName = 'podcast_master_1080p.mp4',
  errorMessage = null,
  isModalOpen = false,
  onCloseModal,
  onRetry,
  onSimulateRun,
}: PipelineProgressModalProps) {
  const [expandedModal, setExpandedModal] = useState<boolean>(isModalOpen);
  const [simulatedFailedStage, setSimulatedFailedStage] = useState<
    number | null
  >(null);
  const [liveTokens, setLiveTokens] = useState<number>(84200);
  const [uploadSpeedMbps, setUploadSpeedMbps] = useState<number>(64.8);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(14);

  useEffect(() => {
    setExpandedModal(isModalOpen);
  }, [isModalOpen]);

  const effectiveStep: PipelineOverallStep =
    simulatedFailedStage !== null
      ? 'failed'
      : errorMessage
        ? 'failed'
        : pipelinePercent >= 100 && pipelineStep === 'rendering'
          ? 'complete'
          : pipelineStep;

  const isRunning =
    effectiveStep === 'uploading' ||
    effectiveStep === 'analyzing' ||
    effectiveStep === 'detecting' ||
    effectiveStep === 'rendering';

  // Animate telemetry counters & estimated time remaining timer while pipeline is active
  useEffect(() => {
    if (!isRunning) {
      if (effectiveStep === 'complete') {
        setRemainingSeconds(0);
        setLiveTokens(168400);
      } else if (effectiveStep === 'idle') {
        setRemainingSeconds(16);
      }
      return;
    }

    const estRemaining = Math.max(
      1,
      Math.round(((100 - pipelinePercent) / 100) * 16)
    );
    setRemainingSeconds(estRemaining);

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(1, prev - 1));
      setLiveTokens((prev) =>
        Math.min(168400, prev + Math.floor(4200 + Math.random() * 3100))
      );
      setUploadSpeedMbps(Number((58 + Math.random() * 18).toFixed(1)));
    }, 650);

    return () => window.clearInterval(interval);
  }, [isRunning, effectiveStep, pipelinePercent]);

  const fileSizeMb = fileSizeBytes
    ? (fileSizeBytes / (1024 * 1024)).toFixed(1)
    : '184.6';

  const stages: StageDefinition[] = [
    {
      id: 1,
      key: 'uploading',
      title: '01. Source Upload & Ingestion',
      subtitle: `Stream demuxing & keyframe extraction (${fileName})`,
      telemetry: `${fileSizeMb} MB · ${uploadSpeedMbps.toFixed(1)} MB/s`,
      icon: UploadCloud,
    },
    {
      id: 2,
      key: 'analyzing',
      title: '02. Gemini Multimodal Analysis',
      subtitle: 'Acoustic hook scoring & semantic narrative detection',
      telemetry: `${liveTokens.toLocaleString()} / 168,400 tokens · 34.2k tok/s`,
      icon: Sparkles,
    },
    {
      id: 3,
      key: 'detecting',
      title: '03. Frame Boundary & Subtitle Extraction',
      subtitle: 'Sentence pause alignment & word-level ASS \\k karaoke offsets',
      telemetry: 'Precision ±12ms · Hormozi Pop + Emoji Map',
      icon: Captions,
    },
    {
      id: 4,
      key: 'rendering',
      title: '04. FFmpeg 9:16 Dual-Layer Render & Subtitle Burn-In',
      subtitle:
        '1080×1920 @ 60fps · boxblur=25:5 · EMA Face Lock · Sidechain Ducking',
      telemetry: 'libx264 CRF 20 · MarginV=520px Safe Zone',
      icon: Film,
    },
  ];

  const renderStageIcon = (state: StageState) => {
    if (state === 'complete') {
      return (
        <div className="h-8 w-8 rounded-full bg-success/10 border border-success/40 flex items-center justify-center text-success shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    if (state === 'failed') {
      return (
        <div className="h-8 w-8 rounded-full bg-danger/10 border border-danger/40 flex items-center justify-center text-danger shrink-0">
          <XCircle className="w-4 h-4" />
        </div>
      );
    }
    if (state === 'active') {
      return (
        <div className="relative h-8 w-8 flex items-center justify-center shrink-0">
          {/* Smooth Framer Motion pulse ring on active step */}
          <motion.span
            className="absolute inset-0 rounded-full bg-accent-soft border border-accent"
            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <div className="relative h-8 w-8 rounded-full bg-accent flex items-center justify-center text-on-accent shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        </div>
      );
    }
    return (
      <div className="h-8 w-8 rounded-full bg-surface border border-line flex items-center justify-center text-ink-subtle shrink-0">
        <Circle className="w-4 h-4" />
      </div>
    );
  };

  const renderStateLabel = (state: StageState) => {
    if (state === 'complete') {
      return (
        <span className="text-[11px] font-mono font-semibold text-success">
          Complete
        </span>
      );
    }
    if (state === 'failed') {
      return (
        <span className="text-[11px] font-mono font-semibold text-danger">
          Failed
        </span>
      );
    }
    if (state === 'active') {
      return (
        <span className="text-[11px] font-mono font-semibold text-ink">
          Active
        </span>
      );
    }
    return (
      <span className="text-[11px] font-mono text-ink-subtle">Pending</span>
    );
  };

  const renderPipelineBody = (isDetailedModal: boolean) => (
    <div className="space-y-4">
      {/* Top Progress Bar & Estimated Time Remaining Header */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-ink truncate">
              {simulatedFailedStage !== null
                ? 'Pipeline Halted — Stage Error Detected'
                : pipelineStatusText || '4-Stage Video Processing Pipeline'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Clock className="w-3.5 h-3.5 text-ink" />
              <span>
                ETA{' '}
                {effectiveStep === 'complete'
                  ? '00:00s'
                  : formatEtaSeconds(remainingSeconds)}
              </span>
            </span>
            <span className="text-ink-subtle">·</span>
            <span className="text-ink font-semibold">
              {pipelinePercent}%
            </span>
          </div>
        </div>

        {/* Animated Progress Track */}
        <div className="relative w-full h-2 rounded-full bg-surface border border-line overflow-hidden">
          <motion.div
            className={`h-full origin-left ${
              effectiveStep === 'failed'
                ? 'bg-danger'
                : effectiveStep === 'complete'
                  ? 'bg-success'
                  : 'bg-accent '
            }`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0.03, pipelinePercent / 100) }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* 4 Stages Grid / Stack */}
      <div
        className={
          isDetailedModal
            ? 'space-y-3'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
        }
      >
        {stages.map((stage, idx) => {
          const state = resolveStageState(
            idx,
            effectiveStep,
            simulatedFailedStage
          );
          const StageIcon = stage.icon;

          return (
            <motion.div
              key={stage.id}
              layout
              initial={{ opacity: 0.9 }}
              animate={{
                opacity: state === 'pending' ? 0.68 : 1,
              }}
              transition={{ duration: 0.2 }}
              className={`relative rounded-xl border p-3.5 transition-colors overflow-hidden ${
                state === 'active'
                  ? 'border-accent bg-surface shadow-[0_0_25px_rgba(34,211,238,0.12)]'
                  : state === 'complete'
                    ? 'border-success/40 bg-canvas'
                    : state === 'failed'
                      ? 'border-danger/40 bg-danger/10'
                      : 'border-line bg-canvas'
              }`}
            >
              {/* Subtle animated ambient pulse overlay on the active stage */}
              {state === 'active' && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-accent "
                  animate={{ opacity: [0.35, 0.85, 0.35] }}
                  transition={{
                    duration: 2.0,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              <div className="relative z-10 flex items-start gap-3">
                {renderStageIcon(state)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StageIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          state === 'active'
                            ? 'text-ink'
                            : state === 'complete'
                              ? 'text-success'
                              : state === 'failed'
                                ? 'text-danger'
                                : 'text-ink-subtle'
                        }`}
                      />
                      <h4 className="text-xs font-semibold text-ink truncate">
                        {stage.title}
                      </h4>
                    </div>
                    {renderStateLabel(state)}
                  </div>

                  {isDetailedModal && (
                    <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                      {stage.subtitle}
                    </p>
                  )}

                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                    <span
                      className={`truncate ${
                        state === 'active'
                          ? 'text-ink'
                          : state === 'complete'
                            ? 'text-ink'
                            : state === 'failed'
                              ? 'text-danger'
                              : 'text-ink-subtle'
                      }`}
                    >
                      {state === 'failed'
                        ? errorMessage ||
                          'FFmpeg / API stream interrupted — retry ready'
                        : stage.telemetry}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Inline Compact Progress Bar & Stage Monitor Card */}
      <div className="rounded-xl border border-line bg-canvas p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                effectiveStep === 'failed'
                  ? 'bg-danger'
                  : effectiveStep === 'complete'
                    ? 'bg-success'
                    : isRunning
                      ? 'bg-accent shadow-[0_0_8px_rgba(34,211,238,0.9)]'
                      : 'bg-surface-2'
              }`}
            />
            <span className="text-xs font-semibold text-ink">
              4-Stage Processing Telemetry
            </span>
          </div>

          <button
            type="button"
            onClick={() => setExpandedModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line bg-surface hover:bg-surface-2 text-[11px] font-medium text-ink transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Open Pipeline Modal</span>
          </button>
        </div>

        {renderPipelineBody(false)}
      </div>

      {/* Full Modern Progress Feedback Modal with Framer Motion Animations */}
      <AnimatePresence>
        {expandedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas "
            onClick={() => {
              setExpandedModal(false);
              onCloseModal?.();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-lg space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-ink" />
                    <h3 className="text-base font-bold text-ink">
                      ClipperX 4-Stage Video Processing Pipeline
                    </h3>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Real-time multimodal ingestion, Gemini token stream,
                    sentence-pause subtitle alignment, and FFmpeg 9:16
                    dual-layer rendering.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setExpandedModal(false);
                    onCloseModal?.();
                  }}
                  aria-label="Close pipeline modal"
                  className="p-1.5 rounded-lg border border-line bg-canvas text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detailed 4-Stage Pipeline Body */}
              {renderPipelineBody(true)}

              {/* Interactive Modal Footer: Simulate Pipeline Run / Test Error State / Close */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
                <div className="flex flex-wrap items-center gap-2">
                  {onSimulateRun && (
                    <button
                      type="button"
                      onClick={() => {
                        setSimulatedFailedStage(null);
                        onSimulateRun();
                      }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded-lg bg-accent disabled:opacity-50 text-on-accent text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Run Pipeline Pass</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSimulatedFailedStage((prev) =>
                        prev === null ? 2 : null
                      )
                    }
                    className="px-3 py-1.5 rounded-lg border border-line bg-canvas hover:bg-surface-2 text-xs font-medium text-ink flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-ink" />
                    <span>
                      {simulatedFailedStage !== null
                        ? 'Clear Simulated Failure'
                        : 'Test Failed State'}
                    </span>
                  </button>

                  {onRetry && effectiveStep === 'failed' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSimulatedFailedStage(null);
                        onRetry();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-success/40 bg-success/10 text-success text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Stage</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setExpandedModal(false);
                    onCloseModal?.();
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-line bg-surface-2 hover:bg-surface-2 text-xs font-medium text-ink flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Minimize to Dashboard</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
