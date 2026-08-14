/**
 * Surface and linear materials, with plan-view rendering styles and rough
 * installed unit costs for the DFW market (2024–2025 retail/contractor
 * range, mid-point). Budget only — always confirm with real bids.
 */

import type { PathMaterialId, SurfaceId } from '../model/types';

export interface SurfaceSpec {
  id: SurfaceId;
  name: string;
  /** Grouping for the tool palette. */
  group: 'Lawn' | 'Planting bed' | 'Paving' | 'Water' | 'Existing';
  fill: string;
  stroke: string;
  /** SVG pattern id defined in <defs>, if the surface is hatched. */
  pattern?: string;
  /** Installed cost per square foot. */
  costPerSqFt: number;
  unit: 'sq ft';
  /** Rough gallons per sq ft per year of supplemental irrigation. */
  waterGalSqFtYr: number;
  notes: string;
}

export const SURFACES: SurfaceSpec[] = [
  {
    id: 'lawn-bermuda',
    name: 'Bermuda sod',
    group: 'Lawn',
    fill: '#a9c67f',
    stroke: '#8bab63',
    costPerSqFt: 0.95,
    unit: 'sq ft',
    waterGalSqFtYr: 22,
    notes:
      'Full sun only — it thins badly under 6 hrs. Toughest wear tolerance, goes dormant tan in winter.',
  },
  {
    id: 'lawn-zoysia',
    name: 'Zoysia sod',
    group: 'Lawn',
    fill: '#9dc077',
    stroke: '#83a75f',
    costPerSqFt: 1.65,
    unit: 'sq ft',
    waterGalSqFtYr: 18,
    notes:
      'Takes light shade better than bermuda, denser and slower growing so less mowing. Costs more up front.',
  },
  {
    id: 'lawn-stjoe',
    name: 'St. Augustine sod',
    group: 'Lawn',
    fill: '#92bb78',
    stroke: '#7aa361',
    costPerSqFt: 1.1,
    unit: 'sq ft',
    waterGalSqFtYr: 30,
    notes:
      'The best shade-tolerant turf here (4–5 hrs will do). Thirstier, and vulnerable to chinch bugs and take-all root rot.',
  },
  {
    id: 'bed-mulch',
    name: 'Planting bed — hardwood mulch',
    group: 'Planting bed',
    fill: '#7a5f45',
    stroke: '#5d4733',
    costPerSqFt: 1.35,
    unit: 'sq ft',
    waterGalSqFtYr: 8,
    notes:
      'Assumes 4" of shredded hardwood over prepared soil. Budget a top-off every other year.',
  },
  {
    id: 'bed-decomposed-granite',
    name: 'Decomposed granite',
    group: 'Planting bed',
    fill: '#c2a882',
    stroke: '#a68f6b',
    costPerSqFt: 2.4,
    unit: 'sq ft',
    waterGalSqFtYr: 4,
    notes:
      'Stabilized DG makes a firm, permeable surface for informal paths and xeric beds. Needs steel edging to hold it.',
  },
  {
    id: 'gravel-river-rock',
    name: 'River rock / dry creek',
    group: 'Planting bed',
    fill: '#b3b5ad',
    stroke: '#94978f',
    costPerSqFt: 3.2,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes:
      'Doubles as drainage. A dry creek routed from the downspouts is the standard fix for soggy clay side yards.',
  },
  {
    id: 'patio-flagstone',
    name: 'Flagstone patio (mortared)',
    group: 'Paving',
    fill: '#c8bda9',
    stroke: '#9d9483',
    costPerSqFt: 26,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Oklahoma or Texas flagstone set on a concrete base. The regional standard.',
  },
  {
    id: 'patio-paver',
    name: 'Paver patio',
    group: 'Paving',
    fill: '#c0a894',
    stroke: '#9c8878',
    costPerSqFt: 18,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Concrete pavers on compacted base and sand. Repairable, and it flexes with our clay.',
  },
  {
    id: 'patio-concrete',
    name: 'Broom-finish concrete',
    group: 'Paving',
    fill: '#cfcfc9',
    stroke: '#a8a8a2',
    costPerSqFt: 11,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Cheapest hard surface. Specify control joints — expansive clay will crack it otherwise.',
  },
  {
    id: 'patio-stamped',
    name: 'Stamped / stained concrete',
    group: 'Paving',
    fill: '#c4b4a2',
    stroke: '#9f9083',
    costPerSqFt: 17,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Needs resealing every few years to hold color.',
  },
  {
    id: 'deck-composite',
    name: 'Composite deck',
    group: 'Paving',
    fill: '#a08464',
    stroke: '#7f6a50',
    costPerSqFt: 42,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Framed and elevated. Check City of McKinney permitting for anything over 30" high.',
  },
  {
    id: 'water',
    name: 'Pond / water feature',
    group: 'Water',
    fill: '#7fa9c4',
    stroke: '#5c88a4',
    costPerSqFt: 65,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'Liner, pump, filtration and stone edge. Cost swings widely with depth and rockwork.',
  },
  {
    id: 'existing-concrete',
    name: 'Existing concrete',
    group: 'Existing',
    fill: '#d5d5d0',
    stroke: '#aeaea8',
    costPerSqFt: 0,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'From the survey — no cost carried.',
  },
  {
    id: 'existing-structure',
    name: 'Existing structure',
    group: 'Existing',
    fill: '#c9c3ba',
    stroke: '#8d877e',
    costPerSqFt: 0,
    unit: 'sq ft',
    waterGalSqFtYr: 0,
    notes: 'From the survey — no cost carried.',
  },
];

