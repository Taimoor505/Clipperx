'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Loader2, Save, Trash2, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { ViralClipSegment } from './VerticalShortPlayer';

/** A campaign file kept on the backend (music, intro, outro), referred to by id. */
export type AssetRef = { id: string; name: string } | null;

/**
 * Everything a campaign can ask for beyond the layout: caption look, text overlays, edits,
 * audio, clip length rules and post caption tags. Saved with the layout and in presets.
 */
export type CampaignOptions = {
  captionFont: string;
  captionSize: number;
  captionTextColor: string;
  captionActiveColor: string; // '' follows the caption style preset
  captionHighlightColor: string;
  captionUppercase: boolean;
  captionWordsPerLine: number; // 0 keeps the transcript's lines
  captionAnimation: 'karaoke' | 'pop' | 'none';
  captionPosition: 'bottom' | 'lower' | 'middle' | 'top';
  captionBox: boolean;
  titleMode: 'none' | 'clip' | 'custom';
  titleText: string;
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  endText: string;
  endSeconds: number;
  cutSilences: boolean;
  speed: number;
  colorFilter: 'none' | 'warm' | 'cool' | 'contrast' | 'vivid' | 'cinematic' | 'bw';
  punchZoom: boolean;
  progressBar: 'none' | 'top' | 'bottom';
  progressColor: string;
  bleepWords: string;
  bleepMode: 'beep' | 'mute';
  music: AssetRef;
  musicVolume: number;
  musicDuck: boolean;
  intro: AssetRef;
  outro: AssetRef;
  minSeconds: number;
  maxSeconds: number;
  hashtags: string;
  tagsYoutube: string;
  tagsInstagram: string;
  tagsTiktok: string;
};

export const DEFAULT_CAMPAIGN_OPTIONS: CampaignOptions = {
  captionFont: 'Anton',
  captionSize: 1,
  captionTextColor: '#FFFFFF',
  captionActiveColor: '',
  captionHighlightColor: '#3DDC84',
  captionUppercase: true,
  captionWordsPerLine: 0,
  captionAnimation: 'karaoke',
  captionPosition: 'lower',
  captionBox: false,
  titleMode: 'none',
  titleText: '',
  watermarkText: '',
  watermarkPosition: 'bottom-right',
  endText: '',
  endSeconds: 3,
  cutSilences: false,
  speed: 1,
  colorFilter: 'none',
  punchZoom: false,
  progressBar: 'none',
  progressColor: '#F2B705',
  bleepWords: '',
  bleepMode: 'beep',
  music: null,
  musicVolume: 0.12,
  musicDuck: true,
  intro: null,
  outro: null,
  minSeconds: 15,
  maxSeconds: 90,
  hashtags: '',
  tagsYoutube: '',
  tagsInstagram: '',
  tagsTiktok: '',
};

const FONTS = ['Anton', 'Bebas Neue', 'Archivo Black', 'Poppins ExtraBold', 'Bangers', 'Lilita One'];

/** Adds the campaign options to a /api/render request. */
export function appendCampaignOptions(form: FormData, o: CampaignOptions, clipTitle: string): void {
  form.append(
    'caption_style',
    JSON.stringify({
      font: o.captionFont,
      size: o.captionSize,
      text_color: o.captionTextColor,
      active_color: o.captionActiveColor,
      highlight_color: o.captionHighlightColor,
      uppercase: o.captionUppercase,
      words_per_line: o.captionWordsPerLine,
      animation: o.captionAnimation,
      position: o.captionPosition,
      box: o.captionBox,
    })
  );
  const title = o.titleMode === 'clip' ? clipTitle : o.titleMode === 'custom' ? o.titleText : '';
  if (title.trim()) form.append('title_text', title);
  if (o.watermarkText.trim()) {
    form.append('watermark_text', o.watermarkText);
    form.append('watermark_position', o.watermarkPosition);
  }
  if (o.endText.trim()) {
    form.append('end_text', o.endText);
    form.append('end_seconds', String(o.endSeconds));
  }
  form.append('cut_silences', String(o.cutSilences));
  form.append('speed', String(o.speed));
  form.append('color_filter', o.colorFilter);
  form.append('punch_zoom', String(o.punchZoom));
  form.append('progress_bar', o.progressBar);
  form.append('progress_color', o.progressColor);
  if (o.bleepWords.trim()) {
    form.append('bleep_words', o.bleepWords);
    form.append('bleep_mode', o.bleepMode);
  }
  if (o.music) {
    form.append('music_asset', o.music.id);
    form.append('music_volume', String(o.musicVolume));
    form.append('music_duck', String(o.musicDuck));
  }
  if (o.intro) form.append('intro_asset', o.intro.id);
  if (o.outro) form.append('outro_asset', o.outro.id);
}

