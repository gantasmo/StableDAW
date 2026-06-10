// theDAW launch-video capture — ONE warm session, built around ONE song.
//
// Boots the app ONCE in a single headed (real-GPU) page, loads "Et Tu Machina"
// (the hero song — imported, stem-separated, and MIDI-converted ahead of time),
// then clicks + drives the Zustand stores tab-by-tab through every scene while
// recording one continuous video. Each scene's stable hold is timestamped, and
// the long recording is sliced into per-scene clips afterward.
//
// Why one session: spawning a fresh context per shot re-runs the boot splash and
// congests the single-worker backend (the splash then bleeds into the clip). With
// the app already loaded and isBackendReady already true, switching tabs via the
// store never re-raises the splash — including the TRAIN tab, which always splashed
// under cold per-shot capture.
//
// Run from frontend/:  node _capture_clips.mjs        (all scenes)
//                      ONLY=20_train,02_dj-console node _capture_clips.mjs
// Output: showcase/clips-recorded/<id>_h.mp4  (+ the raw session webm, kept for re-slicing)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const APP = 'http://localhost:5173';
const ROOT = path.resolve(process.cwd(), '..');
const OUT = path.resolve(ROOT, 'showcase', 'clips-recorded');
fs.mkdirSync(OUT, { recursive: true });

// "Et Tu Machina" — the song the whole film is built around. Imported to the
// library, separated into 4 stems, and converted to MIDI before capture, so the
// EDIT timeline, MIX source, DJ deck, and piano roll all carry the same track.
const HERO = {
  heroUrl: '/api/library/audio/68006988e370427d9108e5c5d724a9f5',
  heroLabel: 'Et Tu Machina',
  heroId: '68006988e370427d9108e5c5d724a9f5',
};
const DECK_B = { url: '/api/library/audio/81a3d137-2b6f-44fe-9e49-0f540d6ec3fc_00', label: 'Deck B' };
const STEM_BASE = '68006988e370427d9108e5c5d724a9f5';
const STEMS = ['drums', 'bass', 'vocals', 'other'].map((n) => ({
  name: n, url: `/api/library/stems/${STEM_BASE}__${n}/audio`,
}));
// Et Tu Machina's MIDI, windowed to a clean 64-step piano-roll pattern (see _make_pianoroll.py).
let ETU_PIANO = { bpm: 120, totalSteps: 64, notes: [] };
try { ETU_PIANO = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'showcase', '_etu_pianoroll.json'), 'utf8')); } catch (e) {}
// The Magenta RT2 NVIDIA port — its standalone Studio UI + a repo/readme card (both static, file://).
const fileUrl = (p) => 'file:///' + path.resolve(ROOT, p).replace(/\\/g, '/');
const MAGENTA_STUDIO = fileUrl('sidecars/magenta-rt2-nvidia/port/oneclick/studio/index.html');
const MAGENTA_CARD = fileUrl('showcase/_magenta_card.html');

// Full coverage: every tab + every feature, with Et Tu Machina present throughout so
// the film reads as one song being made. Bottom-panel features are MAXIMIZED so the
// feature fills the work area; the library is collapsed unless the scene is the
// catalogue itself. Lineage goes fullscreen. Order groups by tab so the warm page
// transitions cleanly. nav-scenes (file://) navigate away and run strictly LAST.
const SCENES = [
  // ── MAKE: generation + every sub-feature ──
  { id: '08_make',           tab: 'make',  play: true,  hold: 6 },
  { id: '23_chimera',        tab: 'make',  play: false, chimeraBuild: true, hold: 6 },
  { id: '21_inpaint',        tab: 'make',  play: false, inpaint: true, hold: 6 },
  { id: '25_init-audio',     tab: 'make',  play: false, initAudio: true, hold: 6 },
  { id: '27_lora',           tab: 'make',  play: false, lora: true, hold: 6 },
  { id: '30_compare',        tab: 'make',  play: false, compare: true, hold: 6 },
  { id: '45_saved-prompts',  tab: 'make',  play: false, savedPrompts: true, hold: 6 },
  { id: '58_spectrogram',    tab: 'make',  play: true,  spectro: true, hold: 14 },
  // ── cymatics + ferrofluid: ONE long fullscreen shot cycling all 4 modes ──
  { id: '50_cymatics', tab: 'make', play: true, vizCycle: true, vizFull: true, hold: 26 },
  // ── EDIT: the multitrack arrangement in depth (chopped / faded / staggered / mixed sources) ──
  { id: '03_edit-stems',     tab: 'edit',  play: true,  buildStems: true, hold: 6 },
  { id: '31_edit-mix',       tab: 'edit',  play: true,  buildStems: true, editMix: true, hold: 6 },
  { id: '22_cut-edit',       tab: 'edit',  play: false, buildStems: true, cutEdit: true, hold: 6 },
  { id: '40_inpaint-region', tab: 'edit',  play: false, buildStems: true, inpaintRegion: true, hold: 6 },
  { id: '41_delete-clip',    tab: 'edit',  play: false, buildStems: true, deleteClip: true, hold: 6 },
  { id: '59_commit-edit',    tab: 'edit',  play: false, buildStems: true, commitEdit: true, hold: 7 },
  // ── MIX: effects browser + populated chain + EVERY effect on the real clip + the UI editor ──
  { id: '07_mix-effects',    tab: 'mix',   play: true,  studioSource: true, hold: 6 },
  { id: '32_mix-chain',      tab: 'mix',   play: true,  studioSource: true, mixChain: true, hold: 6 },
  { id: '57_mix-all-effects',tab: 'mix',   play: true,  studioSource: true, mixAll: true, hold: 13 },
  { id: '39_design-mode',    tab: 'mix',   play: false, studioSource: true, designMode: true, designDrag: true, hold: 9 },
  // ── DJ: console + performance (cue/loop/slip/fx) + automix + live stems + sampler ──
  { id: '02_dj-console',     tab: 'dj',    play: true,  djDecks: true, levelAnim: true, hold: 7 },
  { id: '54_dj-perform',     tab: 'dj',    play: true,  djDecks: true, djPerf: true, hold: 12 },
  { id: '55_dj-automix',     tab: 'dj',    play: true,  djDecks: true, djAutomix: true, hold: 11 },
  { id: '56_dj-stems',       tab: 'dj',    play: true,  djDecks: true, djStems: true, hold: 9 },
  { id: '33_dj-sampler',     tab: 'dj',    play: true,  djDecks: true, djSampler: true, hold: 6 },
  // ── VJ / TRAIN ──
  { id: '19_vj-visualizer',  tab: 'vj',    play: true,  vjClip: true, vjTour: true, hold: 12 },
  { id: '20_train',          tab: 'train', play: false, hold: 6 },
  // ── LEARN: 2D click-a-node, 3D fly-around, per-track lineage ──
  { id: '01a_learn-2d-hero', tab: 'learn', play: false, learn: '2d', lineageFull: true, lineageHover: true, hold: 48 },
  { id: '01b_learn-3d-hero', tab: 'learn', play: false, learn: '3d', lineageFull: true, flyAround: true, hold: 13 },
  { id: '48_galaxy-preset',  tab: 'learn', play: false, learn: '3d', lineageFull: true, vizPreset: 'constellation', flyAround: true, hold: 11 },
  // ── bottom-panel features, each MAXIMIZED into a fullscreen hero ──
  { id: '04_visualize',      tab: 'make',  play: true,  bottomTab: 'spectral',   maximizePanel: true, hold: 6 },
  { id: '15_analyzer-scope', tab: 'make',  play: true,  bottomTab: 'spectral',   maximizePanel: true, modeBtn: 'Oscilloscope', hold: 6 },
  { id: '16_analyzer-radial',tab: 'make',  play: true,  bottomTab: 'spectral',   maximizePanel: true, modeBtn: 'Radial', hold: 6 },
  { id: '05_sequencer',      tab: 'make',  play: false, bottomTab: 'step-seq',   maximizePanel: true, seqFill: true, hold: 7 },
  { id: '06_piano-roll',     tab: 'make',  play: false, bottomTab: 'piano-roll', maximizePanel: true, pianoFill: true, sendToEditor: true, hold: 7 },
  { id: '12_slide-surface',  tab: 'make',  play: true,  bottomTab: 'slide',      maximizePanel: true, dragFader: true, hold: 7 },
  { id: '24_focus',          tab: 'make',  play: true,  bottomTab: 'slide',      maximizePanel: true, slideView: 'focus', hold: 6 },
  { id: '17_controller',     tab: 'make',  play: false, bottomTab: 'slide',      maximizePanel: true, slideView: 'controller', hold: 6 },
  { id: '18_media-bucket',   tab: 'make',  play: false, bottomTab: 'bucket',     maximizePanel: true, fillBucket: true, hold: 6 },
  { id: '44_url-import',     tab: 'make',  play: false, bottomTab: 'bucket',     maximizePanel: true, fillBucket: true, urlImport: true, hold: 6 },
  { id: '13_details',        tab: 'make',  play: false, bottomTab: 'details',    maximizePanel: true, detailsTrack: true, hold: 6 },
  // ── overlays / cloud / library actions / global chrome ──
  { id: '11_assistant-orb',  tab: 'make',  play: false, openOrb: true, hold: 6 },
  { id: '14_catalogue',      tab: 'make',  play: false, catalogue: true, scrollList: true, hold: 7 },
  { id: '42_lib-actions',    tab: 'make',  play: false, catalogue: true, libContext: true, hold: 6 },
  { id: '43_stems-modal',    tab: 'make',  play: false, catalogue: true, stemsModal: true, hold: 6 },
  { id: '10_suno-cloud',     tab: 'make',  play: false, sunoModel: true, hold: 6 },
  { id: '60_magenta-make',   tab: 'make',  play: false, magentaMake: true, hold: 6 },
  { id: '36_log',            tab: 'make',  play: true,  logPanel: true, hold: 5 },
  { id: '37_docs',           tab: 'make',  play: false, docsModal: true, hold: 6 },
  { id: '38_settings',       tab: 'make',  play: false, settingsModal: true, hold: 6 },
  // ── feature-coverage gap fills (from the showcase doc) ──
  { id: '64_node-inspector',    tab: 'learn', play: false, learn: '2d', lineageFull: true, nodeInspect: true, hold: 8 },
  { id: '66_module-gui',        tab: 'mix',   play: true,  studioSource: true, moduleGui: true, hold: 9 },
  { id: '68_audio-to-midi',     tab: 'make',  play: false, catalogue: true, audioToMidi: true, hold: 7 },
  { id: '67_prompt-enhance',    tab: 'make',  play: false, promptEnhance: true, hold: 6 },
  { id: '70_vj-mobile',         tab: 'vj',    play: true,  vjClip: true, vjMobile: true, hold: 8 },
  { id: '71_dj-midi-learn',     tab: 'dj',    play: true,  djDecks: true, djMidiLearn: true, hold: 7 },
  { id: '69_controller-vision', tab: 'make',  play: false, bottomTab: 'slide', maximizePanel: true, slideView: 'controller', controllerVision: true, hold: 7 },
  // ── nav-scenes (file://) — Magenta RT2 NVIDIA port. MUST stay last (they navigate away). ──
  { id: '63_magenta-studio-live', nav: 'http://localhost:8778', hold: 7 },
  { id: '61_magenta-port-ui', nav: MAGENTA_STUDIO, hold: 7 },
  { id: '62_magenta-card',    nav: MAGENTA_CARD,   hold: 7 },
];

