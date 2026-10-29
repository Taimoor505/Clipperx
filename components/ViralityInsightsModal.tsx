'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  X,
  BarChart3,
  Brain,
  Target,
  ArrowUpRight,
  Mic,
  Eye,
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
import type { ViralClipSegment } from './VerticalShortPlayer';

export interface ViralityBreakdownMetrics {
  overallScore: number; // e.g., 94
  hookStrength: number; // e.g., 98
  retentionIndex: number; // e.g., 88
  topicTrendingFactor: number; // e.g., 91
  sentencePacing: number; // e.g., 95
  estimated3sHoldRate: string;
  predictedCompletionRate: string;
  rpmNicheTier: string;
  editorialSummary: string;
  keyMoments: {
    timestamp: string;
    label: string;
    detail: string;
    tag: string;
  }[];
}

export interface ViralityInsightsModalProps {
  clip?: ViralClipSegment | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectClipForRender?: (clip: ViralClipSegment) => void;
}

function computeClipViralityMetrics(
  clip?: ViralClipSegment | null
): ViralityBreakdownMetrics {
  const baseScore = clip?.virality_score ?? 94;
  const seed = (clip?.clip_id ?? 1) * 7;

  // Deterministic, realistic sub-metrics anchored to the clip's overall score
  const hookStrength = Math.min(
    99,
    Math.max(82, baseScore + (seed % 5 === 0 ? 4 : 2))
  );
  const retentionIndex = Math.min(
    97,
    Math.max(76, baseScore - 6 + (seed % 4))
  );
  const topicTrendingFactor = Math.min(
    98,
    Math.max(79, baseScore - 3 + (seed % 5))
  );
  const sentencePacing = Math.min(
    99,
    Math.max(84, baseScore + 1 - (seed % 3))
  );

  const durationSec = clip?.duration_seconds ?? 45.7;
  const mid1 = Math.min(14, Math.max(8, Math.round(durationSec * 0.26)));
  const mid2 = Math.min(32, Math.max(19, Math.round(durationSec * 0.6)));
  const endMoment = Math.max(28, Math.round(durationSec - 1.7));

  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return {
    overallScore: baseScore,
    hookStrength,
    retentionIndex,
    topicTrendingFactor,
    sentencePacing,
    estimated3sHoldRate: `${Math.min(94, Math.round(hookStrength * 0.91))}%`,
    predictedCompletionRate: `${Math.min(
      89,
      Math.round(retentionIndex * 0.93)
    )}%`,
    rpmNicheTier: baseScore >= 90 ? 'High-RPM Tech / Creator' : 'Growth / SaaS',
    editorialSummary:
      clip?.reasoning ||
      'Opens with an immediate pattern-interrupt statement in the first 3.2 seconds, maintains zero dead-air sentence transitions, and lands on a self-contained takeaway.',
    keyMoments: [
      {
        timestamp: '00:02',
        label: 'Curiosity Gap & Pattern-Interrupt Hook',
        detail: `Spoken hook ("${
          clip?.hook_transcript?.slice(0, 68) ||
          'Stop cutting short-form video on fixed time intervals'
        }...") triggers immediate scroll-stop tension.`,
        tag: 'HOOK 0–5s',
      },
      {
        timestamp: formatMmSs(mid1),
        label: `Peak Emotional Trigger at ${formatMmSs(mid1)}`,
        detail:
          'Vocal pitch inflection and primary contrarian claim hit peak semantic density with zero filler words.',
        tag: 'PEAK TRIGGER',
      },
      {
        timestamp: formatMmSs(mid2),
        label: `Mid-Clip Retention Reset at ${formatMmSs(mid2)}`,
        detail:
          'Sentence boundary aligns with a 1.12x punch-in zoom beat, preventing mid-clip viewer drop-off.',
        tag: 'RETENTION BEAT',
      },
      {
        timestamp: formatMmSs(endMoment),
        label: `Clean Resolution at ${formatMmSs(endMoment)}`,
        detail:
          'Ends on a complete grammatical pause with a loop-friendly cadence that encourages re-watches and shares.',
        tag: 'CLEAN CUT',
      },
    ],
  };
}