async function uploadAsset(backendUrl: string, file: File): Promise<AssetRef> {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await fetch(`${backendUrl}/api/assets`, { method: 'POST', body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Upload failed (${response.status})`);
  }
  const saved = await response.json();
  return { id: saved.asset_id, name: file.name };
}

// --- Small form pieces -------------------------------------------------------------------

const inputClass =
  'w-full h-8 px-2.5 rounded-lg bg-canvas border border-line text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-ink">
      <span>
        {label}
        {hint && <span className="block text-[11px] text-ink-subtle">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Color({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value || '#FFFF00'}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="h-8 w-full rounded-lg border border-line bg-canvas cursor-pointer p-0.5"
    />
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-line">
      <summary className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-ink cursor-pointer select-none list-none">
        {title}
        <span className="text-ink-subtle transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 px-3.5 pb-3.5">{children}</div>
    </details>
  );
}

function AssetPicker({
  label,
  accept,
  value,
  backendUrl,
  onChange,
}: {
  label: string;
  accept: string;
  value: AssetRef;
  backendUrl: string;
  onChange: (asset: AssetRef) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-xs text-ink" title={value.name}>
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-7 px-2.5 rounded-lg border border-line text-xs text-ink hover:bg-surface-2 cursor-pointer"
        >
          Remove
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-xs text-ink-muted hover:text-ink cursor-pointer">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {busy ? 'Uploading' : label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy || !backendUrl}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onChange(await uploadAsset(backendUrl, file));
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

// --- Settings sections -------------------------------------------------------------------

export function CampaignSettingsSections({
  options: o,
  onChange,
  backendUrl,
}: {
  options: CampaignOptions;
  onChange: (changes: Partial<CampaignOptions>) => void;
  backendUrl: string;
}) {
  return (
    <div className="space-y-2.5">
      <Section title="Clip length">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Shortest (s)">
            <input
              type="number" min={5} max={170} step={1}
              value={o.minSeconds}
              onChange={(e) => onChange({ minSeconds: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Longest (s)">
            <input
              type="number" min={10} max={180} step={1}
              value={o.maxSeconds}
              onChange={(e) => onChange({ maxSeconds: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-[11px] text-ink-subtle">
          The AI only picks clips in this range; long ones end on the last full sentence that fits.
        </p>
      </Section>

      <Section title="Caption look">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Font">
            <select
              value={o.captionFont}
              onChange={(e) => onChange({ captionFont: e.target.value })}
              className={inputClass}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Animation">
            <select
              value={o.captionAnimation}
              onChange={(e) => onChange({ captionAnimation: e.target.value as CampaignOptions['captionAnimation'] })}
              className={inputClass}
            >
              <option value="karaoke">Karaoke fill</option>
              <option value="pop">Word pop</option>
              <option value="none">Static</option>
            </select>
          </Field>
          <Field label="Position">
            <select
              value={o.captionPosition}
              onChange={(e) => onChange({ captionPosition: e.target.value as CampaignOptions['captionPosition'] })}
              className={inputClass}
            >
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="lower">Lower third</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
          <Field label="Words per line">
            <select
              value={o.captionWordsPerLine}
              onChange={(e) => onChange({ captionWordsPerLine: Number(e.target.value) })}
              className={inputClass}
            >
              <option value={0}>Auto</option>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="w-10">Size</span>
          <input
            type="range" min={0.6} max={1.6} step={0.05}
            value={o.captionSize}
            onChange={(e) => onChange({ captionSize: Number(e.target.value) })}
            className="flex-1 accent-[#F2B705]"
          />
          <span className="w-9 text-right tabular-nums">{Math.round(o.captionSize * 100)}%</span>
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Text">
            <Color label="Text colour" value={o.captionTextColor} onChange={(v) => onChange({ captionTextColor: v })} />
          </Field>
          <Field label="Spoken word">
            <Color
              label="Spoken word colour"
              value={o.captionActiveColor || '#FFFF00'}
              onChange={(v) => onChange({ captionActiveColor: v })}
            />
          </Field>
          <Field label="Key words">
            <Color
              label="Key word colour"
              value={o.captionHighlightColor}
              onChange={(v) => onChange({ captionHighlightColor: v })}
            />
          </Field>
        </div>
        <Toggle label="All caps" checked={o.captionUppercase} onChange={(on) => onChange({ captionUppercase: on })} />
        <Toggle
          label="Dark box behind captions"
          checked={o.captionBox}
          onChange={(on) => onChange({ captionBox: on })}
        />
      </Section>

      <Section title="Text on the video">
        <Field label="Title for the whole clip">
          <select
            value={o.titleMode}
            onChange={(e) => onChange({ titleMode: e.target.value as CampaignOptions['titleMode'] })}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="clip">The clip&rsquo;s title</option>
            <option value="custom">My own text</option>
          </select>
        </Field>
        {o.titleMode === 'custom' && (
          <input
            type="text"
            value={o.titleText}
            onChange={(e) => onChange({ titleText: e.target.value })}
            placeholder="e.g. Greg LaVecchia on Iced Coffee Hour"
            aria-label="Title text"
            className={inputClass}
          />
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Text watermark">
            <input
              type="text"
              value={o.watermarkText}
              onChange={(e) => onChange({ watermarkText: e.target.value })}
              placeholder="@yourhandle"
              className={inputClass}
            />
          </Field>
          <select
            aria-label="Watermark position"
            value={o.watermarkPosition}
            onChange={(e) => onChange({ watermarkPosition: e.target.value as CampaignOptions['watermarkPosition'] })}
            className="h-8 px-2 rounded-lg bg-canvas border border-line text-xs text-ink"
          >
            <option value="top-left">Top left</option>
            <option value="top-right">Top right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="bottom-right">Bottom right</option>
            <option value="center">Center</option>
          </select>
        </div>
        <div className="grid grid-cols-[1fr_72px] gap-2 items-end">
          <Field label="End card">
            <input
              type="text"
              value={o.endText}
              onChange={(e) => onChange({ endText: e.target.value })}
              placeholder="Follow for more"
              className={inputClass}
            />
          </Field>
          <Field label="Seconds">
            <input
              type="number" min={1} max={10} step={0.5}
              value={o.endSeconds}
              onChange={(e) => onChange({ endSeconds: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Edits">
        <Toggle
          label="Cut silences"
          hint="Removes pauses longer than 0.6 s"
          checked={o.cutSilences}
          onChange={(on) => onChange({ cutSilences: on })}
        />
        <Toggle
          label="Punch-in zooms"
          hint="A quick zoom on numbers, names and brands"
          checked={o.punchZoom}
          onChange={(on) => onChange({ punchZoom: on })}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Speed">
            <select
              value={o.speed}
              onChange={(e) => onChange({ speed: Number(e.target.value) })}
              className={inputClass}
            >
              {[0.9, 1, 1.05, 1.1, 1.15, 1.2, 1.25].map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>
          </Field>
          <Field label="Colour filter">
            <select
              value={o.colorFilter}
              onChange={(e) => onChange({ colorFilter: e.target.value as CampaignOptions['colorFilter'] })}
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
              <option value="contrast">More contrast</option>
              <option value="vivid">Vivid</option>
              <option value="cinematic">Cinematic</option>
              <option value="bw">Black and white</option>
            </select>
          </Field>
          <Field label="Progress bar">
            <select
              value={o.progressBar}
              onChange={(e) => onChange({ progressBar: e.target.value as CampaignOptions['progressBar'] })}
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
          {o.progressBar !== 'none' && (
            <Field label="Bar colour">
              <Color label="Progress bar colour" value={o.progressColor} onChange={(v) => onChange({ progressColor: v })} />
            </Field>
          )}
        </div>
        <Field label="Bleep words" hint={'Comma separated; "damn*" also catches damned, damnit.'}>
          <input
            type="text"
            value={o.bleepWords}
            onChange={(e) => onChange({ bleepWords: e.target.value })}
            placeholder="fuck*, shit*"
            className={inputClass}
          />
        </Field>
        {o.bleepWords.trim() && (
          <select
            aria-label="Bleep sound"
            value={o.bleepMode}
            onChange={(e) => onChange({ bleepMode: e.target.value as CampaignOptions['bleepMode'] })}
            className={inputClass}
          >
            <option value="beep">Beep over the word</option>
            <option value="mute">Mute the word</option>
          </select>
        )}
      </Section>

      <Section title="Music, intro and outro">
        <Field label="Background music">
          <AssetPicker
            label="Add music (MP3, M4A, WAV)"
            accept="audio/*"
            value={o.music}
            backendUrl={backendUrl}
            onChange={(music) => onChange({ music })}
          />
        </Field>
        {o.music && (
          <>
            <label className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="w-14">Volume</span>
              <input
                type="range" min={0.02} max={0.6} step={0.01}
                value={o.musicVolume}
                onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
                className="flex-1 accent-[#F2B705]"
              />
              <span className="w-9 text-right tabular-nums">{Math.round(o.musicVolume * 100)}%</span>
            </label>
            <Toggle
              label="Lower music while people talk"
              checked={o.musicDuck}
              onChange={(on) => onChange({ musicDuck: on })}
            />
          </>
        )}
        <Field label="Intro video">
          <AssetPicker
            label="Add intro (MP4, MOV)"
            accept="video/mp4,video/quicktime,video/webm"
            value={o.intro}
            backendUrl={backendUrl}
            onChange={(intro) => onChange({ intro })}
          />
        </Field>
        <Field label="Outro video">
          <AssetPicker
            label="Add outro (MP4, MOV)"
            accept="video/mp4,video/quicktime,video/webm"
            value={o.outro}
            backendUrl={backendUrl}
            onChange={(outro) => onChange({ outro })}
          />
        </Field>
        <p className="text-[11px] text-ink-subtle">
          Use music you have the rights to, like the platform&rsquo;s library or the campaign&rsquo;s own.
        </p>
      </Section>

      <Section title="Post caption tags">
        <Field label="Hashtags">
          <input
            type="text"
            value={o.hashtags}
            onChange={(e) => onChange({ hashtags: e.target.value })}
            placeholder="#bloom #business #podcast"
            className={inputClass}
          />
        </Field>
        <Field label="YouTube tags">
          <input
            type="text"
            value={o.tagsYoutube}
            onChange={(e) => onChange({ tagsYoutube: e.target.value })}
            placeholder="@GregLaVecchia @theicedcoffeehour"
            className={inputClass}
          />
        </Field>
        <Field label="Instagram tags">
          <input
            type="text"
            value={o.tagsInstagram}
            onChange={(e) => onChange({ tagsInstagram: e.target.value })}
            placeholder="@greglav @theicedcoffeehour"
            className={inputClass}
          />
        </Field>
        <Field label="TikTok tags">
          <input
            type="text"
            value={o.tagsTiktok}
            onChange={(e) => onChange({ tagsTiktok: e.target.value })}
            placeholder="@greglav"
            className={inputClass}
          />
        </Field>
      </Section>
    </div>
  );
}

// --- Campaign presets ----------------------------------------------------------------------

export type CampaignPreset<T> = { name: string; settings: T };
const LOCAL_PRESETS_KEY = 'clipperx.presets';

async function loadPresets<T>(backendUrl: string): Promise<CampaignPreset<T>[]> {
  if (backendUrl) {
    const response = await fetch(`${backendUrl}/api/presets`);
    if (response.ok) return (await response.json()).presets ?? [];
  }
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PRESETS_KEY) || '[]');
  } catch {
    return [];
  }
}

async function storePresets<T>(backendUrl: string, presets: CampaignPreset<T>[]): Promise<void> {
  if (backendUrl) {
    const response = await fetch(`${backendUrl}/api/presets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presets }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || `Saving failed (${response.status})`);
    }
    return;
  }
  window.localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