// Capture size / mode / supersample are env-configurable. A HEADED browser caps at the screen
// width (1920 here); HEADLESS can exceed it (true higher-res so 9:16 punch-ins stay sharp).
// DSF supersamples within the size. Fixed mouse coords scale by KX/KY off the 1920x1080 base.
const VW = +(process.env.CAPW || 1920), VH = +(process.env.CAPH || 1080);
const DSF = +(process.env.DSF || 1);
const HEADLESS = process.env.HEADLESS === '1';
const SIZE = { width: VW, height: VH };
const CX = Math.round(VW / 2), CY = Math.round(VH / 2), KX = VW / 1920, KY = VH / 1080;

// Per-scene store driving. Heavy one-time builds (hero/stems/decks/studio/bucket)
// are guarded by window.__cap so they run once across the whole session. Every other
// piece of state is set explicitly each scene so nothing bleeds in from the last one.
async function applyScene(spec) {
  const log = [];
  const imp = (p) => import(p);
  const C = (window.__cap = window.__cap || {});
  const appUi = (await imp('/src/state/appUiStore.ts')).useAppUiStore;
  const lib = (await imp('/src/state/libraryStore.ts')).useLibraryStore;
  const pMod = await imp('/src/state/playerStore.ts');
  const player = pMod.usePlayerStore;
  const edMod = await imp('/src/state/editorStore.ts');
  const editor = edMod.useEditorStore;
  const computePeaks = edMod.computePeaks;
  const bp = (await imp('/src/state/bottomPanelStore.ts')).useBottomPanelStore;

  // ── one-time: library + hero audio (kept playing the whole session) ──
  if (!C.heroLoaded) {
    try { if (lib.getState().entries.length === 0) await lib.getState().load(); } catch (e) { log.push('lib ' + e.message); }
    try { const c = pMod.getEngineCtx && pMod.getEngineCtx(); if (c && c.resume) await c.resume(); } catch (e) {}
    try {
      const blob = await (await fetch(spec.heroUrl)).blob();
      await player.getState().load(blob, { label: spec.heroLabel, entryId: spec.heroId });
      C.heroLoaded = true;
    } catch (e) { log.push('hero ' + e.message); }
  }
  try { if (!player.getState().isPlaying) player.getState().play(); } catch (e) {}

  // ── one-time heavy build: a REAL multitrack arrangement of Et Tu Machina ──
  // Each stem becomes a track, clips are windowed + staggered for arrangement entrances,
  // a couple are chopped, a few carry fades, and a 5th track holds a different source clip,
  // so the timeline reads as a song being arranged rather than 6 bars stacked at t=0.
  if (spec.buildStems && !C.stemsBuilt) {
    const palette = ['#06b6d4', '#f97316', '#ec4899', '#a855f7', '#10b981', '#facc15'];
    // name → [startSec, durationSec, offsetIntoSource] (a meaty mid-song window)
    const plan = { drums: [0, 22, 30], bass: [0, 22, 30], other: [3, 19, 35], vocals: [6, 16, 40] };
    let idx = 0;
    const firstIds = [];
    for (const s of spec.stems) {
      try {
        const blob = await (await fetch(s.url)).blob();
        const { peaks, duration } = await computePeaks(blob, 240);
        const [st, dur, off] = plan[s.name] || [idx * 2, 18, 30];
        const tracks = editor.getState().tracks;
        let trackId;
        if (idx === 0 && tracks.length && editor.getState().clips.filter((c) => c.trackId === tracks[0].id).length === 0) trackId = tracks[0].id;
        else trackId = editor.getState().addTrack({ name: s.name, color: palette[idx % palette.length] });
        editor.getState().updateTrack(trackId, { name: s.name });
        const clipId = editor.getState().addClipToTrack({
          trackId, label: s.name, audioBlob: blob, mimeType: 'audio/wav',
          sourceDuration: duration, offsetIntoSource: Math.min(off, Math.max(0, duration - dur - 1)),
          durationSec: Math.min(dur, duration), startSec: st, color: palette[idx % palette.length],
        });
        editor.getState().cachePeaks(clipId, peaks);
        firstIds.push(clipId);
      } catch (e) { log.push('stem ' + s.name + ' ' + e.message); }
      idx++;
    }
    // a 5th track with a DIFFERENT source (an imported clip) for source variety
    try {
      const b2 = await (await fetch(spec.deckB.url)).blob();
      const { peaks, duration } = await computePeaks(b2, 240);
      const tId = editor.getState().addTrack({ name: 'import', color: palette[4] });
      const cId = editor.getState().addClipToTrack({
        trackId: tId, label: 'import', audioBlob: b2, mimeType: 'audio/wav',
        sourceDuration: duration, offsetIntoSource: Math.min(20, Math.max(0, duration - 13)),
        durationSec: Math.min(12, duration), startSec: 10, color: palette[4],
      });
      editor.getState().cachePeaks(cId, peaks);
      editor.getState().updateClip(cId, { fadeOutSec: 2.0 });
    } catch (e) { log.push('import-track ' + e.message); }
    // chop a couple stems + apply fades so it reads as a worked arrangement
    try {
      if (firstIds[0]) { editor.getState().splitClipAt(firstIds[0], 8); editor.getState().splitClipAt(firstIds[0], 4); editor.getState().updateClip(firstIds[0], { fadeInSec: 0.8 }); }
      if (firstIds[2]) editor.getState().splitClipAt(firstIds[2], 12);
      if (firstIds[3]) editor.getState().updateClip(firstIds[3], { fadeInSec: 1.5 });
    } catch (e) { log.push('arrange ' + e.message); }
    try { editor.getState().setBpm(124); editor.getState().setSnap('1/8'); editor.getState().setZoom(34); editor.getState().setScrollSec(0); } catch (e) {}
    C.stemsBuilt = true;
  }
  if (spec.djDecks && !C.decksLoaded) {
    try {
      const dj = await imp('/src/state/djEngine.ts');
      await dj.loadDeck('A', spec.heroUrl, spec.heroLabel);
      await dj.loadDeck('B', spec.deckB.url, spec.deckB.label);
      for (const fn of ['play', 'playDeck', 'startDeck', 'togglePlay']) { try { if (typeof dj[fn] === 'function') { dj[fn]('A'); dj[fn]('B'); break; } } catch (e) {} }
      C.decksLoaded = true;
    } catch (e) { log.push('dj ' + e.message); }
  }
  // DJ live stems: ride the separated stems on the deck's per-stem faders (uses the
  // already-separated Et Tu Machina stems — no Demucs job needed at capture time).
  if (spec.djStems && !C.djStemsLoaded) {
    try { const dj = await imp('/src/state/djEngine.ts'); await dj.loadDeckStems('A', spec.stems.map((s) => ({ name: s.name, url: s.url }))); C.djStemsLoaded = true; } catch (e) { log.push('djstems ' + e.message); }
  }
  if (spec.studioSource && !C.studioSet) {
    try {
      const blob = await (await fetch(spec.heroUrl)).blob();
      const f = new File([blob], 'et-tu-machina.wav', { type: 'audio/wav' });
      (await imp('/src/state/studioStore.ts')).useStudioStore.getState().setSourceFile(f);
      // The MIX INPUT field + processChain read the advanced-editor source — set it too so
      // EVERY mix scene shows the imported track's waveform loaded, not an empty stage.
      try { (await imp('/src/state/advancedEditorStore.ts')).useAdvancedEditorSourceStore.getState().setSource(f); } catch (e) {}
      C.studioSet = true;
    } catch (e) { log.push('studio ' + e.message); }
  }
  if (spec.fillBucket && !C.bucketFilled) {
    try { const mb = (await imp('/src/state/mediaBucketStore.ts')).useMediaBucketStore; const b = await (await fetch(spec.heroUrl)).blob(); mb.getState().add(new File([b], 'Et-Tu-Machina.wav', { type: 'audio/wav' })); C.bucketFilled = true; } catch (e) { log.push('bucket ' + e.message); }
  }

  // ── per-scene UI state (fully specified every time) ──
  if (spec.bottomTab) bp.setState({ activeTab: spec.bottomTab, isOpen: true, multiMaximized: !!spec.maximizePanel, multiHeight: Math.max(380, bp.getState().multiHeight || 0) });
  else bp.setState({ isOpen: false, multiMaximized: false });

  try { appUi.getState().setLibraryExpanded(!!spec.catalogue); } catch (e) {}

  try {
    const gp = (await imp('/src/state/generateParamsStore.ts')).useGenerateParamsStore;
    gp.getState().setField('model', spec.sunoModel ? 'suno' : (spec.magentaMake ? 'magenta-small' : 'medium'));
    if (!C.srcFile) { const b = await (await fetch(spec.heroUrl)).blob(); C.srcFile = new File([b], 'et-tu-machina.wav', { type: 'audio/wav' }); }
    if (spec.inpaint) {
      gp.getState().setField('initAudioFile', C.srcFile);
      gp.getState().setField('inpaintAudioFile', C.srcFile);
      gp.getState().setField('inpaintEnabled', true);
    } else if (spec.initAudio) {
      gp.getState().setField('initAudioFile', C.srcFile);
      gp.getState().setField('initAudioEnabled', true);
      gp.getState().setField('inpaintEnabled', false);
    } else {
      gp.getState().setField('inpaintEnabled', false);
    }
    // Build a CHIMERA stack — fold Et Tu Machina + two of its stems into 3 chimera tracks.
    if (spec.chimeraBuild && !C.chimeraBuilt) {
      const srcs = [{ u: spec.heroUrl, l: 'Et Tu Machina' }, { u: spec.stems[0].url, l: 'Drums' }, { u: spec.stems[2].url, l: 'Vocals' }];
      for (const s of srcs) { try { const b = await (await fetch(s.u)).blob(); gp.getState().addChimeraClip({ blob: b, mimeType: 'audio/wav', label: s.l }); } catch (e) { log.push('chimera ' + e.message); } }
      try { gp.getState().setChimeraField('targetBpm', 124); gp.getState().setChimeraField('alignMode', 'weave'); } catch (e) {}
      C.chimeraBuilt = true;
    } else if (!spec.chimeraBuild) {
      try { if (gp.getState().chimera.clips.length) gp.getState().clearChimera(); } catch (e) {}
    }
  } catch (e) {}

  // Spectrogram viewer (COMPARE tab) renders from lastAudioUrl — point it at the song.
  if (spec.spectro) {
    try { const gs = (await imp('/src/state/generateStore.ts')).useGenerateStore; gs.setState({ lastAudioUrl: spec.heroUrl }); } catch (e) { log.push('spectro ' + e.message); }
  }

  // EDIT mixing: solo/mute/pan the stems so the per-track faders read as a live mix.
  try {
    if (spec.editMix) {
      const ts = editor.getState().tracks;
      if (ts[0]) editor.getState().updateTrack(ts[0].id, { volume: 0.9, pan: -0.4 });
      if (ts[2]) editor.getState().toggleSolo(ts[2].id);
      if (ts[4]) editor.getState().updateTrack(ts[4].id, { mute: true });
      if (ts[1]) editor.getState().updateTrack(ts[1].id, { pan: 0.5, volume: 0.7 });
    }
  } catch (e) { log.push('editmix ' + e.message); }

  // MIX: stack a real processing chain so the chain column shows live modules.
  try {
    const ec = (await imp('/src/state/effectChainStore.ts')).useEffectChainStore;
    if (spec.mixChain && !C.mixChained) {
      for (const fx of ['mastering_chain', 'reverb_delay', 'sub_exciter', 'stereo_widener', 'compression', 'lofi_vinyl']) ec.getState().addEffect(fx);
      C.mixChained = true;
    } else if (spec.mixAll && !C.mixAllBuilt) {
      // EVERY effect, on the ACTUAL Et Tu Machina clip. The advanced-editor source store
      // is what the MIX INPUT field + processChain() read (studioStore.sourceFile is not).
      try {
        const aes = (await imp('/src/state/advancedEditorStore.ts')).useAdvancedEditorSourceStore;
        aes.getState().setSource(C.srcFile);
      } catch (e) { log.push('mixall-src ' + e.message); }
      ec.getState().clearChain();
      for (const fx of ['mastering_chain', 'compression', 'eq_mid', 'sub_exciter', 'stereo_widener', 'reverb_delay', 'delay', 'echo', 'lofi_vinyl', 'phase_isolation', 'pitch_shift', 'loudnorm', 'vocal_processing', 'highpass']) ec.getState().addEffect(fx);
      C.mixAllBuilt = true;
    } else if (!spec.mixChain && !spec.mixAll) {
      try { if (ec.getState().chain.length) ec.getState().clearChain(); } catch (e) {}
    }
  } catch (e) { log.push('mixchain ' + e.message); }

  // DJ: load the sampler bank + stage tracks in the side list.
  try {
    if (spec.djSampler && !C.djStaged) {
      const samp = (await imp('/src/state/djSamplerStore.ts')).useDjSampler;
      const labels = ['Kick', 'Snare', 'Hat', 'Stab', 'Vox', 'FX'];
      for (let i = 0; i < labels.length; i++) { try { samp.getState().setPad(i, { entryId: spec.heroId, name: labels[i] }); } catch (e) {} }
      try { const sl = (await imp('/src/state/djSideListStore.ts')).useDjSideList; sl.getState().add({ entryId: spec.deckB.url, label: 'Deck B' }); sl.getState().add({ entryId: spec.heroId, label: 'Et Tu Machina' }); } catch (e) {}
      C.djStaged = true;
    }
  } catch (e) { log.push('djsamp ' + e.message); }

  // Global chrome: LOG dock, DOCS modal, SETTINGS modal.
  try { bp.setState({ isLogOpen: !!spec.logPanel }); } catch (e) {}
  try { appUi.getState().setDocsOpen(!!spec.docsModal); } catch (e) {}
  if (spec.settingsModal) { try { window.dispatchEvent(new Event('stabledaw:open-settings')); } catch (e) {} }

  // EDIT cut/razor: switch to the cut tool and make SEVERAL real splits across stems so
  // it reads as a track actively being chopped up.
  try {
    if (spec.cutEdit) {
      editor.getState().setTool('cut');
      if (!C.didCut) {
        const clips = editor.getState().clips.slice();
        const fracs = [0.25, 0.5, 0.7];
        for (let i = 0; i < Math.min(4, clips.length); i++) {
          const c = clips[i];
          const f = fracs[i % fracs.length];
          try { editor.getState().splitClipAt(c.id, c.startSec + c.durationSec * f); } catch (e) {}
        }
        C.didCut = true;
      }
    } else {
      editor.getState().setTool('move');
    }
  } catch (e) { log.push('cut ' + e.message); }

  // PIANO ROLL: load Et Tu Machina's own MIDI (windowed to 64 steps) and start it playing
  // so the grid carries the actual song melody with the playhead moving.
  try {
    if (spec.pianoFill) {
      const piano = (await imp('/src/state/pianoRollStore.ts')).usePianoRollStore;
      const etu = spec.etuPiano;
      if (etu && etu.notes && etu.notes.length) {
        piano.getState().setTotalSteps(etu.totalSteps || 64);
        piano.getState().replaceAll(etu.notes.map((x) => ({ ...x })));
      } else {
        piano.getState().setTotalSteps(64);
        const scale = [60, 62, 63, 65, 67, 68, 70, 72];
        const notes = [];
        for (let step = 0; step < 64; step += 2) {
          const n = scale[(step / 2) % scale.length];
          notes.push({ note: n, step, length: 2, velocity: 80 + (step % 5) * 6 });
          if (step % 4 === 0) notes.push({ note: n - 12, step, length: 4, velocity: 70 });
          if (step % 8 === 0) notes.push({ note: n + 7, step, length: 2, velocity: 64 });
        }
        piano.getState().replaceAll(notes.map((x) => ({ ...x })));
      }
      piano.getState().setPlaying(true);
    }
  } catch (e) { log.push('piano ' + e.message); }

  // EDIT paintbrush INPAINT region + DELETE-from-timeline.
  try {
    if (spec.inpaintRegion) {
      const c = editor.getState().clips[0];
      if (c) { editor.getState().setInpaintSelection({ clipId: c.id, startSec: c.startSec + c.durationSec * 0.3, endSec: c.startSec + c.durationSec * 0.62 }); editor.getState().setSelected(c.id); }
    } else { try { editor.getState().clearInpaintSelection(); } catch (e) {} }
    if (spec.deleteClip && !C.didDelete) {
      const c = editor.getState().clips[0];
      if (c) { const rid = editor.getState().splitClipAt(c.id, c.startSec + c.durationSec * 0.5); if (rid) editor.getState().removeClip(rid); }
      C.didDelete = true;
    }
  } catch (e) { log.push('editops ' + e.message); }

  try {
    const ss = (await imp('/src/state/slideStore.ts')).useSlideStore;
    ss.getState().setView(spec.slideView || 'row');
  } catch (e) {}

  try { lib.getState().setSelectedEntry((spec.detailsTrack || spec.libContext) ? spec.heroId : null); } catch (e) {}

  if (spec.tab) appUi.getState().setCenterTab(spec.tab);
  await new Promise((r) => setTimeout(r, 250));
  return { tracks: editor.getState().tracks.length, clips: editor.getState().clips.length, playing: player.getState().isPlaying, log };
}

