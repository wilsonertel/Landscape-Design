/**
 * Solar position and shadow projection.
 *
 * Sun position uses the NOAA solar-calculator approximation, which is good
 * to well under a degree — far more precision than a planting plan needs.
 * Shadows are a flat-ground projection: each object is extruded from its
 * plan outline by (height / tan(altitude)) in the anti-solar direction.
 * The lot is essentially flat, so that holds up here.
 */

import type { AreaObj, DesignObj, Pt } from './types';
import { boundsOf, pointInPolygon, signedArea } from './geometry';
import { getSpecies } from '../data/plants';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface SunPos {
  /** Degrees above the horizon. Negative means the sun is down. */
  altitude: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
}

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/** US daylight saving: second Sunday in March to first Sunday in November. */
export function isDST(year: number, month: number, day: number): boolean {
  const secondSundayMarch = nthSunday(year, 2, 2);
  const firstSundayNov = nthSunday(year, 10, 1);
  const t = Date.UTC(year, month, day);
  return t >= Date.UTC(year, 2, secondSundayMarch) && t < Date.UTC(year, 10, firstSundayNov);
}

function nthSunday(year: number, monthIdx: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstDow) % 7);
  return firstSunday + (n - 1) * 7;
}

/**
 * @param month 0-11
 * @param hour  local clock hour (decimal), e.g. 14.5 for 2:30pm
 */
export function solarPosition(
  latitude: number,
  longitude: number,
  utcOffsetStd: number,
  year: number,
  month: number,
  day: number,
  hour: number,
): SunPos {
  const tz = utcOffsetStd + (isDST(year, month, day) ? 1 : 0);
  const doy = dayOfYear(new Date(Date.UTC(year, month, day)));

  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24);
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timeOffset = eqtime + 4 * longitude - 60 * tz; // minutes
  const tst = hour * 60 + timeOffset;
  const ha = (tst / 4 - 180) * D2R;

  const lat = latitude * D2R;
  const cosZen =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const altitude = 90 - zen * R2D;

  let az = 0;
  const denom = Math.cos(lat) * Math.sin(zen);
  if (Math.abs(denom) > 1e-9) {
    const cosAz = -(Math.sin(lat) * Math.cos(zen) - Math.sin(decl)) / denom;
    az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * R2D;
  }
  const azimuth = ha > 0 ? 360 - az : az;

  return { altitude, azimuth };
}

/** Sunrise/sunset local clock hours, or null if the sun never rises/sets. */
export function daylightWindow(
  latitude: number,
  longitude: number,
  utcOffsetStd: number,
  year: number,
  month: number,
  day: number,
): { sunrise: number; sunset: number } {
  let sunrise = 12;
  let sunset = 12;
  let prev = solarPosition(latitude, longitude, utcOffsetStd, year, month, day, 0).altitude;
  for (let h = 0.25; h <= 24; h += 0.25) {
    const alt = solarPosition(latitude, longitude, utcOffsetStd, year, month, day, h).altitude;
    if (prev < 0 && alt >= 0) sunrise = h;
    if (prev >= 0 && alt < 0) sunset = h;
    prev = alt;
  }
  return { sunrise, sunset };
}

/**
 * The 2D offset a shadow travels, in feet, for an object of the given height.
 * +x is east, +y is north; azimuth is clockwise from north.
 */
export function shadowVector(sun: SunPos, height: number): Pt | null {
  if (sun.altitude <= 1.5) return null; // sun on the horizon — shadows run to infinity
  const len = height / Math.tan(sun.altitude * D2R);
  const a = sun.azimuth * D2R;
  return { x: -Math.sin(a) * len, y: -Math.cos(a) * len };
}

/**
 * The region swept by a footprint translated along the shadow vector — the
 * Minkowski sum of the polygon with the segment [0, offset].
 *
 * It is returned as a LIST of rings (the footprint, its translated copy, and
 * one quad per swept edge) rather than a single outline. A convex hull would
 * be simpler, but it is wrong for any concave footprint: this house is
 * L-shaped, and its hull fills in the notch, which would mark the entire
 * front-right yard as shaded around the clock.
 *
 * Every ring is normalized counter-clockwise so the parts can be filled as
 * one nonzero path without overlaps cancelling into holes.
 */
export function shadowParts(points: Pt[], offset: Pt): Pt[][] {
  const moved = points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
  const parts: Pt[][] = [ccw(points), ccw(moved)];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    parts.push(
      ccw([a, b, { x: b.x + offset.x, y: b.y + offset.y }, { x: a.x + offset.x, y: a.y + offset.y }]),
    );
  }
  return parts;
}

const ccw = (ring: Pt[]): Pt[] => (signedArea(ring) < 0 ? ring.slice().reverse() : ring);

