'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { timestampToSeconds } from './VerticalShortPlayer';
import type { ViralClipSegment } from './VerticalShortPlayer';

export interface ViralityInsightsModalProps {
  clip?: ViralClipSegment | null;
  isOpen: boolean;
  onClose: () => void;
}

function clock(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Why a clip was picked: only what the clip-picking model actually returned (its score,
 * the opening line, and its reasoning) plus where the clip sits in the source video.
 */
export default function ViralityInsightsModal({ clip, isOpen, onClose }: ViralityInsightsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && clip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay"
        >
          <motion.div
            role="dialog"
            aria-labelledby="why-title"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="why-title" className="text-[15px] font-semibold">
                  Why this clip
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">{clip.title}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 -mr-2 -mt-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-muted">Score</dt>
                <dd className="text-xl font-semibold tabular-nums">{clip.virality_score}</dd>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-muted">Length</dt>
                <dd className="text-xl font-semibold tabular-nums">{clock(clip.duration_seconds)}</dd>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-muted">From</dt>
                <dd className="text-xl font-semibold tabular-nums">{clock(timestampToSeconds(clip.start_time))}</dd>
              </div>
            </dl>

            {clip.hook_transcript && (
              <div className="mt-5">
                <h4 className="text-xs text-ink-muted">Opening line</h4>
                <p className="mt-1 text-[15px] leading-relaxed">&ldquo;{clip.hook_transcript}&rdquo;</p>
              </div>
            )}

            {clip.reasoning && (
              <div className="mt-4">
                <h4 className="text-xs text-ink-muted">What the model saw</h4>
                <p className="mt-1 text-sm leading-relaxed text-ink">{clip.reasoning}</p>
              </div>
            )}

            <p className="mt-5 text-xs text-ink-subtle">
              The score is the clip-picking model&rsquo;s own 0&ndash;100 estimate of how well the
              moment works as a short. It isn&rsquo;t measured from real views.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
