import { memo } from 'react';
import type { AreaObj, DesignObj, DimensionObj, FeatureObj, LabelObj, PathObj, PlantObj } from '../model/types';
import {
  boundsOf,
  centroid,
  dist,
  polylinePath,
  smoothClosedPath,
  smoothOpenPath,
  spanAtY,
} from '../model/geometry';
import { getSpecies } from '../data/plants';
import { FEATURES, getPathSpec, getSurface } from '../data/materials';
import { shade, symbolGeometry } from './symbols';

interface Props {
  obj: DesignObj;
  selected: boolean;
  /** Pixels per foot — used to keep labels and hairlines legible. */
  scale: number;
  showLabels: boolean;
  onPointerDown?: (e: React.PointerEvent, id: string) => void;
}

/** Bed and lawn outlines read better as flowing curves than as polygons. */
const CURVED_SURFACES = new Set([
  'bed-mulch',
  'bed-decomposed-granite',
  'gravel-river-rock',
  'lawn-bermuda',
  'lawn-zoysia',
  'lawn-stjoe',
  'water',
]);

function areaPath(o: AreaObj): string {
  // Right-angled shapes (paving, structures) must stay crisp; organic ones
  // get a Catmull-Rom pass so a hand-drawn bed looks like a bed.
  if (o.kind === 'structure' || !CURVED_SURFACES.has(o.surface) || isRectilinear(o.points)) {
    return polylinePath(o.points, true);
  }
  return smoothClosedPath(o.points, 0.42);
}

function isRectilinear(pts: Pt[]): boolean {
  if (pts.length < 3) return true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (Math.abs(a.x - b.x) > 0.05 && Math.abs(a.y - b.y) > 0.05) return false;
  }
  return true;
}

type Pt = { x: number; y: number };


export const PlanObject = memo(function PlanObject({
  obj,
  selected,
  scale,
  showLabels,
  onPointerDown,
}: Props) {
  const down = onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, obj.id) : undefined;
  const sel = selected ? { stroke: '#f0a500', strokeWidth: 2.5 } : null;

  switch (obj.kind) {
    case 'area':
    case 'structure':
      return <AreaShape o={obj} sel={!!selected} onDown={down} />;
    case 'path':
      return <PathShape o={obj} sel={!!selected} onDown={down} />;
    case 'plant':
      return <PlantShape o={obj} sel={!!selected} scale={scale} showLabels={showLabels} onDown={down} />;
    case 'feature':
      return <FeatureShape o={obj} sel={!!selected} scale={scale} onDown={down} />;
    case 'label':
      return <LabelShape o={obj} sel={!!selected} scale={scale} onDown={down} />;
    case 'dimension':
      return <DimensionShape o={obj} sel={!!selected} scale={scale} onDown={down} />;
    default:
      return sel && null;
  }
});

/* ------------------------------------------------------------------ */