const onlyIds = (process.env.ONLY || '').split(',').filter(Boolean);
const VJ_SOURCE = path.join(OUT, '_vjsource.mp4');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByTitle = (page, re) => page.evaluate((src) => { const rx = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.getAttribute('title') || '')); if (b) b.click(); }, re.source).catch(() => {});
const clickByText = (page, re) => page.evaluate((src) => { const rx = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent || '')); if (b) b.click(); }, re.source).catch(() => {});
// A REAL mouse click (transient user activation) on the nth titled button — needed for
// requestFullscreen() on the cymatics panels, which a synthetic .click() can't activate.
async function realClickByTitle(page, re, nth = 0) {
  const box = await page.evaluate(({ s, n }) => {
    const rx = new RegExp(s, 'i');
    const bs = [...document.querySelectorAll('button')].filter((x) => rx.test(x.getAttribute('title') || ''));
    const b = bs[n]; if (!b) return null; const q = b.getBoundingClientRect();
    if (q.width < 1 || q.height < 1) return null;
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, { s: re.source, n: nth }).catch(() => null);
  if (box) { await page.mouse.click(box.x, box.y); return true; }
  return false;
}

const waitSplashGone = (page) => page.waitForFunction(() => {
  // LoadingScreen unmounts (AnimatePresence) once the backend is ready; it is the only
  // overlay carrying the "Stable Audio 3" wordmark. Test DOM PRESENCE, not offsetParent
  // — position:fixed elements always report offsetParent === null, so the old check
  // resolved instantly and the splash bled into the first clip.
  return ![...document.querySelectorAll('.fixed.inset-0')].some((e) => /Stable Audio 3/i.test(e.textContent || ''));
}, { timeout: 45000 }).catch(() => {});

// Per-scene DOM choreography that the stores can't do (graph fullscreen, analyzer
// mode buttons, the assistant orb, the VJ source import). Runs after the view mounts.
async function sceneActions(page, scene) {
  let err = null;
  if (scene.learn === '2d') {
    await clickByText(page, /genealogy/i);
    // Wait for the family-tree to actually finish loading (nodes present), not just a
    // fixed delay — the graph fetch can lag and otherwise we capture "Loading lineage…".
    await page.waitForFunction(() => {
      let n = 0;
      for (const g of document.querySelectorAll('svg g')) { const r = g.getBoundingClientRect(); if (r.width > 0 && r.width < 360 && r.height > 0 && r.height < 280) n++; }
      return n > 20;
    }, { timeout: 18000 }).catch(() => {});
    await sleep(1200);
    if (scene.lineageFull) { await clickByTitle(page, /full screen/i); await sleep(1500); }
    try {
      // The app lights a node's FULL lineage on HOVER (opacity 1 for the lineage, 0.12 for
      // the rest). Probe each node box — hover it, count how many boxes stay bright — to
      // rank nodes by lineage size, then keep the densest handful to hover during the hold.
      const boxes = await page.evaluate(() => {
        const out = [];
        for (const g of document.querySelectorAll('svg g')) {
          const r = g.getBoundingClientRect();
          if (r.width > 40 && r.width < 360 && r.height > 20 && r.height < 280) out.push({ cx: r.x + r.width / 2, cy: r.y + r.height / 2 });
        }
        return out;
      });
      const scored = [];
      for (const b of boxes.slice(0, 90)) {
        await page.mouse.move(b.cx, b.cy); await sleep(60);
        const lit = await page.evaluate(() => { let n = 0; for (const g of document.querySelectorAll('svg g')) { if (parseFloat(getComputedStyle(g).opacity || '1') > 0.5) n++; } return n; });
        scored.push({ b, lit });
      }
      // When hovering, lit-count = the lineage size of that node. Densest = most lit.
      scored.sort((a, b) => b.lit - a.lit);
      const picks = [];
      for (const s of scored) { if (picks.every((p) => Math.hypot(p.cx - s.b.cx, p.cy - s.b.cy) > 36)) picks.push(s.b); if (picks.length >= 40) break; }
      scene._targets = picks;  // densest-first; the hold hovers a long parade of them
      await page.mouse.move(960, 230);
      if (!picks.length) err = '2d:no-nodes';
    } catch (e) { err = '2d:' + e.message; }
  } else if (scene.learn === '3d') {
    await clickByText(page, /3d\s*graph/i);
    if (scene.lineageFull) { await clickByTitle(page, /full screen/i); await sleep(1400); }
    // No search, no refresh — just let the galaxy render; the fly-around happens during
    // the hold (see flyAround3d).
    await page.waitForSelector('#lineage-graph-search', { timeout: 12000 }).catch(() => {});
    await sleep(2200);
  } else if (scene.learn === 'track') {
    // per-track lineage: the Track tab shows the selected entry's ancestors + descendants
    await clickByText(page, /^\s*track\s*$/i); await sleep(1600);
    if (scene.lineageFull) { await clickByTitle(page, /full screen/i); await sleep(1200); }
    await sleep(1500);
  }
  if (scene.lora) { await clickByText(page, /^\s*lora\b/i); await sleep(800); }
  if (scene.compare) { await clickByText(page, /\bcompare\b/i); await sleep(800); }
  if (scene.savedPrompts) { await clickByText(page, /saved\s*\(/i); await sleep(900); }
  if (scene.designMode) { await clickByText(page, /edit layout/i); await sleep(1600); }
  // Cymatics / ferrofluid: enter fullscreen on the orb; the hold cycles all 4 modes.
  if (scene.vizCycle) {
    await realClickByTitle(page, /ferrofluid orb/i, 0);
    await sleep(500);
    if (scene.vizFull) { await realClickByTitle(page, /^fullscreen$/i, 0); await sleep(1300); }
  } else if (scene.vizMode) {
    await realClickByTitle(page, new RegExp(scene.vizMode, 'i'), 0);
    await sleep(600);
    if (scene.vizFull) { await realClickByTitle(page, /^fullscreen$/i, 0); await sleep(1300); }
  }
  // Spectrogram viewer (COMPARE hero-tab): wait for /api/spectrogram, then toggle ON the Mel /
  // STFT / Chroma / CQT layers so the STACK of spectrograms renders (default shows only the WF).
  if (scene.spectro) {
    await clickByText(page, /\bcompare\b/i);
    await sleep(5200);
    for (const m of ['Mel', 'STFT', 'Chroma', 'CQT']) { await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === t); if (b) b.click(); }, m).catch(() => {}); await sleep(250); }
    await sleep(1500);
  }
  // DJ automix: engage the hands-free auto-mixer (the crossfader then travels on its own).
  if (scene.djAutomix) { await clickByText(page, /automix/i); await sleep(900); }
  // Magenta panel (theDAW integrated): select the Magenta RT2 model option if the sidecar surfaced it.
  if (scene.magentaMake) {
    await page.evaluate(() => { const el = [...document.querySelectorAll('button,[role="option"],li,div,span')].find((x) => /magenta\s*rt2/i.test(x.textContent || '') && (x.textContent || '').length < 60); if (el) el.click(); }).catch(() => {});
    await sleep(1000);
  }
  // EDIT commit: name the mixdown and click Commit Edit (offline 44.1k stereo render).
  if (scene.commitEdit) {
    try { await page.evaluate(() => { const i = document.querySelector('#editor-mixdown-name'); if (i) { i.value = 'Et Tu Machina (mixdown)'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); } catch (e) {}
    await clickByText(page, /commit\s*edit/i); await sleep(900);
  }
  // ── feature-coverage gap fills ──
  // Node inspector: click the densest 2D node's actual <g> element → its params + lineage panel.
  if (scene.nodeInspect && scene._targets && scene._targets.length) {
    const t = scene._targets[0];
    await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); const g = el && (el.closest('g') || el); if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y })); }, { x: t.cx, y: t.cy }).catch(() => {});
    await page.mouse.click(t.cx, t.cy);
    await sleep(1600);
  }
  // Edit Tool Stack: open a Studio Module's exact instrument GUI in the MIX effect stage.
  if (scene.moduleGui) {
    await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /studio/i.test(x.textContent || '') && (x.textContent || '').replace(/\s/g, '').length < 12); if (el) el.click(); }).catch(() => {});
    await sleep(800);
    for (const m of ['Imager', 'Maximizer', 'Exciter', 'Character FX', 'EQ']) { const ok = await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => { const s = (x.textContent || '').trim(); return new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(s) && s.length > t.length; }); if (b) { b.click(); return true; } return false; }, m); if (ok) break; }
    await sleep(2400);
  }
  // Audio-to-MIDI: right-click a catalogue track → show the menu with "Convert to MIDI" highlighted.
  if (scene.audioToMidi) {
    try {
      await page.mouse.click(360, 130, { button: 'right' }); await sleep(800);
      const box = await page.evaluate(() => { const b = [...document.querySelectorAll('*')].find((x) => /convert to midi/i.test(x.textContent || '') && x.children.length === 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      if (box) await page.mouse.move(box.x, box.y);
      await sleep(900);
    } catch (e) { err = (err || '') + ' a2m:' + e.message; }
  }
  // Prompt enhancement: type a prompt, hit the AI-enhance (wand) button.
  if (scene.promptEnhance) {
    try { await page.fill('textarea', 'lo-fi boom bap, dusty rhodes chords, vinyl crackle, 84 bpm'); } catch (e) {}
    await sleep(300); await clickByTitle(page, /ai-enhance prompt/i); await sleep(1400);
  }
  // VJ mobile mirror: show the LAN QR + URL popover, then toggle the camera input.
  if (scene.vjMobile) {
    await clickByTitle(page, /mobile url/i); await sleep(1000);
    await clickByTitle(page, /camera (on|off)/i); await sleep(700);
  }
  // DJ MIDI-learn: open the learn overlay and arm a binding.
  if (scene.djMidiLearn) {
    await clickByTitle(page, /^\s*midi\s*$/i); await sleep(800);
    await clickByText(page, /^\s*learn\s*$/i); await sleep(1000);
  }
  // Controller Vision: Set up device → Identify by photo (AI) → the detect/identify modal.
  if (scene.controllerVision) {
    await clickByText(page, /set up device/i); await sleep(700);
    await clickByText(page, /identify by photo/i); await sleep(1300);
  }
  if (scene.urlImport) {
    try { await page.fill('input[placeholder*="YouTube" i]', 'https://www.youtube.com/watch?v=2Vv-BfVoq4g'); } catch (e) { err = (err || '') + ' url:' + e.message; }
    await sleep(700);
  }
  if (scene.stemsModal) {
    // right-click a catalogue row → "Separate stems…" opens the modal (we don't run it)
    try {
      await page.mouse.click(360, 110, { button: 'right' }); await sleep(700);
      await clickByText(page, /separate stems/i); await sleep(1200);
    } catch (e) { err = (err || '') + ' stems:' + e.message; }
  }
  if (scene.vizPreset) {
    // open the 3D appearance drawer and pick a vivid preset (galaxy / constellation …)
    await clickByTitle(page, /appearance/i); await sleep(900);
    await page.evaluate((preset) => {
      const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === preset));
      if (sel) { sel.value = preset; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, scene.vizPreset).catch(() => {});
    await sleep(1500);
  }
  if (scene.modeBtn) {
    await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === t || (x.textContent || '').trim() === t[0]); if (b) b.click(); }, scene.modeBtn).catch(() => {});
    await sleep(700);
  }
  if (scene.openOrb) {
    try { await page.click('[aria-label="Toggle orb panel"]', { timeout: 3500 }); } catch (e) { err = (err || '') + ' orb:' + e.message; }
    try { await page.waitForSelector('input[placeholder="Ask anything..."]', { timeout: 4000 }); await page.fill('input[placeholder="Ask anything..."]', 'lo-fi boom bap, dusty rhodes chords, vinyl crackle, 84 bpm'); } catch (e) {}
    await sleep(700);
  }
  if (scene.seqFill) {
    // fill the step grid (RANDOM), add voices, and start it playing → no empty tracks
    await clickByTitle(page, /add track/i); await sleep(300);
    await clickByTitle(page, /add track/i); await sleep(300);
    await clickByTitle(page, /randomize all step/i); await sleep(400);
    await clickByTitle(page, /^\s*play\s*$/i); await sleep(300);
  }
  if (scene.sendToEditor) { await clickByText(page, /send to editor/i); await sleep(500); }
  if (scene.vjClip) {
    try {
      await clickByText(page, /import video|select.*video|video clip/i); await sleep(1600);
      await clickByText(page, /\bMEM\b/i); await sleep(800);
    } catch (e) { err = (err || '') + ' vj:' + e.message; }
    await sleep(1000);
  }
  return err;
}

