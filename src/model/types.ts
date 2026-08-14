/**
 * Core document model.
 *
 * COORDINATE SYSTEM
 * -----------------
 * All geometry is stored in FEET, in survey space:
 *   origin (0,0) = the front-left (southwest) property corner
 *   +x = east  (toward Lot 42 / the right side of the plat)
 *   +y = north (toward the rear of the lot / Lot 50)
 *
 * The plat's front line ("WEST 70.00'", Creekstone Court) is y = 0.
 * The rear line ("EAST 70.00'") is y = 120. North is up on screen, so the
 * renderer flips y when converting to SVG user units.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Every drawable thing lives on exactly one layer. */
export type LayerId =
  | 'survey' // property lines, easements, setbacks — locked reference
  | 'structures' // house, shed, existing hardscape from the survey
  | 'hardscape' // new patios, walks, decks, walls
  | 'beds' // planting beds, lawn, mulch, gravel
  | 'plants' // trees, shrubs, perennials, groundcover
  | 'irrigation' // heads, drip zones, valves
  | 'lighting' // path lights, uplights
  | 'annotation'; // dimensions, labels, notes

export const LAYER_ORDER: LayerId[] = [
  'survey',
  'beds',
  'hardscape',
  'structures',
  'irrigation',
  'lighting',
  'plants',
  'annotation',
];

export interface LayerState {
  id: LayerId;
  name: string;
  visible: boolean;
  locked: boolean;
}

/* ------------------------------------------------------------------ */
/* Objects                                                             */
/* ------------------------------------------------------------------ */

export type ObjKind =
  | 'area' // closed polygon: bed, lawn, patio, deck, gravel, water
  | 'path' // open polyline with a width: walk, edging, drip line, wall
  | 'plant' // a single plant instance
  | 'feature' // point object: boulder, pot, light, bench, firepit, head
  | 'structure' // closed polygon read-only-ish: house, shed
  | 'label' // free text
  | 'dimension'; // a measured dimension string between two points

/**
 * Surface materials available to `area` objects. Costs are installed
 * $/sq ft for the North Texas market and are user-editable in Settings.
 */
export type SurfaceId =
  | 'lawn-bermuda'
  | 'lawn-zoysia'
  | 'lawn-stjoe'
  | 'bed-mulch'
  | 'bed-decomposed-granite'
  | 'gravel-river-rock'
  | 'patio-flagstone'
  | 'patio-paver'
  | 'patio-concrete'
  | 'patio-stamped'
  | 'deck-composite'
  | 'water'
  | 'existing-concrete'
  | 'existing-structure';

export type PathMaterialId =
  | 'walk-flagstone'
  | 'walk-paver'
  | 'walk-concrete'
  | 'walk-stepper'
  | 'edging-steel'
  | 'edging-stone'
  | 'wall-retaining'
  | 'fence-wood'
  | 'drip-line';

export type FeatureId =
  | 'boulder'
  | 'pot'
  | 'firepit'
  | 'bench'
  | 'birdbath'
  | 'light-path'
  | 'light-up'
  | 'irrigation-rotor'
  | 'irrigation-spray'
  | 'downspout'
  | 'ac-unit';

interface ObjBase {
  id: string;
  layer: LayerId;
  name?: string;
  locked?: boolean;
  notes?: string;
}

export interface AreaObj extends ObjBase {
  kind: 'area' | 'structure';
  points: Pt[];
  /** Sub-polygons cut out of the outline (e.g. a patio wrapping a tree). */
  holes?: Pt[][];
  surface: SurfaceId;
  /** Height in feet above grade — drives shadow casting for structures. */
  height?: number;
}

export interface PathObj extends ObjBase {
  kind: 'path';
  points: Pt[];
  material: PathMaterialId;
  /** Width in feet. Edging and drip line use a nominal hairline width. */
  width: number;
  closed?: boolean;
}

export interface PlantObj extends ObjBase {
  kind: 'plant';
  /** Key into the plant database. */
  speciesId: string;
  at: Pt;
  /**
   * Planted size in gallons (or caliper inches for trees) — drives unit cost.
   * Falls back to the species' default nursery size.
   */
  size?: string;
  /**
   * Canopy radius override in feet. Defaults to the species' mature spread / 2.
   * Lets a designer draw a plant at 5-year size instead of mature size.
   */
  radiusFt?: number;
  /** Instances placed as a drift/mass share one object via a count + spacing. */
  rotation?: number;
}

export interface FeatureObj extends ObjBase {
  kind: 'feature';
  feature: FeatureId;
  at: Pt;
  sizeFt?: number;
  rotation?: number;
}

export interface LabelObj extends ObjBase {
  kind: 'label';
  at: Pt;
  text: string;
  fontSizeFt?: number;
}

export interface DimensionObj extends ObjBase {
  kind: 'dimension';
  a: Pt;
  b: Pt;
  /** Perpendicular offset of the dimension line from the measured segment. */
  offset?: number;
}

export type DesignObj =
  | AreaObj
  | PathObj
  | PlantObj
  | FeatureObj
  | LabelObj
  | DimensionObj;

/* ------------------------------------------------------------------ */
/* Site + document                                                     */
/* ------------------------------------------------------------------ */

export interface SiteInfo {
  address: string;
  legal: string;
  city: string;
  county: string;
  state: string;
  /** Decimal degrees, used for solar position. */
  latitude: number;
  longitude: number;
  /** IANA-ish offset in hours from UTC (standard time). */
  utcOffsetStd: number;
  usdaZone: string;
  lotAreaSqFt: number;
  surveyor: string;
  surveyDate: string;
  /**
   * Rotation in degrees from plat-north to true north. The plat's bearings
   * are the basis of bearings ("WEST 70.00'"), so plat north == true north
   * for this survey; kept so other sites can be loaded.
   */
  northRotationDeg: number;
}

export interface Document {
  version: number;
  site: SiteInfo;
  name: string;
  /** Survey-derived, non-editable base geometry. */
  base: DesignObj[];
  /** Everything the designer adds. */
  objects: DesignObj[];
  layers: Record<LayerId, LayerState>;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Editing tools                                                       */
/* ------------------------------------------------------------------ */

export type Tool =
  | 'select'
  | 'bed'
  | 'lawn'
  | 'patio'
  | 'walk'
  | 'edging'
  | 'fence'
  | 'plant'
  | 'feature'
  | 'label'
  | 'dimension'
  | 'measure';