function AreaShape({
  o,
  sel,
  onDown,
}: {
  o: AreaObj;
  sel: boolean;
  onDown?: (e: React.PointerEvent) => void;
}) {
  const spec = getSurface(o.surface);
  const d = areaPath(o);
  const holes = (o.holes ?? []).map((h) => polylinePath(h, true)).join(' ');
  const isStructure = o.kind === 'structure';

  return (
    <g onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
      <path
        d={d + (holes ? ' ' + holes : '')}
        fillRule="evenodd"
        fill={spec.fill}
        stroke={sel ? '#f0a500' : spec.stroke}
        strokeWidth={sel ? 2.5 : isStructure ? 1.4 : 1}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * Area names, drawn in one pass above every layer so a bed label is never
 * buried under the shrubs planted in that bed.
 *
 * A label only appears when it genuinely fits the shape at the line it sits
 * on, which means labels reveal themselves as you zoom in instead of piling
 * up on top of each other at plan scale.
 */
export function AreaLabels({
  objects,
  scale,
  px = 11,
}: {
  objects: DesignObj[];
  scale: number;
  px?: number;
}) {
  return (
    <g pointerEvents="none">
      {objects.map((o) => {
        if ((o.kind !== 'area' && o.kind !== 'structure') || !o.name) return null;
        const c = centroid(o.points);
        const span = spanAtY(o.points, c.y);
        if (!span) return null;
        const textFt = (o.name.length * px * 0.5) / scale;
        const lineFt = (px * 1.35) / scale;
        const b = boundsOf(o.points);
        if (textFt > (span.x1 - span.x0) * 0.94) return null;
        if (lineFt > (b.maxY - b.minY) * 0.8) return null;
        return (
          <PlanText
            key={o.id}
            x={(span.x0 + span.x1) / 2}
            y={c.y}
            scale={scale}
            px={px}
            fill={o.kind === 'structure' ? '#5c564d' : '#3d3a34'}
            weight={600}
            halo
          >
            {o.name}
          </PlanText>
        );
      })}
    </g>
  );
}

function PathShape({
  o,
  sel,
  onDown,
}: {
  o: PathObj;
  sel: boolean;
  onDown?: (e: React.PointerEvent) => void;
}) {
  const spec = getPathSpec(o.material);
  const curved = o.material === 'walk-flagstone' || o.material === 'walk-stepper';
  const d = o.closed
    ? polylinePath(o.points, true)
    : curved
      ? smoothOpenPath(o.points, 0.4)
      : polylinePath(o.points, false);

  if (o.material === 'walk-stepper') {
    return (
      <g onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={o.width} />
        <Steppers points={o.points} width={o.width} sel={sel} />
      </g>
    );
  }

  return (
    <g onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
      <path
        d={d}
        fill="none"
        stroke={sel ? '#f0a500' : spec.fill === 'none' ? spec.stroke : spec.fill}
        strokeWidth={o.width}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={spec.dashed ? `${o.width * 4} ${o.width * 3}` : undefined}
      />
      {!spec.dashed && spec.fill !== 'none' && (
        <path
          d={d}
          fill="none"
          stroke={sel ? '#f0a500' : spec.stroke}
          strokeWidth={0.9}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          pathLength={undefined}
          style={{ opacity: 0.9 }}
        />
      )}
    </g>
  );
}

/** Individual stones, set on centre along the path. */
function Steppers({ points, width, sel }: { points: Pt[]; width: number; sel: boolean }) {
  const stones: { x: number; y: number; a: number }[] = [];
  const spacing = 2.0;
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (let t = carry; t < seg; t += spacing) {
      stones.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg, a: ang });
    }
    carry = (carry - seg) % spacing;
    if (carry < 0) carry += spacing;
  }
  return (
    <>
      {stones.map((s, i) => (
        <rect
          key={i}
          x={-width / 2}
          y={-width / 2}
          width={width}
          height={width * 0.75}
          rx={width * 0.18}
          fill="#c8bda9"
          stroke={sel ? '#f0a500' : '#9d9483'}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          transform={`translate(${s.x} ${s.y}) rotate(${(s.a * 180) / Math.PI})`}
        />
      ))}
    </>
  );
}