// Walk the VJ control surface: cycle canvas formats + toggle every geometry / feedback /
// performance option so the whole rig is shown working, not a static panel.
async function vjTour(page, seconds) {
  const t0 = Date.now();
  const groups = [
    ['16:9', '4:3', '9:16', '1:1', '21:9', 'FREE'],
    ['MIRROR X', 'MIRROR Y', 'KALEIDO', 'SOFT EDGES', 'HDR', 'FB IO'],
    ['RADIAL', 'GRID', 'FEEDBACK', 'STROBE', 'CORRUPT'],
    ['HIGH', 'MED', 'LOW'],
  ];
  let gi = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    const g = groups[gi % groups.length];
    for (const label of g) {
      await page.evaluate((s) => { const rx = new RegExp(s, 'i'); const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent || '')); if (b) b.click(); }, label).catch(() => {});
      await sleep(260);
      if ((Date.now() - t0) / 1000 >= seconds) break;
    }
    gi++;
  }
}

// Full DJ performance workout: fire hotcues, toggle beat loops + a loop-roll, slip,
// beat-jump, and sweep the per-deck FX (flanger / reverb / wah) + EQ + filter so every
// pad and knob on the console is visibly working.
async function djPerf(page, seconds) {
  const t0 = Date.now();
  const clickTitle = (rx) => page.evaluate((s) => { const r = new RegExp(s, 'i'); const b = [...document.querySelectorAll('button')].find((x) => r.test(x.getAttribute('title') || '')); if (b) b.click(); }, rx).catch(() => {});
  const seq = ['cue 1', 'cue 2', '1-beat loop', 'jump \\+1 beat', 'cue 3', '½-beat loop', 'slip mode', 'jump -4 beats', 'cue 4', 'exit loop', '2-beat loop'];
  let i = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    const p = (Date.now() - t0) / 1000;
    await page.evaluate(async (ph) => {
      try {
        const dj = await import('/src/state/djEngine.ts');
        if (dj.setDeckFx) { dj.setDeckFx('A', 'flanger', Math.sin(ph) * 0.5 + 0.5); dj.setDeckFx('A', 'reverb', Math.cos(ph * 0.7) * 0.5 + 0.5); dj.setDeckFx('B', 'wahwah', Math.sin(ph * 1.3) * 0.5 + 0.5); }
        if (dj.setDeckEq) { dj.setDeckEq('A', 'low', Math.sin(ph) * 12); dj.setDeckEq('B', 'high', Math.cos(ph) * 12); }
        if (dj.setDeckFilter) dj.setDeckFilter('A', Math.sin(ph * 0.8) * 0.7);
      } catch (e) {}
    }, p);
    await clickTitle(seq[i % seq.length]);
    i++;
    await sleep(820);
  }
  // loop-roll flourish: press-and-hold a roll pad, then release
  try {
    const box = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /loop-roll/i.test(x.getAttribute('title') || '')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (box) { await page.mouse.move(box.x, box.y); await page.mouse.down(); await sleep(700); await page.mouse.up(); }
  } catch (e) {}
}

