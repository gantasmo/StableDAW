import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import {
  Play, Pause, Square, X, Plus,
  Scissors, Mic2, Search, ChevronDown,
  LayoutList, AudioWaveform, Volume2, Sliders,
  Wand2, Loader2, BookOpen, Layers, Sparkles, Download,
} from 'lucide-react';
import { useGenerateParamsStore, type GenerateParamsState } from '../state/generateParamsStore';
import { useGenerateStore } from '../state/generateStore';
import { useLibraryStore } from '../state/libraryStore';
import { useEditorStore } from '../state/editorStore';
import { WaveformPreview } from '../components/audio/WaveformPreview';
import { FooterScrubWave } from '../components/audio/FooterScrubWave';
import { uuid } from '../orb-kit/utils';
import { InfoTip } from '../components/ui/Tooltip';
import { RICH_TOOLTIPS } from '../components/ui/tooltips';
import { GENERATION_PRESETS, type GenerationPreset } from '../data/generationPresets';
import { enhanceStableAudioPrompt } from '../orb-kit/promptEnhancer';
import { ChimeraStack } from '../components/chimera/ChimeraStack';
import { SlideKnob } from '../components/audio/SlideKnob';
import { SlideTrack } from '../components/audio/SlideTrack';
import { SlideFader } from '../components/audio/SlideFader';
import { SlideRow } from '../components/audio/SlideRow';
import { RoundToggle } from '../components/audio/RoundToggle';
import { VisualizerPanel } from '../components/audio/VisualizerPanelLazy';
import { getMasterGain, usePlayerStore } from '../state/playerStore';
import '../components/layout/track-controls.css';

/* ── Full audio player (Compare row) ──────────────────────────────────── */
/* Drives the global footer transport (playerStore) — the generated output is
   loaded into that single engine after generation, so this player and the
   footer share one source and the visualizers react to playback. */
