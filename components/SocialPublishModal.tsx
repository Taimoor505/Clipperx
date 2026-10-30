'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2,
  Sparkles,
  Hash,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  X,
  Send,
  Globe,
  Link2,
  RefreshCw,
  Video,
  Youtube,
  Instagram,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { ViralClipSegment } from './VerticalShortPlayer';

export type SocialPlatformId = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export type PlatformPublishState =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'published'
  | 'scheduled';

export interface SocialPlatformAccount {
  id: SocialPlatformId;
  name: string;
  apiLabel: string;
  handle: string;
  avatarInitials: string;
  avatarGradient: string;
  connected: boolean;
  enabledForPost: boolean;
  followers: string;
}

export interface SocialPublishModalProps {
  clip?: ViralClipSegment | null;
  isOpen: boolean;
  onClose: () => void;
}

const TRENDING_HASHTAG_POOLS = [
  ['#shorts', '#viral', '#podcast', '#clipperx', '#fyp', '#reels'],
  [
    '#tiktokgrowth',
    '#contentcreator',
    '#storytime',
    '#mindset',
    '#viralvideo',
    '#youtubeshorts',
  ],
  [
    '#aivideo',
    '#videoediting',
    '#podcasts',
    '#entrepreneur',
    '#highretention',
    '#explorepage',
  ],
];

