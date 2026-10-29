'use client';

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Type,
  Sliders,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  Smartphone,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Play,
  Pause,
  Code2,
  Copy,
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

export type CaptionPresetId =
  | 'Hormozi Pop'
  | 'Clean Minimalist'
  | 'Cyber Neon'
  | 'Red Highlight';

export type SupportedFontFamily = 'Impact' | 'Montserrat' | 'Inter' | 'Arial';

export interface CaptionStyleConfig {
  presetId: CaptionPresetId;
  fontFamily: SupportedFontFamily;
  primaryColor: string;
  highlightColor: string;
  fontSizePx: number; // 40px to 90px (in 1080x1920 reference space)
  marginBottomPx: number; // 200px to 800px from bottom (1080x1920 reference space)
  strokeWidthPx: number;
  uppercase: boolean;
  boxBackground: boolean;
  neonGlow: boolean;
}

export interface CaptionStylePickerProps {
  selectedPreset?: string;
  onSelectPreset?: (presetName: CaptionPresetId) => void;
  onChangeStyleConfig?: (config: CaptionStyleConfig) => void;
  sampleHookText?: string;
}

interface PresetDefinition {
  id: CaptionPresetId;
  title: string;
  tagline: string;
  badgeText: string;
  config: CaptionStyleConfig;
}

export const CAPTION_PRESET_GALLERY: PresetDefinition[] = [
  {
    id: 'Hormozi Pop',
    title: 'Hormozi Pop',
    tagline: 'Impact font · #FFFF00 active word · 5px black stroke outline',
    badgeText: 'High Retention',
    config: {
      presetId: 'Hormozi Pop',
      fontFamily: 'Impact',
      primaryColor: '#FFFFFF',
      highlightColor: '#FFFF00',
      fontSizePx: 72,
      marginBottomPx: 480,
      strokeWidthPx: 5,
      uppercase: true,
      boxBackground: false,
      neonGlow: false,
    },
  },
  {
    id: 'Clean Minimalist',
    title: 'Clean Minimalist',
    tagline: 'Inter Bold · white text · semi-transparent dark rounded box',
    badgeText: 'Editorial',
    config: {
      presetId: 'Clean Minimalist',
      fontFamily: 'Inter',
      primaryColor: '#FFFFFF',
      highlightColor: '#38BDF8',
      fontSizePx: 56,
      marginBottomPx: 440,
      strokeWidthPx: 0,
      uppercase: false,
      boxBackground: true,
      neonGlow: false,
    },
  },
  {
    id: 'Cyber Neon',
    title: 'Cyber Neon',
    tagline: 'Bold Sans · Cyan active (#00FFFF) · outer neon glow shadow',
    badgeText: 'Tech / AI',
    config: {
      presetId: 'Cyber Neon',
      fontFamily: 'Arial',
      primaryColor: '#F8FAFC',
      highlightColor: '#00FFFF',
      fontSizePx: 66,
      marginBottomPx: 500,
      strokeWidthPx: 3,
      uppercase: true,
      boxBackground: false,
      neonGlow: true,
    },
  },
  {
    id: 'Red Highlight',
    title: 'Red Highlight',
    tagline: 'Montserrat ExtraBold · Red active (#FF0000) · uppercase punch',
    badgeText: 'Controversial Hook',
    config: {
      presetId: 'Red Highlight',
      fontFamily: 'Montserrat',
      primaryColor: '#FFFFFF',
      highlightColor: '#FF0000',
      fontSizePx: 68,
      marginBottomPx: 470,
      strokeWidthPx: 4,
      uppercase: true,
      boxBackground: false,
      neonGlow: false,
    },
  },
];

const QUICK_PRIMARY_SWATCHES = [
  '#FFFFFF',
  '#F8FAFC',
  '#FEF08A',
  '#E2E8F0',
  '#CBD5E1',
];

const QUICK_HIGHLIGHT_SWATCHES = [
  '#FFFF00',
  '#00FFFF',
  '#FF0000',
  '#22C55E',
  '#A855F7',
  '#F97316',
];