function FullAudioPlayer() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const time = usePlayerStore((s) => s.currentTime);
  const dur = usePlayerStore((s) => s.duration);
  const toggle = usePlayerStore((s) => s.toggle);
  const stop = usePlayerStore((s) => s.stop);
  const seekByFraction = usePlayerStore((s) => s.seekByFraction);
  const setMasterGain = usePlayerStore((s) => s.setMasterGain);
  const [vol, setVol] = useState(1);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-2 px-1">
      <button onClick={toggle} title={isPlaying ? 'Pause (footer)' : 'Play (footer)'}
        className="text-purple-400 hover:text-purple-300 cursor-pointer w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <button onClick={stop} title="Stop" className="text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0">
        <Square className="w-3.5 h-3.5" />
      </button>
      <span className="text-[10px] font-mono text-zinc-400 tabular-nums shrink-0">{fmt(time)} / {fmt(dur)}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => { if (!dur) return; seekByFraction((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth); }}>
        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dur ? (time / dur) * 100 : 0}%` }} />
      </div>
      <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <SlideTrack min={0} max={1} step={0.01} value={vol}
        onChange={(v) => { setVol(v); setMasterGain(v); }}
        className="w-16 shrink-0" ariaLabel="Master volume" />
    </div>
  );
}

/* ── Saved Prompts Dropdown ───────────────────────────────────────────── */
function SavedPromptsDropdown({ type, value, onChange }: {
  type: 'positive' | 'negative'; value: string; onChange: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const storageKey = `stabledaw.savedPrompts.${type}`;
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(saved)); }, [saved, storageKey]);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!saved.includes(trimmed)) setSaved([trimmed, ...saved]);
  };
  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button className="btn-ghost flex items-center gap-1 cursor-pointer text-[9px]" onClick={() => setOpen(!open)}>
        <ChevronDown className="w-3 h-3" /> SAVED ({saved.length})
      </button>
      <button className="btn-ghost cursor-pointer p-1" onClick={handleSave} title="Save current">
        <Plus className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 top-full right-0 mt-1 bg-(--panel) border border-(--panel-border) rounded shadow-2xl min-w-55 max-h-45 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {saved.length === 0 ? (
              <div className="px-3 py-2 text-[9px] text-zinc-600 text-center">No saved prompts</div>
            ) : saved.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer group"
                onClick={() => { onChange(item); setOpen(false); }}>
                <span className="text-[9px] text-zinc-300 truncate flex-1">{item.slice(0, 40)}{item.length > 40 ? '...' : ''}</span>
                <button className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSaved(saved.filter((s) => s !== item)); }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Templates Panel ──────────────────────────────────────────────────── */
interface Template { id: string; name: string; createdAt: string; params: Partial<GenerateParamsState>; }

function TemplatesPanel() {
  const p = useGenerateParamsStore();
  const [templates, setTemplates] = useState<Template[]>(() => {
    try { return JSON.parse(localStorage.getItem('stabledaw.templates') || '[]'); } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => { localStorage.setItem('stabledaw.templates', JSON.stringify(templates)); }, [templates]);
  const handleSave = () => {
    const name = window.prompt('Template name:');
    if (!name?.trim()) return;
    const params: Partial<GenerateParamsState> = {
      prompt: p.prompt, negativePrompt: p.negativePrompt, model: p.model, duration: p.duration,
      steps: p.steps, cfg: p.cfg, seed: p.seed, batch: p.batch, samplerType: p.samplerType,
      sigmaMax: p.sigmaMax, durationPaddingSec: p.durationPaddingSec, apgScale: p.apgScale,
      cfgRescale: p.cfgRescale, cfgNormThreshold: p.cfgNormThreshold, cfgIntervalMin: p.cfgIntervalMin,
      cfgIntervalMax: p.cfgIntervalMax, shiftMode: p.shiftMode, logsnrAnchorLength: p.logsnrAnchorLength,
      logsnrAnchorLogsnr: p.logsnrAnchorLogsnr, logsnrRate: p.logsnrRate, logsnrEnd: p.logsnrEnd,
      fluxMinLen: p.fluxMinLen, fluxMaxLen: p.fluxMaxLen, fluxAlphaMin: p.fluxAlphaMin,
      fluxAlphaMax: p.fluxAlphaMax, fullBaseShift: p.fullBaseShift, fullMaxShift: p.fullMaxShift,
      fullMinLen: p.fullMinLen, fullMaxLen: p.fullMaxLen, initNoise: p.initNoise, initType: p.initType,
      initAudioEnabled: p.initAudioEnabled, inversionSteps: p.inversionSteps,
      inversionGamma: p.inversionGamma, inversionUnconditional: p.inversionUnconditional,
      inpaintEnabled: p.inpaintEnabled, maskStart: p.maskStart, maskEnd: p.maskEnd,
      fileFormat: p.fileFormat, fileNaming: p.fileNaming, cutToDuration: p.cutToDuration,
      autoplay: p.autoplay, autoDownload: p.autoDownload,
    };
    setTemplates([{ id: uuid(), name: name.trim(), createdAt: new Date().toISOString(), params }, ...templates]);
  };
  const filtered = templates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <div className="hardware-card flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">TEMPLATES</span>
        <button className="btn-ghost cursor-pointer p-1" onClick={handleSave} title="Save current">
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1 mb-1.5">
        <Search className="w-3 h-3 text-zinc-600 shrink-0" />
        <input className="compact-input flex-1 text-[9px]" placeholder="Search templates..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <div className="overflow-y-auto min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="text-center py-1"><span className="text-[9px] text-zinc-600 font-mono">No templates</span></div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-black/20 rounded hover:bg-white/5 cursor-pointer group">
                <span className="text-[9px] text-zinc-300 flex-1 truncate" onClick={() => p.patch(t.params)}>{t.name}</span>
                <button className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setTemplates(templates.filter((x) => x.id !== t.id)); }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export const AdvancedGenPanel: React.FC<{
  onAddTo?: (target: 'timeline' | 'editor' | 'sequencer' | 'newTrack') => void;
}> = ({ onAddTo }) => {
  const p = useGenerateParamsStore();
  const sf = p.setField;
  const patch = p.patch;

  // Probe the Magenta RT2 sidecar once on mount; gates the Magenta model option.
  useEffect(() => {
    fetch('/api/magenta/probe')
      .then((r) => r.json())
      .then((d) => useGenerateParamsStore.getState().setField('magentaAvailable', d?.available === true))
      .catch(() => useGenerateParamsStore.getState().setField('magentaAvailable', false));
  }, []);

  const lastAudioUrl = useGenerateStore((s) => s.lastAudioUrl);
  const libraryEntries = useLibraryStore((s) => s.entries);
  const addTrack = useEditorStore((s) => s.addTrack);
  const addClip = useEditorStore((s) => s.addClipToTrack);

  const initRef = useRef<HTMLInputElement>(null);
  const inpaintRef = useRef<HTMLInputElement>(null);

  const [enhancingPositive, setEnhancingPositive] = useState(false);
  const [enhancingNegative, setEnhancingNegative] = useState(false);

  const [presetsOpen, setPresetsOpen] = useState(false);
  const [lorasOpen, setLorasOpen] = useState(false);
  const applyPreset = useCallback((preset: GenerationPreset) => {
    patch(preset.params);
    setPresetsOpen(false);
  }, [patch]);

  const [spectrograms, setSpectrograms] = useState<{mel:string,stft:string,chromagram:string,cqt:string}|null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  // Center hero tab — Chimera (setup) ↔ Compare (post-gen inspection).
  const [heroTab, setHeroTab] = useState<'chimera' | 'compare'>('chimera');
  const prevAudioRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastAudioUrl && lastAudioUrl !== prevAudioRef.current) setHeroTab('compare');
    prevAudioRef.current = lastAudioUrl;
  }, [lastAudioUrl]);

  const [cmpLayers, setCmpLayers] = useState<Set<string>>(() => new Set(['output']));
  const [cmpOverlay, setCmpOverlay] = useState(false);
  const toggleLayer = (k: string) => setCmpLayers((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  useEffect(() => {
    if (!lastAudioUrl) { setSpectrograms(null); setSpecLoading(false); return; }
    let cancelled = false;
    setSpecLoading(true);
    setSpectrograms(null);
    (async () => {
      try {
        const audioRes = await fetch(lastAudioUrl);
        if (!audioRes.ok) throw new Error(`audio fetch failed: ${audioRes.status}`);
        const blob = await audioRes.blob();
        if (cancelled) return;
        const form = new FormData();
        form.append('audio_file', blob, 'output.wav');
        const res = await fetch('/api/spectrogram', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`/api/spectrogram ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSpectrograms(data);
      } catch (e) {
        if (cancelled) return;
        console.error('[spectrogram] failed:', e);
        setSpectrograms({ mel: '', stft: '', chromagram: '', cqt: '' });
      } finally {
        if (!cancelled) setSpecLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lastAudioUrl]);

  const fileFromDrop = useCallback(async (e: React.DragEvent): Promise<File | null> => {
    const libId = e.dataTransfer.getData('application/x-stabledaw-library-id');
    if (libId) {
      const entry = libraryEntries.find((en) => en.id === libId);
      if (entry) {
        const blob = await useLibraryStore.getState().fetchAudioBlob(entry);
        return new File([blob], `${entry.title.slice(0, 40)}.wav`, { type: entry.mimeType || 'audio/wav' });
      }
    }
    return e.dataTransfer.files[0] || null;
  }, [libraryEntries]);

  // Shared player-engine master gain → live audio-reactive visualizers.
  const masterAudio = useMemo<AudioNode | null>(() => { try { return getMasterGain(); } catch { return null; } }, []);

  const initAudioUrl = useMemo(() => p.initAudioFile ? URL.createObjectURL(p.initAudioFile) : null, [p.initAudioFile]);
  const inpaintAudioUrl = useMemo(() => p.inpaintAudioFile ? URL.createObjectURL(p.inpaintAudioFile) : null, [p.inpaintAudioFile]);
  useEffect(() => () => { if (initAudioUrl) URL.revokeObjectURL(initAudioUrl); }, [initAudioUrl]);
  useEffect(() => () => { if (inpaintAudioUrl) URL.revokeObjectURL(inpaintAudioUrl); }, [inpaintAudioUrl]);

  const handleSendToDaw = async () => {
    if (!lastAudioUrl) return;
    const blob = await (await fetch(lastAudioUrl)).blob();
    const trackId = addTrack({ name: p.prompt.slice(0, 30) || 'Generated' });
    const audio = new Audio(lastAudioUrl);
    await new Promise<void>((r) => { audio.onloadedmetadata = () => r(); audio.onerror = () => r(); });
    addClip({ trackId, label: p.prompt.slice(0, 40) || 'Generated Audio', audioBlob: blob,
      mimeType: blob.type || 'audio/wav', sourceDuration: audio.duration || p.duration,
      offsetIntoSource: 0, durationSec: audio.duration || p.duration, startSec: 0,
      color: '#8b5cf6', sourceKind: 'audio' });
  };
  const handleSendToInit = async () => {
    if (!lastAudioUrl) return;
    const blob = await (await fetch(lastAudioUrl)).blob();
    patch({ initAudioFile: new File([blob], 'output.wav', { type: blob.type || 'audio/wav' }), initAudioEnabled: true });
  };
  const handleSendToInpaint = async () => {
    if (!lastAudioUrl) return;
    const blob = await (await fetch(lastAudioUrl)).blob();
    patch({ inpaintAudioFile: new File([blob], 'output.wav', { type: blob.type || 'audio/wav' }), inpaintEnabled: true, maskStart: 0, maskEnd: 0 });
  };
  type QuickTarget = 'daw' | 'init' | 'inpaint' | 'effects';
  const handleQuickAction = (target: QuickTarget) => {
    if (target === 'daw') { void handleSendToDaw(); return; }
    if (target === 'init') { void handleSendToInit(); return; }
    if (target === 'inpaint') { void handleSendToInpaint(); return; }
    if (target === 'effects' && onAddTo) { onAddTo('editor'); return; }
  };

  const sectionTitle = 'text-[10px] font-black uppercase tracking-widest text-purple-300';
  const subTitle = 'text-[9px] font-black uppercase tracking-widest text-purple-300/70';
  const accentBox = 'rounded-lg border border-(--surface-divider) bg-[#0c0a12]/70';
  const colBox = 'rounded-lg bg-black/20 border border-(--surface-divider)';
  const SHIFT_MODES = ['LogSNR', 'Flux', 'Full', 'None'] as const;
  const tabBtn = (on: boolean) =>
    `flex items-center gap-1.5 px-5 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${
      on ? 'bg-purple-600/25 text-purple-200 border border-purple-500/40' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`;

  // schedule-shift faders for the active mode
  const shiftFaders = () => {
    if (p.shiftMode === 'LogSNR') return (<>
      <SlideFader label="Anchor" value={p.logsnrAnchorLength} onChange={(v) => sf('logsnrAnchorLength', v)} min={100} max={10000} step={100} tipKey="logsnrAnchorLength" />
      <SlideFader label="A.SNR" value={p.logsnrAnchorLogsnr} onChange={(v) => sf('logsnrAnchorLogsnr', v)} min={-12} max={0} step={0.1} tipKey="logsnrAnchorLogsnr" />
      <SlideFader label="Rate" value={p.logsnrRate} onChange={(v) => sf('logsnrRate', v)} min={-2} max={2} step={0.05} tipKey="logsnrRate" />
      <SlideFader label="End" value={p.logsnrEnd} onChange={(v) => sf('logsnrEnd', v)} min={-2} max={6} step={0.1} tipKey="logsnrEnd" />
    </>);
    if (p.shiftMode === 'Flux') return (<>
      <SlideFader label="Min" value={p.fluxMinLen} onChange={(v) => sf('fluxMinLen', v)} min={1} max={10000} step={1} tipKey="fluxMinLen" />
      <SlideFader label="Max" value={p.fluxMaxLen} onChange={(v) => sf('fluxMaxLen', v)} min={1} max={10000} step={1} tipKey="fluxMaxLen" />
      <SlideFader label="α min" value={p.fluxAlphaMin} onChange={(v) => sf('fluxAlphaMin', v)} min={0.1} max={20} step={0.1} tipKey="fluxAlphaMin" />
      <SlideFader label="α max" value={p.fluxAlphaMax} onChange={(v) => sf('fluxAlphaMax', v)} min={0.1} max={20} step={0.1} tipKey="fluxAlphaMax" />
    </>);
    if (p.shiftMode === 'Full') return (<>
      <SlideFader label="Base" value={p.fullBaseShift} onChange={(v) => sf('fullBaseShift', v)} min={0} max={5} step={0.1} tipKey="fullBaseShift" />
      <SlideFader label="Max" value={p.fullMaxShift} onChange={(v) => sf('fullMaxShift', v)} min={0} max={5} step={0.1} tipKey="fullMaxShift" />
      <SlideFader label="Min L" value={p.fullMinLen} onChange={(v) => sf('fullMinLen', v)} min={1} max={10000} step={1} tipKey="fullMinLen" />
      <SlideFader label="Max L" value={p.fullMaxLen} onChange={(v) => sf('fullMaxLen', v)} min={1} max={10000} step={1} tipKey="fullMaxLen" />
    </>);
    return <div className="col-span-4 flex items-center justify-center text-[9px] text-zinc-600">No schedule shift</div>;
  };

  /* ────────────────────────────────────────────────────────────────────── */

  return (
    <div className="make-surface h-full w-full overflow-hidden text-[11px] flex flex-col gap-1.5 p-1.5">

      {/* ═══ TOP: input waveforms (INIT | INPAINT) ═══ */}
      <div className="shrink-0 grid grid-cols-2 gap-1.5" style={{ height: 128 }}>
        {/* INIT */}
        <div className={`${accentBox} flex flex-col px-2 py-1.5 min-w-0`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={async (e) => { e.preventDefault(); const f = await fileFromDrop(e); if (f) patch({ initAudioFile: f, initAudioEnabled: true }); }}>
          <div className="flex items-center gap-1.5 mb-1 shrink-0">
            <Mic2 className="w-3 h-3 text-purple-400 shrink-0" />
            <span className={`${subTitle} flex items-center gap-1`}>INIT <InfoTip {...RICH_TOOLTIPS.initAudio} /></span>
            <span className="text-[9px] text-purple-200 truncate flex-1 min-w-0">{p.initAudioFile ? p.initAudioFile.name : 'drop audio / load'}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-zinc-400">Type</span>
              <select className="compact-input h-5 py-0 text-[9px] w-20" value={p.initType} onChange={(e) => sf('initType', e.target.value)} style={{ colorScheme: 'dark' }}>
                <option value="Audio">Audio</option><option value="RF-Inversion">RF-Inv</option>
              </select>
            </div>
            <div className="flex items-center gap-1 shrink-0" title="Init noise — denoising strength for the init audio (0 = keep init exactly, 1 = full noise / ignore init). Set this BEFORE generating.">
              <span className="text-[9px] text-zinc-400">Nz</span>
              <SlideTrack min={0} max={1} step={0.01} value={p.initNoise}
                onChange={(v) => sf('initNoise', v)} className="w-14" ariaLabel="Init noise" />
              <span className="text-[9px] font-mono text-purple-300 tabular-nums w-7 text-right">{p.initNoise.toFixed(2)}</span>
            </div>
            <button onClick={() => sf('initAudioEnabled', !p.initAudioEnabled)}
              className={`mono-tag cursor-pointer shrink-0 ${p.initAudioEnabled ? 'bg-purple-600/30 text-purple-200 border-purple-500/50' : ''}`}>
              {p.initAudioEnabled ? 'ON' : 'OFF'}
            </button>
            {p.initAudioFile ? (
              <button className="btn-ghost cursor-pointer shrink-0" onClick={() => patch({ initAudioFile: null, initAudioEnabled: false })}><X className="w-3 h-3" /></button>
            ) : (
              <button className="btn-ghost cursor-pointer text-[9px] shrink-0" onClick={() => initRef.current?.click()}>LOAD</button>
            )}
            <input ref={initRef} type="file" accept="audio/*" multiple className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length === 0) return;
                if (files.length === 1) { patch({ initAudioFile: files[0], initAudioEnabled: true }); return; }
                const items = await Promise.all(files.map(async (f) => ({ blob: f, mimeType: f.type || 'audio/wav', label: f.name })));
                const { addBlobsToChimera } = await import('../lib/chimeraClient');
                addBlobsToChimera(items);
              }} />
          </div>
          <div className="flex-1 min-h-0 rounded overflow-hidden border border-white/5 bg-black/40">
            {initAudioUrl ? <WaveformPreview audioUrl={initAudioUrl} height={88} />
              : <div className="h-full flex items-center justify-center"><span className="text-[9px] text-zinc-600">No init audio</span></div>}
          </div>
        </div>
        {/* INPAINT */}
        <div className={`${accentBox} flex flex-col px-2 py-1.5 min-w-0`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={async (e) => { e.preventDefault(); const f = await fileFromDrop(e); if (f) patch({ inpaintAudioFile: f, inpaintEnabled: true, maskStart: 0, maskEnd: 0 }); }}>
          <div className="flex items-center gap-1.5 mb-1 shrink-0">
            <Scissors className="w-3 h-3 text-purple-400 shrink-0" />
            <span className={`${subTitle} flex items-center gap-1`}>INPAINT <InfoTip {...RICH_TOOLTIPS.inpainting} /></span>
            <span className="text-[9px] text-purple-200 truncate flex-1 min-w-0">{p.inpaintAudioFile ? p.inpaintAudioFile.name : 'drop audio / load'}</span>
            {p.inpaintAudioFile && <span className="text-[9px] font-mono text-purple-300/80 shrink-0">{p.maskStart.toFixed(1)}–{p.maskEnd.toFixed(1)}s</span>}
            <button onClick={() => sf('inpaintEnabled', !p.inpaintEnabled)}
              className={`mono-tag cursor-pointer shrink-0 ${p.inpaintEnabled ? 'bg-purple-600/30 text-purple-200 border-purple-500/50' : ''}`}>
              {p.inpaintEnabled ? 'ON' : 'OFF'}
            </button>
            {p.inpaintAudioFile ? (
              <button className="btn-ghost cursor-pointer shrink-0" onClick={() => patch({ inpaintAudioFile: null, inpaintEnabled: false, maskStart: 0, maskEnd: 0 })}><X className="w-3 h-3" /></button>
            ) : (
              <button className="btn-ghost cursor-pointer text-[9px] shrink-0" onClick={() => inpaintRef.current?.click()}>LOAD</button>
            )}
            <input ref={inpaintRef} type="file" accept="audio/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) patch({ inpaintAudioFile: e.target.files[0], inpaintEnabled: true, maskStart: 0, maskEnd: 0 }); e.target.value = ''; }} />
          </div>
          <div className="flex-1 min-h-0 rounded overflow-hidden border border-white/5 bg-black/40">
            {inpaintAudioUrl ? <WaveformPreview audioUrl={inpaintAudioUrl} height={88} enableRegions regionStart={p.maskStart} regionEnd={p.maskEnd} onRegionChange={(s, e) => patch({ maskStart: s, maskEnd: e })} />
              : <div className="h-full flex items-center justify-center"><span className="text-[9px] text-zinc-600">No inpaint audio</span></div>}
          </div>
        </div>
      </div>

      {/* ═══ UPPER: left rail | chimera area | output rail ═══ */}
      <div className="flex-1 min-h-0 grid gap-1.5" style={{ gridTemplateColumns: '190px minmax(0,1fr) 190px' }}>

        {/* ── LEFT RAIL: Presets · Controls · Templates (GENERATE lives in footer CREATE) ── */}
        <div className="flex flex-col gap-1.5 min-h-0">
          {/* Presets — moved here, above Controls */}
          <div className="relative shrink-0">
            <button onClick={() => setPresetsOpen(!presetsOpen)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-purple-500/15 hover:border-purple-500/30 text-zinc-300 hover:text-white transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Presets</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${presetsOpen ? 'rotate-180' : ''}`} />
            </button>
            {presetsOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-full max-h-80 overflow-y-auto rounded border border-white/10 bg-[#0c0a12] shadow-2xl">
                {GENERATION_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => applyPreset(preset)}
                    className="w-full text-left px-3 py-2 hover:bg-purple-500/15 border-b border-white/5 last:border-0 transition-colors group">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: preset.color }} />
                      <span className="text-[11px] font-bold text-zinc-200 group-hover:text-white">{preset.name}</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-0.5 leading-tight pl-4">{preset.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="hardware-card flex flex-col shrink-0">
            <span className={`${sectionTitle} mb-1.5`}>CONTROLS</span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-300 w-16 shrink-0">Model</span>
                <select className="compact-input flex-1" value={p.model} onChange={(e) => {
                  const m = e.target.value; const isRf = m.endsWith('-rf'); const isMagenta = m.startsWith('magenta-');
                  patch({ model: m, steps: isMagenta ? 1 : isRf ? 50 : 8, cfg: isMagenta ? 1.0 : isRf ? 7.0 : 1.0 });
                }} style={{ colorScheme: 'dark' }}>
                  <option value="small">Small (ARC)</option>
                  <option value="medium">Medium (ARC)</option>
                  <option value="small-rf">Small-RF</option>
                  <option value="medium-rf">Medium-RF</option>
                  {p.magentaAvailable && <option value="magenta-small">Magenta RT2 (text→music)</option>}
                  <option value="suno">Suno (Cloud)</option>
                </select>
              </div>
              <SlideRow label="Length (s)" value={p.duration} onChange={(v) => sf('duration', v)} min={0.5} max={512} step={0.5} tipKey="duration" />
              <SlideRow label="Steps" value={p.steps} onChange={(v) => sf('steps', v)} min={1} max={500} step={1} tipKey="steps" />
              <SlideRow label="CFG" value={p.cfg} onChange={(v) => sf('cfg', v)} min={0} max={25} step={0.1} tipKey="cfg" />
              <SlideRow label="Seed" value={p.seed} onChange={(v) => sf('seed', v)} min={-1} max={2147483647} step={1} tipKey="seed"
                onRandomize={() => sf('seed', Math.floor(Math.random() * 2147483647))} />
              {/* Batch — value field aligned (flush right) with the SlideRows above */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-300 w-16 shrink-0 whitespace-nowrap">Batch</span>
                <div className="flex-1 min-w-0" />
                <input type="number" className="compact-input w-11 text-center tabular-nums shrink-0" min={1} max={16} step={1} value={p.batch} onChange={(e) => sf('batch', +e.target.value || 1)} />
              </div>
            </div>
          </div>

          {/* Templates — fills the rail's lower region */}
          <div className="flex-1 min-h-0"><TemplatesPanel /></div>
        </div>

        {/* ── CHIMERA AREA ── */}
        <div className="hardware-card flex flex-col min-h-0 gap-1.5">
          {/* tabs — centered + wider */}
          <div className="relative flex items-center justify-center gap-2 shrink-0">
            <button onClick={() => setHeroTab('chimera')} className={tabBtn(heroTab === 'chimera')}>
              <Layers className="w-3 h-3" /> Chimera
            </button>
            <button onClick={() => lastAudioUrl && setHeroTab('compare')} disabled={!lastAudioUrl}
              className={`${tabBtn(heroTab === 'compare')} disabled:opacity-30 disabled:cursor-not-allowed`}>
              <AudioWaveform className="w-3 h-3" /> Compare
            </button>
            {heroTab === 'compare' && (
              <button onClick={() => setCmpOverlay((v) => !v)}
                className={`absolute right-0 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${cmpOverlay ? 'bg-purple-600/25 text-purple-200 border border-purple-500/40' : 'text-zinc-500 hover:text-zinc-300 border border-white/10'}`}>
                {cmpOverlay ? 'Overlay' : 'Stacked'}
              </button>
            )}
          </div>

          {/* CHIMERA tab */}
          {heroTab === 'chimera' && (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5">
              {/* Renderweave / latent visual strip */}
              <div className="shrink-0 h-12 rounded-lg border border-purple-500/20 overflow-hidden relative bg-linear-to-r from-purple-900/30 via-fuchsia-900/15 to-cyan-900/25 flex items-center justify-center">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.5),transparent_60%),radial-gradient(circle_at_75%_50%,rgba(34,211,238,0.4),transparent_55%)]" />
                <div className="relative flex items-center gap-2 text-purple-200/80">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Renderweave · Latent</span>
                </div>
              </div>

              {/* SAMPLER(+TEMP) | chimera STACK (~prompt width) | SCHEDULE(+FX) */}
              <div className="flex-1 min-h-0 grid gap-1.5" style={{ gridTemplateColumns: 'minmax(0,1fr) 600px minmax(0,1fr)' }}>

                {/* SAMPLER column — TEMP knobs ride above the faders */}
                <div className={`${colBox} p-2 flex flex-col gap-1 min-h-0`}>
                  <span className={subTitle}>TEMP</span>
                  <div className="grid grid-cols-3 gap-1 place-items-center shrink-0">
                    <SlideKnob label="Init nz" value={p.initNoise} onChange={(v) => sf('initNoise', v)} min={0} max={1} tipKey="initNoise" size={32} />
                    <SlideKnob label="CFG min" value={p.cfgIntervalMin} onChange={(v) => sf('cfgIntervalMin', v)} min={0} max={1} tipKey="cfgIntervalMin" size={32} />
                    <SlideKnob label="CFG max" value={p.cfgIntervalMax} onChange={(v) => sf('cfgIntervalMax', v)} min={0} max={1} tipKey="cfgIntervalMax" size={32} />
                  </div>
                  <div className="border-t border-white/8 mt-0.5 pt-1 flex items-center gap-1.5 shrink-0">
                    <span className={`${subTitle} shrink-0`}>SAMPLER</span>
                    <select className="compact-input flex-1 h-6 py-0 text-[9px]" value={p.samplerType} onChange={(e) => sf('samplerType', e.target.value)} style={{ colorScheme: 'dark' }}>
                      <option value="pingpong">pingpong</option><option value="euler">euler</option>
                      <option value="rk4">rk4</option><option value="dpmpp">dpmpp</option>
                    </select>
                  </div>
                  <div className="flex-1 min-h-0 grid grid-cols-4 gap-0.5 mb-3">
                    <SlideFader label="Sigma" value={p.sigmaMax} onChange={(v) => sf('sigmaMax', v)} min={0} max={1} tipKey="sigmaMax" />
                    <SlideFader label="DurPad" value={p.durationPaddingSec} onChange={(v) => sf('durationPaddingSec', v)} min={0} max={30} step={0.1} tipKey="durationPadding" />
                    <SlideFader label="APG" value={p.apgScale} onChange={(v) => sf('apgScale', v)} min={0} max={1} tipKey="apg" />
                    <SlideFader label="Rescale" value={p.cfgRescale} onChange={(v) => sf('cfgRescale', v)} min={0} max={1} tipKey="cfgRescale" />
                  </div>
                </div>

                {/* CENTER — chimera stack, full height */}
                <div className="rounded-lg bg-black/20 border border-(--surface-divider) p-2 min-h-0 overflow-y-auto" data-chimera-anchor="init-audio">
                  <ChimeraStack />
                </div>

                {/* SCHEDULE column — FX thin rows ride above the faders */}
                <div className={`${colBox} p-2 flex flex-col gap-1 min-h-0`}>
                  <span className={subTitle}>FX</span>
                  <div className="flex items-start justify-around gap-1 shrink-0">
                    <SlideKnob label="Norm thr" value={p.cfgNormThreshold} onChange={(v) => sf('cfgNormThreshold', v)} min={0} max={100} step={0.1} tipKey="cfgNormThreshold" size={46} centerReadout />
                    <RoundToggle label="Cut" icon={Scissors} on={p.cutToDuration} onChange={(v) => sf('cutToDuration', v)} />
                    <RoundToggle label="Play" icon={Play} on={p.autoplay} onChange={(v) => sf('autoplay', v)} />
                    <RoundToggle label="DL" icon={Download} on={p.autoDownload} onChange={(v) => sf('autoDownload', v)} />
                  </div>
                  <div className="border-t border-white/8 mt-0.5 pt-1 flex items-center gap-1.5 shrink-0">
                    <span className={`${subTitle} shrink-0`}>SHIFT</span>
                    <div className="grid grid-cols-4 gap-0.5 flex-1">
                      {SHIFT_MODES.map((m) => (
                        <button key={m} onClick={() => sf('shiftMode', m)}
                          className={`px-0.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wide transition-colors ${p.shiftMode === m ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40' : 'text-zinc-500 hover:text-zinc-300 border border-white/10'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 grid grid-cols-4 gap-0.5 mb-3">
                    {shiftFaders()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COMPARE tab — fills the whole area */}
          {heroTab === 'compare' && (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-1 flex-wrap shrink-0">
                {([
                  { k: 'output', label: 'Output WF', on: !!lastAudioUrl },
                  { k: 'init', label: 'Init WF', on: !!initAudioUrl },
                  { k: 'mel', label: 'Mel', on: true },
                  { k: 'stft', label: 'STFT', on: true },
                  { k: 'chromagram', label: 'Chroma', on: true },
                  { k: 'cqt', label: 'CQT', on: true },
                ] as const).map(({ k, label, on }) => (
                  <button key={k} disabled={!on} onClick={() => toggleLayer(k)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${cmpLayers.has(k) ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
                    {label}
                  </button>
                ))}
                {specLoading && <span className="text-[8px] text-zinc-600 ml-1 animate-pulse font-mono">analyzing…</span>}
              </div>
              {lastAudioUrl && <div className="shrink-0"><FullAudioPlayer /></div>}
              <div className={`flex-1 min-h-0 ${cmpOverlay ? 'relative' : 'flex flex-col gap-1.5 overflow-y-auto'}`}>
                {cmpLayers.has('output') && lastAudioUrl && (
                  <div className={cmpOverlay ? 'absolute inset-0' : 'h-28 shrink-0'}>
                    <div className="h-full rounded overflow-hidden border border-white/5 bg-black/40">
                      <FooterScrubWave src={lastAudioUrl} height={cmpOverlay ? 220 : 108} />
                    </div>
                  </div>
                )}
                {cmpLayers.has('init') && initAudioUrl && (
                  <div className={cmpOverlay ? 'absolute inset-0 opacity-50 mix-blend-screen pointer-events-none' : 'h-28 shrink-0'}>
                    <div className="h-full rounded overflow-hidden border border-cyan-500/20 bg-black/20">
                      <WaveformPreview audioUrl={initAudioUrl} height={cmpOverlay ? 220 : 108} />
                    </div>
                  </div>
                )}
                {(['mel', 'stft', 'chromagram', 'cqt'] as const).filter((t) => cmpLayers.has(t)).map((t, i) => (
                  <div key={t} className={cmpOverlay ? `absolute inset-0 ${i > 0 || cmpLayers.has('output') || cmpLayers.has('init') ? 'opacity-60 mix-blend-screen' : ''} pointer-events-none` : 'flex-1 min-h-28'}>
                    <div className="h-full rounded overflow-hidden border border-white/5 bg-black/60 flex items-center justify-center">
                      {spectrograms && spectrograms[t] ? (
                        <img src={`data:image/png;base64,${spectrograms[t]}`} alt={`${t} spectrogram`} className="w-full h-full object-fill" />
                      ) : (
                        <span className="text-[9px] text-zinc-600 font-mono">{specLoading ? 'generating…' : 'unavailable'}</span>
                      )}
                    </div>
                  </div>
                ))}
                {cmpLayers.size === 0 && (
                  <div className="h-full flex items-center justify-center"><span className="text-[10px] text-zinc-600">Select layers to inspect</span></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── OUTPUT RAIL: LoRA · Output · Quick Actions ── */}
        <div className="flex flex-col gap-1.5 min-h-0 overflow-y-auto">
            {/* LoRA — PRESETS-style dropdown; expands to show added LoRAs */}
            <div className="relative shrink-0">
              <button onClick={() => setLorasOpen(!lorasOpen)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-purple-500/15 hover:border-purple-500/30 text-zinc-300 hover:text-white transition-colors">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">LoRA{p.loras.length ? ` (${p.loras.length})` : ''}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${lorasOpen ? 'rotate-180' : ''}`} />
              </button>
              {lorasOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full max-h-64 overflow-y-auto rounded border border-white/10 bg-[#0c0a12] shadow-2xl p-1.5 flex flex-col gap-1">
                  <button
                    className="flex items-center justify-center gap-1 px-2 py-1 rounded border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-[10px] font-bold uppercase tracking-wider text-purple-200 cursor-pointer"
                    onClick={() => sf('loras', [...p.loras, { name: '', weight: 1.0, file: null }])}>
                    <Plus className="w-3 h-3" /> Add LoRA
                  </button>
                  {p.loras.length === 0 ? (
                    <span className="text-[9px] text-zinc-600 font-mono text-center py-1">No LoRAs added</span>
                  ) : p.loras.map((lora, i) => (
                    <div key={i} className="flex items-center gap-1 bg-purple-500/5 rounded px-1.5 py-1 border border-purple-500/10">
                      {lora.file ? (
                        <span className="text-[9px] text-purple-200 flex-1 truncate" title={lora.file.name}>{lora.file.name}</span>
                      ) : (
                        <button className="btn-ghost cursor-pointer text-[9px] flex-1 text-left" onClick={() => {
                          const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.safetensors,.pt,.bin';
                          inp.onchange = () => { if (inp.files?.[0]) { const u = p.loras.map((l, idx) => idx === i ? { ...l, file: inp.files![0], name: inp.files![0].name } : l); sf('loras', u); } };
                          inp.click();
                        }}>Choose file…</button>
                      )}
                      <input type="number" className="compact-input w-10 text-center text-[9px]" value={lora.weight} step={0.05} min={0} max={2}
                        onChange={(e) => { const u = p.loras.map((l, idx) => idx === i ? { ...l, weight: +e.target.value } : l); sf('loras', u); }} />
                      <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => sf('loras', p.loras.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NAME — name your outputs (below LoRA) */}
            <div className="hardware-card flex flex-col shrink-0 gap-1">
              <span className={`${sectionTitle} flex items-center gap-1`}>NAME</span>
              <input className="compact-input w-full" placeholder="name your output…" maxLength={80}
                value={p.outputName} onChange={(e) => sf('outputName', e.target.value)} />
            </div>

            {/* Output settings */}
            <div className="hardware-card flex flex-col shrink-0">
              <span className={`${sectionTitle} mb-1.5`}>OUTPUT</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-300 flex items-center gap-1">Format <InfoTip {...RICH_TOOLTIPS.outputFormat} /></label>
                  <select className="compact-input w-full mt-0.5" value={p.fileFormat} onChange={(e) => sf('fileFormat', e.target.value)} style={{ colorScheme: 'dark' }}>
                    <option value="wav">WAV</option><option value="flac">FLAC</option><option value="ogg">OGG</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-300 flex items-center gap-1">Naming <InfoTip {...RICH_TOOLTIPS.fileNaming} /></label>
                  <select className="compact-input w-full mt-0.5" value={p.fileNaming} onChange={(e) => sf('fileNaming', e.target.value)} style={{ colorScheme: 'dark' }}>
                    <option value="verbose">Verbose</option><option value="prompt">Prompt</option><option value="seed">Seed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="hardware-card flex flex-col shrink-0">
              <span className={`${sectionTitle} mb-1.5`}>QUICK ACTIONS</span>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { label: 'DAW', icon: LayoutList, target: 'daw' as QuickTarget, desc: 'Send to timeline as new track' },
                  { label: 'Init', icon: Mic2, target: 'init' as QuickTarget, desc: 'Load into Init Audio' },
                  { label: 'Inpaint', icon: Scissors, target: 'inpaint' as QuickTarget, desc: 'Load into Inpainting' },
                  { label: 'Effects', icon: Sliders, target: 'effects' as QuickTarget, desc: 'Send to Effects tab' },
                ] as const).map(({ label, icon: Icon, target, desc }) => (
                  <button key={label} disabled={!lastAudioUrl} onClick={() => handleQuickAction(target)} title={desc}
                    className={`group flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all ${lastAudioUrl ? 'border-purple-900/40 bg-purple-950/20 hover:bg-purple-900/30 hover:border-purple-700/50 cursor-pointer' : 'border-white/5 bg-white/3 opacity-60 cursor-not-allowed'}`}>
                    <Icon className={`w-3.5 h-3.5 ${lastAudioUrl ? 'text-purple-400' : 'text-zinc-400'}`} />
                    <span className={`text-[10px] font-semibold ${lastAudioUrl ? 'text-zinc-300' : 'text-zinc-400'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
        </div>
      </div>

      {/* ═══ BOTTOM: edge-to-edge visualizers flanking the prompt ═══ */}
      <div className="shrink-0 grid gap-1.5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,560px) minmax(0,1fr)', height: 196 }}>
        {/* VIZ LEFT */}
        <VisualizerPanel initialMode="orb" audioNode={masterAudio} className="border border-(--surface-divider)" />

        {/* PROMPT */}
        <div className="hardware-card flex flex-col gap-1.5 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <span className={`${sectionTitle} flex items-center gap-1`}>PROMPT <InfoTip {...RICH_TOOLTIPS.prompt} /></span>
            <div className="flex items-center gap-1">
              <SavedPromptsDropdown type="positive" value={p.prompt} onChange={(v) => sf('prompt', v)} />
              <button
                onClick={async () => {
                  if (enhancingPositive || !p.prompt.trim()) return;
                  setEnhancingPositive(true);
                  try { const r = await enhanceStableAudioPrompt({ target: 'positive', positivePrompt: p.prompt, negativePrompt: p.negativePrompt }); if (r) sf('prompt', r); }
                  catch { /* non-fatal */ } finally { setEnhancingPositive(false); }
                }}
                disabled={enhancingPositive || !p.prompt.trim()}
                className="p-1 rounded hover:bg-purple-500/20 text-zinc-500 hover:text-purple-300 transition-colors disabled:opacity-30"
                title="AI-enhance prompt">
                {enhancingPositive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <textarea className="compact-input w-full resize-none h-full"
              placeholder="120 BPM house loop, deep sub bass, crispy hi-hats, minimal percussion…"
              value={p.prompt} onChange={(e) => sf('prompt', e.target.value)} maxLength={1000} />
            <span className="absolute bottom-1 right-2 text-[9px] text-zinc-500">{p.prompt.length}/1000</span>
          </div>
          <div className="relative shrink-0">
            <textarea className="compact-input w-full resize-none h-9"
              placeholder="negative: vocals, distortion, harshness…"
              value={p.negativePrompt} onChange={(e) => sf('negativePrompt', e.target.value)} maxLength={500} />
            <div className="absolute top-1 right-2 flex items-center gap-1">
              <SavedPromptsDropdown type="negative" value={p.negativePrompt} onChange={(v) => sf('negativePrompt', v)} />
              <button
                onClick={async () => {
                  if (enhancingNegative || !p.negativePrompt.trim()) return;
                  setEnhancingNegative(true);
                  try { const r = await enhanceStableAudioPrompt({ target: 'negative', positivePrompt: p.prompt, negativePrompt: p.negativePrompt }); if (r) sf('negativePrompt', r); }
                  catch { /* non-fatal */ } finally { setEnhancingNegative(false); }
                }}
                disabled={enhancingNegative || !p.negativePrompt.trim()}
                className="p-1 rounded hover:bg-purple-500/20 text-zinc-500 hover:text-purple-300 transition-colors disabled:opacity-30"
                title="AI-enhance negative prompt">
                {enhancingNegative ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* VIZ RIGHT — flipped + icons on the left so it mirrors the left panel */}
        <VisualizerPanel initialMode="orb" flipX iconsSide="left" audioNode={masterAudio} className="border border-(--surface-divider)" />
      </div>
    </div>
  );
};
