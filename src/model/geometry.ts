import type { Pt } from './types';

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });

/** Signed area (positive when the ring winds counter-clockwise). */
export function signedArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return s / 2;
}

export const polygonArea = (pts: Pt[]) => Math.abs(signedArea(pts));

/** Net area of an outline minus its holes. */
export function netArea(outline: Pt[], holes?: Pt[][]): number {
  let a = polygonArea(outline);
  for (const h of holes ?? []) a -= polygonArea(h);
  return Math.max(0, a);
}

export function perimeter(pts: Pt[], closed = true): number {
  let p = 0;
  for (let i = 1; i < pts.length; i++) p += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 2) p += dist(pts[pts.length - 1], pts[0]);
  return p;
}

export function centroid(pts: Pt[]): Pt {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    // Degenerate ring — fall back to the vertex average.
    const s = pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return scale(s, 1 / Math.max(1, pts.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    cx += (pts[j].x + pts[i].x) * f;
    cy += (pts[j].y + pts[i].y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const hit =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Point inside an outline but outside all of its holes. */
export function pointInArea(p: Pt, outline: Pt[], holes?: Pt[][]): boolean {
  if (!pointInPolygon(p, outline)) return false;
  for (const h of holes ?? []) if (pointInPolygon(p, h)) return false;
  return true;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(pts: Pt[]): Bounds {
  const b: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

/** Shortest distance from p to the segment ab, plus the closest point. */
export function closestOnSegment(p: Pt, a: Pt, b: Pt): { pt: Pt; d: number } {
  const ab = sub(b, a);
  const len2 = ab.x * ab.x + ab.y * ab.y;
  const t =
    len2 < 1e-12
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2));
  const pt = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { pt, d: dist(p, pt) };
}

export function distToPolyline(p: Pt, pts: Pt[], closed = false): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, closestOnSegment(p, pts[i - 1], pts[i]).d);
  }
  if (closed && pts.length > 2) {
    best = Math.min(best, closestOnSegment(p, pts[pts.length - 1], pts[0]).d);
  }
  return best;
}

/**
 * Ramer–Douglas–Peucker simplification, used to keep freehand-drawn bed
 * outlines from carrying hundreds of near-collinear vertices.
 */
export function simplify(pts: Pt[], tol = 0.25): Pt[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = closestOnSegment(pts[i], first, last).d;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [first, last];
  return [
    ...simplify(pts.slice(0, idx + 1), tol).slice(0, -1),
    ...simplify(pts.slice(idx), tol),
  ];
}

/**
 * Catmull-Rom -> cubic Bezier, so hand-drawn beds render as the smooth
 * flowing curves a planting plan expects rather than faceted polygons.
 */
export function smoothClosedPath(pts: Pt[], tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return polylinePath(pts, true);
  const at = (i: number) => pts[(i + n) % n];
  let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension * 2,
      y: p1.y + ((p2.y - p0.y) / 6) * tension * 2,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension * 2,
      y: p2.y - ((p3.y - p1.y) / 6) * tension * 2,
    };
    d += ` C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)} ${c2.x.toFixed(3)} ${c2.y.toFixed(
      3,
    )} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
  }
  return d + ' Z';
}

export function smoothOpenPath(pts: Pt[], tension = 0.5): string {
  const n = pts.length;
  if (n < 3) return polylinePath(pts, false);
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension * 2,
      y: p1.y + ((p2.y - p0.y) / 6) * tension * 2,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension * 2,
      y: p2.y - ((p3.y - p1.y) / 6) * tension * 2,
    };
    d += ` C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)} ${c2.x.toFixed(3)} ${c2.y.toFixed(
      3,
    )} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
  }
  return d;
}

export function polylinePath(pts: Pt[], closed: boolean): string {
  if (!pts.length) return '';
  let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(3)} ${pts[i].y.toFixed(3)}`;
  }
  return closed ? d + ' Z' : d;
}

/** Rectangle helper — used for the survey base geometry. */
export function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** A circle approximated as a polygon, for round patios and pond edges. */
export function circlePts(c: Pt, r: number, segments = 48): Pt[] {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return { x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r };
  });
}

/**
 * Offset a closed ring outward (positive) or inward (negative) by `d` feet,
 * using per-vertex miter offsets. Good enough for setback bands and for
 * generating a mulch ring around a bed; not a full polygon-clipping library.
 */
export function offsetRing(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const ccw = signedArea(pts) > 0;
  const s = ccw ? d : -d;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const n1 = normalOf(prev, cur);
    const n2 = normalOf(cur, next);
    let bx = n1.x + n2.x;
    let by = n1.y + n2.y;
    const len = Math.hypot(bx, by);
    if (len < 1e-9) {
      out.push({ x: cur.x + n1.x * s, y: cur.y + n1.y * s });
      continue;
    }
    bx /= len;
    by /= len;
    // Miter length grows as the corner sharpens; clamp to avoid spikes.
    const cosHalf = Math.max(0.2, bx * n1.x + by * n1.y);
    const m = Math.min(s / cosHalf, s * 4);
    out.push({ x: cur.x + bx * m, y: cur.y + by * m });
  }
  return out;
}

function normalOf(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  // Left-hand normal.
  return { x: -dy / l, y: dx / l };
}

/**
 * Lay out `count` plants inside a polygon on a staggered triangular grid at
 * the given on-center spacing — the standard way to mass a groundcover or
 * shrub drift on a planting plan.
 */
export function triangularFill(
  outline: Pt[],
  holes: Pt[][] | undefined,
  spacing: number,
  inset = 0,
): Pt[] {
  const b = boundsOf(outline);
  const rowH = spacing * Math.sqrt(3) / 2;
  const pts: Pt[] = [];
  let row = 0;
  for (let y = b.minY + rowH / 2; y <= b.maxY; y += rowH, row++) {
    const xOff = row % 2 === 0 ? 0 : spacing / 2;
    for (let x = b.minX + xOff + spacing / 2; x <= b.maxX; x += spacing) {
      const p = { x, y };
      if (!pointInArea(p, outline, holes)) continue;
      if (inset > 0 && distToPolyline(p, outline, true) < inset) continue;
      pts.push(p);
    }
  }
  return pts;
}

/**
 * The widest continuous horizontal run inside a polygon at a given y.
 *
 * Used to place area labels: a bounding box lies about L-shaped and notched
 * beds, so "Front foundation bed" would be judged to fit and then spill out
 * of the 6′ leg it actually lands in.
 */
export function spanAtY(pts: Pt[], y: number): { x0: number; x1: number } | null {
  const xs: number[] = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j];
    const b = pts[i];
    if (a.y > y !== b.y > y) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  if (xs.length < 2) return null;
  xs.sort((p, q) => p - q);
  let best: { x0: number; x1: number } | null = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (!best || xs[i + 1] - xs[i] > best.x1 - best.x0) best = { x0: xs[i], x1: xs[i + 1] };
  }
  return best;
}

/** Format a decimal foot value the way a plan sheet does: 12'-6". */
export function ftIn(v: number): string {
  const neg = v < 0;
  const abs = Math.abs(v);
  let ft = Math.floor(abs);
  let inch = Math.round((abs - ft) * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return `${neg ? '-' : ''}${ft}'-${inch}"`;
}

export const fmtArea = (sqft: number) =>
  `${Math.round(sqft).toLocaleString()} sq ft`;
