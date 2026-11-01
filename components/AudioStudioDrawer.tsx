'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Volume2,
  Mic,
  Upload,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Radio,
  Code2,
  Copy,
  FileAudio,
  X,
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
import { Switch } from '@/components/ui/switch';

export type AmbientTrackPresetId =
  | 'lofi_beats'
  | 'cinematic_tension'
  | 'upbeat_phonk'
  | 'corporate_clean'
  | 'custom_upload';

export interface AudioMixConfig {
  selectedTrackId: AmbientTrackPresetId;
  customFileName: string | null;
  voiceVolumePct: number; // 0 to 150%
  musicVolumePct: number; // 0 to 100%
  enableDucking: boolean;
  duckingThreshold: number; // 0.02 to 0.25 (default 0.08)
  duckingRatio: number; // 2 to 10 (default 4)
  attackMs: number; // default 20
  releaseMs: number; // default 300
}

export interface AudioStudioDrawerProps {
  enableAudioDucking?: boolean;
  onToggleAudioDucking?: (enabled: boolean) => void;
  onChangeAudioMix?: (config: AudioMixConfig) => void;
}

interface AmbientTrackPreset {
  id: Exclude<AmbientTrackPresetId, 'custom_upload'>;
  name: string;
  genreTag: string;
  bpm: number;
  description: string;
  accentColor: string;
  baseFreqs: number[];
}

const AMBIENT_TRACK_PRESETS: AmbientTrackPreset[] = [
  {
    id: 'lofi_beats',
    name: 'Lofi Beats',
    genreTag: 'Chill / Storytelling',
    bpm: 84,
    description: 'Warm Rhodes chords & dusty vinyl groove for podcast hooks',
    accentColor: 'text-ink border-accent bg-accent-soft',
    baseFreqs: [220, 277.18, 329.63, 415.3],
  },
  {
    id: 'cinematic_tension',
    name: 'Cinematic Tension',
    genreTag: 'Suspense / Tech',
    bpm: 110,
    description: 'Deep sub-bass pulse & rising minor ostinato for dramatic reveals',
    accentColor: 'text-ink border-accent bg-accent-soft',
    baseFreqs: [110, 130.81, 164.81, 220],
  },
  {
    id: 'upbeat_phonk',
    name: 'Upbeat Phonk',
    genreTag: 'High Velocity',
    bpm: 136,
    description: 'Punchy 808 drift bass & rhythmic cowbell for high-energy shorts',
    accentColor: 'text-danger border-danger/40 bg-danger/10',
    baseFreqs: [146.83, 174.61, 220, 293.66],
  },
  {
    id: 'corporate_clean',
    name: 'Corporate Clean',
    genreTag: 'SaaS / Educational',
    bpm: 102,
    description: 'Crisp marimba plucks & airy stereo pad for B2B & founder clips',
    accentColor: 'text-ink border-accent bg-accent-soft',
    baseFreqs: [261.63, 329.63, 392.0, 523.25],
  },
];