export const SURFACE_BY_ID = new Map(SURFACES.map((s) => [s.id, s]));
export const getSurface = (id: SurfaceId) =>
  SURFACE_BY_ID.get(id) ?? SURFACES[SURFACES.length - 1];

export interface PathSpec {
  id: PathMaterialId;
  name: string;
  group: 'Walks' | 'Edging' | 'Walls & fences' | 'Irrigation';
  stroke: string;
  fill: string;
  defaultWidth: number;
  /**
   * Walks are priced by area (width x length); edging, walls and fences are
   * priced per linear foot.
   */
  priceBy: 'area' | 'length';
  cost: number;
  dashed?: boolean;
  notes: string;
}

export const PATH_MATERIALS: PathSpec[] = [
  {
    id: 'walk-flagstone',
    name: 'Flagstone walk',
    group: 'Walks',
    stroke: '#9d9483',
    fill: '#c8bda9',
    defaultWidth: 4,
    priceBy: 'area',
    cost: 26,
    notes: 'Keep primary walks at least 4′ wide so two people can pass.',
  },
  {
    id: 'walk-stepper',
    name: 'Stepping stones',
    group: 'Walks',
    stroke: '#9d9483',
    fill: '#c8bda9',
    defaultWidth: 2,
    priceBy: 'area',
    cost: 14,
    notes: 'Set 24″ on center, top flush with grade so a mower can pass over.',
  },
  {
    id: 'walk-paver',
    name: 'Paver walk',
    group: 'Walks',
    stroke: '#9c8878',
    fill: '#c0a894',
    defaultWidth: 4,
    priceBy: 'area',
    cost: 18,
    notes: '',
  },
  {
    id: 'walk-concrete',
    name: 'Concrete walk',
    group: 'Walks',
    stroke: '#a8a8a2',
    fill: '#cfcfc9',
    defaultWidth: 4,
    priceBy: 'area',
    cost: 11,
    notes: '',
  },
  {
    id: 'edging-steel',
    name: 'Steel edging',
    group: 'Edging',
    stroke: '#4b4b4b',
    fill: '#4b4b4b',
    defaultWidth: 0.35,
    priceBy: 'length',
    cost: 7.5,
    notes: '3/16″ x 4″ steel. The clean, long-lasting way to hold a bed line against bermuda.',
  },
  {
    id: 'edging-stone',
    name: 'Stone / block edging',
    group: 'Edging',
    stroke: '#9a8f7d',
    fill: '#c3b7a2',
    defaultWidth: 0.8,
    priceBy: 'length',
    cost: 22,
    notes: '',
  },
  {
    id: 'wall-retaining',
    name: 'Retaining / seat wall',
    group: 'Walls & fences',
    stroke: '#8b7f6d',
    fill: '#b5a894',
    defaultWidth: 1.2,
    priceBy: 'length',
    cost: 95,
    notes:
      'Priced at roughly 18″ high. Anything over 4′ needs an engineer and a permit in McKinney.',
  },
  {
    id: 'fence-wood',
    name: 'Wood fence',
    group: 'Walls & fences',
    stroke: '#8a7355',
    fill: '#a68d6c',
    defaultWidth: 0.5,
    priceBy: 'length',
    cost: 38,
    notes: '6′ cedar on steel posts.',
  },
  {
    id: 'drip-line',
    name: 'Drip irrigation line',
    group: 'Irrigation',
    stroke: '#4f7fb5',
    fill: 'none',
    defaultWidth: 0.2,
    priceBy: 'length',
    cost: 2.2,
    dashed: true,
    notes: 'Inline emitter tubing at 18″ spacing under mulch. Far more efficient than spray in beds.',
  },
];

