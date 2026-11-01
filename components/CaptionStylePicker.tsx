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
    <Card className="border-line bg-surface shadow-lg overflow-hidden">
      <CardHeader className="pb-4 border-b border-line bg-canvas">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent-soft border border-accent flex items-center justify-center text-ink">
                <Palette className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="text-base">
                Real-Time Subtitle &amp; Caption Customizer
              </CardTitle>
              <Badge variant="gradient" className="font-mono text-[10px]">
                {styleConfig.presetId}
              </Badge>
            </div>
            <CardDescription className="text-xs text-ink-muted">
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
              className="border border-line bg-canvas hover:bg-surface-2 text-ink cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>Reset Style</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className="border-line bg-surface hover:bg-surface-2 text-ink cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-ink" />
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
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-ink" />
              <span>1. Viral Caption Preset Gallery</span>
            </span>
            <span className="text-[11px] font-mono text-ink-muted">
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
                      ? 'border-accent bg-surface ring-2 ring-accent shadow-lg '
                      : 'border-line bg-canvas hover:border-line hover:bg-surface'
                  }`}
                >
                  {/* Top Badge + Active Check */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-ink border border-line">
                      {preset.badgeText}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-success/10 border border-success/40 flex items-center justify-center text-success">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Miniature Visual Typography Preview Banner */}
                  <div className="h-14 rounded-lg bg-accent border border-line flex items-center justify-center px-2 overflow-hidden mb-2.5 group-hover:border-line transition-colors">
                    <div
                      style={{
                        fontFamily: getFontStackCss(preset.config.fontFamily),
                        textTransform: preset.config.uppercase
                          ? 'uppercase'
                          : 'none',
                      }}
                      className={`text-sm font-black tracking-tight flex items-center gap-1.5 select-none ${
                        preset.config.boxBackground
                          ? 'bg-canvas px-2.5 py-1 rounded-md border border-line'
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

                  <div className="font-semibold text-xs text-ink">
                    {preset.title}
                  </div>
                  <p className="text-[11px] text-ink-muted leading-snug mt-0.5 line-clamp-2">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2 border-t border-line">
          {/* LEFT 7 COLS: Granular Controls Drawer */}
          <div className="lg:col-span-7 space-y-4">
            {isDrawerOpen ? (
              <div className="rounded-xl border border-line bg-canvas p-4 space-y-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-ink" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                      2. Granular Typography &amp; Safe-Zone Drawer
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted tabular-nums">
                    1080×1920 ASS Coordinate Space
                  </span>
                </div>

                {/* Font Family Dropdown + Style Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="caption-font-family"
                      className="text-xs font-medium text-ink block"
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
                      className="w-full h-9 px-3 rounded-lg bg-surface border border-line text-xs font-medium text-ink focus:outline-none focus:border-accent cursor-pointer"
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
                    <span className="text-xs font-medium text-ink block">
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
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-line bg-surface text-ink-muted'
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
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-line bg-surface text-ink-muted'
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
                            ? 'border-success/40 bg-success/10 text-success'
                            : 'border-line bg-surface text-ink-muted'
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
                  <div className="rounded-lg border border-line bg-surface p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">
                        Primary Text Color
                      </span>
                      <span className="text-[11px] font-mono text-ink-muted uppercase">
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
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-line"
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
                                ? 'scale-115 ring-2 ring-accent border-white'
                                : 'border-line hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Karaoke Highlight Color Picker */}
                  <div className="rounded-lg border border-line bg-surface p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">
                        Active Karaoke Highlight
                      </span>
                      <span className="text-[11px] font-mono text-ink uppercase">
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
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-line"
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
                                ? 'scale-115 ring-2 ring-white border-line'
                                : 'border-line hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Size Slider (40px to 90px) */}
                <div className="rounded-lg border border-line bg-surface p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="caption-font-size-slider"
                      className="text-xs font-medium text-ink"
                    >
                      Font Size (1080p ASS Scale)
                    </label>
                    <span className="text-xs font-mono font-bold text-ink tabular-nums">
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
                  <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted tabular-nums">
                    <span>40px (Compact)</span>
                    <span>65px (Standard Short)</span>
                    <span>90px (Max Billboard)</span>
                  </div>
                </div>

                {/* Vertical Margin Slider (200px to 800px from bottom) with TikTok/Reels Safe-Zone Indicator */}
                <div className="rounded-lg border border-line bg-surface p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="caption-margin-v-slider"
                      className="text-xs font-medium text-ink"
                    >
                      Vertical Margin from Bottom (ASS MarginV)
                    </label>
                    <div className="flex items-center gap-2">
                      {isInSafeZone ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 border border-success/40 text-[10px] font-mono text-success">
                          <ShieldCheck className="w-3 h-3" />
                          <span>TikTok/Reels UI Safe Zone</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-soft border border-accent text-[10px] font-mono text-ink">
                          <AlertTriangle className="w-3 h-3" />
                          <span>
                            {isTooLow
                              ? 'Overlaps Bottom Caption UI (<340px)'
                              : 'High / Near Speaker Face (>680px)'}
                          </span>
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-ink tabular-nums">
                        {styleConfig.marginBottomPx}px
                      </span>
                    </div>
                  </div>

                  {/* Visual Safe-Zone Track Bar behind Slider */}
                  <div className="relative pt-1">
                    <div className="w-full h-2 rounded-full bg-canvas border border-line overflow-hidden flex">
                      {/* 200..340px: Danger Zone (23%) */}
                      <div
                        style={{ width: '23.3%' }}
                        className="h-full bg-accent-soft border-r border-accent"
                        title="200px–340px: TikTok Bottom Metadata Collision Zone"
                      />
                      {/* 340..680px: Safe Zone (56.7%) */}
                      <div
                        style={{ width: '56.7%' }}
                        className="h-full bg-success/10 border-r border-success/40"
                        title="340px–680px: TikTok / Reels / Shorts Optimal Visual Safe Zone"
                      />
                      {/* 680..800px: Upper Face Zone (20%) */}
                      <div
                        style={{ width: '20%' }}
                        className="h-full bg-accent-soft"
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

                  <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted tabular-nums">
                    <span>200px (Bottom Edge)</span>
                    <span className="text-success font-semibold">
                      340px–680px (TikTok/Reels Safe Zone)
                    </span>
                    <span>800px (Center-High)</span>
                  </div>
                </div>

                {/* Generated FFmpeg .ASS Style Line Inspector */}
                <div className="rounded-lg border border-line bg-canvas p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-ink" />
                      <span>Generated FFmpeg .ASS V4+ Style Line</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAssLine}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-ink hover:text-ink cursor-pointer"
                    >
                      {copiedAssStyle ? (
                        <>
                          <Check className="w-3 h-3 text-success" />
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
                  <pre className="text-[10px] font-mono text-ink overflow-x-auto pb-1">
                    <code>{assStyleLine}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-canvas p-4 flex items-center justify-between">
                <span className="text-xs text-ink-muted">
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
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Smartphone className="w-3.5 h-3.5 text-ink" />
                <span>3. Live 9:16 Smartphone Canvas</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-muted cursor-pointer">
                  <span>Safe Zones</span>
                  <Switch
                    checked={showSafeZoneGuides}
                    onCheckedChange={setShowSafeZoneGuides}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAnimateKaraokeLoop((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-line bg-surface text-[10px] font-mono text-ink hover:text-ink cursor-pointer"
                >
                  {animateKaraokeLoop ? (
                    <>
                      <Pause className="w-2.5 h-2.5 text-ink" />
                      <span>Karaoke Live</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 text-ink-muted" />
                      <span>Paused</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 9:16 Smartphone Mockup Container */}
            <div className="relative w-full max-w-[290px] aspect-[9/16] rounded-[28px] border-2 border-line bg-canvas shadow-lg overflow-hidden select-none">
              {/* Top Speaker Notch */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-black/80 border border-line z-30 flex items-center justify-center">
                <div className="w-8 h-1 rounded-full bg-surface-2" />
              </div>

              {/* Simulated Dual-Layer 9:16 Video Background */}
              <div className="absolute inset-0 bg-accent ">
                {/* Blurred ambient light blobs */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full bg-accent-soft blur-2xl" />
                <div className="absolute bottom-1/3 left-1/3 w-36 h-36 rounded-full bg-accent-soft blur-2xl" />

                {/* Simulated Center Speaker Foreground Frame */}
                <div className="absolute inset-x-0 top-[18%] h-[42%] border-y border-line bg-surface flex flex-col items-center justify-center px-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-accent border border-line flex items-center justify-center mb-2">
                    <Eye className="w-6 h-6 text-ink" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                    1080×1920 Active Speaker
                  </span>
                  <span className="text-[9px] font-mono text-ink-subtle mt-0.5">
                    Font: {styleConfig.fontFamily} · {styleConfig.fontSizePx}px
                  </span>
                </div>
              </div>

              {/* Simulated TikTok / Reels Safe-Zone Overlay Guides */}
              {showSafeZoneGuides && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* Top Header Unsafe Strip */}
                  <div className="absolute inset-x-0 top-0 h-[11%] bg-danger/10 border-b border-dashed border-danger/40 flex items-end justify-center pb-1">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-danger">
                      Top App Bar Unsafe Zone
                    </span>
                  </div>

                  {/* Optimal Safe Zone Horizontal Band (340px to 680px from bottom -> ~17.7% to 35.4% from bottom) */}
                  <div
                    style={{
                      bottom: `${(340 / 1920) * 100}%`,
                      height: `${((680 - 340) / 1920) * 100}%`,
                    }}
                    className="absolute inset-x-2 border border-dashed border-success/40 bg-success/10 rounded-lg flex items-start justify-between px-2 pt-1"
                  >
                    <span className="text-[8px] font-mono uppercase tracking-wider text-success bg-canvas px-1.5 py-0.5 rounded">
                      TikTok/Reels Safe Zone (340–680px)
                    </span>
                  </div>

                  {/* Right-Side Action Icons Unsafe Column */}
                  <div className="absolute right-1.5 bottom-[18%] w-10 flex flex-col items-center gap-3 py-2 rounded-full bg-canvas border border-dashed border-accent text-ink">
                    <Heart className="w-4 h-4 text-danger" />
                    <MessageCircle className="w-4 h-4" />
                    <Bookmark className="w-4 h-4" />
                    <Share2 className="w-4 h-4" />
                  </div>

                  {/* Bottom Caption & Audio Ticker Unsafe Zone (<340px from bottom) */}
                  <div
                    style={{ height: `${(340 / 1920) * 100}%` }}
                    className="absolute inset-x-0 bottom-0 bg-accent-soft border-t border-dashed border-accent p-2.5 flex flex-col justify-end"
                  >
                    <div className="text-[9px] font-semibold text-ink">
                      @clipperx_creator
                    </div>
                    <div className="text-[8px] text-ink truncate">
                      Original audio — AI Short-Form Video Clipper #shorts
                    </div>
                    <span className="mt-1 inline-block text-[8px] font-mono uppercase text-ink">
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
                      ? 'bg-canvas rounded-xl border border-line shadow-lg '
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
                      ? 'bg-success border-success/40 text-success'
                      : 'bg-accent border-accent text-ink'
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
