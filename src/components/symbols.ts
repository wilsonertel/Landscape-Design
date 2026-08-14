/**
 * Plan-view plant symbols.
 *
 * A planting plan is read at a glance, so the symbol has to say what kind of
 * thing it is before you get to the label: clouds for broadleaf canopy,
 * spikes for conifer/evergreen, radiating blades for grasses, and so on.
 * Everything is generated at unit radius around (0,0) and scaled by the
 * plant's real canopy radius in feet, so the plan stays honest about size.
 */

import type { PlantSymbol } from '../data/plants';

const pt = (a: number, r: number) => `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;

/** A cloud/scalloped outline — deciduous canopy and broadleaf shrubs. */
function scallop(r: number, lobes: number, bulge: number): string {
  const inner = r * (1 - bulge * 0.42);
  let d = `M ${pt(0, inner)}`;
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2;
    const a1 = ((i + 1) / lobes) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const ctrl = r * (1 + bulge * 0.55);
    d += ` Q ${pt(mid, ctrl)} ${pt(a1, inner)}`;
  }
  return d + ' Z';
}

/** Alternating points — evergreen / conifer canopy. */
function spiky(r: number, teeth: number, depth: number): string {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * (1 - depth);
    d += `${i === 0 ? 'M' : 'L'} ${pt(a, rad)} `;
  }
  return d + 'Z';
}

/** Radiating blades — ornamental grasses. */
function blades(r: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.2;
    const flick = a + 0.34;
    d += `M 0 0 Q ${pt(a, r * 0.62)} ${pt(flick, r)} `;
  }
  return d;
}

/** Rosette of pointed leaves — yuccas, agaves, sedums. */
function rosette(r: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const w = 0.13;
    d += `M 0 0 L ${pt(a - w, r * 0.55)} L ${pt(a, r)} L ${pt(a + w, r * 0.55)} Z `;
  }
  return d;
}

export interface SymbolGeometry {
  /** Main canopy outline. */
  outline: string;
  /** Interior texture drawn as a stroke-only overlay. */
  detail?: string;
  /** Draw a trunk/crown dot at the centre. */
  centerDot: number;
  /** Interior line weight relative to the outline. */
  detailOpacity: number;
}

export function symbolGeometry(sym: PlantSymbol, r: number): SymbolGeometry {
  switch (sym) {
    case 'tree-deciduous':
      return {
        outline: scallop(r, 11, 0.26),
        detail: radials(r * 0.86, 9) + arcs(r * 0.5, 5),
        centerDot: r * 0.09,
        detailOpacity: 0.45,
      };
    case 'tree-evergreen':
      return {
        outline: spiky(r, 20, 0.2),
        detail: radials(r * 0.78, 16),
        centerDot: r * 0.09,
        detailOpacity: 0.4,
      };
    case 'tree-ornamental':
      return {
        outline: scallop(r, 14, 0.2),
        detail: radials(r * 0.8, 7),
        centerDot: r * 0.08,
        detailOpacity: 0.4,
      };
    case 'shrub':
      return { outline: scallop(r, 8, 0.3), centerDot: 0, detailOpacity: 0.4 };
    case 'shrub-evergreen':
      return { outline: spiky(r, 13, 0.22), centerDot: 0, detailOpacity: 0.4 };
    case 'grass':
      return { outline: circle(r), detail: blades(r * 0.95, 11), centerDot: 0, detailOpacity: 0.85 };
    case 'succulent':
      return { outline: rosette(r, 9), centerDot: r * 0.1, detailOpacity: 0.6 };
    case 'groundcover':
      return { outline: circle(r), detail: stipple(r), centerDot: 0, detailOpacity: 0.7 };
    case 'vine':
      return { outline: circle(r), detail: spiral(r * 0.9), centerDot: 0, detailOpacity: 0.8 };
    case 'perennial':
    default:
      return { outline: scallop(r, 6, 0.34), centerDot: r * 0.14, detailOpacity: 0.5 };
  }
}

function circle(r: number): string {
  return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;
}

function radials(r: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    d += `M ${pt(a, r * 0.28)} L ${pt(a, r)} `;
  }
  return d;
}

function arcs(r: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    d += `M ${pt(a - 0.35, r)} A ${r} ${r} 0 0 1 ${pt(a + 0.35, r)} `;
  }
  return d;
}

function stipple(r: number): string {
  let d = '';
  const rings = 3;
  for (let ring = 1; ring <= rings; ring++) {
    const rr = (r * ring) / (rings + 0.4);
    const count = ring * 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.5;
      const p = pt(a, rr).split(' ');
      d += `M ${p[0]} ${p[1]} l 0.001 0 `;
    }
  }
  return d;
}

function spiral(r: number): string {
  let d = 'M 0 0';
  const turns = 2.2;
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    d += ` L ${pt(a, r * t)}`;
  }
  return d;
}

/** Slightly darker companion to a foliage colour, for symbol outlines. */
export function shade(hex: string, amount = 0.72): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = Math.round(((v >> 16) & 255) * amount);
  const g = Math.round(((v >> 8) & 255) * amount);
  const b = Math.round((v & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
