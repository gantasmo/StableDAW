/**
 * Recursive row/column renderer for a container node, plus the `SurfaceNode`
 * dispatcher that picks container vs panel. Each child sits in a `ContainerCell`
 * that is a PANEL_MIME drop target, so dragging a panel header onto a child
 * reorders/moves that panel into this container at the child's index (works
 * across containers because the store's `reorderPanel` accepts any target).
 */
import React, { useState } from 'react';
import { GripVertical, Rows3, Columns3, Square, SquareDashedBottom, Link2, Combine, Palette, X } from 'lucide-react';
import { useSurface } from './surfaceContext';
import { FrGrid } from './FrGrid';
import { SurfacePanel } from './SurfacePanel';
import { PANEL_MIME, encode, decodePanel } from './dnd';
import { useLayoutPrefs } from '../../state/layoutPrefsStore';
import { companionOf, absorbableSibling } from '../../state/surfaceLayoutStore';
import type { ContainerNode, NodeId, SurfaceStoreApi } from '../../state/surfaceLayoutStore';
import type { FrameShape } from './widgetTypes';

// Preset region-outline shapes. Applied to the decorative frame LAYERS only
// (not the content), so a hexagon/bevel never clips the controls inside.
const FRAME_STYLE: Record<FrameShape, React.CSSProperties> = {
  rect: { borderRadius: 2 },
  rounded: { borderRadius: 10 },
  capsule: { borderRadius: 9999 },
  blob: { borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' },
  hexagon: { clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)' },
  beveled: { clipPath: 'polygon(7% 0, 93% 0, 100% 28%, 100% 72%, 93% 100%, 7% 100%, 0 72%, 0 28%)' },
};
const FRAME_SHAPES: FrameShape[] = ['rounded', 'rect', 'capsule', 'hexagon', 'beveled', 'blob'];
const FRAME_TINTS: (number | undefined)[] = [undefined, 0.78, 0.55, 0.33, 0.13, 0.95];
const hue = (t: number) => Math.round(t * 360);

/** A small popover to style a framed region: outline shape, accent tint, glow,
 *  and a label. */
const FrameStyleMenu: React.FC<{ node: ContainerNode; store: SurfaceStoreApi; onClose: () => void }> = ({ node, store, onClose }) => {
  const set = (p: Partial<Pick<ContainerNode, 'frameShape' | 'frameTint' | 'frameGlow' | 'frameTitle'>>) =>
    store.getState().setContainerFrame(node.id, p);
  const curShape = node.frameShape ?? 'rounded';
  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-0 z-200 w-52 rounded-lg border border-purple-400/40 bg-[#140e20] shadow-2xl p-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-purple-200">Region frame</span>
        <button onClick={onClose} title="Close" className="text-zinc-400 hover:text-rose-300"><X className="w-3 h-3" /></button>
      </div>
      <div className="flex flex-wrap gap-1">
        {FRAME_SHAPES.map((s) => (
          <button
            key={s}
            onClick={() => set({ frameShape: s })}
            className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${curShape === s ? 'border-purple-400 bg-purple-500/20 text-purple-100' : 'border-white/10 text-zinc-400 hover:text-zinc-200'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {FRAME_TINTS.map((t, i) => (
          <button
            key={i}
            onClick={() => set({ frameTint: t })}
            title={t === undefined ? 'Default purple' : 'Accent tint'}
            className={`w-5 h-5 rounded-full border-2 ${node.frameTint === t ? 'border-white scale-110' : 'border-white/20'}`}
            style={{ background: t === undefined ? 'rgba(168,85,247,0.7)' : `hsl(${hue(t)} 80% 58%)` }}
          />
        ))}
      </div>
      <button
        onClick={() => set({ frameGlow: !node.frameGlow })}
        className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border self-start ${node.frameGlow ? 'border-amber-400/60 bg-amber-500/20 text-amber-100' : 'border-white/10 text-zinc-400 hover:text-zinc-200'}`}
      >
        Glow {node.frameGlow ? 'on' : 'off'}
      </button>
      <input
        value={node.frameTitle ?? ''}
        onChange={(e) => set({ frameTitle: e.target.value })}
        placeholder="Label (optional)"
        className="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[9px] text-zinc-200 focus:outline-none focus:border-purple-400/50"
      />
    </div>
  );
};

const ContainerCell: React.FC<{
  containerId: NodeId;
  index: number;
  design: boolean;
  surfaceId: string;
  store: SurfaceStoreApi;
  children: React.ReactNode;
}> = ({ containerId, index, design, surfaceId, store, children }) => {
  const [over, setOver] = useState(false);
  const accept = (e: React.DragEvent) => design && e.dataTransfer.types.includes(PANEL_MIME);
  return (
    <div
      className={`relative min-w-0 min-h-0 grid ${over ? 'ring-2 ring-inset ring-cyan-300/70 rounded' : ''}`}
      onDragOver={
        design
          ? (e) => {
              if (!accept(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOver(true);
            }
          : undefined
      }
      onDragLeave={design ? () => setOver(false) : undefined}
      onDrop={
        design
          ? (e) => {
              setOver(false);
              if (!accept(e)) return;
              const p = decodePanel(e.dataTransfer.getData(PANEL_MIME));
              if (!p || p.surfaceId !== surfaceId) return;
              e.preventDefault();
              e.stopPropagation();
              store.getState().reorderPanel(p.panelId, containerId, index);
            }
          : undefined
      }
    >
      {children}
    </div>
  );
};

export const SurfaceNode: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const { store } = useSurface();
  const type = store((s) => s.layout.nodes[nodeId]?.type);
  if (!type) return null;
  return type === 'container' ? <SurfaceContainer nodeId={nodeId} /> : <SurfacePanel nodeId={nodeId} />;
};

export const SurfaceContainer: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const { store, surfaceId, openMenu } = useSurface();
  const node = store((s) => s.layout.nodes[nodeId]) as ContainerNode | undefined;
  const design = store((s) => s.designMode);
  const companionId = store((s) => companionOf(s.layout.nodes, nodeId));
  const absorbId = store((s) => absorbableSibling(s.layout.nodes, nodeId));
  const highlighted = store((s) => s.highlightId === nodeId);
  const gapPx = useLayoutPrefs((s) => s.gapPx);
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  if (!node || node.type !== 'container') return null;

  // A framed region draws ONE box around the group. The frame is two decorative
  // LAYERS behind the content (back = border/glow, front = fill) so a preset
  // outline shape (hexagon/bevel/…) never clips the controls; leaf panels stay
  // transparent so the region reads as a single box, not a grid of boxes.
  const framed = !!node.framed;
  const shapeCss = FRAME_STYLE[node.frameShape ?? 'rounded'];
  const tint = node.frameTint;
  // Normal-mode fallback brightened from var(--panel-border) (#231e38, nearly
  // the bg tone) to the shared --surface-divider (salmon) so region separations
  // actually read. Design mode keeps the purple design tint.
  const borderCol = tint != null ? `hsl(${hue(tint)} 80% 60%)` : design ? 'rgba(168,85,247,0.5)' : 'var(--surface-divider)';
  const fillCol = tint != null ? `hsl(${hue(tint)} 38% 11%)` : 'var(--panel)';
  const glowCss = node.frameGlow
    ? `drop-shadow(0 0 10px ${tint != null ? `hsl(${hue(tint)} 85% 55% / 0.6)` : 'rgba(168,85,247,0.55)'})`
    : undefined;

  return (
    <div
      className="relative h-full w-full min-h-0 min-w-0"
      onContextMenu={design ? (e) => { e.stopPropagation(); openMenu(e, { kind: 'container', nodeId }); } : undefined}
      onPointerEnter={design ? () => store.getState().setHoverNode(nodeId) : undefined}
      onPointerLeave={design ? () => { if (store.getState().hoverNodeId === nodeId) store.getState().setHoverNode(null); } : undefined}
    >
      {framed && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ ...shapeCss, background: borderCol, filter: glowCss }} />
          <div className="absolute inset-[1.5px] pointer-events-none" style={{ ...shapeCss, background: fillCol }} />
        </>
      )}
      {!framed && node.bgFill && (
        <div className="absolute inset-0 pointer-events-none rounded bg-(--panel) border border-(--surface-divider)" />
      )}
      <div className={`relative h-full w-full min-h-0 min-w-0 ${framed ? 'p-1.5' : ''} ${highlighted ? 'ring-2 ring-amber-300/70 shadow-[0_0_12px_rgba(252,211,77,0.5)] rounded-md' : ''}`}>
        <FrGrid
          axis={node.axis}
          ids={node.children}
          fr={node.fr}
          design={design}
          gap={gapPx}
          className="h-full w-full min-h-0 min-w-0"
          onResize={(l, r, frac) => store.getState().resize(nodeId, l, r, frac)}
          renderItem={(childId, index) => (
            <ContainerCell
              containerId={nodeId}
              index={index}
              design={design}
              surfaceId={surfaceId}
              store={store}
            >
              <SurfaceNode nodeId={childId} />
            </ContainerCell>
          )}
        />
      </div>
      {framed && node.frameTitle && (
        <div
          className="absolute -top-2 left-3 z-40 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest pointer-events-none"
          style={{ background: borderCol, color: '#0a0a0a' }}
        >
          {node.frameTitle}
        </div>
      )}
      {design && (
        <div className="absolute bottom-0 right-0 z-50 flex items-center gap-px">
          {absorbId && (
            <button
              onClick={() => store.getState().fillAdjacent(nodeId)}
              onMouseEnter={() => store.getState().setHighlight(absorbId)}
              onMouseLeave={() => store.getState().setHighlight(null)}
              title="Fill — absorb the adjacent empty gap into this region"
              className="h-3 w-3 grid place-items-center rounded-t bg-cyan-600/85 hover:bg-cyan-400 text-cyan-50"
            >
              <Combine className="w-2 h-2" />
            </button>
          )}
          {companionId && (
            <button
              onClick={() => store.getState().mirrorToCompanion(nodeId)}
              onMouseEnter={() => store.getState().setHighlight(companionId)}
              onMouseLeave={() => store.getState().setHighlight(null)}
              title="Sync: mirror this region's track sizes onto its symmetric companion"
              className="h-3 w-3 grid place-items-center rounded-t bg-amber-600/85 hover:bg-amber-500 text-amber-50"
            >
              <Link2 className="w-2 h-2" />
            </button>
          )}
          <button
            onClick={() => store.getState().toggleContainerFramed(nodeId)}
            title={framed ? 'Region frame ON — click to remove the border/background' : 'Add a region frame (border + filled background) around this group'}
            className={`h-3 w-3 grid place-items-center rounded-t ${framed ? 'bg-amber-500/90 text-amber-50' : 'bg-cyan-800/85 hover:bg-cyan-600 text-cyan-50'}`}
          >
            {framed ? <Square className="w-2 h-2" /> : <SquareDashedBottom className="w-2 h-2" />}
          </button>
          {framed && (
            <button
              onClick={() => setFrameMenuOpen((v) => !v)}
              title="Region frame style — shape / tint / glow / label"
              className={`h-3 w-3 grid place-items-center rounded-t ${frameMenuOpen ? 'bg-fuchsia-500 text-fuchsia-50' : 'bg-fuchsia-700/85 hover:bg-fuchsia-500 text-fuchsia-50'}`}
            >
              <Palette className="w-2 h-2" />
            </button>
          )}
          <button
            onClick={() => store.getState().toggleContainerAxis(nodeId)}
            title={`This row/column is ${node.axis === 'row' ? 'horizontal' : 'vertical'} — click to flip`}
            className="h-3 w-3 grid place-items-center rounded-t bg-cyan-700/85 hover:bg-cyan-500 text-cyan-50"
          >
            {node.axis === 'row' ? <Columns3 className="w-2 h-2" /> : <Rows3 className="w-2 h-2" />}
          </button>
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData(PANEL_MIME, encode({ surfaceId, panelId: nodeId }));
            }}
            title="Drag this row/column to dock it elsewhere"
            className="h-3 w-3 grid place-items-center rounded-tl bg-cyan-600/85 hover:bg-cyan-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-2 h-2 text-cyan-50" />
          </div>
        </div>
      )}
      {design && framed && frameMenuOpen && (
        <FrameStyleMenu node={node} store={store} onClose={() => setFrameMenuOpen(false)} />
      )}
    </div>
  );
};