// Automix is engaged (sceneActions clicked it); the crossfader auto-travels. Ride a gentle
// EQ/filter sweep so console knobs also move while the auto-transition runs.
async function djAutomix(page, seconds) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < seconds) {
    const p = (Date.now() - t0) / 1000;
    await page.evaluate(async (ph) => { try { const dj = await import('/src/state/djEngine.ts'); if (dj.setDeckEq) { dj.setDeckEq('A', 'mid', Math.sin(ph) * 8); dj.setDeckEq('B', 'low', Math.cos(ph) * 8); } if (dj.setDeckFilter) dj.setDeckFilter('B', Math.sin(ph * 0.6) * 0.5); } catch (e) {} }, p);
    await sleep(160);
  }
}

// Ride the deck's live stem faders (drums/bass/vocals/other) up and down.
async function djStems(page, seconds) {
  const t0 = Date.now();
  const names = ['drums', 'bass', 'vocals', 'other'];
  while ((Date.now() - t0) / 1000 < seconds) {
    const p = (Date.now() - t0) / 1000;
    await page.evaluate(async ({ ph, nm }) => { try { const dj = await import('/src/state/djEngine.ts'); if (dj.setStemGain) nm.forEach((n, i) => dj.setStemGain('A', n, Math.abs(Math.sin(ph * 0.6 + i)))); } catch (e) {} }, { ph: p, nm: names });
    await sleep(150);
  }
}

