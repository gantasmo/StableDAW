import React, { useState, useEffect } from 'react';
import { Settings, X, Package, RefreshCw, AlertTriangle, ToggleLeft, ToggleRight, Activity, Scissors, Music, Power, CheckCircle2, AlertCircle, PowerOff, ChevronRight, LayoutGrid } from 'lucide-react';
import { useFeatureToggleStore } from '../../state/featureToggleStore';
import { useLayoutPrefs, UI_SCALE_MIN, UI_SCALE_MAX, THEME_DEFAULTS } from '../../state/layoutPrefsStore';
import { SlideTrack } from '../audio/SlideTrack';
// CHANGED: Suno cloud-generation API key section (surfaced in Settings).
import { SunoKeySettings } from '../../suno/SunoKeySettings';

interface ModuleConfig {
  name: string;
  label?: string;
  description?: string;
  version?: string;
  enabled: boolean;
  api_prefix?: string;
  _dir?: string;
  _loaded?: boolean;
}

export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const featureSettings = useFeatureToggleStore((s) => s.settings);
  const refreshFeatures = useFeatureToggleStore((s) => s.refresh);
  const patchFeatures = useFeatureToggleStore((s) => s.patch);

  // Local mirror of the VJ export root so typing doesn't fire a PATCH per
  // keystroke — we commit on blur / Enter. Kept in sync when the backend
  // settings resolve.
  const [vjExportRoot, setVjExportRoot] = useState('');
  useEffect(() => {
    setVjExportRoot(featureSettings.vj?.export_root ?? 'exports/vj');
  }, [featureSettings.vj?.export_root]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setDirty(false);
    void refreshFeatures();
    fetch('/api/modules/all')
      .then((r) => r.json() as Promise<ModuleConfig[]>)
      .then((data) => setModules(Array.isArray(data) ? data : []))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, [open, refreshFeatures]);

  const toggleModule = async (dirName: string, enabled: boolean) => {
    setToggling(dirName);
    try {
      const res = await fetch(`/api/modules/${dirName}/enabled`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setModules((prev) => prev.map((m) => (m._dir === dirName ? { ...m, enabled } : m)));
        setDirty(true);
      }
    } finally {
      setToggling(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0c0a14] border border-purple-500/30 rounded-lg w-120 max-h-[75vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Settings</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors rounded hover:bg-white/5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pinned Admin — always at the top, never scrolls away */}
        <div className="shrink-0 border-b border-white/5 bg-[#0a080f] px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Power className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Admin</span>
            <span className="text-[8px] font-mono text-zinc-600 ml-auto">supervisor required</span>
          </div>
          <div className="flex gap-2">
            <RestartServerButton />
            <ShutdownServerButton />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">

          {/* CHANGED: Suno cloud-generation API key entry (the intuitive place to set it). */}
          <SunoKeySettings />

          <LayoutSettingsSection />

          {/* Section: Background features (auto-analysis / stems / midi) */}
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Background features</span>
            <span className="text-[8px] font-mono text-zinc-600 ml-auto">runs during idle</span>
          </div>
          <p className="text-[9px] text-zinc-500 mb-3 leading-relaxed">
            Opt-in enrichment runs in the background when the app is idle. Toggles default OFF and persist across reloads.
          </p>

          <div className="flex flex-col gap-1.5 mb-4">
            <FeatureToggleGroup
              icon={<Activity className="w-3 h-3 text-purple-400" />}
              title="Auto-analysis"
              desc="Detect BPM, key, pitch, bars, codec, embedded prompts. Local-only, CPU-friendly."
              onImport={featureSettings.analysis.auto_on_import}
              onGenerate={featureSettings.analysis.auto_on_generate}
              onPatchImport={(v) => void patchFeatures({ analysis: { auto_on_import: v } })}
              onPatchGenerate={(v) => void patchFeatures({ analysis: { auto_on_generate: v } })}
            />
            <FeatureToggleGroup
              icon={<Scissors className="w-3 h-3 text-purple-400" />}
              title="Auto-stems"
              desc="Separate tracks into stems via Demucs sidecar. Requires the stems module + LARSNET weights for 12-stem."
              onImport={featureSettings.stems.auto_on_import}
              onGenerate={featureSettings.stems.auto_on_generate}
              onPatchImport={(v) => void patchFeatures({ stems: { auto_on_import: v } })}
              onPatchGenerate={(v) => void patchFeatures({ stems: { auto_on_generate: v } })}
              extra={
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Stems:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { value: 2,  label: '2',  hint: 'vocals + accompaniment' },
                        { value: 4,  label: '4',  hint: 'vocals, drums, bass, other' },
                        { value: 6,  label: '6',  hint: '+ guitar, piano' },
                        { value: 12, label: '12', hint: '+ LARSNET drum sub-stems' },
                      ].map((opt) => {
                        const active = featureSettings.stems.default_count === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => void patchFeatures({ stems: { default_count: opt.value } })}
                            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                              active
                                ? 'bg-purple-500/25 border-purple-400/60 text-purple-100'
                                : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                            }`}
                            title={opt.hint}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Device:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { value: 'cuda', label: 'GPU (cuda)', enabled: true },
                        { value: 'cpu',  label: 'CPU',        enabled: true },
                        { value: 'cloud-runpod',     label: 'RunPod',    enabled: false },
                        { value: 'cloud-cloudflare', label: 'Cloudflare', enabled: false },
                        { value: 'cloud-colab',      label: 'Colab',     enabled: false },
                      ].map((opt) => {
                        const active = featureSettings.stems.device === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              if (!opt.enabled) return;
                              void patchFeatures({ stems: { device: opt.value } });
                            }}
                            disabled={!opt.enabled}
                            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                              active
                                ? 'bg-purple-500/25 border-purple-400/60 text-purple-100'
                                : opt.enabled
                                  ? 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                                  : 'border-white/5 text-zinc-700 cursor-not-allowed line-through'
                            }`}
                            title={opt.enabled ? opt.label : `${opt.label} — coming soon`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Quality:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { value: 'fast',     label: 'Fast',     hint: 'shifts=1, overlap=0.25 — ~30s per track' },
                        { value: 'balanced', label: 'Balanced', hint: 'shifts=2, overlap=0.5 — ~1-2 min per track' },
                        { value: 'hq',       label: 'HQ',       hint: 'shifts=10, overlap=0.9 — 5-15 min per track' },
                      ].map((opt) => {
                        const active = featureSettings.stems.quality === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => void patchFeatures({ stems: { quality: opt.value } })}
                            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                              active
                                ? 'bg-purple-500/25 border-purple-400/60 text-purple-100'
                                : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                            }`}
                            title={opt.hint}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              }
            />
            <FeatureToggleGroup
              icon={<Music className="w-3 h-3 text-purple-400" />}
              title="Auto-MIDI"
              desc="Convert tracks (and stems, if available) to MIDI via basic-pitch / piano-transcription."
              onImport={featureSettings.midi.auto_on_import}
              onGenerate={featureSettings.midi.auto_on_generate}
              onPatchImport={(v) => void patchFeatures({ midi: { auto_on_import: v } })}
              onPatchGenerate={(v) => void patchFeatures({ midi: { auto_on_generate: v } })}
            />
          </div>

          {/* Section: VJ recording */}
          <div className="flex items-center gap-1.5 mb-2 pt-2 border-t border-white/5">
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">VJ Recording</span>
          </div>
          <div className="mb-3">
            <label className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Export root folder</label>
            <input
              type="text"
              value={vjExportRoot}
              onChange={(e) => setVjExportRoot(e.target.value)}
              onBlur={() => {
                const v = vjExportRoot.trim() || 'exports/vj';
                if (v !== featureSettings.vj.export_root) void patchFeatures({ vj: { export_root: v } });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              spellCheck={false}
              placeholder="exports/vj"
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-zinc-200 focus:border-purple-500/50 focus:outline-none"
            />
            <p className="text-[8px] text-zinc-600 mt-1">
              Where VJ recordings are saved. A relative path sits inside the project; an absolute path (e.g. D:\Renders) is used as-is. Each take adds the subfolder named in the VJ record bar, then ffmpeg transcodes to the chosen codec.
            </p>
          </div>

          {/* Section: Modules */}
          <div className="flex items-center gap-1.5 mb-2 pt-2 border-t border-white/5">
            <Package className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Backend Modules</span>
            <span className="text-[8px] font-mono text-zinc-600 ml-auto">restart required for changes</span>
          </div>

          {dirty && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded mb-3">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[9px] font-mono text-amber-300">Restart the backend server for module changes to take effect.</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[9px] font-mono">Loading modules...</span>
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-10 text-[9px] text-zinc-600 font-mono">No modules found in backend/modules/</div>
          ) : (
            <ModuleTree modules={modules} toggling={toggling} onToggle={(dir, en) => void toggleModule(dir, en)} />
          )}

        </div>
      </div>
    </div>
  );
};

/* ── Edit Layout Settings (global surface prefs) ──────────────────────────── */
const LayoutSettingsSection: React.FC = () => {
  const fillMode = useLayoutPrefs((s) => s.fillMode);
  const gapPx = useLayoutPrefs((s) => s.gapPx);
  const snapPx = useLayoutPrefs((s) => s.snapPx);
  const showGuides = useLayoutPrefs((s) => s.showGuides);
  const matchSizes = useLayoutPrefs((s) => s.matchSizes);
  const setFillMode = useLayoutPrefs((s) => s.setFillMode);
  const setGapPx = useLayoutPrefs((s) => s.setGapPx);
  const setSnapPx = useLayoutPrefs((s) => s.setSnapPx);
  const setShowGuides = useLayoutPrefs((s) => s.setShowGuides);
  const setMatchSizes = useLayoutPrefs((s) => s.setMatchSizes);
  const uiScale = useLayoutPrefs((s) => s.uiScale);
  const setUiScale = useLayoutPrefs((s) => s.setUiScale);
  const scalePct = Math.round(uiScale * 100);
  const theme = useLayoutPrefs((s) => s.theme);
  const setTheme = useLayoutPrefs((s) => s.setTheme);
  const textColor = useLayoutPrefs((s) => s.textColor);
  const setTextColor = useLayoutPrefs((s) => s.setTextColor);
  const bgColor = useLayoutPrefs((s) => s.bgColor);
  const setBgColor = useLayoutPrefs((s) => s.setBgColor);
  // Effective colour shown in each picker: the custom override if set, else the
  // current theme's default (so the swatch always reflects what's on screen).
  const effTextColor = textColor ?? THEME_DEFAULTS[theme].text;
  const effBgColor = bgColor ?? THEME_DEFAULTS[theme].bg;
  const colorsCustomized = textColor !== null || bgColor !== null;
  const highContrast = useLayoutPrefs((s) => s.highContrast);
  const setHighContrast = useLayoutPrefs((s) => s.setHighContrast);
  const minTextPx = useLayoutPrefs((s) => s.minTextPx);
  const setMinTextPx = useLayoutPrefs((s) => s.setMinTextPx);
  return (
    <>
      <div className="flex items-center gap-1.5 mb-2">
        <LayoutGrid className="w-3 h-3 text-purple-400" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Edit Layout Settings</span>
        <span className="text-[8px] font-mono text-zinc-600 ml-auto">applies to every workspace</span>
      </div>
      <div className="border border-white/5 rounded px-3 py-2.5 bg-white/3 mb-4 flex flex-col gap-3">
        {/* App-wide text/UI size — a clamped page-zoom so nothing gets too big or small. */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Text size:</span>
          <SlideTrack
            min={Math.round(UI_SCALE_MIN * 100)}
            max={Math.round(UI_SCALE_MAX * 100)}
            step={5}
            value={scalePct}
            onChange={(v) => setUiScale(v / 100)}
            className="flex-1"
            ariaLabel="App-wide text and UI size"
          />
          <span className="text-[8px] font-mono text-zinc-400 w-9 text-right tabular-nums">{scalePct}%</span>
          <button
            onClick={() => setUiScale(1)}
            disabled={scalePct === 100}
            className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-40 disabled:cursor-default transition-colors"
            title="Reset text size to 100%"
          >
            Reset
          </button>
        </div>
        {/* App-wide colour theme — flips the CSS-variable palette (index.css). */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Theme:</span>
          <div className="flex items-center gap-1">
            {([['dark', 'Dark'], ['light', 'Light']] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setTheme(v)}
                className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                  theme === v ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
                title={v === 'dark' ? "The app's native dark palette" : 'A light palette for brighter rooms'}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {/* Optional per-user colour overrides — win over the theme palette. */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Colors:</span>
          <label className="flex items-center gap-1 text-[8px] font-mono uppercase tracking-widest text-zinc-400">
            Text
            <input
              type="color"
              value={effTextColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="h-5 w-7 rounded border border-white/10 bg-transparent cursor-pointer"
              title="Custom text colour (overrides the theme)"
            />
          </label>
          <label className="flex items-center gap-1 text-[8px] font-mono uppercase tracking-widest text-zinc-400">
            BG
            <input
              type="color"
              value={effBgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-5 w-7 rounded border border-white/10 bg-transparent cursor-pointer"
              title="Custom background colour (overrides the theme)"
            />
          </label>
          <button
            onClick={() => { setTextColor(null); setBgColor(null); }}
            disabled={!colorsCustomized}
            className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-40 disabled:cursor-default transition-colors ml-auto"
            title="Clear custom colours and use the theme defaults"
          >
            Reset
          </button>
        </div>
        {/* Legibility: lift dim text so it stops blending into the background. */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Contrast:</span>
          <div className="flex items-center gap-1">
            {([[false, 'Normal'], [true, 'High']] as const).map(([v, lbl]) => (
              <button
                key={lbl}
                onClick={() => setHighContrast(v)}
                className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                  highContrast === v ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
                title={v ? 'Brighten dim/muted text so it separates from the background' : "The app's native contrast"}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {/* Legibility: floor the tiniest notification/label fonts (layout-safe). */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Min size:</span>
          <div className="flex items-center gap-1">
            {([[0, 'Off'], [10, '10px'], [12, '12px']] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setMinTextPx(v)}
                className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                  minTextPx === v ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
                title={v === 0 ? 'No minimum — native tiny sizes' : `Bump fonts below ${lbl} up to ${lbl}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Fill:</span>
          <div className="flex items-center gap-1">
            {([['scale', 'Scale controls'], ['natural', 'Compact']] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setFillMode(v)}
                className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
                  fillMode === v ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
                title={v === 'scale' ? 'Controls grow to fill their cell' : 'Controls stay compact, centered'}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Gap:</span>
          <SlideTrack min={0} max={24} step={1} value={gapPx}
            onChange={(v) => setGapPx(v)} className="flex-1" ariaLabel="Gap between panels" />
          <span className="text-[8px] font-mono text-zinc-400 w-8 text-right tabular-nums">{gapPx}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Snap:</span>
          <SlideTrack min={0} max={24} step={1} value={snapPx}
            onChange={(v) => setSnapPx(v)} className="flex-1" ariaLabel="Snap step when dragging margins" />
          <span className="text-[8px] font-mono text-zinc-400 w-8 text-right tabular-nums">{snapPx === 0 ? 'off' : `${snapPx}px`}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Guides:</span>
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
              showGuides ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
            title="Show centre + increment alignment guides while editing a layout"
          >
            {showGuides ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 w-16 shrink-0">Match:</span>
          <button
            onClick={() => setMatchSizes(!matchSizes)}
            className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors ${
              matchSizes ? 'bg-purple-500/25 border-purple-400/60 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
            title="Match same-kind control sizes — equal height across a row, equal width down a column"
          >
            {matchSizes ? 'On' : 'Off'}
          </button>
        </div>
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          Scale grows controls to fill empty space; Compact keeps them at a natural size. Gap sets the spacing between panels. Per-panel padding, mirror, and control placement are edited inside each workspace's Edit Layout mode.
        </p>
      </div>
    </>
  );
};

/* ── Modules grouped into a collapsible tree ──────────────────────────────── */
const MODULE_GROUPS: Record<string, string> = {
  chimera: 'Generation',
  analysis: 'Audio', effects: 'Audio', stems: 'Audio', midi: 'Audio',
  library: 'Library', ytimport: 'Library',
  vj: 'Performance', controllervision: 'Performance',
  settings: 'System',
};
const GROUP_ORDER = ['Generation', 'Audio', 'Library', 'Performance', 'System', 'Other'];

const ModuleTree: React.FC<{ modules: ModuleConfig[]; toggling: string | null; onToggle: (dir: string, enabled: boolean) => void }> = ({ modules, toggling, onToggle }) => {
  const groups: Record<string, ModuleConfig[]> = {};
  for (const m of Array.isArray(modules) ? modules : []) {
    const g = MODULE_GROUPS[m.name] ?? 'Other';
    (groups[g] ??= []).push(m);
  }
  const names = GROUP_ORDER.filter((g) => groups[g]?.length);
  return (
    <div className="flex flex-col gap-1.5">
      {names.map((g) => (
        <ModuleGroup key={g} name={g} mods={groups[g]} toggling={toggling} onToggle={onToggle} />
      ))}
    </div>
  );
};

const ModuleGroup: React.FC<{ name: string; mods: ModuleConfig[]; toggling: string | null; onToggle: (dir: string, enabled: boolean) => void }> = ({ name, mods, toggling, onToggle }) => {
  const [open, setOpen] = useState(false);
  const onCount = mods.filter((m) => m.enabled).length;
  return (
    <div className="border border-white/5 rounded bg-white/3">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2">
        <ChevronRight className={`w-3 h-3 text-purple-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-200">{name}</span>
        <span className="text-[8px] font-mono text-zinc-600 ml-auto">{onCount}/{mods.length} on</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-2 pb-2">
          {mods.map((mod) => (
            <ModuleRow key={mod._dir || mod.name} mod={mod} toggling={toggling} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
};

const ModuleRow: React.FC<{ mod: ModuleConfig; toggling: string | null; onToggle: (dir: string, enabled: boolean) => void }> = ({ mod, toggling, onToggle }) => {
  const key = mod._dir || mod.name;
  const isToggling = toggling === key;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border rounded transition-colors ${mod.enabled ? 'bg-white/3 border-white/8' : 'bg-black/20 border-white/5 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold text-zinc-100 truncate">{mod.label || mod.name}</span>
          {mod.version && <span className="text-[8px] font-mono text-zinc-600 shrink-0">v{mod.version}</span>}
          {mod._loaded && <span className="text-[7px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-1 py-0.5 rounded shrink-0">RUNNING</span>}
        </div>
        {mod.description && <p className="text-[9px] text-zinc-500 truncate">{mod.description}</p>}
        {mod.api_prefix && <span className="text-[8px] font-mono text-zinc-700">{mod.api_prefix}</span>}
      </div>
      <button
        onClick={() => onToggle(key, !mod.enabled)}
        disabled={isToggling}
        className="shrink-0 transition-opacity disabled:opacity-50"
        title={mod.enabled ? 'Disable module' : 'Enable module'}
      >
        {isToggling ? (
          <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
        ) : mod.enabled ? (
          <ToggleRight className="w-6 h-6 text-purple-400" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-zinc-600" />
        )}
      </button>
    </div>
  );
};

/** Restarts the backend by hitting POST /api/admin/restart and then
 *  polling /api/health until the new process answers. The button
 *  surfaces three states: idle, restarting (spinner), and a short
 *  success/error flash that auto-resets after a few seconds.
 *
 *  Deadline is 90s because the backend's startup includes torch + CUDA
 *  module loading + ML model init, which on slower GPUs can comfortably
 *  push past a tighter window. We flash success as soon as /api/health
 *  returns 200 (which is decoupled from model loading on the backend
 *  side — health responds the moment uvicorn is up). */
const RestartServerButton: React.FC = () => {
  type Status = 'idle' | 'restarting' | 'success' | 'error';
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState<string>('');

  const handle = async () => {
    if (status === 'restarting') return;
    setStatus('restarting');
    setDetail('Sending restart signal…');
    try {
      const r = await fetch('/api/admin/restart', { method: 'POST' });
      if (r.status === 412) {
        // Backend isn't running under the supervisor — show its detail
        // verbatim so the user knows how to enable restart.
        const body = await r.json().catch(() => ({ detail: '' }));
        setStatus('error');
        setDetail(body.detail || 'Supervisor not detected. Launch via start-dev.bat to enable restart.');
        setTimeout(() => {
          setStatus('idle');
          setDetail('');
        }, 10_000);
        return;
      }
      if (!r.ok) throw new Error(`restart endpoint returned ${r.status}`);
      // Wait a beat for the process to exit, then poll /api/health.
      setDetail('Waiting for backend to come back…');
      const deadline = Date.now() + 90_000;
      // Brief initial sleep so we don't race the still-alive old
      // process before the supervisor re-spawns.
      await new Promise((res) => setTimeout(res, 1500));
      while (Date.now() < deadline) {
        try {
          const h = await fetch('/api/health', { cache: 'no-store' });
          if (h.ok) {
            setStatus('success');
            setDetail('Backend restarted.');
            setTimeout(() => {
              setStatus('idle');
              setDetail('');
            }, 4000);
            return;
          }
        } catch {
          // expected during the offline window
        }
        const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
        setDetail(`Waiting for backend to come back… ${remaining}s left`);
        await new Promise((res) => setTimeout(res, 500));
      }
      throw new Error("backend didn't respond within 90s — it may still be loading; try refreshing the page");
    } catch (e) {
      setStatus('error');
      setDetail(e instanceof Error ? e.message : 'restart failed');
      setTimeout(() => {
        setStatus('idle');
        setDetail('');
      }, 10_000);
    }
  };

  const baseCls =
    'flex items-center justify-center gap-2 flex-1 px-3 py-2 rounded border text-[10px] font-black uppercase tracking-widest transition-colors';
  const stateCls: Record<Status, string> = {
    idle: 'border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60',
    restarting: 'border-amber-500/40 bg-amber-500/10 text-amber-200 cursor-wait',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 cursor-default',
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-200 cursor-default',
  };

  const icon =
    status === 'restarting' ? (
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
    ) : status === 'success' ? (
      <CheckCircle2 className="w-3.5 h-3.5" />
    ) : status === 'error' ? (
      <AlertCircle className="w-3.5 h-3.5" />
    ) : (
      <Power className="w-3.5 h-3.5" />
    );

  const label =
    status === 'restarting'
      ? 'Restarting…'
      : status === 'success'
      ? 'Back online'
      : status === 'error'
      ? 'Restart failed'
      : 'Restart';

  return (
    <button
      type="button"
      onClick={handle}
      disabled={status === 'restarting'}
      className={`${baseCls} ${stateCls[status]}`}
      title={detail || label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

/** Cleanly stops the SA3 backend (rc=0). The supervisor sees a non-
 *  restart exit code and terminates the loop, so the whole "SA3
 *  Backend" console closes — the user has to relaunch via start-dev
 *  to bring SA3 back up. Confirms before sending the shutdown signal
 *  because this can't be reversed from the browser side once fired. */
const ShutdownServerButton: React.FC = () => {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async () => {
    if (pending || done) return;
    const ok = window.confirm(
      'Shut down the SA3 backend?\n\nThe browser will lose its connection. Relaunch via start-dev.bat to bring it back.',
    );
    if (!ok) return;
    setPending(true);
    try {
      await fetch('/api/admin/shutdown', { method: 'POST' });
      setDone(true);
    } catch {
      // The fetch may abort mid-shutdown — that's expected. Treat it
      // as a successful trigger so the UI flips to the terminal state.
      setDone(true);
    } finally {
      setPending(false);
    }
  };

  const baseCls =
    'flex items-center justify-center gap-2 flex-1 px-3 py-2 rounded border text-[10px] font-black uppercase tracking-widest transition-colors';
  const cls = done
    ? 'border-rose-500/50 bg-rose-500/15 text-rose-200 cursor-default'
    : pending
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 cursor-wait'
    : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-400/60';

  const icon = done ? (
    <PowerOff className="w-3.5 h-3.5" />
  ) : pending ? (
    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
  ) : (
    <PowerOff className="w-3.5 h-3.5" />
  );
  const label = done ? 'Offline' : pending ? 'Shutting down…' : 'Shutdown';

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending || done}
      className={`${baseCls} ${cls}`}
      title="Stop the SA3 backend entirely (supervisor exits, no respawn)."
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};


interface FeatureToggleGroupProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onImport: boolean;
  onGenerate: boolean;
  onPatchImport: (next: boolean) => void;
  onPatchGenerate: (next: boolean) => void;
  /** Optional extra controls rendered below the on-import/on-generate
   *  toggles — e.g. the stems device picker. */
  extra?: React.ReactNode;
}

const FeatureToggleGroup: React.FC<FeatureToggleGroupProps> = ({
  icon, title, desc, onImport, onGenerate, onPatchImport, onPatchGenerate, extra,
}) => (
  <div className="border border-white/5 rounded px-3 py-2.5 bg-white/3">
    <div className="flex items-center gap-2 mb-1.5">
      {icon}
      <span className="text-[10px] font-bold text-zinc-100">{title}</span>
    </div>
    <p className="text-[9px] text-zinc-500 mb-2 leading-relaxed">{desc}</p>
    <div className="flex items-center gap-4">
      <ToggleRow label="on import" enabled={onImport} onToggle={() => onPatchImport(!onImport)} />
      <ToggleRow label="on generate" enabled={onGenerate} onToggle={() => onPatchGenerate(!onGenerate)} />
    </div>
    {extra}
  </div>
);


interface ToggleRowProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, enabled, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex items-center gap-1.5 group"
    title={enabled ? `Disable: ${label}` : `Enable: ${label}`}
  >
    {enabled ? (
      <ToggleRight className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
    ) : (
      <ToggleLeft className="w-5 h-5 text-zinc-600 group-hover:text-zinc-500" />
    )}
    <span className={`text-[9px] font-mono uppercase tracking-widest ${enabled ? 'text-purple-200' : 'text-zinc-500'}`}>
      {label}
    </span>
  </button>
);