function getFontStackCss(font: SupportedFontFamily): string {
  switch (font) {
    case 'Impact':
      return 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
    case 'Montserrat':
      return '"Montserrat", "Inter", system-ui, sans-serif';
    case 'Inter':
      return '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    case 'Arial':
      return '"Arial Black", Arial, Helvetica, sans-serif';
  }
}

function hexToAssBgr(hex: string): string {
  const clean = hex.replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`;
}

export default function CaptionStylePicker({
  selectedPreset = 'Hormozi Pop',
  onSelectPreset,
  onChangeStyleConfig,
  sampleHookText = 'Stop cutting viral video on fixed time intervals 🔥',
}: CaptionStylePickerProps) {
  // Normalize incoming preset name ("Minimalist Clean" -> "Clean Minimalist")
  const normalizedInitialPreset: CaptionPresetId =
    selectedPreset === 'Minimalist Clean'
      ? 'Clean Minimalist'
      : (CAPTION_PRESET_GALLERY.find((p) => p.id === selectedPreset)?.id ??
        'Hormozi Pop');

  const [styleConfig, setStyleConfig] = useState<CaptionStyleConfig>(() => {
    const found = CAPTION_PRESET_GALLERY.find(
      (p) => p.id === normalizedInitialPreset
    );
    return found ? { ...found.config } : { ...CAPTION_PRESET_GALLERY[0].config };
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [showSafeZoneGuides, setShowSafeZoneGuides] = useState<boolean>(true);
  const [animateKaraokeLoop, setAnimateKaraokeLoop] = useState<boolean>(true);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(2);
  const [copiedAssStyle, setCopiedAssStyle] = useState<boolean>(false);

  // Sync if parent changes selectedPreset prop externally
  useEffect(() => {
    const mapped: CaptionPresetId =
      selectedPreset === 'Minimalist Clean'
        ? 'Clean Minimalist'
        : (CAPTION_PRESET_GALLERY.find((p) => p.id === selectedPreset)?.id ??
          styleConfig.presetId);

    if (mapped !== styleConfig.presetId) {
      const presetObj = CAPTION_PRESET_GALLERY.find((p) => p.id === mapped);
      if (presetObj) {
        setStyleConfig({ ...presetObj.config });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset]);

  const sampleWords = sampleHookText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  // Cycle active word highlight in the 9:16 live card canvas
  useEffect(() => {
    if (!animateKaraokeLoop || sampleWords.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % sampleWords.length);
    }, 650);
    return () => window.clearInterval(timer);
  }, [animateKaraokeLoop, sampleWords.length]);

  const updateConfig = (partial: Partial<CaptionStyleConfig>) => {
    setStyleConfig((prev) => {
      const next = { ...prev, ...partial };
      onChangeStyleConfig?.(next);
      return next;
    });
  };

  const handleChoosePreset = (preset: PresetDefinition) => {
    const next = { ...preset.config };
    setStyleConfig(next);
    onSelectPreset?.(preset.id);
    onChangeStyleConfig?.(next);
  };

  const handleResetToActivePreset = () => {
    const found =
      CAPTION_PRESET_GALLERY.find((p) => p.id === styleConfig.presetId) ||
      CAPTION_PRESET_GALLERY[0];
    const next = { ...found.config };
    setStyleConfig(next);
    onChangeStyleConfig?.(next);
  };

  // Safe zone evaluation for Vertical Margin (200px to 800px from bottom of 1920px frame)
  // Ideal TikTok/Reels/Shorts safe zone is 350px to 680px from bottom
  const isInSafeZone =
    styleConfig.marginBottomPx >= 340 && styleConfig.marginBottomPx <= 680;
  const isTooLow = styleConfig.marginBottomPx < 340;

  // Map 1080x1920 values to the simulated 9:16 smartphone container
  // Bottom percentage = (marginBottomPx / 1920) * 100
  const bottomPercent = Math.min(
    78,
    Math.max(10, (styleConfig.marginBottomPx / 1920) * 100)
  );
  // Scaled font size in the preview phone card (40px..90px -> ~13px..28px)
  const previewFontSizePx = Math.round((styleConfig.fontSizePx / 1080) * 310);

  // Live FFmpeg .ASS Style definition line
  const assStyleLine = `Style: Default,${styleConfig.fontFamily},${styleConfig.fontSizePx},${hexToAssBgr(
    styleConfig.primaryColor
  )},${hexToAssBgr(styleConfig.highlightColor)},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,${
    styleConfig.boxBackground ? 3 : 1
  },${styleConfig.strokeWidthPx},${
    styleConfig.neonGlow ? 3 : 0
  },2,60,60,${styleConfig.marginBottomPx},1`;

  const handleCopyAssLine = () => {
    navigator.clipboard.writeText(assStyleLine);
    setCopiedAssStyle(true);
    window.setTimeout(() => setCopiedAssStyle(false), 1800);
  };

  return (
    <Card className="border-slate-800/90 bg-slate-900/60 backdrop-blur-md shadow-xl shadow-violet-950/10 overflow-hidden">
      <CardHeader className="pb-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                <Palette className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="text-base">
                Real-Time Subtitle &amp; Caption Customizer
              </CardTitle>
              <Badge variant="gradient" className="font-mono text-[10px]">
                {styleConfig.presetId}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Choose a SOTA viral preset or fine-tune typography, karaoke
              highlight colors, font size (40–90px), and vertical safe-zone
              margins (200–800px).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToActivePreset}
              className="border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Style</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-violet-400" />
              <span>{isDrawerOpen ? 'Hide Controls' : 'Granular Controls'}</span>
              {isDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* ===================================================================
            1. PRESET GALLERY (4 Visual Cards with Hover Effects)
           =================================================================== */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Viral Caption Preset Gallery</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Click any card to apply preset
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {CAPTION_PRESET_GALLERY.map((preset) => {
              const isSelected = styleConfig.presetId === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleChoosePreset(preset)}
                  className={`group relative text-left rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                    isSelected
                      ? 'border-violet-500 bg-slate-900/95 ring-2 ring-violet-500/30 shadow-lg shadow-violet-950/30'
                      : 'border-slate-800/90 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/70'
                  }`}
                >
                  {/* Top Badge + Active Check */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/70">
                      {preset.badgeText}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Miniature Visual Typography Preview Banner */}
                  <div className="h-14 rounded-lg bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800/90 flex items-center justify-center px-2 overflow-hidden mb-2.5 group-hover:border-slate-700 transition-colors">
                    <div
                      style={{
                        fontFamily: getFontStackCss(preset.config.fontFamily),
                        textTransform: preset.config.uppercase
                          ? 'uppercase'
                          : 'none',
                      }}
                      className={`text-sm font-black tracking-tight flex items-center gap-1.5 select-none ${
                        preset.config.boxBackground
                          ? 'bg-slate-950/85 px-2.5 py-1 rounded-md border border-white/10'
                          : ''
                      }`}
                    >
                      <span
                        style={{
                          color: preset.config.primaryColor,
                          WebkitTextStroke:
                            preset.config.strokeWidthPx > 0
                              ? '1.2px #000000'
                              : undefined,
                        }}
                      >
                        VIRAL
                      </span>
                      <span
                        style={{
                          color: preset.config.highlightColor,
                          WebkitTextStroke:
                            preset.config.strokeWidthPx > 0
                              ? '1.2px #000000'
                              : undefined,
                          textShadow: preset.config.neonGlow
                            ? `0 0 12px ${preset.config.highlightColor}`
                            : '0 2px 4px rgba(0,0,0,0.85)',
                        }}
                        className="scale-110 inline-block transition-transform group-hover:scale-125"
                      >
                        HOOK
                      </span>
                    </div>
                  </div>

                  <div className="font-semibold text-xs text-white">
                    {preset.title}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                    {preset.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================================
            2 & 3. GRANULAR CONTROLS DRAWER + LIVE 9:16 SMARTPHONE CARD CANVAS
           =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2 border-t border-slate-800/80">
          {/* LEFT 7 COLS: Granular Controls Drawer */}
          <div className="lg:col-span-7 space-y-4">
            {isDrawerOpen ? (
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/65 p-4 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      2. Granular Typography &amp; Safe-Zone Drawer
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    1080×1920 ASS Coordinate Space
                  </span>
                </div>

                {/* Font Family Dropdown + Style Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="caption-font-family"
                      className="text-xs font-medium text-slate-300 block"
                    >
                      Font Family
                    </label>
                    <select
                      id="caption-font-family"
                      value={styleConfig.fontFamily}
                      onChange={(e) =>
                        updateConfig({
                          fontFamily: e.target.value as SupportedFontFamily,
                        })
                      }
                      className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-medium text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="Impact">Impact (Hormozi Heavy)</option>
                      <option value="Montserrat">
                        Montserrat (ExtraBold Modern)
                      </option>
                      <option value="Inter">Inter (Clean Minimalist)</option>
                      <option value="Arial">Arial (Bold Cyber Sans)</option>
                    </select>
                  </div>

                  {/* Stroke / Box / Uppercase Quick Pills */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">
                      Text Modifiers
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({ uppercase: !styleConfig.uppercase })
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                          styleConfig.uppercase
                            ? 'border-violet-500/60 bg-violet-500/20 text-violet-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        UPPERCASE
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            boxBackground: !styleConfig.boxBackground,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                          styleConfig.boxBackground
                            ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        BOX BG
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({ neonGlow: !styleConfig.neonGlow })
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                          styleConfig.neonGlow
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        NEON GLOW
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Text Color & Active Karaoke Highlight Color Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Primary Text Color Picker */}
                  <div className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200">
                        Primary Text Color
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 uppercase">
                        {styleConfig.primaryColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Primary Text Color"
                        value={styleConfig.primaryColor}
                        onChange={(e) =>
                          updateConfig({
                            primaryColor: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-700"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {QUICK_PRIMARY_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateConfig({ primaryColor: hex })}
                            style={{ backgroundColor: hex }}
                            title={`Set primary color ${hex}`}
                            className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                              styleConfig.primaryColor.toUpperCase() === hex
                                ? 'scale-115 ring-2 ring-cyan-400 border-white'
                                : 'border-slate-700 hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Karaoke Highlight Color Picker */}
                  <div className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200">
                        Active Karaoke Highlight
                      </span>
                      <span className="text-[11px] font-mono text-cyan-300 uppercase">
                        {styleConfig.highlightColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Active Karaoke Highlight Color"
                        value={styleConfig.highlightColor}
                        onChange={(e) =>
                          updateConfig({
                            highlightColor: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-700"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {QUICK_HIGHLIGHT_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() =>
                              updateConfig({ highlightColor: hex })
                            }
                            style={{ backgroundColor: hex }}
                            title={`Set active karaoke highlight ${hex}`}
                            className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                              styleConfig.highlightColor.toUpperCase() === hex
                                ? 'scale-115 ring-2 ring-white border-slate-950'
                                : 'border-slate-700 hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Size Slider (40px to 90px) */}
                <div className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="caption-font-size-slider"
                      className="text-xs font-medium text-slate-200"
                    >
                      Font Size (1080p ASS Scale)
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                      {styleConfig.fontSizePx}px
                    </span>
                  </div>
                  <input
                    id="caption-font-size-slider"
                    type="range"
                    min={40}
                    max={90}
                    step={1}
                    value={styleConfig.fontSizePx}
                    onChange={(e) =>
                      updateConfig({ fontSizePx: Number(e.target.value) })
                    }
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>40px (Compact)</span>
                    <span>65px (Standard Short)</span>
                    <span>90px (Max Billboard)</span>
                  </div>
                </div>

                {/* Vertical Margin Slider (200px to 800px from bottom) with TikTok/Reels Safe-Zone Indicator */}
                <div className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="caption-margin-v-slider"
                      className="text-xs font-medium text-slate-200"
                    >
                      Vertical Margin from Bottom (ASS MarginV)
                    </label>
                    <div className="flex items-center gap-2">
                      {isInSafeZone ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                          <ShieldCheck className="w-3 h-3" />
                          <span>TikTok/Reels UI Safe Zone</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[10px] font-mono text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>
                            {isTooLow
                              ? 'Overlaps Bottom Caption UI (<340px)'
                              : 'High / Near Speaker Face (>680px)'}
                          </span>
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-violet-300 tabular-nums">
                        {styleConfig.marginBottomPx}px
                      </span>
                    </div>
                  </div>

                  {/* Visual Safe-Zone Track Bar behind Slider */}
                  <div className="relative pt-1">
                    <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
                      {/* 200..340px: Danger Zone (23%) */}
                      <div
                        style={{ width: '23.3%' }}
                        className="h-full bg-amber-500/30 border-r border-amber-500/40"
                        title="200px–340px: TikTok Bottom Metadata Collision Zone"
                      />
                      {/* 340..680px: Safe Zone (56.7%) */}
                      <div
                        style={{ width: '56.7%' }}
                        className="h-full bg-emerald-500/30 border-r border-emerald-500/40"
                        title="340px–680px: TikTok / Reels / Shorts Optimal Visual Safe Zone"
                      />
                      {/* 680..800px: Upper Face Zone (20%) */}
                      <div
                        style={{ width: '20%' }}
                        className="h-full bg-violet-500/25"
                        title="680px–800px: Upper Center Subject Zone"
                      />
                    </div>
                    <input
                      id="caption-margin-v-slider"
                      type="range"
                      min={200}
                      max={800}
                      step={10}
                      value={styleConfig.marginBottomPx}
                      onChange={(e) =>
                        updateConfig({ marginBottomPx: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-400 cursor-pointer -mt-2 relative z-10"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>200px (Bottom Edge)</span>
                    <span className="text-emerald-400 font-semibold">
                      340px–680px (TikTok/Reels Safe Zone)
                    </span>
                    <span>800px (Center-High)</span>
                  </div>
                </div>

                {/* Generated FFmpeg .ASS Style Line Inspector */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Generated FFmpeg .ASS V4+ Style Line</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAssLine}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer"
                    >
                      {copiedAssStyle ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Style</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto pb-1">
                    <code>{assStyleLine}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Granular typography &amp; margin controls are collapsed.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrawerOpen(true)}
                >
                  Expand Controls
                </Button>
              </div>
            )}
          </div>

          {/* =================================================================
              3. LIVE CARD CANVAS (Simulated 9:16 Vertical Smartphone Frame)
             ================================================================= */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. Live 9:16 Smartphone Canvas</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 cursor-pointer">
                  <span>Safe Zones</span>
                  <Switch
                    checked={showSafeZoneGuides}
                    onCheckedChange={setShowSafeZoneGuides}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAnimateKaraokeLoop((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-800 bg-slate-900 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                >
                  {animateKaraokeLoop ? (
                    <>
                      <Pause className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Karaoke Live</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 text-slate-400" />
                      <span>Paused</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 9:16 Smartphone Mockup Container */}
            <div className="relative w-full max-w-[290px] aspect-[9/16] rounded-[28px] border-2 border-slate-700/90 bg-slate-950 shadow-2xl shadow-black/80 overflow-hidden select-none">
              {/* Top Speaker Notch */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-black/80 border border-slate-800 z-30 flex items-center justify-center">
                <div className="w-8 h-1 rounded-full bg-slate-800" />
              </div>

              {/* Simulated Dual-Layer 9:16 Video Background */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950/60 to-slate-950">
                {/* Blurred ambient light blobs */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full bg-violet-600/20 blur-2xl" />
                <div className="absolute bottom-1/3 left-1/3 w-36 h-36 rounded-full bg-cyan-500/15 blur-2xl" />

                {/* Simulated Center Speaker Foreground Frame */}
                <div className="absolute inset-x-0 top-[18%] h-[42%] border-y border-white/10 bg-slate-900/75 flex flex-col items-center justify-center px-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-500/40 to-cyan-400/40 border border-white/20 flex items-center justify-center mb-2">
                    <Eye className="w-6 h-6 text-cyan-200/80" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    1080×1920 Active Speaker
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Font: {styleConfig.fontFamily} · {styleConfig.fontSizePx}px
                  </span>
                </div>
              </div>

              {/* Simulated TikTok / Reels Safe-Zone Overlay Guides */}
              {showSafeZoneGuides && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* Top Header Unsafe Strip */}
                  <div className="absolute inset-x-0 top-0 h-[11%] bg-rose-500/10 border-b border-dashed border-rose-400/50 flex items-end justify-center pb-1">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-rose-300/90">
                      Top App Bar Unsafe Zone
                    </span>
                  </div>

                  {/* Optimal Safe Zone Horizontal Band (340px to 680px from bottom -> ~17.7% to 35.4% from bottom) */}
                  <div
                    style={{
                      bottom: `${(340 / 1920) * 100}%`,
                      height: `${((680 - 340) / 1920) * 100}%`,
                    }}
                    className="absolute inset-x-2 border border-dashed border-emerald-400/60 bg-emerald-500/5 rounded-lg flex items-start justify-between px-2 pt-1"
                  >
                    <span className="text-[8px] font-mono uppercase tracking-wider text-emerald-300 bg-slate-950/80 px-1.5 py-0.5 rounded">
                      TikTok/Reels Safe Zone (340–680px)
                    </span>
                  </div>

                  {/* Right-Side Action Icons Unsafe Column */}
                  <div className="absolute right-1.5 bottom-[18%] w-10 flex flex-col items-center gap-3 py-2 rounded-full bg-slate-950/50 border border-dashed border-amber-400/40 text-white/70">
                    <Heart className="w-4 h-4 text-rose-400/80" />
                    <MessageCircle className="w-4 h-4" />
                    <Bookmark className="w-4 h-4" />
                    <Share2 className="w-4 h-4" />
                  </div>

                  {/* Bottom Caption & Audio Ticker Unsafe Zone (<340px from bottom) */}
                  <div
                    style={{ height: `${(340 / 1920) * 100}%` }}
                    className="absolute inset-x-0 bottom-0 bg-amber-500/10 border-t border-dashed border-amber-400/60 p-2.5 flex flex-col justify-end"
                  >
                    <div className="text-[9px] font-semibold text-white/75">
                      @clipperx_creator
                    </div>
                    <div className="text-[8px] text-slate-300/70 truncate">
                      Original audio — AI Short-Form Video Clipper #shorts
                    </div>
                    <span className="mt-1 inline-block text-[8px] font-mono uppercase text-amber-300">
                      ▲ UI Collision Zone (&lt;340px)
                    </span>
                  </div>
                </div>
              )}

              {/* LIVE DYNAMIC SUBTITLE RENDERED AT EXACT VERTICAL MARGIN */}
              <div
                style={{
                  bottom: `${bottomPercent}%`,
                }}
                className="absolute inset-x-3 z-30 flex flex-col items-center pointer-events-none transition-all duration-75"
              >
                <div
                  style={{
                    fontFamily: getFontStackCss(styleConfig.fontFamily),
                    fontSize: `${previewFontSizePx}px`,
                    textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
                  }}
                  className={`text-center font-black leading-tight tracking-tight flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 px-3 py-1.5 ${
                    styleConfig.boxBackground
                      ? 'bg-slate-950/85 rounded-xl border border-white/15 shadow-lg backdrop-blur-sm'
                      : ''
                  }`}
                >
                  {sampleWords.map((word, idx) => {
                    const isSpoken = idx === activeWordIdx;
                    return (
                      <span
                        key={idx}
                        style={{
                          color: isSpoken
                            ? styleConfig.highlightColor
                            : styleConfig.primaryColor,
                          WebkitTextStroke:
                            styleConfig.strokeWidthPx > 0
                              ? `${Math.max(
                                  1,
                                  styleConfig.strokeWidthPx * 0.3
                                )}px #000000`
                              : undefined,
                          textShadow: styleConfig.neonGlow
                            ? `0 0 14px ${
                                isSpoken
                                  ? styleConfig.highlightColor
                                  : styleConfig.primaryColor
                              }, 0 2px 5px rgba(0,0,0,0.95)`
                            : styleConfig.strokeWidthPx > 0
                            ? '0 2px 6px rgba(0,0,0,0.95)'
                            : undefined,
                        }}
                        className={`inline-block transition-transform duration-150 ${
                          isSpoken ? 'scale-110' : 'scale-100'
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>

                {/* Live Margin Coordinate Pill attached under caption */}
                <span
                  className={`mt-1 px-1.5 py-0.2 rounded text-[8px] font-mono tabular-nums border ${
                    isInSafeZone
                      ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-950/90 border-amber-500/50 text-amber-300'
                  }`}
                >
                  MarginV: {styleConfig.marginBottomPx}px ·{' '}
                  {styleConfig.fontSizePx}px
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