// MIX: cycle the populated chain — click each chain row (its purple mono label) to open
// that effect's instrument over the loaded Et Tu Machina waveform.
async function mixCycle(page, seconds) {
  const t0 = Date.now();
  const rows = await page.evaluate(() => {
    const out = [];
    for (const s of document.querySelectorAll('span')) {
      const c = (typeof s.className === 'string') ? s.className : '';
      if (/font-mono/.test(c) && /text-purple-300/.test(c) && /font-semibold/.test(c)) {
        const r = s.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      }
    }
    return out;
  }).catch(() => []);
  let i = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    if (rows.length) { await page.mouse.click(rows[i % rows.length].x, rows[i % rows.length].y); }
    i++;
    await sleep(1050);
  }
}

// Undo cross-tab overlays so the next scene is clean (lineage fullscreen unmounts with
// the tab; the assistant orb is global and must be toggled back off; cymatics fullscreen
// must be Escaped).
async function sceneCleanup(page, scene) {
  if (scene.openOrb) { try { await page.click('[aria-label="Toggle orb panel"]', { timeout: 1500 }); } catch (e) {} await sleep(250); }
  if (scene.vizFull) { try { await page.keyboard.press('Escape'); } catch (e) {} await sleep(300); }
  if (scene.settingsModal || scene.docsModal) { try { await page.keyboard.press('Escape'); } catch (e) {} await sleep(250); }
}