/** Pick, save, update and delete named campaign presets (all export settings at once). */
export function PresetBar<T>({
  backendUrl,
  current,
  onApply,
}: {
  backendUrl: string;
  current: T;
  onApply: (settings: T) => void;
}) {
  const [presets, setPresets] = useState<CampaignPreset<T>[]>([]);
  const [selected, setSelected] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadPresets<T>(backendUrl).then(setPresets).catch(() => setPresets([]));
  }, [backendUrl]);
  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  const persist = async (next: CampaignPreset<T>[], message: string) => {
    try {
      await storePresets(backendUrl, next);
      setPresets(next);
      setStatus(message);
      window.setTimeout(() => setStatus(null), 2000);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const saveAs = async () => {
    const clean = name.trim();
    if (!clean) return;
    const next = [...presets.filter((p) => p.name !== clean), { name: clean, settings: current }].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    await persist(next, 'Saved');
    setSelected(clean);
    setNaming(false);
    setName('');
  };

  return (
    <div className="space-y-2 rounded-xl border border-line bg-canvas p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Campaign preset</span>
        {status && (
          <span role="status" className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Check className="w-3 h-3" />
            {status}
          </span>
        )}
      </div>
      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAs();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name, e.g. Iced Coffee Hour"
            aria-label="Preset name"
            className={inputClass}
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-lg bg-accent text-on-accent text-xs font-semibold cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            aria-label="Cancel"
            className="w-8 h-8 rounded-lg text-ink-muted hover:bg-surface-2 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Campaign preset"
            value={selected}
            onChange={(e) => {
              const preset = presets.find((p) => p.name === e.target.value);
              setSelected(e.target.value);
              if (preset) onApply(preset.settings);
            }}
            className={inputClass}
          >
            <option value="">{presets.length ? 'Choose a campaign' : 'No presets yet'}</option>
            {presets.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          {selected && (
            <>
              <button
                type="button"
                title="Update this preset with the current settings"
                aria-label="Update preset"
                onClick={() =>
                  persist(
                    presets.map((p) => (p.name === selected ? { ...p, settings: current } : p)),
                    'Updated'
                  )
                }
                className="w-8 h-8 shrink-0 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Delete this preset"
                aria-label="Delete preset"
                onClick={() => {
                  if (!window.confirm(`Delete the "${selected}" preset?`)) return;
                  persist(presets.filter((p) => p.name !== selected), 'Deleted');
                  setSelected('');
                }}
                className="w-8 h-8 shrink-0 rounded-lg border border-line text-ink-muted hover:text-danger hover:bg-surface-2 flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setName(selected);
              setNaming(true);
            }}
            className="h-8 shrink-0 px-2.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-surface-2 cursor-pointer"
          >
            Save as
          </button>
        </div>
      )}
      <p className="text-[11px] text-ink-subtle">
        Saves everything here: names, layout, banner, logo, captions, text, edits, music and tags.
      </p>
    </div>
  );
}

