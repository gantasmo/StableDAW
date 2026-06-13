import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* Global control-surface preferences (client-only, separate from the backend
 * /api/settings feature toggles). These apply to every surface instance:
 *   - fillMode: how a control uses the dead space in its cell.
 *       'scale'   → the control grows to fill the cell (default).
 *       'natural' → the control stays at a compact size, centred.
 *   - gapPx: the gap between panels (the splitter track width), surface-wide.
 * Edited from the Settings modal's "Edit Layout Settings" section. */

export type FillMode = 'scale' | 'natural';

// App-wide colour theme. 'dark' is the app's native look; 'light' flips the
// CSS-variable palette in index.css (:root[data-theme="light"]). Applied from
// App.tsx via document.documentElement[data-theme], same channel as --text-scale.
export type ThemeMode = 'dark' | 'light';

// Per-theme default colours. MUST mirror the values in index.css (the dark
// :root block and the :root[data-theme="light"] override) so the Settings
// colour pickers show the real effective colour when no custom override is set.
export const THEME_DEFAULTS: Record<ThemeMode, { text: string; bg: string }> = {
  dark: { text: '#f5f3ff', bg: '#07050a' },
  light: { text: '#16121f', bg: '#f7f7fb' },
};

const DEFAULT_GAP = 6;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// App-wide UI/text scale (page zoom). Clamped so nothing gets unusably big or
// small. 1.0 = the app's native density (unchanged default).
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.3;
const DEFAULT_UI_SCALE = 1.0;

interface LayoutPrefsState {
  fillMode: FillMode;
  gapPx: number;
  /** App-wide UI/text scale (page zoom), clamped to [UI_SCALE_MIN, UI_SCALE_MAX]. */
  uiScale: number;
  /** Snap step (px) for dragging margins/handles; 0 = no snapping. Hold Ctrl
   *  while dragging to override with a 1px fine step. */
  snapPx: number;
  /** Show the centre + increment alignment guides while editing. */
  showGuides: boolean;
  /** Match same-kind control sizes within a panel: equal height across a row,
   *  equal width down a column (sized to the shared cross-axis). On by default. */
  matchSizes: boolean;
  /** App-wide colour theme. 'dark' = native; 'light' = light palette. */
  theme: ThemeMode;
  /** Custom text colour override (any CSS colour). null = use the theme default. */
  textColor: string | null;
  /** Custom background colour override (any CSS colour). null = theme default. */
  bgColor: string | null;
  /** High-contrast text: lifts dim/muted text so it stops blending into the bg. */
  highContrast: boolean;
  /** Minimum font size floor in px (0 = off). Bumps tiny notification/label text
   *  (6-13px) up to at least this size without enlarging the whole layout. */
  minTextPx: number;
  setFillMode: (m: FillMode) => void;
  setGapPx: (px: number) => void;
  setSnapPx: (px: number) => void;
  setShowGuides: (v: boolean) => void;
  setMatchSizes: (v: boolean) => void;
  setUiScale: (v: number) => void;
  setTheme: (t: ThemeMode) => void;
  setTextColor: (c: string | null) => void;
  setBgColor: (c: string | null) => void;
  setHighContrast: (v: boolean) => void;
  setMinTextPx: (px: number) => void;
  reset: () => void;
}

const DEFAULT_SNAP = 8;

export const useLayoutPrefs = create<LayoutPrefsState>()(
  persist(
    (set) => ({
      fillMode: 'scale',
      gapPx: DEFAULT_GAP,
      snapPx: DEFAULT_SNAP,
      showGuides: true,
      matchSizes: true,
      uiScale: DEFAULT_UI_SCALE,
      theme: 'dark',
      textColor: null,
      bgColor: null,
      highContrast: false,
      minTextPx: 0,
      setFillMode: (m) => set({ fillMode: m }),
      setGapPx: (px) => set({ gapPx: clamp(Math.round(px), 0, 40) }),
      setSnapPx: (px) => set({ snapPx: clamp(Math.round(px), 0, 32) }),
      setShowGuides: (v) => set({ showGuides: v }),
      setMatchSizes: (v) => set({ matchSizes: v }),
      // Round to 0.01 and clamp so persisted/applied values stay sane.
      setUiScale: (v) => set({ uiScale: clamp(Math.round(v * 100) / 100, UI_SCALE_MIN, UI_SCALE_MAX) }),
      setTheme: (t) => set({ theme: t }),
      setTextColor: (c) => set({ textColor: c }),
      setBgColor: (c) => set({ bgColor: c }),
      setHighContrast: (v) => set({ highContrast: v }),
      setMinTextPx: (px) => set({ minTextPx: clamp(Math.round(px), 0, 16) }),
      reset: () => set({ fillMode: 'scale', gapPx: DEFAULT_GAP, snapPx: DEFAULT_SNAP, showGuides: true, matchSizes: true, uiScale: DEFAULT_UI_SCALE, theme: 'dark', textColor: null, bgColor: null, highContrast: false, minTextPx: 0 }),
    }),
    { name: 'thedaw.layoutprefs.v1' },
  ),
);
