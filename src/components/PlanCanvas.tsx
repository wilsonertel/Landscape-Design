import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, uid, SITE_BOUNDS } from '../state/store';
import type { AreaObj, DesignObj, DimensionObj, LabelObj, PathObj, Pt } from '../model/types';
import { getSpecies } from '../data/plants';
import { getPathSpec } from '../data/materials';
import {
  centroid,
  dist,
  distToPolyline,
  netArea,
  perimeter,
  pointInArea,
  polylinePath,
} from '../model/geometry';
import { castShadows, collectCasters, solarPosition, type SunGrid } from '../model/sun';
import { AreaLabels, PlanObject, PlanText, formatFeet } from './PlanObjects';
import { SheetFurniture, SurveyBase } from './SurveyBase';

const AREA_TOOLS: Record<string, { surface: AreaObj['surface']; layer: AreaObj['layer'] } | undefined> = {
  bed: { surface: 'bed-mulch', layer: 'beds' },
  lawn: { surface: 'lawn-bermuda', layer: 'beds' },
  patio: { surface: 'patio-flagstone', layer: 'hardscape' },
};

const PATH_TOOLS: Record<string, PathObj['material'] | undefined> = {
  walk: 'walk-flagstone',
  edging: 'edging-steel',
  fence: 'fence-wood',
};

type DragState =
  | { mode: 'none' }
  | { mode: 'pan'; sx: number; sy: number; tx: number; ty: number }
  | { mode: 'move'; start: Pt; originals: DesignObj[] }
  | { mode: 'vertex'; objId: string; index: number; original: DesignObj }
  | { mode: 'marquee'; start: Pt; current: Pt };