export default function AudioStudioDrawer({
  enableAudioDucking = true,
  onToggleAudioDucking,
  onChangeAudioMix,
}: AudioStudioDrawerProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [mixConfig, setMixConfig] = useState<AudioMixConfig>({
    selectedTrackId: 'lofi_beats',
    customFileName: null,
    voiceVolumePct: 115,
    musicVolumePct: 18,
    enableDucking: enableAudioDucking,
    duckingThreshold: 0.08,
    duckingRatio: 4,
    attackMs: 20,
    releaseMs: 300,
  });

  const [playingTrackId, setPlayingTrackId] =
    useState<AmbientTrackPresetId | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [copiedFilter, setCopiedFilter] = useState<boolean>(false);
  const [simulatedDuckingDb, setSimulatedDuckingDb] = useState<number>(0);

  // Web Audio API refs for real procedural preset preview
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const stepIntervalRef = useRef<number | null>(null);
  const customAudioElemRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync external prop changes
  useEffect(() => {
    setMixConfig((prev) =>
      prev.enableDucking === enableAudioDucking
        ? prev
        : { ...prev, enableDucking: enableAudioDucking }
    );
  }, [enableAudioDucking]);

  // Simulate live sidechain gain reduction meter when ducking is enabled
  useEffect(() => {
    if (!mixConfig.enableDucking) {
      setSimulatedDuckingDb(0);
      return;
    }
    const timer = window.setInterval(() => {
      const sensitivity = (0.26 - mixConfig.duckingThreshold) * 45;
      const wave = Math.abs(Math.sin(Date.now() / 340));
      const reduction = Math.min(
        18,
        Math.round(wave * sensitivity * (mixConfig.duckingRatio / 4))
      );
      setSimulatedDuckingDb(reduction);
    }, 180);
    return () => window.clearInterval(timer);
  }, [
    mixConfig.enableDucking,
    mixConfig.duckingThreshold,
    mixConfig.duckingRatio,
  ]);

  // Adjust live Web Audio / HTMLAudio gain when musicVolumePct slider moves
  useEffect(() => {
    const normalizedGain = Math.max(
      0,
      Math.min(1, (mixConfig.musicVolumePct / 100) * 0.35)
    );
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        normalizedGain,
        audioCtxRef.current.currentTime,
        0.05
      );
    }
    if (customAudioElemRef.current) {
      customAudioElemRef.current.volume = Math.max(
        0,
        Math.min(1, mixConfig.musicVolumePct / 100)
      );
    }
  }, [mixConfig.musicVolumePct]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAllAudioPreviews();
      if (customAudioUrl) {
        URL.revokeObjectURL(customAudioUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMix = (partial: Partial<AudioMixConfig>) => {
    setMixConfig((prev) => {
      const next = { ...prev, ...partial };
      onChangeAudioMix?.(next);
      return next;
    });
  };

  const stopAllAudioPreviews = () => {
    if (stepIntervalRef.current) {
      window.clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }
    if (customAudioElemRef.current) {
      customAudioElemRef.current.pause();
      customAudioElemRef.current.currentTime = 0;
    }
    setPlayingTrackId(null);
  };

  // Toggle Play/Pause preview for an ambient preset using Web Audio API synthesis
  const handleTogglePlayPreset = (
    e: React.MouseEvent,
    preset: AmbientTrackPreset
  ) => {
    e.stopPropagation();

    if (playingTrackId === preset.id) {
      stopAllAudioPreviews();
      return;
    }

    stopAllAudioPreviews();
    updateMix({ selectedTrackId: preset.id });

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioContextClass();
      const masterGain = ctx.createGain();
      masterGain.gain.value = Math.max(
        0.04,
        Math.min(0.4, (mixConfig.musicVolumePct / 100) * 0.35)
      );
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = masterGain;
      setPlayingTrackId(preset.id);

      let step = 0;
      const stepDurationMs = Math.round((60 / preset.bpm) * 500);

      const triggerNote = () => {
        if (!audioCtxRef.current || !gainNodeRef.current) return;
        const now = audioCtxRef.current.currentTime;
        const osc = audioCtxRef.current.createOscillator();
        const noteGain = audioCtxRef.current.createGain();

        const freq = preset.baseFreqs[step % preset.baseFreqs.length];
        osc.type =
          preset.id === 'upbeat_phonk'
            ? 'sawtooth'
            : preset.id === 'cinematic_tension'
            ? 'triangle'
            : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.45, now + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(
          0.001,
          now + stepDurationMs / 1000
        );

        osc.connect(noteGain);
        noteGain.connect(gainNodeRef.current);
        osc.start(now);
        osc.stop(now + stepDurationMs / 1000 + 0.02);
        step += 1;
      };

      triggerNote();
      stepIntervalRef.current = window.setInterval(triggerNote, stepDurationMs);
    } catch {
      setPlayingTrackId(null);
    }
  };

  // Custom MP3/WAV Upload Handler
  const handleCustomAudioFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopAllAudioPreviews();
    if (customAudioUrl) {
      URL.revokeObjectURL(customAudioUrl);
    }

    const url = URL.createObjectURL(file);
    setCustomAudioUrl(url);
    updateMix({
      selectedTrackId: 'custom_upload',
      customFileName: file.name,
    });
  };

  const handleTogglePlayCustomUpload = () => {
    if (!customAudioElemRef.current || !customAudioUrl) return;
    if (playingTrackId === 'custom_upload') {
      customAudioElemRef.current.pause();
      setPlayingTrackId(null);
    } else {
      stopAllAudioPreviews();
      customAudioElemRef.current.volume = Math.max(
        0,
        Math.min(1, mixConfig.musicVolumePct / 100)
      );
      customAudioElemRef.current.play().catch(() => {});
      setPlayingTrackId('custom_upload');
    }
  };

  const handleResetAudioMix = () => {
    stopAllAudioPreviews();
    const defaults: AudioMixConfig = {
      selectedTrackId: 'lofi_beats',
      customFileName: mixConfig.customFileName,
      voiceVolumePct: 115,
      musicVolumePct: 18,
      enableDucking: true,
      duckingThreshold: 0.08,
      duckingRatio: 4,
      attackMs: 20,
      releaseMs: 300,
    };
    setMixConfig(defaults);
    onToggleAudioDucking?.(true);
    onChangeAudioMix?.(defaults);
  };

  // Generated FFmpeg Sidechain Audio Ducking & Mixing Filter String
  const voiceVolFloat = (mixConfig.voiceVolumePct / 100).toFixed(2);
  const musicVolFloat = (mixConfig.musicVolumePct / 100).toFixed(2);

  const ffmpegAudioFilterString = mixConfig.enableDucking
    ? `ffmpeg -i speech.mp4 -i ${
        mixConfig.selectedTrackId === 'custom_upload' &&
        mixConfig.customFileName
          ? mixConfig.customFileName
          : `${mixConfig.selectedTrackId}.mp3`
      } -filter_complex "[0:a]volume=${voiceVolFloat}[voice];[1:a]volume=${musicVolFloat}[bg];[bg][voice]sidechaincompress=threshold=${mixConfig.duckingThreshold.toFixed(
        2
      )}:ratio=${mixConfig.duckingRatio}:attack=${mixConfig.attackMs}:release=${
        mixConfig.releaseMs
      }[ducked];[voice][ducked]amix=inputs=2:duration=first[aout]"`
    : `ffmpeg -i speech.mp4 -i ${
        mixConfig.selectedTrackId === 'custom_upload' &&
        mixConfig.customFileName
          ? mixConfig.customFileName
          : `${mixConfig.selectedTrackId}.mp3`
      } -filter_complex "[0:a]volume=${voiceVolFloat}[voice];[1:a]volume=${musicVolFloat}[bg];[voice][bg]amix=inputs=2:duration=first[aout]"`;

  const handleCopyFilter = () => {
    navigator.clipboard.writeText(ffmpegAudioFilterString);
    setCopiedFilter(true);
    window.setTimeout(() => setCopiedFilter(false), 1800);
  };

  return (
    <Card className="border-line bg-surface shadow-lg overflow-hidden">
      {/* Hidden <audio> element for custom uploaded MP3/WAV */}
      {customAudioUrl && (
        <audio
          ref={customAudioElemRef}
          src={customAudioUrl}
          onEnded={() => setPlayingTrackId(null)}
          className="hidden"
        />
      )}

      {/* =====================================================================
          HEADER BAR
         ===================================================================== */}
      <CardHeader className="pb-4 border-b border-line bg-canvas">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent-soft border border-accent flex items-center justify-center text-ink">
                <Music className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="text-base">
                Audio Enhancement &amp; Sidechain Ducking Studio
              </CardTitle>
              <Badge variant="gradient" className="font-mono text-[10px]">
                Voice {mixConfig.voiceVolumePct}% · BGM{' '}
                {mixConfig.musicVolumePct}%
              </Badge>
              {playingTrackId && (
                <Badge variant="green" className="font-mono text-[10px]">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Previewing Audio</span>
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-ink-muted">
              Select a royalty-free ambient track or upload MP3/WAV, balance
              voiceover vs. music levels, and configure FFmpeg sidechain audio
              ducking.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetAudioMix}
              className="border border-line bg-canvas hover:bg-surface-2 text-ink cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>Reset Mix</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDrawerOpen((v) => !v)}
              className="border-line bg-surface hover:bg-surface-2 text-ink cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-ink" />
              <span>{isDrawerOpen ? 'Collapse Studio' : 'Expand Studio'}</span>
              {isDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isDrawerOpen && (
        <CardContent className="pt-5 space-y-6">
          {/* =================================================================
              1. AMBIENT TRACK LIBRARY (4 Preset Cards + Custom MP3/WAV Upload Slot)
             ================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-ink" />
                <span>1. Royalty-Free Ambient Track Library</span>
              </span>
              <span className="text-[11px] font-mono text-ink-muted">
                Click play button to audition track in browser
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {AMBIENT_TRACK_PRESETS.map((preset) => {
                const isSelected = mixConfig.selectedTrackId === preset.id;
                const isPlaying = playingTrackId === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => updateMix({ selectedTrackId: preset.id })}
                    className={`group rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-surface ring-2 ring-accent shadow-lg '
                        : 'border-line bg-canvas hover:border-line hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${preset.accentColor}`}
                      >
                        {preset.genreTag} · {preset.bpm} BPM
                      </span>

                      {/* Play / Pause Audio Preview Trigger */}
                      <button
                        type="button"
                        onClick={(e) => handleTogglePlayPreset(e, preset)}
                        title={
                          isPlaying
                            ? `Pause ${preset.name} preview`
                            : `Preview ${preset.name}`
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                          isPlaying
                            ? 'bg-accent border-accent text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                            : 'bg-surface border-line text-ink hover:border-accent hover:text-ink'
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        )}
                      </button>
                    </div>

                    {/* Mini Animated Audio Equalizer Bars */}
                    <div className="h-8 rounded-lg bg-canvas border border-line px-2.5 flex items-center justify-between gap-1 mb-2.5">
                      {Array.from({ length: 16 }).map((_, barIdx) => {
                        const baseH =
                          25 + ((barIdx * 19 + preset.bpm) % 60);
                        return (
                          <span
                            key={barIdx}
                            style={{
                              height: isPlaying
                                ? `${Math.max(20, (baseH + 25) % 90)}%`
                                : `${Math.round(baseH * 0.55)}%`,
                            }}
                            className={`flex-1 rounded-full transition-all duration-150 ${
                              isPlaying
                                ? 'bg-accent animate-pulse'
                                : isSelected
                                ? 'bg-accent'
                                : 'bg-surface-2'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-success" />
                      )}
                    </div>
                    <p className="text-[11px] text-ink-muted leading-snug mt-0.5 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Custom Audio File Upload Slot (MP3/WAV) */}
            <div className="rounded-xl border border-dashed border-line bg-canvas p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center text-ink shrink-0">
                  <FileAudio className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink truncate">
                      {mixConfig.customFileName
                        ? `Custom Track: ${mixConfig.customFileName}`
                        : 'Upload Custom Ambient Track (MP3 / WAV)'}
                    </span>
                    {mixConfig.selectedTrackId === 'custom_upload' && (
                      <Badge variant="green" className="text-[10px] font-mono">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-muted truncate">
                    Import your own brand stem or instrumental bed for sidechain
                    ducking
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                  onChange={handleCustomAudioFileUpload}
                  className="hidden"
                />

                {customAudioUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePlayCustomUpload}
                    className="h-8 px-2.5 text-xs cursor-pointer"
                  >
                    {playingTrackId === 'custom_upload' ? (
                      <>
                        <Pause className="w-3 h-3 text-ink" />
                        <span>Pause Custom</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-ink" />
                        <span>Play Custom</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 text-xs border-line bg-surface hover:bg-surface-2 text-ink cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-ink" />
                  <span>
                    {mixConfig.customFileName ? 'Replace Audio' : 'Upload MP3/WAV'}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* =================================================================
              2 & 3. AUDIO MIXING SLIDERS + SIDECHAIN AUTO-DUCKING CONTROLS
             ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-line">
            {/* 2. Audio Mixing Sliders (Voiceover 0-150% & Background Music 0-100%) */}
            <div className="lg:col-span-6 rounded-xl border border-line bg-canvas p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-ink" />
                  <span>2. Voiceover &amp; Music Gain Staging</span>
                </span>
                <span className="text-[10px] font-mono text-ink-muted">
                  FFmpeg Volume Filter
                </span>
              </div>

              {/* Voiceover Volume Slider (0% to 150%) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="voiceover-volume-slider"
                    className="text-xs font-medium text-ink flex items-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5 text-success" />
                    <span>Primary Voiceover Volume</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {mixConfig.voiceVolumePct > 100 && (
                      <span className="px-1.5 py-0.2 rounded bg-success/10 border border-success/40 text-[10px] font-mono text-success">
                        +{mixConfig.voiceVolumePct - 100}% Vocal Boost
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-ink tabular-nums">
                      {mixConfig.voiceVolumePct}%
                    </span>
                  </div>
                </div>

                <input
                  id="voiceover-volume-slider"
                  type="range"
                  min={0}
                  max={150}
                  step={1}
                  value={mixConfig.voiceVolumePct}
                  onChange={(e) =>
                    updateMix({ voiceVolumePct: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted tabular-nums">
                  <span>0% (Mute)</span>
                  <span>100% (Unity 0dB)</span>
                  <span>150% (+3.5dB Vocal Punch)</span>
                </div>
              </div>

              {/* Background Music Volume Slider (0% to 100%) */}
              <div className="space-y-2 pt-2 border-t border-line">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bgm-volume-slider"
                    className="text-xs font-medium text-ink flex items-center gap-1.5"
                  >
                    <Music className="w-3.5 h-3.5 text-ink" />
                    <span>Background Music Bed Volume</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-ink tabular-nums">
                    {mixConfig.musicVolumePct}%
                  </span>
                </div>

                <input
                  id="bgm-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={mixConfig.musicVolumePct}
                  onChange={(e) =>
                    updateMix({ musicVolumePct: Number(e.target.value) })
                  }
                  className="w-full accent-violet-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted tabular-nums">
                  <span>0% (Off)</span>
                  <span className="text-ink">
                    15–22% (Recommended Bed)
                  </span>
                  <span>100% (Full Level)</span>
                </div>
              </div>
            </div>

            {/* 3. Auto-Ducking Toggle & Threshold Sensitivity Controls */}
            <div className="lg:col-span-6 rounded-xl border border-line bg-canvas p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink block">
                    3. Enable Sidechain Audio Ducking
                  </span>
                  <span className="text-[11px] text-ink-muted block">
                    Automatically compresses BGM whenever speech is detected
                  </span>
                </div>
                <Switch
                  checked={mixConfig.enableDucking}
                  onCheckedChange={(checked) => {
                    updateMix({ enableDucking: checked });
                    onToggleAudioDucking?.(checked);
                  }}
                />
              </div>

              {/* Threshold Sensitivity & Compression Ratio Sliders */}
              <div
                className={`space-y-3.5 transition-opacity ${
                  mixConfig.enableDucking
                    ? 'opacity-100'
                    : 'opacity-45 pointer-events-none'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="ducking-threshold-slider"
                      className="text-ink font-medium"
                    >
                      Speech Detection Threshold Sensitivity
                    </label>
                    <span className="font-mono font-bold text-ink tabular-nums">
                      {mixConfig.duckingThreshold.toFixed(2)} (
                      {mixConfig.duckingThreshold <= 0.06
                        ? 'Aggressive'
                        : mixConfig.duckingThreshold <= 0.12
                        ? 'Balanced'
                        : 'Gentle'}
                      )
                    </span>
                  </div>
                  <input
                    id="ducking-threshold-slider"
                    type="range"
                    min={0.02}
                    max={0.25}
                    step={0.01}
                    value={mixConfig.duckingThreshold}
                    onChange={(e) =>
                      updateMix({
                        duckingThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted">
                    <span>0.02 (Ducks on soft whispers)</span>
                    <span>0.08 (Default)</span>
                    <span>0.25 (Loud peaks only)</span>
                  </div>
                </div>

                {/* Compression Ratio Selector + Live Gain Reduction Meter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg border border-line bg-surface p-2.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-ink-muted block">
                      Compression Ratio &amp; Envelope
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[2, 4, 6, 8].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => updateMix({ duckingRatio: r })}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                            mixConfig.duckingRatio === r
                              ? 'bg-accent-soft border border-accent text-ink font-bold'
                              : 'bg-canvas border border-line text-ink-muted hover:text-ink'
                          }`}
                        >
                          {r}:1
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Sidechain Gain Reduction Telemetry Meter */}
                  <div className="rounded-lg border border-line bg-surface p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-ink-muted">GAIN REDUCTION</span>
                      <span className="text-ink font-bold tabular-nums">
                        -{simulatedDuckingDb} dB
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-canvas overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            (simulatedDuckingDb / 18) * 100
                          )}%`,
                        }}
                        className="h-full bg-accent transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generated FFmpeg Sidechain Audio Ducking Filter Preview */}
          <div className="rounded-xl border border-line bg-canvas p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-ink" />
                <span>Live FFmpeg Sidechain Audio Filter Graph</span>
              </span>
              <button
                type="button"
                onClick={handleCopyFilter}
                className="inline-flex items-center gap-1 text-[10px] font-mono text-ink hover:text-ink cursor-pointer"
              >
                {copiedFilter ? (
                  <>
                    <Check className="w-3 h-3 text-success" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy FFmpeg Command</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-ink overflow-x-auto pb-1">
              <code>{ffmpegAudioFilterString}</code>
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