// Design Mode (Edit Layout): grab panels / control groups and drag them to new positions so
// the recording shows the INTERFACE BEING REARRANGED, not just the toggle being flipped.
async function designDrag(page, seconds) {
  const t0 = Date.now();
  const click = (rx) => page.evaluate((s) => { const r = new RegExp(s, 'i'); const b = [...document.querySelectorAll('button')].find((x) => r.test(x.getAttribute('title') || '')); if (b) b.click(); }, rx).catch(() => {});
  // The layout-action buttons — each visibly reflows the surface (scaling + padding shift).
  const actions = ['balance the layout', 'mirror the left', 'mirror the right', 'add an empty panel', 'reset to the saved'];
  let i = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    // DRAG A RESIZE EDGE (Splitter handle) — the two neighbouring panels scale + repad live.
    const sp = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[class*="cursor-col-resize"],[class*="cursor-row-resize"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, ax: /col-resize/.test(el.className) ? 'x' : 'y' });
      }
      return out;
    }).catch(() => []);
    if (sp.length) {
      const s = sp[i % sp.length], d = (i % 2 ? 170 : -150);
      await page.mouse.move(s.x, s.y); await page.mouse.down();
      if (s.ax === 'x') { await page.mouse.move(s.x + d, s.y, { steps: 12 }); await page.mouse.move(s.x, s.y, { steps: 10 }); }
      else { await page.mouse.move(s.x, s.y + d, { steps: 12 }); await page.mouse.move(s.x, s.y, { steps: 10 }); }
      await page.mouse.up();
    }
    await sleep(350);
    // PRESS A LAYOUT-ACTION BUTTON (center / mirror / add panel / reset) so its effect is shown.
    await click(actions[i % actions.length]);
    await sleep(750);
    i++;
  }
}

// Cymatics: ONE fullscreen shot that cycles all 4 modes (sceneActions started on the orb +
// fullscreen). Switch mode every ~6s by clicking the panel's mode buttons while still fullscreen.
async function vizCycle(page, seconds) {
  const t0 = Date.now();
  const modes = ['cymatic platform', 'liquid chrome', 'ferrofluid valley'];
  let i = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    await sleep(6000);
    if ((Date.now() - t0) / 1000 >= seconds) break;
    if (i < modes.length) await realClickByTitle(page, new RegExp(modes[i], 'i'), 0);
    i++;
  }
}

// Fly the 3D genealogy galaxy. Mouse-drag orbits (always-on motion) PLUS the spaceship-flight
// keys the app binds — WASD thrust + periodic hold-F FTL hyperspace warp — so the recording
// shows the velocity flight + warp the showcase calls out, not just a slow pan.
async function flyAround3d(page, seconds) {
  const cx = 960, cy = 540;
  const t0 = Date.now();
  await page.mouse.click(cx, cy);   // focus the canvas so the flight keys register
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let i = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    const a = i * 0.22;
    await page.mouse.move(cx + Math.cos(a) * 300, cy + Math.sin(a) * 150, { steps: 10 });
    const k = ['w', 'd', 'w', 'a'][i % 4];
    await page.keyboard.down(k); await sleep(110); await page.keyboard.up(k);
    if (i % 6 === 5) { await page.keyboard.down('f'); await sleep(650); await page.keyboard.up('f'); } // FTL warp
    i++;
  }
  await page.mouse.up();
}

