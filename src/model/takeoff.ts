/**
 * Quantity takeoff, plant schedule, and cost estimate — the parts that turn
 * a drawing into a document you can hand to a contractor.
 */

import type { DesignObj, PlantObj } from './types';
import { netArea, perimeter } from './geometry';
import { getSpecies, type Species } from '../data/plants';
import { getPathSpec, getSurface, FEATURES, SOFT_COSTS } from '../data/materials';

export interface ScheduleRow {
  key: string;
  /** Plan key like "QV" for Quercus virginiana. */
  code: string;
  species: Species;
  qty: number;
  size: string;
  unitCost: number;
  total: number;
}

/**
 * Build the plant schedule with unique two/three letter keys, the way a
 * planting plan legend does it.
 */
export function plantSchedule(objs: DesignObj[]): ScheduleRow[] {
  const groups = new Map<string, { species: Species; qty: number; size: string }>();
  for (const o of objs) {
    if (o.kind !== 'plant') continue;
    const sp = getSpecies((o as PlantObj).speciesId);
    if (!sp) continue;
    const size = (o as PlantObj).size ?? sp.size;
    const key = `${sp.id}::${size}`;
    const g = groups.get(key);
    if (g) g.qty += 1;
    else groups.set(key, { species: sp, qty: 1, size });
  }

  const used = new Set<string>();
  const rows: ScheduleRow[] = [];
  for (const [key, g] of groups) {
    const code = uniqueCode(g.species, used);
    const unitCost = sizeAdjustedCost(g.species, g.size);
    rows.push({
      key,
      code,
      species: g.species,
      qty: g.qty,
      size: g.size,
      unitCost,
      total: unitCost * g.qty,
    });
  }

  // Trees first, then shrubs, then everything else — standard schedule order.
  const rank: Record<string, number> = {
    'shade-tree': 0,
    'ornamental-tree': 1,
    'evergreen-shrub': 2,
    'deciduous-shrub': 3,
    'ornamental-grass': 4,
    perennial: 5,
    succulent: 6,
    groundcover: 7,
    vine: 8,
  };
  rows.sort(
    (a, b) =>
      (rank[a.species.type] ?? 9) - (rank[b.species.type] ?? 9) ||
      a.species.common.localeCompare(b.species.common),
  );
  return rows;
}

function uniqueCode(sp: Species, used: Set<string>): string {
  const [genus, epithet = ''] = sp.botanical.split(' ');
  let base = (genus[0] ?? 'X') + (epithet[0] ?? sp.common[0] ?? 'X');
  base = base.toUpperCase();
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let i = 2; i < 60; i++) {
    const c = base + i;
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  return base;
}

/**
 * Nursery stock roughly doubles in price per size step up. The species cost
 * is quoted at its default size, so scale from there.
 */
const SIZE_FACTOR: Record<string, number> = {
  '4" pot': 0.35,
  '1 gal': 0.6,
  '3 gal': 1.0,
  '5 gal': 1.5,
  '7 gal': 2.1,
  '15 gal': 3.4,
  '30 gal': 6.0,
  '45 gal': 9.0,
  '65 gal': 13.0,
};

function factorFor(size: string): number {
  for (const k of Object.keys(SIZE_FACTOR)) if (size.startsWith(k)) return SIZE_FACTOR[k];
  return 1;
}

export function sizeAdjustedCost(sp: Species, size: string): number {
  if (size === sp.size) return sp.cost;
  const base = factorFor(sp.size);
  const want = factorFor(size);
  if (!base || !want) return sp.cost;
  return Math.round((sp.cost * want) / base);
}

/** Purchase sizes offered for a species, largest sensible range by type. */
export function sizeOptions(sp: Species): string[] {
  switch (sp.type) {
    case 'shade-tree':
      return ['15 gal', '30 gal', '45 gal / 3" cal.', '65 gal / 4" cal.'];
    case 'ornamental-tree':
      return ['7 gal', '15 gal', '30 gal', '45 gal'];
    case 'evergreen-shrub':
    case 'deciduous-shrub':
      return ['1 gal', '3 gal', '5 gal', '7 gal', '15 gal'];
    case 'groundcover':
      return ['4" pot', '1 gal'];
    default:
      return ['4" pot', '1 gal', '3 gal', '5 gal'];
  }
}

/* ------------------------------------------------------------------ */
/* Material takeoff                                                    */
/* ------------------------------------------------------------------ */

export interface TakeoffLine {
  category: string;
  item: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
}

export interface Takeoff {
  lines: TakeoffLine[];
  plantRows: ScheduleRow[];
  plantsTotal: number;
  materialsTotal: number;
  softCosts: TakeoffLine[];
  softTotal: number;
  grandTotal: number;
  /** Areas by broad category, for the site-coverage summary. */
  areas: {
    lawn: number;
    beds: number;
    paving: number;
    water: number;
    existingHardscape: number;
    house: number;
  };
  /** Estimated supplemental irrigation, gallons per year. */
  waterGalPerYear: number;
}