export const PATH_BY_ID = new Map(PATH_MATERIALS.map((p) => [p.id, p]));
export const getPathSpec = (id: PathMaterialId) =>
  PATH_BY_ID.get(id) ?? PATH_MATERIALS[0];

export interface FeatureSpec {
  name: string;
  group: 'Amenities' | 'Lighting' | 'Irrigation' | 'Existing';
  color: string;
  defaultSizeFt: number;
  cost: number;
  notes: string;
}

export const FEATURES: Record<string, FeatureSpec> = {
  boulder: {
    name: 'Boulder',
    group: 'Amenities',
    color: '#9a9a94',
    defaultSizeFt: 3,
    cost: 250,
    notes: 'Bury a third of it so it looks native to the site rather than set on top.',
  },
  pot: {
    name: 'Container / pot',
    group: 'Amenities',
    color: '#a9705a',
    defaultSizeFt: 2.5,
    cost: 220,
    notes: 'Frost-proof glazed or concrete. Anything terracotta will spall in a hard freeze.',
  },
  firepit: {
    name: 'Fire pit',
    group: 'Amenities',
    color: '#8a5b45',
    defaultSizeFt: 4,
    cost: 2400,
    notes: 'Allow 6′ of clear seating apron all the way around.',
  },
  bench: {
    name: 'Bench',
    group: 'Amenities',
    color: '#8a7355',
    defaultSizeFt: 4.5,
    cost: 650,
    notes: '',
  },
  birdbath: {
    name: 'Birdbath / fountain',
    group: 'Amenities',
    color: '#8fa8b8',
    defaultSizeFt: 2.5,
    cost: 480,
    notes: 'Moving water brings in far more birds than still water.',
  },
  'light-path': {
    name: 'Path light',
    group: 'Lighting',
    color: '#e0b658',
    defaultSizeFt: 1,
    cost: 165,
    notes: 'Space 8–12′ apart, staggered. Resist the urge to line them up like a runway.',
  },
  'light-up': {
    name: 'Uplight',
    group: 'Lighting',
    color: '#e8c877',
    defaultSizeFt: 1,
    cost: 195,
    notes: 'Aim at trunks and canopy texture. Set the fixture back so the source stays hidden.',
  },
  'irrigation-rotor': {
    name: 'Rotor head',
    group: 'Irrigation',
    color: '#4f7fb5',
    defaultSizeFt: 1,
    cost: 85,
    notes: 'For turf runs over 18′. Head-to-head coverage.',
  },
  'irrigation-spray': {
    name: 'Spray head',
    group: 'Irrigation',
    color: '#6f9fd0',
    defaultSizeFt: 1,
    cost: 65,
    notes: 'For turf under 15′. Do not mix spray and rotor on the same zone.',
  },
  'ac-unit': {
    name: 'A/C condenser',
    group: 'Existing',
    color: '#9aa0a6',
    defaultSizeFt: 3,
    cost: 0,
    notes: 'Existing equipment. Keep 24″ clear on all sides for service access.',
  },
  downspout: {
    name: 'Downspout outlet',
    group: 'Irrigation',
    color: '#7d8a95',
    defaultSizeFt: 1,
    cost: 140,
    notes: 'Pipe it at least 8′ from the foundation, or into a dry creek.',
  },
};

/** Soft costs applied on top of the material takeoff. */
export const SOFT_COSTS = {
  bedPrepPerSqFt: 1.1, // till + 3" compost into blackland clay
  irrigationPerSqFt: 1.35, // new zones / retrofit
  designFeePct: 0, // designer's own fee — off by default
  contingencyPct: 12,
};