// --- Post caption --------------------------------------------------------------------------

function postText(clip: ViralClipSegment, o: CampaignOptions, tags: string): string {
  return [clip.title, '', [o.hashtags.trim(), tags.trim()].filter(Boolean).join(' ')].join('\n').trim();
}

function CopyBox({ label, initial }: { label: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="h-7 px-2.5 rounded-md border border-line text-xs font-medium hover:bg-surface-2 cursor-pointer flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        aria-label={`${label} caption`}
        className="w-full px-3 py-2 rounded-lg bg-canvas border border-line text-sm text-ink focus:outline-none focus:border-accent resize-none"
      />
    </div>
  );
}

/** Ready-to-paste captions per platform, with the campaign's hashtags and required tags. */
export function PostCaptionPanel({
  clip,
  options,
  onClose,
}: {
  clip: ViralClipSegment;
  options: CampaignOptions;
  onClose: () => void;
}) {
  const noTags = !options.hashtags && !options.tagsYoutube && !options.tagsInstagram && !options.tagsTiktok;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-overlay"
    >
      <motion.div
        role="dialog"
        aria-label="Post caption"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md border-l border-line bg-surface overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 h-14">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold">Post caption</h3>
            <p className="text-xs text-ink-muted truncate">{clip.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post caption"
            className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {noTags && (
            <p className="text-sm text-ink-muted">
              Add the campaign&rsquo;s hashtags and required tags in Settings, under Post caption
              tags, and they&rsquo;ll be filled in here.
            </p>
          )}
          <CopyBox key={`yt-${clip.clip_id}`} label="YouTube Shorts" initial={postText(clip, options, options.tagsYoutube)} />
          <CopyBox key={`ig-${clip.clip_id}`} label="Instagram Reels" initial={postText(clip, options, options.tagsInstagram)} />
          <CopyBox key={`tt-${clip.clip_id}`} label="TikTok" initial={postText(clip, options, options.tagsTiktok)} />
        </div>
      </motion.div>
    </motion.div>
  );
}