export function computeTakeoff(objs: DesignObj[], baseObjs: DesignObj[]): Takeoff {
  const lines: TakeoffLine[] = [];
  const areas = {
    lawn: 0,
    beds: 0,
    paving: 0,
    water: 0,
    existingHardscape: 0,
    house: 0,
  };
  let waterGalPerYear = 0;

  // Existing conditions contribute area but never cost.
  for (const o of baseObjs) {
    if (o.kind !== 'area' && o.kind !== 'structure') continue;
    const a = netArea(o.points, o.holes);
    if (o.surface === 'existing-structure') areas.house += a;
    else if (o.surface === 'existing-concrete') areas.existingHardscape += a;
  }

  const surfaceTotals = new Map<string, number>();
  const pathLen = new Map<string, number>();
  const pathArea = new Map<string, number>();
  const featureCount = new Map<string, number>();

  for (const o of objs) {
    if (o.kind === 'area') {
      const a = netArea(o.points, o.holes);
      const spec = getSurface(o.surface);
      surfaceTotals.set(o.surface, (surfaceTotals.get(o.surface) ?? 0) + a);
      waterGalPerYear += a * spec.waterGalSqFtYr;
      if (spec.group === 'Lawn') areas.lawn += a;
      else if (spec.group === 'Planting bed') areas.beds += a;
      else if (spec.group === 'Paving') areas.paving += a;
      else if (spec.group === 'Water') areas.water += a;
    } else if (o.kind === 'path') {
      const len = perimeter(o.points, !!o.closed);
      const spec = getPathSpec(o.material);
      if (spec.priceBy === 'area') {
        pathArea.set(o.material, (pathArea.get(o.material) ?? 0) + len * o.width);
        areas.paving += len * o.width;
      } else {
        pathLen.set(o.material, (pathLen.get(o.material) ?? 0) + len);
      }
    } else if (o.kind === 'feature') {
      featureCount.set(o.feature, (featureCount.get(o.feature) ?? 0) + 1);
    }
  }

  for (const [id, qty] of surfaceTotals) {
    const spec = getSurface(id as never);
    if (!spec.costPerSqFt) continue;
    lines.push({
      category: spec.group,
      item: spec.name,
      qty: Math.round(qty),
      unit: 'sq ft',
      unitCost: spec.costPerSqFt,
      total: qty * spec.costPerSqFt,
    });
  }
  for (const [id, qty] of pathArea) {
    const spec = getPathSpec(id as never);
    lines.push({
      category: spec.group,
      item: spec.name,
      qty: Math.round(qty),
      unit: 'sq ft',
      unitCost: spec.cost,
      total: qty * spec.cost,
    });
  }
  for (const [id, qty] of pathLen) {
    const spec = getPathSpec(id as never);
    lines.push({
      category: spec.group,
      item: spec.name,
      qty: Math.round(qty),
      unit: 'lin ft',
      unitCost: spec.cost,
      total: qty * spec.cost,
    });
  }
  for (const [id, qty] of featureCount) {
    const spec = FEATURES[id];
    if (!spec) continue;
    lines.push({
      category: spec.group,
      item: spec.name,
      qty,
      unit: 'ea',
      unitCost: spec.cost,
      total: qty * spec.cost,
    });
  }

  const plantRows = plantSchedule(objs);
  const plantsTotal = plantRows.reduce((s, r) => s + r.total, 0);
  const materialsTotal = lines.reduce((s, l) => s + l.total, 0);

  const softCosts: TakeoffLine[] = [];
  if (areas.beds > 0) {
    softCosts.push({
      category: 'Site prep',
      item: 'Bed preparation — till + 3″ compost',
      qty: Math.round(areas.beds),
      unit: 'sq ft',
      unitCost: SOFT_COSTS.bedPrepPerSqFt,
      total: areas.beds * SOFT_COSTS.bedPrepPerSqFt,
    });
  }
  const irrigated = areas.beds + areas.lawn;
  if (irrigated > 0) {
    softCosts.push({
      category: 'Irrigation',
      item: 'Irrigation zones / retrofit',
      qty: Math.round(irrigated),
      unit: 'sq ft',
      unitCost: SOFT_COSTS.irrigationPerSqFt,
      total: irrigated * SOFT_COSTS.irrigationPerSqFt,
    });
  }
  const subtotal = plantsTotal + materialsTotal + softCosts.reduce((s, l) => s + l.total, 0);
  if (SOFT_COSTS.contingencyPct > 0 && subtotal > 0) {
    softCosts.push({
      category: 'Contingency',
      item: `Contingency @ ${SOFT_COSTS.contingencyPct}%`,
      qty: 1,
      unit: 'ls',
      unitCost: (subtotal * SOFT_COSTS.contingencyPct) / 100,
      total: (subtotal * SOFT_COSTS.contingencyPct) / 100,
    });
  }
  const softTotal = softCosts.reduce((s, l) => s + l.total, 0);

  lines.sort((a, b) => a.category.localeCompare(b.category) || b.total - a.total);

  return {
    lines,
    plantRows,
    plantsTotal,
    materialsTotal,
    softCosts,
    softTotal,
    grandTotal: plantsTotal + materialsTotal + softTotal,
    areas,
    waterGalPerYear,
  };
}

export const usd = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/**
 * Unit rates keep their cents below $100. Rounding $7.50/lin ft to "$8" makes
 * the line item look like it does not multiply out to its own total, which is
 * the first thing anyone checks on an estimate.
 */
export const usdRate = (n: number) =>
  n >= 100
    ? usd(n)
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
