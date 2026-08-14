/**
 * Automated plan review.
 *
 * These are the mistakes that show up on real residential plans: trees that
 * will grow into the house or over the neighbour's roof, shrubs specified for
 * sun that end up in shade, woody material inside a utility easement, and
 * structures pushed past the recorded building line. Catching them on the
 * drawing costs nothing; catching them in year eight costs a crane.
 */

import type { AreaObj, DesignObj, PlantObj, Pt } from './types';
import { dist, distToPolyline, netArea, pointInPolygon } from './geometry';
import { getSpecies, SUN_MAX_HOURS, SUN_MIN_HOURS } from '../data/plants';
import {
  FRONT_BUILDING_LINE,
  FRONT_EASEMENT_DEPTH,
  HOUSE_OUTLINE,
  LOT_DEPTH,
  LOT_WIDTH,
} from '../data/property';
export type Severity = 'error' | 'warn' | 'info';

export interface CheckResult {
  id: string;
  severity: Severity;
  objectId?: string;
  title: string;
  detail: string;
}

/**
 * @param exposure Direct-sun hours per plant id, from `computeExposure`.
 *                 Pass null to skip the exposure checks.
 */
export function runChecks(
  objects: DesignObj[],
  exposure: Map<string, number> | null,
): CheckResult[] {
  const out: CheckResult[] = [];
  const plants = objects.filter((o): o is PlantObj => o.kind === 'plant');

  for (const p of plants) {
    const sp = getSpecies(p.speciesId);
    if (!sp) continue;
    const r = p.radiusFt ?? sp.w / 2;
    const woody =
      sp.type === 'shade-tree' ||
      sp.type === 'ornamental-tree' ||
      sp.type === 'evergreen-shrub' ||
      sp.type === 'deciduous-shrub';

    // Mature canopy crossing a property line. Vines are trained on a
    // vertical surface, so their spread never hangs over the neighbour.
    const over = sp.type === 'vine' ? 0 : overhang(p.at, r);
    if (over > 0.5) {
      out.push({
        id: `${p.id}-overhang`,
        severity: over > r * 0.45 ? 'error' : 'warn',
        objectId: p.id,
        title: `${sp.common} overhangs the property line`,
        detail: `At mature spread (${sp.w}′) this canopy reaches about ${over.toFixed(
          1,
        )}′ past the line. Texas law lets a neighbour trim back to it, which will leave the crown one-sided. Move it in or pick a narrower tree.`,
      });
    }

    // Canopy or root zone crowding the house.
    const dHouse = distToPolyline(p.at, HOUSE_OUTLINE, true);
    const inside = pointInPolygon(p.at, HOUSE_OUTLINE);
    if (inside) {
      out.push({
        id: `${p.id}-in-house`,
        severity: 'error',
        objectId: p.id,
        title: `${sp.common} is inside the building footprint`,
        detail: 'Move it out of the house outline.',
      });
    } else if (sp.type === 'shade-tree' && dHouse < 15) {
      out.push({
        id: `${p.id}-house-clear`,
        severity: dHouse < 10 ? 'error' : 'warn',
        objectId: p.id,
        title: `${sp.common} is only ${dHouse.toFixed(1)}′ from the house`,
        detail:
          'Large trees want 15–20′ of clearance on our expansive clay — closer than that and the roots start pulling moisture from under the slab, plus limbs over the roof. Move it out.',
      });
    } else if (woody && dHouse < r * 0.75 && sp.type !== 'shade-tree') {
      out.push({
        id: `${p.id}-foundation`,
        severity: 'warn',
        objectId: p.id,
        title: `${sp.common} will grow into the wall`,
        detail: `Mature half-spread is ${r.toFixed(1)}′ but it sits ${dHouse.toFixed(
          1,
        )}′ off the house. Pull it out so it never needs shearing flat on one side.`,
      });
    }

    // Woody material inside the frontage utility easement.
    if (woody && p.at.y < FRONT_EASEMENT_DEPTH) {
      out.push({
        id: `${p.id}-easement`,
        severity: 'warn',
        objectId: p.id,
        title: `${sp.common} sits in the 10′ T.P.& L. easement`,
        detail:
          'The utility can excavate this strip without replacing what it removes. Keep woody plants out — perennials and turf only.',
      });
    }

    // Exposure mismatch, checked against modelled direct-sun hours.
    const hrs = exposure?.get(p.id);
    if (hrs !== undefined) {
      const min = SUN_MIN_HOURS[sp.sun];
      const max = SUN_MAX_HOURS[sp.sun];
      if (hrs < min - 1) {
        out.push({
          id: `${p.id}-too-dark`,
          severity: 'warn',
          objectId: p.id,
          title: `${sp.common} is short on sun here`,
          detail: `This spot gets about ${hrs.toFixed(1)} hrs of direct sun on the sampled day; it wants at least ${min}. Expect it to stretch, flower poorly, or thin out.`,
        });
      } else if (hrs > max + 1) {
        out.push({
          id: `${p.id}-too-bright`,
          severity: 'warn',
          objectId: p.id,
          title: `${sp.common} will scorch here`,
          detail: `About ${hrs.toFixed(1)} hrs of direct sun, and this one tops out near ${max}. In a North Texas August that means crisped leaf margins.`,
        });
      }
    }
  }

  // Trees planted into each other.
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const a = plants[i];
      const b = plants[j];
      const sa = getSpecies(a.speciesId);
      const sb = getSpecies(b.speciesId);
      if (!sa || !sb) continue;
      if (sa.type !== 'shade-tree' && sa.type !== 'ornamental-tree') continue;
      if (sb.type !== 'shade-tree' && sb.type !== 'ornamental-tree') continue;
      const ra = a.radiusFt ?? sa.w / 2;
      const rb = b.radiusFt ?? sb.w / 2;
      const d = dist(a.at, b.at);
      if (d < (ra + rb) * 0.62) {
        out.push({
          id: `${a.id}-${b.id}-crowd`,
          severity: 'warn',
          objectId: a.id,
          title: `${sa.common} and ${sb.common} are crowded`,
          detail: `Centres are ${d.toFixed(1)}′ apart but mature half-spreads total ${(ra + rb).toFixed(
            1,
          )}′. One will win and the other will lean away from it.`,
        });
      }
    }
  }

  // Permanent construction forward of the recorded building line.
  for (const o of objects) {
    if (o.kind !== 'area') continue;
    const a = o as AreaObj;
    const isPaving = a.surface.startsWith('patio') || a.surface.startsWith('deck');
    if (!isPaving) continue;
    const minY = Math.min(...a.points.map((p) => p.y));
    if (minY < FRONT_BUILDING_LINE) {
      out.push({
        id: `${o.id}-bl`,
        severity: a.surface.startsWith('deck') ? 'error' : 'info',
        objectId: o.id,
        title: `${a.name ?? 'Paving'} crosses the 25′ building line`,
        detail:
          'The plat sets a 25′ front building line. Flatwork at grade is usually fine, but a deck or any roofed structure is not — check with the City of McKinney before you build.',
      });
    }
  }

  // Overlapping surfaces each bill their full area, so the takeoff quietly
  // over-orders. Total coverage exceeding the lot is the tell.
  let covered = 0;
  for (const o of objects) {
    if (o.kind !== 'area') continue;
    covered += netArea(o.points, o.holes);
  }
  const lot = LOT_WIDTH * LOT_DEPTH;
  if (covered > lot * 1.02) {
    out.push({
      id: 'coverage-overlap',
      severity: 'warn',
      title: 'Drawn surfaces overlap',
      detail: `Beds, lawn and paving add up to ${Math.round(covered).toLocaleString()} sq ft on an ${lot.toLocaleString()} sq ft lot, so at least ${Math.round(
        covered - lot,
      ).toLocaleString()} sq ft is drawn twice. Each overlapping shape bills its full area, which inflates the estimate — trim the shapes so they meet rather than stack.`,
    });
  }

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** How far a mature canopy of radius r at p reaches past the nearest lot line. */
function overhang(p: Pt, r: number): number {
  return Math.max(
    r - p.x, // west line
    r - (LOT_WIDTH - p.x), // east line
    r - p.y, // front line
    r - (LOT_DEPTH - p.y), // rear line
    0,
  );
}

/** Headline stats for the summary strip. */
export function designStats(objects: DesignObj[]) {
  let plants = 0;
  let trees = 0;
  let natives = 0;
  for (const o of objects) {
    if (o.kind !== 'plant') continue;
    const sp = getSpecies(o.speciesId);
    if (!sp) continue;
    plants++;
    if (sp.type === 'shade-tree' || sp.type === 'ornamental-tree') trees++;
    if (sp.native) natives++;
  }
  return { plants, trees, natives, nativePct: plants ? Math.round((natives / plants) * 100) : 0 };
}