export default function SocialPublishModal({
  clip,
  isOpen,
  onClose,
}: SocialPublishModalProps) {
  const [accounts, setAccounts] = useState<SocialPlatformAccount[]>([
    {
      id: 'tiktok',
      name: 'TikTok',
      apiLabel: 'TikTok Direct Post API v2',
      handle: '@clipperx.studio',
      avatarInitials: 'TT',
      avatarGradient: 'from-cyan-400 via-slate-900 to-rose-500',
      connected: true,
      enabledForPost: true,
      followers: '148.2K',
    },
    {
      id: 'youtube_shorts',
      name: 'YouTube Shorts',
      apiLabel: 'YouTube Data API v3',
      handle: '@ClipperXOfficial',
      avatarInitials: 'YT',
      avatarGradient: 'from-rose-500 to-red-700',
      connected: true,
      enabledForPost: true,
      followers: '92.4K',
    },
    {
      id: 'instagram_reels',
      name: 'Instagram Reels',
      apiLabel: 'IG Graph Reels Container API',
      handle: '@clipperx.ai',
      avatarInitials: 'IG',
      avatarGradient: 'from-amber-400 via-fuchsia-500 to-violet-600',
      connected: true,
      enabledForPost: true,
      followers: '64.9K',
    },
  ]);

  const [captionText, setCaptionText] = useState<string>('');
  const [hashtagPoolIdx, setHashtagPoolIdx] = useState<number>(0);
  const [isGeneratingTags, setIsGeneratingTags] = useState<boolean>(false);

  // Publishing Mode: 'immediate' vs 'scheduled'
  const [publishMode, setPublishMode] = useState<'immediate' | 'scheduled'>(
    'immediate'
  );
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [scheduleTime, setScheduleTime] = useState<string>('18:30');

  // Multi-Platform API Status Feedback State
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [platformStatuses, setPlatformStatuses] = useState<
    Record<SocialPlatformId, { state: PlatformPublishState; progress: number }>
  >({
    tiktok: { state: 'idle', progress: 0 },
    youtube_shorts: { state: 'idle', progress: 0 },
    instagram_reels: { state: 'idle', progress: 0 },
  });

  // Sync default AI caption whenever a new clip opens in the modal
  useEffect(() => {
    if (!clip) return;
    const baseHook =
      clip.hook_transcript ||
      'Stop cutting short-form video on fixed time intervals.';
    setCaptionText(
      `${baseHook} 🔥\n\n${clip.title} — Full breakdown in bio.\n\n#shorts #viral #podcast`
    );
    setPlatformStatuses({
      tiktok: { state: 'idle', progress: 0 },
      youtube_shorts: { state: 'idle', progress: 0 },
      instagram_reels: { state: 'idle', progress: 0 },
    });
    setIsPublishing(false);
  }, [clip]);

  const activePlatforms = useMemo(
    () => accounts.filter((a) => a.connected && a.enabledForPost),
    [accounts]
  );

  // Toggle platform enabled state for publishing
  const handleTogglePlatformPost = (id: SocialPlatformId) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== id) return acc;
        if (!acc.connected) {
          return { ...acc, connected: true, enabledForPost: true };
        }
        return { ...acc, enabledForPost: !acc.enabledForPost };
      })
    );
  };

  // Toggle OAuth account connection state
  const handleToggleAccountConnection = (
    e: React.MouseEvent,
    id: SocialPlatformId
  ) => {
    e.stopPropagation();
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== id) return acc;
        const nextConnected = !acc.connected;
        return {
          ...acc,
          connected: nextConnected,
          enabledForPost: nextConnected,
        };
      })
    );
  };

  // 2. "Generate Trending Hashtags" Button Handler
  const handleGenerateTrendingHashtags = () => {
    setIsGeneratingTags(true);
    window.setTimeout(() => {
      const pool =
        TRENDING_HASHTAG_POOLS[hashtagPoolIdx % TRENDING_HASHTAG_POOLS.length];
      setHashtagPoolIdx((prev) => prev + 1);

      setCaptionText((prev) => {
        const existingLower = prev.toLowerCase();
        const missingTags = pool.filter(
          (tag) => !existingLower.includes(tag.toLowerCase())
        );
        if (missingTags.length === 0) {
          return `${prev.trim()} #trending #shortform`;
        }
        return `${prev.trim()}\n${missingTags.join(' ')}`;
      });
      setIsGeneratingTags(false);
    }, 280);
  };

  // Append a single clicked hashtag chip
  const handleInsertSingleTag = (tag: string) => {
    setCaptionText((prev) => {
      if (prev.toLowerCase().includes(tag.toLowerCase())) return prev;
      return `${prev.trim()} ${tag}`;
    });
  };

  // 3. "Publish Short" Primary Action Handler with Multi-Platform API Telemetry
  const handlePublishShort = () => {
    if (activePlatforms.length === 0 || isPublishing) return;

    setIsPublishing(true);
    const targetEndState: PlatformPublishState =
      publishMode === 'scheduled' ? 'scheduled' : 'published';

    // Initialize enabled platforms to 'uploading'
    const initialMap: Record<
      SocialPlatformId,
      { state: PlatformPublishState; progress: number }
    > = {
      tiktok: { state: 'idle', progress: 0 },
      youtube_shorts: { state: 'idle', progress: 0 },
      instagram_reels: { state: 'idle', progress: 0 },
    };

    activePlatforms.forEach((p) => {
      initialMap[p.id] = { state: 'uploading', progress: 18 };
    });
    setPlatformStatuses(initialMap);

    let tickCount = 0;
    const interval = window.setInterval(() => {
      tickCount += 1;

      setPlatformStatuses((prev) => {
        const next = { ...prev };
        let allDone = true;

        activePlatforms.forEach((p, idx) => {
          const cur = next[p.id];
          const stepBoost = 24 - idx * 3;
          const updatedProg = Math.min(100, cur.progress + stepBoost);

          if (updatedProg < 65) {
            next[p.id] = { state: 'uploading', progress: updatedProg };
            allDone = false;
          } else if (updatedProg < 100) {
            next[p.id] = { state: 'processing', progress: updatedProg };
            allDone = false;
          } else {
            next[p.id] = { state: targetEndState, progress: 100 };
          }
        });

        if (allDone || tickCount > 8) {
          window.clearInterval(interval);
          setIsPublishing(false);
        }

        return next;
      });
    }, 320);
  };

  const allCompleted =
    activePlatforms.length > 0 &&
    activePlatforms.every(
      (p) =>
        platformStatuses[p.id]?.state === 'published' ||
        platformStatuses[p.id]?.state === 'scheduled'
    );

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
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/90 text-slate-100"
          >
            {/* ===============================================================
                MODAL HEADER
               =============================================================== */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      Direct-to-Social Short Publisher
                    </h3>
                    <Badge variant="gradient" className="font-mono text-[10px]">
                      1080×1920 · 60fps
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    Publishing Clip #{clip?.clip_id ?? 1}:{' '}
                    <span className="text-slate-200 font-medium">
                      {clip?.title ||
                        'Why 90% of AI Video Pipelines Fail at Frame Pacing'}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Social Publish Modal"
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* =============================================================
                  1. ACCOUNT CONNECTION PILLS (TikTok, YouTube Shorts, Instagram Reels)
                 ============================================================= */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>1. Connected Destination Accounts</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {activePlatforms.length} of {accounts.length} active for
                    distribution
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {accounts.map((acc) => {
                    const isSelected = acc.connected && acc.enabledForPost;

                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleTogglePlatformPost(acc.id)}
                        className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-violet-500/70 bg-slate-950/90 ring-1 ring-violet-500/30 shadow-md shadow-violet-950/20'
                            : 'border-slate-800/90 bg-slate-950/50 opacity-75 hover:opacity-100 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          {/* Avatar Preview + Platform Name */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full bg-gradient-to-br ${acc.avatarGradient} p-0.5 shrink-0 flex items-center justify-center shadow-sm`}
                            >
                              <div className="w-full h-full rounded-full bg-slate-950/85 flex items-center justify-center text-[11px] font-extrabold font-mono text-white">
                                {acc.avatarInitials}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {acc.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 truncate">
                                {acc.handle}
                              </div>
                            </div>
                          </div>

                          <Switch
                            checked={isSelected}
                            onCheckedChange={() =>
                              handleTogglePlatformPost(acc.id)
                            }
                          />
                        </div>

                        {/* Connection Status Badge Pill */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={(e) =>
                              handleToggleAccountConnection(e, acc.id)
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                              acc.connected
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                acc.connected
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <span>
                              {acc.connected ? 'OAuth Connected' : 'Reconnect'}
                            </span>
                          </button>

                          <span className="text-slate-500">
                            {acc.followers}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* =============================================================
                  2. AI CAPTION & HASHTAG GENERATOR
                 ============================================================= */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="social-caption-textarea"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>2. AI Post Description &amp; Viral Hashtags</span>
                  </label>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTrendingHashtags}
                    disabled={isGeneratingTags}
                    className="h-7 px-2.5 text-xs border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 cursor-pointer"
                  >
                    {isGeneratingTags ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                        <span>Generating Tags...</span>
                      </>
                    ) : (
                      <>
                        <Hash className="w-3 h-3 text-cyan-400" />
                        <span>Generate Trending Hashtags</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative">
                  <textarea
                    id="social-caption-textarea"
                    rows={4}
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Write your short-form hook description and hashtags..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400 resize-none"
                  />
                  <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] font-mono text-slate-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-500">Quick append:</span>
                      {[
                        '#shorts',
                        '#viral',
                        '#podcast',
                        '#fyp',
                        '#reels',
                        '#aivideo',
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleInsertSingleTag(tag)}
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 text-cyan-300 border border-slate-700/70 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <span className="tabular-nums shrink-0">
                      {captionText.length} / 2,200 chars
                    </span>
                  </div>
                </div>
              </div>

              {/* =============================================================
                  3. PUBLISHING CONTROLS (Immediate vs Schedule + Date/Time Picker)
                 ============================================================= */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Release Schedule &amp; Distribution Timing</span>
                </span>

                {/* Radio Selector Cards: Publish Immediately vs Schedule for Later */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setPublishMode('immediate')}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      publishMode === 'immediate'
                        ? 'border-cyan-500/70 bg-cyan-950/15 ring-1 ring-cyan-500/30'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishMode"
                      value="immediate"
                      checked={publishMode === 'immediate'}
                      onChange={() => setPublishMode('immediate')}
                      className="mt-0.5 accent-cyan-400 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">
                        Publish Immediately
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Push 9:16 vertical short live to all selected platforms
                        right now.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setPublishMode('scheduled')}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      publishMode === 'scheduled'
                        ? 'border-violet-500/70 bg-violet-950/15 ring-1 ring-violet-500/30'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="publishMode"
                      value="scheduled"
                      checked={publishMode === 'scheduled'}
                      onChange={() => setPublishMode('scheduled')}
                      className="mt-0.5 accent-violet-400 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">
                        Schedule for Later
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Queue post for peak audience engagement window across
                        platforms.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Date and Time Picker Input when Scheduled is active */}
                {publishMode === 'scheduled' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-violet-500/30 bg-slate-950/80 p-3.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="schedule-date-input"
                        className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3 text-violet-400" />
                        <span>Target Publish Date</span>
                      </label>
                      <input
                        id="schedule-date-input"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-xs font-mono text-white focus:outline-none focus:border-violet-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="schedule-time-input"
                        className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>Target Publish Time (Local TZ)</span>
                      </label>
                      <input
                        id="schedule-time-input"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* =============================================================
                  MULTI-PLATFORM API STATUS FEEDBACK TELEMETRY
                 ============================================================= */}
              {(isPublishing || allCompleted) && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold uppercase tracking-wider text-slate-300">
                      Multi-Platform API Dispatch Status
                    </span>
                    <span className="text-[11px] font-mono text-cyan-300">
                      {allCompleted
                        ? publishMode === 'scheduled'
                          ? `Scheduled for ${scheduleDate} @ ${scheduleTime}`
                          : 'All Platforms Live'
                        : 'Streaming 1080×1920 MP4 payloads...'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activePlatforms.map((acc) => {
                      const st = platformStatuses[acc.id] || {
                        state: 'idle',
                        progress: 0,
                      };
                      const isDone =
                        st.state === 'published' || st.state === 'scheduled';

                      return (
                        <div
                          key={acc.id}
                          className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {acc.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({acc.apiLabel})
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                              {st.state === 'uploading' && (
                                <span className="text-cyan-300 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Uploading 9:16 MP4 ({st.progress}%)</span>
                                </span>
                              )}
                              {st.state === 'processing' && (
                                <span className="text-violet-300 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>
                                    Indexing Captions ({st.progress}%)
                                  </span>
                                </span>
                              )}
                              {isDone && (
                                <span className="text-emerald-300 flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>
                                    {st.state === 'scheduled'
                                      ? 'Scheduled via API'
                                      : 'Published Live'}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                            <div
                              style={{ width: `${st.progress}%` }}
                              className={`h-full transition-all duration-200 ${
                                isDone
                                  ? 'bg-emerald-400'
                                  : 'bg-gradient-to-r from-violet-500 to-cyan-400'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =============================================================
                  MODAL FOOTER & "PUBLISH SHORT" PRIMARY ACTION BUTTON
                 ============================================================= */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="text-xs font-mono text-slate-400">
                  {activePlatforms.length === 0 ? (
                    <span className="text-amber-400">
                      Enable at least 1 social account above to publish
                    </span>
                  ) : (
                    <span>
                      Ready for{' '}
                      <strong className="text-white">
                        {activePlatforms.map((p) => p.name).join(', ')}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={onClose}
                  >
                    Close
                  </Button>

                  <Button
                    type="button"
                    variant={allCompleted ? 'emerald' : 'default'}
                    size="default"
                    disabled={activePlatforms.length === 0 || isPublishing}
                    onClick={handlePublishShort}
                    className="cursor-pointer"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publishing to {activePlatforms.length} APIs...</span>
                      </>
                    ) : allCompleted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {publishMode === 'scheduled'
                            ? 'Scheduled Across Platforms'
                            : 'Published to All Platforms'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {publishMode === 'scheduled'
                            ? 'Schedule Short'
                            : 'Publish Short'}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