export const pointInParts = (p: Pt, parts: Pt[][]): boolean =>
  parts.some((ring) => pointInPolygon(p, ring));

export interface Caster {
  id: string;
  /** The design object this caster came from (a fence yields one per run). */
  ownerId: string;
  outline: Pt[];
  height: number;
  /** Deciduous canopies let winter sun through. */
  deciduous: boolean;
  kind: 'structure' | 'fence' | 'plant';
}

/** Everything on the plan tall enough to matter for shade. */
export function collectCasters(objs: DesignObj[]): Caster[] {
  const out: Caster[] = [];
  for (const o of objs) {
    if ((o.kind === 'structure' || o.kind === 'area') && (o as AreaObj).height) {
      const a = o as AreaObj;
      out.push({
        id: a.id,
        ownerId: a.id,
        outline: a.points,
        height: a.height!,
        deciduous: false,
        kind: 'structure',
      });
    } else if (o.kind === 'path' && o.material === 'fence-wood' && o.points.length > 1) {
      // A fence casts a long thin shadow; treat each run as a 6' tall ribbon.
      for (let i = 1; i < o.points.length; i++) {
        const a = o.points[i - 1];
        const b = o.points[i];
        out.push({
          id: `${o.id}-${i}`,
          ownerId: o.id,
          outline: ribbon(a, b, o.width || 0.5),
          height: 6,
          deciduous: false,
          kind: 'fence',
        });
      }
    } else if (o.kind === 'plant') {
      const sp = getSpecies(o.speciesId);
      if (!sp) continue;
      // Only things with real canopy height cast usable shade.
      if (sp.h < 6) continue;
      // A vine is trained flat on a fence or wall, so its "spread" is a
      // vertical plane, not a canopy hanging over the ground beside it.
      if (sp.type === 'vine') continue;
      const r = o.radiusFt ?? sp.w / 2;
      out.push({
        id: o.id,
        ownerId: o.id,
        outline: circle(o.at, r, 16),
        // Shade comes from the canopy, whose centre sits well up the plant.
        height: sp.h * 0.75,
        deciduous: !sp.evergreen,
        kind: 'plant',
      });
    }
  }
  return out;
}

function ribbon(a: Pt, b: Pt, w: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

function circle(c: Pt, r: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r };
  });
}

export interface ShadowShape {
  id: string;
  /** Rings making up the swept silhouette; fill them as one nonzero path. */
  parts: Pt[][];
  kind: Caster['kind'];
}