// What happens DURING a scene's hold. Most scenes just sit (audio-reactive meters keep
// moving); the interactive ones drive their controls so the whole rig is shown working.
async function holdAction(page, scene) {
  const secs = scene.hold;
  const t0 = Date.now();
  if (scene.flyAround) return flyAround3d(page, secs);
  if (scene.vjTour) return vjTour(page, secs);
  if (scene.djPerf) return djPerf(page, secs);
  if (scene.djAutomix) return djAutomix(page, secs);
  if (scene.djStems) return djStems(page, secs);
  if (scene.mixAll) return mixCycle(page, secs);
  if (scene.designDrag) return designDrag(page, secs);
  if (scene.vizCycle) return vizCycle(page, secs);
  if (scene.lineageHover) {
    // Walk a long PARADE of nodes, densest-first; each hover lights that node's full
    // ancestry + descendant chain. Cycles the densest ~40 so the big lineages recur.
    const tg = scene._targets || [];
    if (!tg.length) { await sleep(secs * 1000); return; }
    let i = 0;
    while ((Date.now() - t0) / 1000 < secs) {
      const t = tg[i % tg.length];
      await page.mouse.move(t.cx, t.cy, { steps: 4 });
      await sleep(1100);
      i++;
    }
    return;
  }
  if (scene.levelAnim) {
    // Full DJ workout — sweep the crossfader + both decks' EQ / filter / pitch so every
    // knob and fader on the console is visibly moving.
    while ((Date.now() - t0) / 1000 < secs) {
      const p = (Date.now() - t0) / 1000;
      await page.evaluate(async (ph) => {
        try {
          const dj = await import('/src/state/djEngine.ts');
          dj.setCrossfade && dj.setCrossfade(Math.sin(ph * 1.1));
          if (dj.setDeckEq) { dj.setDeckEq('A', 'low', Math.sin(ph) * 12); dj.setDeckEq('A', 'mid', Math.cos(ph * 1.3) * 9); dj.setDeckEq('A', 'high', Math.sin(ph * 0.8) * 12); dj.setDeckEq('B', 'low', Math.cos(ph) * 12); dj.setDeckEq('B', 'high', Math.sin(ph * 1.2) * 12); }
          if (dj.setDeckFilter) { dj.setDeckFilter('A', Math.sin(ph * 0.7) * 0.7); dj.setDeckFilter('B', Math.cos(ph * 0.9) * 0.7); }
          if (dj.setDeckPitch) { dj.setDeckPitch('A', Math.sin(ph) * 6); dj.setDeckPitch('B', Math.cos(ph) * 6); }
        } catch (e) {}
      }, p);
      await sleep(130);
    }
    await page.evaluate(async () => { try { const dj = await import('/src/state/djEngine.ts'); dj.setCrossfade && dj.setCrossfade(0); } catch (e) {} });
    return;
  }
  if (scene.dragFader) {
    // grab the maximised SLIDE capsule faders and ride them up/down
    const xs = [220, 470, 720, 970, 1220, 1470];
    while ((Date.now() - t0) / 1000 < secs) {
      for (const x of xs) {
        await page.mouse.move(x, 560); await page.mouse.down();
        await page.mouse.move(x, 460, { steps: 6 }); await page.mouse.move(x, 660, { steps: 6 }); await page.mouse.move(x, 540, { steps: 4 });
        await page.mouse.up();
        if ((Date.now() - t0) / 1000 >= secs) break;
      }
    }
    return;
  }
  if (scene.scrollList) {
    let down = true;
    await page.mouse.move(960, 400);
    while ((Date.now() - t0) / 1000 < secs) { await page.mouse.wheel(0, down ? 260 : -260); await sleep(380); if (((Date.now() - t0) / 1000) > secs * 0.6) down = false; }
    return;
  }
  await sleep(secs * 1000);
}

const launchArgs = ['--autoplay-policy=no-user-gesture-required'];
if (HEADLESS) launchArgs.push('--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--enable-accelerated-2d-canvas');
else launchArgs.push('--start-maximized');
const browser = await chromium.launch({ headless: HEADLESS, args: launchArgs });
const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: DSF, recordVideo: { dir: OUT, size: SIZE } });
const page = await ctx.newPage();
const tRec = Date.now();       // recording starts at context/page creation → this is video t=0.
                               // (Anchoring AFTER the splash wait shifts every slice earlier by
                               // the boot duration and lands scene 1 inside the splash.)
page.on('filechooser', (fc) => { fc.setFiles(VJ_SOURCE).catch(() => {}); });

const scenes = onlyIds.length ? SCENES.filter((s) => onlyIds.includes(s.id)) : SCENES;
const marks = [];
const results = [];

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await sleep(2600);
await waitSplashGone(page);    // the ONLY splash wait — once, up front
await page.mouse.click(8, 8);

for (const scene of scenes) {
  let info = null, err = null;
  try {
    if (scene.nav) {
      // file:// scenes (the Magenta port UI + repo card) navigate away — they run last.
      await page.goto(scene.nav, { waitUntil: 'domcontentloaded' }).catch((e) => { err = 'nav ' + e.message; });
      await sleep(1600);
      const start = (Date.now() - tRec) / 1000;
      await holdAction(page, scene);
      const end = (Date.now() - tRec) / 1000;
      marks.push({ id: scene.id, start, end });
    } else {
      info = await page.evaluate(applyScene, { ...HERO, deckB: DECK_B, stems: STEMS, etuPiano: ETU_PIANO, ...scene });
      await sleep(1200);                       // let the tab transition + view settle
      err = await sceneActions(page, scene);
      await sleep(500);
      const start = (Date.now() - tRec) / 1000; // stable-hold window begins here
      await holdAction(page, scene);
      const end = (Date.now() - tRec) / 1000;
      marks.push({ id: scene.id, start, end });
      await sceneCleanup(page, scene);
    }
  } catch (e) { err = String(e).slice(0, 200); }
  results.push({ id: scene.id, info, err });
  console.log(`${scene.id}`, err ? ('ERR ' + err) : JSON.stringify(info));
}

const video = page.video();
await ctx.close();             // flush the recording
await browser.close();
const sessionWebm = path.join(OUT, '_session.webm');
try { const vp = await video.path(); fs.renameSync(vp, sessionWebm); } catch (e) { console.log('session rename', e.message); }

// Slice the one long recording into per-scene clips (trim the transition edges).
const { execFileSync } = await import('node:child_process');
for (const m of marks) {
  const ss = (m.start + 0.4).toFixed(2);
  const dur = Math.max(0.5, m.end - m.start - 0.6).toFixed(2);
  const out = path.join(OUT, `${m.id}_h.mp4`);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-t', dur, '-i', sessionWebm,
      '-an', '-vf', `scale=${VW}:${VH},fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', out]);
    console.log(`  sliced ${m.id}_h.mp4  (${dur}s @ ${ss}s)`);
  } catch (e) { console.log(`  slice FAIL ${m.id}`, e.message); }
}

fs.writeFileSync(path.join(OUT, '_capture-log.json'), JSON.stringify({ marks, results }, null, 2));
console.log('DONE ->', OUT);