export function PlanCanvas({ sunGrid }: { sunGrid: SunGrid | null }) {
  const doc = useStore((s) => s.doc);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const draft = useStore((s) => s.draft);
  const selection = useStore((s) => s.selection);
  const snap = useStore((s) => s.snap);
  const snapSize = useStore((s) => s.snapSize);
  const showDimensions = useStore((s) => s.showDimensions);
  const sun = useStore((s) => s.sun);
  // Only the species is needed for rendering (the placement ghost); the other
  // active-material values are read from the store inside the event handlers.
  const activeSpecies = useStore((s) => s.activeSpecies);
  const cursor = useStore((s) => s.cursor);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState>({ mode: 'none' });
  const [size, setSize] = useState({ w: 1200, h: 820 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Viewport                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitToSite = useCallback(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const sw = w / (SITE_BOUNDS.maxX - SITE_BOUNDS.minX);
    const sh = h / (SITE_BOUNDS.maxY - SITE_BOUNDS.minY);
    const s = Math.min(sw, sh) * 0.94;
    useStore.getState().setView({
      scale: s,
      // screenX = tx + x·s and screenY = ty + (maxY − y)·s, so centring the
      // site means offsetting by half the leftover space in each axis.
      tx: (w - (SITE_BOUNDS.maxX - SITE_BOUNDS.minX) * s) / 2 - SITE_BOUNDS.minX * s,
      ty: (h - (SITE_BOUNDS.maxY - SITE_BOUNDS.minY) * s) / 2,
    });
  }, []);

  // Frame the lot on first paint.
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || size.w < 50) return;
    didFit.current = true;
    fitToSite();
  }, [size.w, fitToSite]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = svgRef.current!.getBoundingClientRect();
      const sx = clientX - r.left;
      const sy = clientY - r.top;
      return {
        x: (sx - view.tx) / view.scale,
        y: SITE_BOUNDS.maxY - (sy - view.ty) / view.scale,
      };
    },
    [view],
  );

  const snapPt = useCallback(
    (p: Pt): Pt => {
      if (!snap) return p;
      const g = snapSize;
      return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
    },
    [snap, snapSize],
  );

  const worldTransform = `translate(${view.tx} ${view.ty}) scale(${view.scale}) translate(0 ${SITE_BOUNDS.maxY}) scale(1 -1)`;

  /* ---------------------------------------------------------------- */
  /* Sun                                                               */
  /* ---------------------------------------------------------------- */

  const allObjects = useMemo(() => [...doc.base, ...doc.objects], [doc.base, doc.objects]);

  const sunPos = useMemo(
    () =>
      solarPosition(
        doc.site.latitude,
        doc.site.longitude,
        doc.site.utcOffsetStd,
        new Date().getFullYear(),
        sun.month,
        sun.day,
        sun.hour,
      ),
    [doc.site, sun.month, sun.day, sun.hour],
  );

  const shadows = useMemo(() => {
    if (!sun.enabled) return [];
    return castShadows(collectCasters(allObjects), sunPos, sun.leafOn);
  }, [sun.enabled, sun.leafOn, allObjects, sunPos]);

  /* ---------------------------------------------------------------- */
  /* Hit testing                                                       */
  /* ---------------------------------------------------------------- */

  const hitTest = useCallback(
    (p: Pt): DesignObj | null => {
      const tol = 7 / view.scale;
      // Top of the z-order first, so small things on top of big things win.
      for (let i = doc.objects.length - 1; i >= 0; i--) {
        const o = doc.objects[i];
        const layer = doc.layers[o.layer];
        if (!layer?.visible || layer.locked || o.locked) continue;
        if (hits(o, p, tol)) return o;
      }
      return null;
    },
    [doc.objects, doc.layers, view.scale],
  );

  /* ---------------------------------------------------------------- */
  /* Pointer handling                                                  */
  /* ---------------------------------------------------------------- */

  const finishDraft = useCallback(() => {
    const st = useStore.getState();
    const pts = st.draft;
    const t = st.tool;

    if (AREA_TOOLS[t] && pts.length >= 3) {
      const cfg = AREA_TOOLS[t]!;
      st.addObject({
        id: uid('area'),
        kind: 'area',
        layer: cfg.layer,
        points: pts,
        surface: st.activeSurface,
        name: undefined,
      } satisfies AreaObj);
    } else if (PATH_TOOLS[t] && pts.length >= 2) {
      const spec = getPathSpec(st.activePath);
      st.addObject({
        id: uid('path'),
        kind: 'path',
        layer: t === 'fence' ? 'hardscape' : t === 'edging' ? 'hardscape' : 'hardscape',
        points: pts,
        material: st.activePath,
        width: spec.defaultWidth,
      } satisfies PathObj);
    }
    st.clearDraft();
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const st = useStore.getState();
      const raw = toWorld(e.clientX, e.clientY);
      const p = snapPt(raw);

      // Middle button, or space-less right button, pans.
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }
      if (e.button !== 0) return;

      switch (st.tool) {
        case 'select': {
          const hit = hitTest(raw);
          if (!hit) {
            if (!e.shiftKey) st.setSelection([]);
            dragRef.current = { mode: 'marquee', start: raw, current: raw };
            return;
          }
          const already = st.selection.includes(hit.id);
          if (!already) st.toggleSelection(hit.id, e.shiftKey);
          const ids = e.shiftKey || already ? [...new Set([...st.selection, hit.id])] : [hit.id];
          dragRef.current = {
            mode: 'move',
            start: raw,
            originals: st.doc.objects.filter((o) => ids.includes(o.id)).map((o) => structuredClone(o)),
          };
          return;
        }
        case 'plant': {
          const sp = getSpecies(st.activeSpecies);
          if (!sp) return;
          st.addObject({ id: uid('pl'), kind: 'plant', layer: 'plants', speciesId: sp.id, at: p });
          return;
        }
        case 'feature': {
          st.addObject({
            id: uid('ft'),
            kind: 'feature',
            layer:
              st.activeFeature.startsWith('light') ? 'lighting'
              : st.activeFeature.startsWith('irrigation') ? 'irrigation'
              : 'hardscape',
            feature: st.activeFeature,
            at: p,
          });
          return;
        }
        case 'label': {
          const text = window.prompt('Note text');
          if (text) {
            st.addObject({ id: uid('lb'), kind: 'label', layer: 'annotation', at: p, text } satisfies LabelObj);
          }
          return;
        }
        case 'dimension':
        case 'measure': {
          if (st.draft.length === 0) {
            st.setDraft([p]);
          } else {
            const a = st.draft[0];
            if (st.tool === 'dimension') {
              st.addObject({ id: uid('dm'), kind: 'dimension', layer: 'annotation', a, b: p } satisfies DimensionObj);
            }
            st.clearDraft();
          }
          return;
        }
        default: {
          // Polygon / polyline tools accumulate vertices.
          if (st.draft.length > 2 && dist(p, st.draft[0]) < 12 / view.scale && AREA_TOOLS[st.tool]) {
            finishDraft();
            return;
          }
          st.pushDraft(p);
          return;
        }
      }
    },
    [toWorld, snapPt, hitTest, view.tx, view.ty, view.scale, finishDraft],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const st = useStore.getState();
      const raw = toWorld(e.clientX, e.clientY);
      st.setCursor(raw);

      const d = dragRef.current;
      if (d.mode === 'pan') {
        st.setView({ tx: d.tx + (e.clientX - d.sx), ty: d.ty + (e.clientY - d.sy) });
        return;
      }
      if (d.mode === 'move') {
        const dx = raw.x - d.start.x;
        const dy = raw.y - d.start.y;
        const g = snap ? snapSize : 0;
        const sdx = g ? Math.round(dx / g) * g : dx;
        const sdy = g ? Math.round(dy / g) * g : dy;
        const map = new Map(d.originals.map((o) => [o.id, o]));
        st.liveUpdate(
          st.doc.objects.map((o) => {
            const orig = map.get(o.id);
            return orig ? translateObj(orig, sdx, sdy) : o;
          }),
        );
        return;
      }
      if (d.mode === 'vertex') {
        const p = snapPt(raw);
        st.liveUpdate(
          st.doc.objects.map((o) => {
            if (o.id !== d.objId) return o;
            const orig = d.original as AreaObj | PathObj;
            const pts = orig.points.slice();
            pts[d.index] = p;
            return { ...o, points: pts } as DesignObj;
          }),
        );
        return;
      }
      if (d.mode === 'marquee') {
        dragRef.current = { ...d, current: raw };
        setHoverId(null); // force a repaint of the marquee
        return;
      }

      if (st.tool === 'select') {
        const hit = hitTest(raw);
        setHoverId(hit?.id ?? null);
      }
    },
    [toWorld, snapPt, hitTest, snap, snapSize],
  );

  const onPointerUp = useCallback(() => {
    const st = useStore.getState();
    const d = dragRef.current;
    if (d.mode === 'move' || d.mode === 'vertex') {
      // The live edits are already in doc.objects; commit them for undo.
      st.commit(st.doc.objects);
    } else if (d.mode === 'marquee') {
      const { start, current } = d;
      const box = {
        minX: Math.min(start.x, current.x),
        maxX: Math.max(start.x, current.x),
        minY: Math.min(start.y, current.y),
        maxY: Math.max(start.y, current.y),
      };
      if (Math.abs(box.maxX - box.minX) > 1 && Math.abs(box.maxY - box.minY) > 1) {
        const ids = st.doc.objects
          .filter((o) => {
            const layer = st.doc.layers[o.layer];
            if (!layer?.visible || layer.locked || o.locked) return false;
            const c = objCenter(o);
            return c.x >= box.minX && c.x <= box.maxX && c.y >= box.minY && c.y <= box.maxY;
          })
          .map((o) => o.id);
        st.setSelection(ids);
      }
    }
    dragRef.current = { mode: 'none' };
  }, []);

  const onDoubleClick = useCallback(() => {
    if (useStore.getState().draft.length >= 2) finishDraft();
  }, [finishDraft]);

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const r = svgRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const factor = Math.exp(-e.deltaY * 0.0016);
      const next = Math.max(1.2, Math.min(48, view.scale * factor));
      const k = next / view.scale;
      useStore.getState().setView({
        scale: next,
        tx: mx - (mx - view.tx) * k,
        ty: my - (my - view.ty) * k,
      });
    },
    [view],
  );

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const st = useStore.getState();

      if (e.key === 'Escape') {
        st.clearDraft();
        st.setSelection([]);
        st.setTool('select');
      } else if (e.key === 'Enter') {
        if (st.draft.length >= 2) finishDraft();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.draft.length) st.setDraft(st.draft.slice(0, -1));
        else st.deleteSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        st.setSelection(st.doc.objects.filter((o) => st.doc.layers[o.layer]?.visible).map((o) => o.id));
      } else if (e.key === 'f') {
        fitToSite();
      } else {
        const map: Record<string, string> = {
          v: 'select', b: 'bed', l: 'lawn', p: 'patio', w: 'walk',
          e: 'edging', t: 'plant', g: 'feature', n: 'label', m: 'measure', d: 'dimension',
        };
        if (map[e.key]) st.setTool(map[e.key] as never);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finishDraft, fitToSite]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const selectedObjs = useMemo(
    () => doc.objects.filter((o) => selection.includes(o.id)),
    [doc.objects, selection],
  );

  const drag = dragRef.current;
  const drawingArea = !!AREA_TOOLS[tool];
  const drawingPath = !!PATH_TOOLS[tool];

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={`plan-svg tool-${tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid-ft" width={view.scale * 5} height={view.scale * 5} patternUnits="userSpaceOnUse">
            <path d={`M ${view.scale * 5} 0 L 0 0 0 ${view.scale * 5}`} fill="none" stroke="#000" strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={size.w} height={size.h} fill="#efece5" />
        {view.scale > 3 && <rect width={size.w} height={size.h} fill="url(#grid-ft)" style={{ transform: `translate(${view.tx % (view.scale * 5)}px, ${view.ty % (view.scale * 5)}px)` }} />}

        <g transform={worldTransform}>
          <SurveyBase scale={view.scale} />

          {/* Design + base objects, in layer order */}
          {(['beds', 'hardscape', 'structures', 'irrigation', 'lighting', 'plants', 'annotation'] as const).map(
            (layerId) => {
              const layer = doc.layers[layerId];
              if (!layer?.visible) return null;
              return (
                <g key={layerId} opacity={layer.locked ? 0.85 : 1}>
                  {doc.base
                    .filter((o) => o.layer === layerId)
                    .map((o) => (
                      <PlanObject key={o.id} obj={o} selected={false} scale={view.scale} showLabels={false} />
                    ))}
                  {doc.objects
                    .filter((o) => o.layer === layerId)
                    .map((o) => (
                      <g key={o.id} className={hoverId === o.id ? 'hovered' : undefined}>
                        <PlanObject
                          obj={o}
                          selected={selection.includes(o.id)}
                          scale={view.scale}
                          showLabels={showDimensions}
                        />
                      </g>
                    ))}
                </g>
              );
            },
          )}

          {showDimensions && (
            <AreaLabels
              objects={[...doc.base, ...doc.objects].filter(
                (o) => doc.layers[o.layer]?.visible,
              )}
              scale={view.scale}
            />
          )}

          {/*
            The sun-hours map goes OVER the design, translucent. Underneath it
            was invisible — the beds and lawn are opaque — and the whole point
            is to read exposure against the planting you are judging.
          */}
          {sunGrid && (
            <g opacity={0.62} pointerEvents="none">
              {Array.from({ length: sunGrid.rows }, (_, r) =>
                Array.from({ length: sunGrid.cols }, (_, c) => {
                  const h = sunGrid.hours[r * sunGrid.cols + c];
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={sunGrid.originX + c * sunGrid.cell}
                      y={sunGrid.originY + r * sunGrid.cell}
                      width={sunGrid.cell + 0.02}
                      height={sunGrid.cell + 0.02}
                      fill={sunColor(h, sunGrid.maxHours)}
                    />
                  );
                }),
              )}
            </g>
          )}

          {/* Shadows drawn on top, translucent, so you can see what they land on. */}
          {sun.enabled && sunPos.altitude > 1.5 && (
            <g pointerEvents="none">
              {shadows.map((s) => (
                <path
                  key={s.id}
                  // One path per caster, so the swept rings union instead of
                  // stacking their opacity on top of each other.
                  d={s.parts.map((ring) => polylinePath(ring, true)).join(' ')}
                  fillRule="nonzero"
                  fill="#1e2a3a"
                  fillOpacity={s.kind === 'plant' ? 0.16 : 0.22}
                />
              ))}
            </g>
          )}

          {/* In-progress geometry */}
          {draft.length > 0 && (
            <g pointerEvents="none">
              <path
                d={
                  polylinePath(
                    cursor && (drawingArea || drawingPath || tool === 'measure' || tool === 'dimension')
                      ? [...draft, snapPt(cursor)]
                      : draft,
                    drawingArea,
                  )
                }
                fill={drawingArea ? '#2f6fb0' : 'none'}
                fillOpacity={0.16}
                stroke="#2f6fb0"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4 / view.scale} fill="#fff" stroke="#2f6fb0" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ))}
              {cursor && draft.length >= 1 && (tool === 'measure' || tool === 'dimension') && (
                <PlanText
                  x={(draft[0].x + cursor.x) / 2}
                  y={(draft[0].y + cursor.y) / 2}
                  scale={view.scale}
                  px={13}
                  fill="#1d4f80"
                  weight={700}
                  halo
                >
                  {formatFeet(dist(draft[0], snapPt(cursor)))}
                </PlanText>
              )}
              {drawingArea && draft.length >= 3 && cursor && (
                <PlanText
                  x={centroid([...draft, snapPt(cursor)]).x}
                  y={centroid([...draft, snapPt(cursor)]).y}
                  scale={view.scale}
                  px={12}
                  fill="#1d4f80"
                  weight={700}
                  halo
                >
                  {Math.round(netArea([...draft, snapPt(cursor)]))} sq ft
                </PlanText>
              )}
            </g>
          )}

          {/* Ghost of the plant about to be dropped */}
          {tool === 'plant' && cursor && <PlantGhost speciesId={activeSpecies} at={snapPt(cursor)} />}

          {/* Selection handles */}
          {tool === 'select' &&
            selectedObjs.map((o) =>
              'points' in o ? (
                <g key={o.id}>
                  {o.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={5 / view.scale}
                      fill="#fff"
                      stroke="#f0a500"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: 'crosshair' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        dragRef.current = { mode: 'vertex', objId: o.id, index: i, original: structuredClone(o) };
                      }}
                    />
                  ))}
                </g>
              ) : null,
            )}

          {/* Live measurements on the current selection */}
          {showDimensions &&
            selectedObjs.map((o) => {
              if (o.kind === 'area') {
                const c = centroid(o.points);
                return (
                  <PlanText key={o.id} x={c.x} y={c.y} scale={view.scale} px={12} fill="#8a5a00" weight={700} halo dy={1.6}>
                    {Math.round(netArea(o.points, o.holes)).toLocaleString()} sq ft
                  </PlanText>
                );
              }
              if (o.kind === 'path') {
                const c = o.points[Math.floor(o.points.length / 2)];
                return (
                  <PlanText key={o.id} x={c.x} y={c.y} scale={view.scale} px={12} fill="#8a5a00" weight={700} halo dy={1.6}>
                    {formatFeet(perimeter(o.points, !!o.closed))}
                  </PlanText>
                );
              }
              return null;
            })}

          {/* Marquee */}
          {drag.mode === 'marquee' && (
            <rect
              x={Math.min(drag.start.x, drag.current.x)}
              y={Math.min(drag.start.y, drag.current.y)}
              width={Math.abs(drag.current.x - drag.start.x)}
              height={Math.abs(drag.current.y - drag.start.y)}
              fill="#2f6fb0"
              fillOpacity={0.1}
              stroke="#2f6fb0"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </g>

        <SheetFurniture width={size.w} height={size.h} scale={view.scale} />

        {sun.enabled && <SunCompass width={size.w} sun={sunPos} />}
      </svg>

      <div className="canvas-readout">
        {cursor && (
          <span className="mono">
            {cursor.x.toFixed(1)}′ E · {cursor.y.toFixed(1)}′ N
          </span>
        )}
        <span className="dim">{hintFor(tool)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PlantGhost({ speciesId, at }: { speciesId: string; at: Pt }) {
  const sp = getSpecies(speciesId);
  if (!sp) return null;
  const r = sp.w / 2;
  return (
    <g pointerEvents="none" opacity={0.55}>
      <circle cx={at.x} cy={at.y} r={r} fill={sp.foliage} fillOpacity={0.3} stroke={sp.foliage} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <circle cx={at.x} cy={at.y} r={0.4} fill="#333" />
    </g>
  );
}

function SunCompass({ width, sun }: { width: number; sun: { altitude: number; azimuth: number } }) {
  const cx = width - 52;
  const cy = 52;
  const a = ((sun.azimuth - 90) * Math.PI) / 180;
  const r = 34;
  if (sun.altitude <= 0) {
    return (
      <g pointerEvents="none">
        <text x={cx} y={cy + 44} textAnchor="middle" fontSize={10} fill="#6b6459" fontFamily="'Inter', system-ui, sans-serif">
          sun down
        </text>
      </g>
    );
  }
  return (
    <g pointerEvents="none">
      <line x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="#e0a020" strokeWidth={2.5} />
      <circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={6} fill="#f2b73d" stroke="#c98d1d" strokeWidth={1.5} />
      <text x={cx} y={cy + 48} textAnchor="middle" fontSize={10} fill="#6b6459" fontFamily="'Inter', system-ui, sans-serif">
        alt {sun.altitude.toFixed(0)}° · az {sun.azimuth.toFixed(0)}°
      </text>
    </g>
  );
}

/**
 * Blue (deep shade) through green to gold (full sun). Anchored on the two
 * thresholds that actually drive plant selection: ~4 hrs (shade vs part sun)
 * and ~6 hrs (part sun vs full sun).
 */
function sunColor(hours: number, maxHours: number): string {
  const t = Math.max(0, Math.min(1, hours / Math.max(6, maxHours)));
  if (t < 0.4) {
    const k = t / 0.4;
    return `rgb(${Math.round(56 + k * 40)}, ${Math.round(78 + k * 70)}, ${Math.round(130 - k * 20)})`;
  }
  const k = (t - 0.4) / 0.6;
  return `rgb(${Math.round(96 + k * 150)}, ${Math.round(148 + k * 45)}, ${Math.round(110 - k * 70)})`;
}

function hits(o: DesignObj, p: Pt, tol: number): boolean {
  switch (o.kind) {
    case 'area':
    case 'structure':
      return pointInArea(p, o.points, o.holes) || distToPolyline(p, o.points, true) < tol;
    case 'path':
      return distToPolyline(p, o.points, !!o.closed) < Math.max(tol, o.width / 2);
    case 'plant': {
      const sp = getSpecies(o.speciesId);
      const r = o.radiusFt ?? (sp ? sp.w / 2 : 2);
      return dist(p, o.at) < Math.max(r, tol);
    }
    case 'feature':
      return dist(p, o.at) < Math.max((o.sizeFt ?? 2) / 2, tol);
    case 'label':
      return dist(p, o.at) < tol * 2;
    case 'dimension':
      return distToPolyline(p, [o.a, o.b], false) < tol;
    default:
      return false;
  }
}

function objCenter(o: DesignObj): Pt {
  if ('points' in o) return centroid(o.points);
  if ('at' in o) return o.at;
  if (o.kind === 'dimension') return { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
  return { x: 0, y: 0 };
}

function translateObj(o: DesignObj, dx: number, dy: number): DesignObj {
  const m = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  const c = structuredClone(o) as DesignObj;
  if ('points' in c) {
    c.points = c.points.map(m);
    if ('holes' in c && c.holes) c.holes = c.holes.map((h) => h.map(m));
  }
  if ('at' in c) c.at = m(c.at);
  if (c.kind === 'dimension') {
    c.a = m(c.a);
    c.b = m(c.b);
  }
  return c;
}

function hintFor(tool: string): string {
  switch (tool) {
    case 'select':
      return 'Click to select · drag to move · shift-click to add · drag a vertex to reshape';
    case 'bed':
    case 'lawn':
    case 'patio':
      return 'Click to place corners · click the first point again, double-click, or press Enter to close';
    case 'walk':
    case 'edging':
    case 'fence':
      return 'Click to place points · double-click or Enter to finish';
    case 'plant':
      return 'Click to plant · the dashed circle is mature canopy spread';
    case 'feature':
      return 'Click to place';
    case 'measure':
      return 'Click two points to measure';
    case 'dimension':
      return 'Click two points to add a dimension to the plan';
    case 'label':
      return 'Click to place a note';
    default:
      return '';
  }
}