export function castShadows(
  casters: Caster[],
  sun: SunPos,
  leafOn: boolean,
): ShadowShape[] {
  const out: ShadowShape[] = [];
  for (const c of casters) {
    if (c.deciduous && !leafOn) continue;
    const v = shadowVector(sun, c.height);
    if (!v) continue;
    out.push({ id: c.id, parts: shadowParts(c.outline, v), kind: c.kind });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sun-hours grid                                                      */
/* ------------------------------------------------------------------ */

export interface SunGrid {
  /** Cell size in feet. */
  cell: number;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  /** Direct-sun hours per cell for the sampled day. */
  hours: Float32Array;
  maxHours: number;
}

/**
 * Sample direct sun across the site for one day. This is what turns "is this
 * a sunny spot?" from a guess into something the plan can actually answer —
 * and it is what the plant-fit warnings are checked against.
 */
export function computeSunGrid(
  objs: DesignObj[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opts: {
    latitude: number;
    longitude: number;
    utcOffsetStd: number;
    year: number;
    month: number;
    day: number;
    cell?: number;
    stepMinutes?: number;
    leafOn?: boolean;
  },
): SunGrid {
  const cell = opts.cell ?? 2.5;
  const step = (opts.stepMinutes ?? 30) / 60;
  const leafOn = opts.leafOn ?? true;

  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
  const rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cell));
  const hours = new Float32Array(cols * rows);

  const casters = collectCasters(objs).filter((c) => !(c.deciduous && !leafOn));

  const { sunrise, sunset } = daylightWindow(
    opts.latitude,
    opts.longitude,
    opts.utcOffsetStd,
    opts.year,
    opts.month,
    opts.day,
  );

  let maxHours = 0;
  for (let h = sunrise; h <= sunset; h += step) {
    const sun = solarPosition(
      opts.latitude,
      opts.longitude,
      opts.utcOffsetStd,
      opts.year,
      opts.month,
      opts.day,
      h,
    );
    if (sun.altitude <= 3) continue; // grazing light does little for plants
    maxHours += step;

    const shadows: { parts: Pt[][]; b: ReturnType<typeof boundsOf> }[] = [];
    for (const c of casters) {
      const v = shadowVector(sun, c.height);
      if (!v) continue;
      const parts = shadowParts(c.outline, v);
      shadows.push({ parts, b: boundsOf(parts.flat()) });
    }

    for (let r = 0; r < rows; r++) {
      const y = bounds.minY + (r + 0.5) * cell;
      for (let col = 0; col < cols; col++) {
        const x = bounds.minX + (col + 0.5) * cell;
        let shaded = false;
        for (const s of shadows) {
          if (x < s.b.minX || x > s.b.maxX || y < s.b.minY || y > s.b.maxY) continue;
          if (pointInParts({ x, y }, s.parts)) {
            shaded = true;
            break;
          }
        }
        if (!shaded) hours[r * cols + col] += step;
      }
    }
  }

  return {
    cell,
    cols,
    rows,
    originX: bounds.minX,
    originY: bounds.minY,
    hours,
    maxHours,
  };
}

/* ------------------------------------------------------------------ */
/* Per-plant exposure                                                  */
/* ------------------------------------------------------------------ */

export interface ExposureSample {
  /** Object id, so a plant is never counted as shading itself. */
  id: string;
  at: Pt;
  /** The plant's own canopy height — only taller things can shade it. */
  height: number;
}

/**
 * Direct-sun hours at specific points, excluding each point's own caster.
 *
 * This matters more than it sounds. Two corrections separate a useful answer
 * from a useless one:
 *
 *  1. A plant never shades itself. Sampling the grid at a tree's trunk puts
 *     the point under that tree's own canopy, so every tree on the plan would
 *     report zero sun and get flagged as too shady.
 *  2. Only TALLER things shade you. Exposure is judged at the plant's own
 *     canopy height, not at grade — otherwise a hedge row, which is meant to
 *     be planted tight, reads as deep shade because each shrub casts a long
 *     low-angle shadow onto its neighbours at dawn and dusk.
 */
export function computeExposure(
  objs: DesignObj[],
  samples: ExposureSample[],
  opts: {
    latitude: number;
    longitude: number;
    utcOffsetStd: number;
    year: number;
    month: number;
    day: number;
    stepMinutes?: number;
    leafOn?: boolean;
  },
): Map<string, number> {
  const result = new Map<string, number>();
  if (!samples.length) return result;

  const step = (opts.stepMinutes ?? 30) / 60;
  const leafOn = opts.leafOn ?? true;
  const casters = collectCasters(objs).filter((c) => !(c.deciduous && !leafOn));

  for (const s of samples) result.set(s.id, 0);

  const { sunrise, sunset } = daylightWindow(
    opts.latitude,
    opts.longitude,
    opts.utcOffsetStd,
    opts.year,
    opts.month,
    opts.day,
  );

  for (let h = sunrise; h <= sunset; h += step) {
    const sun = solarPosition(
      opts.latitude,
      opts.longitude,
      opts.utcOffsetStd,
      opts.year,
      opts.month,
      opts.day,
      h,
    );
    if (sun.altitude <= 3) continue;

    const shadows: {
      owner: string;
      height: number;
      parts: Pt[][];
      b: ReturnType<typeof boundsOf>;
    }[] = [];
    for (const c of casters) {
      const v = shadowVector(sun, c.height);
      if (!v) continue;
      const parts = shadowParts(c.outline, v);
      shadows.push({ owner: c.ownerId, height: c.height, parts, b: boundsOf(parts.flat()) });
    }

    for (const s of samples) {
      let shaded = false;
      for (const sh of shadows) {
        if (sh.owner === s.id) continue;
        if (sh.height <= s.height + 0.5) continue;
        if (s.at.x < sh.b.minX || s.at.x > sh.b.maxX || s.at.y < sh.b.minY || s.at.y > sh.b.maxY)
          continue;
        if (pointInParts(s.at, sh.parts)) {
          shaded = true;
          break;
        }
      }
      if (!shaded) result.set(s.id, (result.get(s.id) ?? 0) + step);
    }
  }

  return result;
}

export function sampleSunGrid(grid: SunGrid, p: Pt): number {
  const c = Math.floor((p.x - grid.originX) / grid.cell);
  const r = Math.floor((p.y - grid.originY) / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return grid.maxHours;
  return grid.hours[r * grid.cols + c];
}

/** Representative dates: the solstices and an equinox. */
export const SEASON_PRESETS = [
  { id: 'summer', label: 'Summer solstice', month: 5, day: 21 },
  { id: 'equinox', label: 'Equinox (Sep)', month: 8, day: 22 },
  { id: 'winter', label: 'Winter solstice', month: 11, day: 21 },
  { id: 'spring', label: 'Equinox (Mar)', month: 2, day: 20 },
] as const;