function PlantShape({
  o,
  sel,
  scale,
  showLabels,
  onDown,
}: {
  o: PlantObj;
  sel: boolean;
  scale: number;
  showLabels: boolean;
  onDown?: (e: React.PointerEvent) => void;
}) {
  const sp = getSpecies(o.speciesId);
  if (!sp) return null;
  const r = o.radiusFt ?? sp.w / 2;
  const g = symbolGeometry(sp.symbol, r);
  const outline = shade(sp.foliage, 0.62);
  const isTree = sp.type === 'shade-tree' || sp.type === 'ornamental-tree';

  return (
    <g
      transform={`translate(${o.at.x} ${o.at.y})${o.rotation ? ` rotate(${o.rotation})` : ''}`}
      onPointerDown={onDown}
      style={{ cursor: onDown ? 'pointer' : 'default' }}
    >
      <path
        d={g.outline}
        fill={sp.foliage}
        fillOpacity={isTree ? 0.42 : 0.68}
        stroke={sel ? '#f0a500' : outline}
        strokeWidth={sel ? 2.5 : 1.2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      {g.detail && (
        <path
          d={g.detail}
          fill="none"
          stroke={outline}
          strokeOpacity={g.detailOpacity}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {g.centerDot > 0 && (
        <circle r={g.centerDot} fill={outline} pointerEvents="none" />
      )}
      {showLabels && isTree && (sp.common.length * 10 * 0.5) / scale <= r * 3 && (
        <PlanText x={0} y={-r - 1.2} scale={scale} px={10} fill="#2f2c27" weight={600} halo anchor="middle">
          {sp.common}
        </PlanText>
      )}
    </g>
  );
}

function FeatureShape({
  o,
  sel,
  scale,
  onDown,
}: {
  o: FeatureObj;
  sel: boolean;
  scale: number;
  onDown?: (e: React.PointerEvent) => void;
}) {
  const spec = FEATURES[o.feature];
  const size = o.sizeFt ?? spec?.defaultSizeFt ?? 2;
  const color = spec?.color ?? '#888';
  const stroke = sel ? '#f0a500' : shade(color, 0.6);
  const common = {
    stroke,
    strokeWidth: sel ? 2.5 : 1.3,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  let shape: React.ReactNode;
  switch (o.feature) {
    case 'light-path':
    case 'light-up': {
      // Lights are drawn as symbols at a fixed pixel size, not to scale —
      // a 6" fixture would vanish at plan scale otherwise.
      const rr = Math.max(0.6, 9 / scale);
      shape = (
        <>
          <circle r={rr} fill={color} {...common} />
          {o.feature === 'light-up' ? (
            <path d={`M 0 ${-rr * 2.2} L 0 ${-rr * 0.9} M ${-rr} ${-rr * 1.7} L 0 ${-rr * 2.6} L ${rr} ${-rr * 1.7}`} fill="none" stroke={stroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          ) : (
            <circle r={rr * 2} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          )}
        </>
      );
      break;
    }
    case 'irrigation-rotor':
    case 'irrigation-spray': {
      const rr = Math.max(0.5, 7 / scale);
      shape = (
        <>
          <circle r={rr} fill={color} {...common} />
          <circle r={rr * 3} fill={color} fillOpacity={0.09} stroke={color} strokeOpacity={0.5} strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </>
      );
      break;
    }
    case 'firepit':
      shape = (
        <>
          <circle r={size / 2} fill={color} fillOpacity={0.75} {...common} />
          <circle r={size / 2 + 3} fill="none" stroke={stroke} strokeOpacity={0.4} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle r={size / 5} fill="#e08a4a" pointerEvents="none" />
        </>
      );
      break;
    case 'bench':
      shape = (
        <g transform={`rotate(${o.rotation ?? 0})`}>
          <rect x={-size / 2} y={-0.8} width={size} height={1.6} rx={0.25} fill={color} {...common} />
          <line x1={-size / 2} y1={0.55} x2={size / 2} y2={0.55} stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      );
      break;
    case 'ac-unit': {
      const h = size / 2;
      shape = (
        <>
          <rect x={-h} y={-h} width={size} height={size} rx={size * 0.08} fill={color} {...common} />
          <circle r={size * 0.3} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path
            d={`M ${-size * 0.3} 0 L ${size * 0.3} 0 M 0 ${-size * 0.3} L 0 ${size * 0.3}`}
            stroke={stroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </>
      );
      break;
    }
    case 'boulder':
      shape = (
        <path
          d={`M ${size * 0.5} 0 Q ${size * 0.42} ${size * 0.4} 0 ${size * 0.46} Q ${-size * 0.48} ${size * 0.36} ${-size * 0.5} ${-size * 0.06} Q ${-size * 0.4} ${-size * 0.44} ${size * 0.06} ${-size * 0.46} Q ${size * 0.46} ${-size * 0.4} ${size * 0.5} 0 Z`}
          fill={color}
          {...common}
        />
      );
      break;
    default:
      shape = <circle r={size / 2} fill={color} fillOpacity={0.8} {...common} />;
  }

  return (
    <g transform={`translate(${o.at.x} ${o.at.y})`} onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
      {shape}
    </g>
  );
}

function LabelShape({
  o,
  sel,
  scale,
  onDown,
}: {
  o: LabelObj;
  sel: boolean;
  scale: number;
  onDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <g onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
      <circle cx={o.at.x} cy={o.at.y} r={Math.max(0.4, 4 / scale)} fill={sel ? '#f0a500' : '#5a5346'} />
      <PlanText
        x={o.at.x + Math.max(0.8, 8 / scale)}
        y={o.at.y}
        scale={scale}
        px={11}
        fill={sel ? '#a06b00' : '#3d3a34'}
        weight={500}
        anchor="start"
        halo
      >
        {o.text}
      </PlanText>
    </g>
  );
}

function DimensionShape({
  o,
  sel,
  scale,
  onDown,
}: {
  o: DimensionObj;
  sel: boolean;
  scale: number;
  onDown?: (e: React.PointerEvent) => void;
}) {
  const len = dist(o.a, o.b);
  const mid = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
  const color = sel ? '#f0a500' : '#8a3b2e';
  const ang = (Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x) * 180) / Math.PI;
  const flip = ang > 90 || ang < -90;
  const tick = Math.max(0.5, 5 / scale);

  return (
    <g onPointerDown={onDown} style={{ cursor: onDown ? 'pointer' : 'default' }}>
      <line x1={o.a.x} y1={o.a.y} x2={o.b.x} y2={o.b.y} stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      {[o.a, o.b].map((p, i) => {
        // Witness ticks run perpendicular to the dimension line.
        const nx = (-(o.b.y - o.a.y) / (len || 1)) * tick;
        const ny = ((o.b.x - o.a.x) / (len || 1)) * tick;
        return (
          <line
            key={i}
            x1={p.x - nx}
            y1={p.y - ny}
            x2={p.x + nx}
            y2={p.y + ny}
            stroke={color}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <g transform={`translate(${mid.x} ${mid.y}) rotate(${flip ? ang + 180 : ang})`}>
        <PlanText x={0} y={0} scale={scale} px={11} fill={color} weight={700} anchor="middle" halo dy={-0.35}>
          {formatFeet(len)}
        </PlanText>
      </g>
    </g>
  );
}

export function formatFeet(v: number): string {
  const ft = Math.floor(v);
  const inch = Math.round((v - ft) * 12);
  if (inch === 0) return `${ft}'-0"`;
  if (inch === 12) return `${ft + 1}'-0"`;
  return `${ft}'-${inch}"`;
}

/**
 * Text in the flipped world space. The group is mirrored on y, so every text
 * node has to be un-mirrored, and the font size is expressed in feet so that
 * it lands at the requested pixel size on screen.
 */
export function PlanText({
  x,
  y,
  scale,
  px,
  fill,
  weight = 400,
  anchor = 'middle',
  halo = false,
  dy = 0,
  children,
}: {
  x: number;
  y: number;
  scale: number;
  px: number;
  fill: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  halo?: boolean;
  dy?: number;
  children: React.ReactNode;
}) {
  const size = px / scale;
  return (
    <g transform={`translate(${x} ${y}) scale(1 -1)`} pointerEvents="none">
      <text
        x={0}
        y={dy * -1}
        fontSize={size}
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight={weight}
        textAnchor={anchor}
        dominantBaseline="middle"
        fill={fill}
        stroke={halo ? '#fbfaf7' : undefined}
        strokeWidth={halo ? size * 0.32 : undefined}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {children}
      </text>
    </g>
  );
}