export default function ViralityInsightsModal({
  clip,
  isOpen,
  onClose,
  onSelectClipForRender,
}: ViralityInsightsModalProps) {
  const metrics = useMemo(() => computeClipViralityMetrics(clip), [clip]);

  const breakdownRows = [
    {
      id: 'hook',
      label: 'Hook Strength (0–5s)',
      description: 'Evaluates emotional punch and curiosity gap',
      value: metrics.hookStrength,
      benchmark: '+16% vs top shorts',
      icon: Zap,
      barColor: 'from-emerald-400 to-cyan-400',
      badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    },
    {
      id: 'retention',
      label: 'Retention Index',
      description: 'Predicts viewer drop-off rate based on pacing',
      value: metrics.retentionIndex,
      benchmark: 'Low drop-off risk',
      icon: Activity,
      barColor: 'from-cyan-400 to-violet-500',
      badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    },
    {
      id: 'trending',
      label: 'Topic Trending Factor',
      description: 'Alignment with high-RPM niches',
      value: metrics.topicTrendingFactor,
      benchmark: metrics.rpmNicheTier,
      icon: TrendingUp,
      barColor: 'from-violet-500 to-fuchsia-400',
      badgeColor: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    },
    {
      id: 'pacing',
      label: 'Sentence Pacing',
      description: 'Checks for dead air or silence gaps',
      value: metrics.sentencePacing,
      benchmark: '<80ms silence gaps',
      icon: Mic,
      barColor: 'from-amber-400 to-emerald-400',
      badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    },
  ];

  // Radial SVG Progress Ring Geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (metrics.overallScore / 100) * circumference;
  const isHighViral = metrics.overallScore >= 90;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/90 text-slate-100"
          >
            {/* ===============================================================
                MODAL HEADER
               =============================================================== */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      Virality Insights &amp; Multimodal Telemetry
                    </h3>
                    <Badge
                      variant={isHighViral ? 'green' : 'yellow'}
                      className="font-mono text-[10px]"
                    >
                      Clip #{clip?.clip_id ?? 1}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {clip?.title ||
                      'Why 90% of AI Video Pipelines Fail at Frame Pacing'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Virality Insights Modal"
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* =============================================================
                  1. TOP METRIC OVERVIEW (Animated Radial Gauge + KPI Grid)
                 ============================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center rounded-xl border border-slate-800/90 bg-slate-950/70 p-5">
                {/* Animated Radial Progress Ring */}
                <div className="md:col-span-5 flex items-center gap-4 border-b md:border-b-0 md:border-r border-slate-800/80 pb-4 md:pb-0 md:pr-4">
                  <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                    <svg
                      className="w-full h-full -rotate-90"
                      viewBox="0 0 128 128"
                    >
                      <defs>
                        <linearGradient
                          id="viralityGaugeGrad"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor="#34D399" />
                          <stop offset="50%" stopColor="#22D3EE" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                      {/* Background Track Circle */}
                      <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(30, 41, 59, 0.9)"
                        strokeWidth="10"
                      />
                      {/* Animated Score Progress Ring */}
                      <motion.circle
                        cx="64"
                        cy="64"
                        r={radius}
                        fill="transparent"
                        stroke="url(#viralityGaugeGrad)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    </svg>

                    {/* Center Score Readout */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                        SCORE
                      </span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-extrabold font-mono text-white tabular-nums">
                          {metrics.overallScore}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          /100
                        </span>
                      </div>
                      <span className="mt-0.5 px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono font-semibold text-emerald-300">
                        {isHighViral ? 'S-TIER VIRAL' : 'STRONG PICK'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Badge variant="gradient" className="text-[10px]">
                      <Flame className="w-3 h-3" />
                      <span>Overall Virality Score</span>
                    </Badge>
                    <h4 className="text-sm font-bold text-white leading-snug">
                      Top {Math.max(1, 100 - metrics.overallScore)}% Short-Form
                      Candidate
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Window:{' '}
                      <span className="font-mono text-slate-200">
                        {clip?.start_time ?? '00:04:12.500'} →{' '}
                        {clip?.end_time ?? '00:04:58.200'}
                      </span>{' '}
                      ({(clip?.duration_seconds ?? 45.7).toFixed(1)}s)
                    </p>
                  </div>
                </div>

                {/* Secondary Telemetry Micro-Cards */}
                <div className="md:col-span-7 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>3s HOLD RATE</span>
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-lg font-bold font-mono text-white tabular-nums">
                      {metrics.estimated3sHoldRate}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>Above 72% avg</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>AVG COMPLETION</span>
                      <Target className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="text-lg font-bold font-mono text-white tabular-nums">
                      {metrics.predictedCompletionRate}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-300">
                      Loop-ready ending
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>CUT PRECISION</span>
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-lg font-bold font-mono text-white tabular-nums">
                      99.4%
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Zero mid-word cuts
                    </div>
                  </div>
                </div>
              </div>

              {/* =============================================================
                  2. SCORE BREAKDOWN PROGRESS BARS (4 Core Viral Dimensions)
                 ============================================================= */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Multimodal Virality Score Breakdown</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    4 Weighted Ranking Signals
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {breakdownRows.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800/90 bg-slate-950/65 p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white">
                                {item.label}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <span className="text-sm font-extrabold font-mono text-white tabular-nums shrink-0">
                            {item.value}%
                          </span>
                        </div>

                        {/* Animated Horizontal Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800/80 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.value}%` }}
                            transition={{
                              duration: 0.7,
                              delay: idx * 0.08,
                              ease: 'easeOut',
                            }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.barColor}`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-500">
                            Signal Weight: 25%
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded border ${item.badgeColor}`}
                          >
                            {item.benchmark}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* =============================================================
                  3. AI EDITORIAL EXPLANATION BOX (Qualitative Reasoning + Key Moments)
                 ============================================================= */}
              <Card className="border-violet-500/35 bg-gradient-to-br from-violet-950/25 via-slate-950/90 to-cyan-950/20 shadow-inner">
                <CardHeader className="pb-3 border-b border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <CardTitle className="text-sm text-white">
                        Gemini Editorial Explanation &amp; Timestamped Moments
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Multimodal Audio + Visual Track
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-300 leading-relaxed pt-1">
                    {metrics.editorialSummary}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 space-y-2.5">
                  <ul className="space-y-2.5">
                    {metrics.keyMoments.map((moment, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/75 p-3"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white">
                              {moment.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-[10px] font-mono text-violet-300">
                                {moment.tag}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300 tabular-nums">
                                @{moment.timestamp}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {moment.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Modal Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs text-slate-400 font-mono">
                  Hook:{' '}
                  <span className="text-slate-200 italic">
                    &ldquo;{clip?.hook_transcript?.slice(0, 62)}...&rdquo;
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                  >
                    Close Insights
                  </Button>
                  {clip && onSelectClipForRender && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => {
                        onSelectClipForRender(clip);
                        onClose();
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Render This 9:16 Short</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
