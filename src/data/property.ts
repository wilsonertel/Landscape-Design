/**
 * 3610 Creekstone Court — surveyed base plan.
 *
 * Digitized from the CBG Surveying Texas LLC boundary survey of
 * Lot Forty-One (41), Block E, GLENWOOD ESTATES NO. 2, an Addition to the
 * City of McKinney, Texas (Vol. F, Pg. 390, Map Records, Collin County).
 * Job No. 2406908, GF No. 7320124-00248, drawn 05/07/2024, scale 1" = 20'.
 *
 * Origin (0,0) is the front-left (southwest) property corner, at the
 * intersection of the west line and the Creekstone Court right-of-way.
 * +x runs east along the 70.00' frontage, +y runs north along the 120.00'
 * side lines toward the rear.
 *
 * Dimensions marked (survey) are lettered on the plat. Dimensions marked
 * (scaled) were taken off the plat at its stated 1" = 20' scale and are
 * accurate to roughly a half foot — good enough to design against, but
 * confirm before pouring concrete or setting a fence.
 */

import type { AreaObj, DesignObj, FeatureObj, PathObj, Pt, SiteInfo } from '../model/types';
import { rect } from '../model/geometry';

export const LOT_WIDTH = 70; // survey: EAST/WEST 70.00'
export const LOT_DEPTH = 120; // survey: NORTH/SOUTH 120.00'

export const SITE: SiteInfo = {
  address: '3610 Creekstone Court',
  legal:
    'Lot Forty-One (41), Block E, GLENWOOD ESTATES NO. 2 — Vol. F, Pg. 390, Map Records',
  city: 'McKinney',
  county: 'Collin County',
  state: 'Texas',
  latitude: 33.1976,
  longitude: -96.6153,
  utcOffsetStd: -6, // CST
  usdaZone: '8a',
  lotAreaSqFt: LOT_WIDTH * LOT_DEPTH, // 8,400 sq ft
  surveyor: 'CBG Surveying Texas LLC — Abel P. Stendahl, RPLS 6754',
  surveyDate: '2024-05-07',
  northRotationDeg: 0, // plat bearings are the basis of bearings; north is up
};

/** The full lot, counter-clockwise from the southwest corner. */
export const LOT_BOUNDARY: Pt[] = rect(0, 0, LOT_WIDTH, LOT_DEPTH);

/**
 * House footprint — two story brick & frame.
 * Traced from the lettered plat calls, and it closes exactly:
 *   left wall 55.2', rear wall 40.1', right wall 36.9', 12.1' in,
 *   7.6' back out, 8.0' in, 25.9' down, 20.0' across to close.
 * The 8.0' x 7.6' notch on the front elevation is the covered entry.
 */
export const HOUSE_OUTLINE: Pt[] = [
  { x: 14.5, y: 26.0 }, // front-left corner (14.5' off the west line — survey)
  { x: 14.5, y: 81.2 }, // up the 55.2' left wall (survey)
  { x: 54.6, y: 81.2 }, // 40.1' rear wall (survey)
  { x: 54.6, y: 44.3 }, // down the 36.9' right wall (survey)
  { x: 42.5, y: 44.3 }, // 12.1' west (survey)
  { x: 42.5, y: 51.9 }, // 7.6' north (survey)
  { x: 34.5, y: 51.9 }, // 8.0' west (survey)
  { x: 34.5, y: 26.0 }, // 25.9' south (survey), then 20.0' west closes it
];

/** Covered front entry recessed into the front elevation — 8.0' x 7.6'. */
export const FRONT_PORCH: Pt[] = rect(34.5, 44.3, 8.0, 7.6);

/** Frame shed, no foundation — 8.0' x 8.0', set 9.0' off the rear line. */
export const SHED: Pt[] = rect(59.5, 103.0, 8.0, 8.0);

/** Existing concrete driveway running to the garage wing (scaled). */
export const DRIVEWAY: Pt[] = rect(15.5, 0, 19.0, 26.0);

/** Existing concrete walk from the drive/street up to the covered entry (scaled). */
export const FRONT_WALK: Pt[] = rect(34.5, 0, 6.0, 44.3);

/** Existing concrete patio off the rear elevation (scaled). */
export const REAR_PATIO: Pt[] = rect(40.5, 81.2, 12.5, 10.8);

/** 25' front building line, per recorded plat. */
export const FRONT_BUILDING_LINE = 25;

/** 10' T.P.& L. (Texas Power & Light) easement across the frontage. */
export const FRONT_EASEMENT_DEPTH = 10;

/**
 * Wood fence, 0.5' wide typical, enclosing the rear yard. It returns to the
 * house on both sides — west at about y=43.8 (the plat's "1.2' ON" call) and
 * east off the rear-right house corner.
 */
const FENCE_RUNS: Pt[][] = [
  // West return + west side line + rear line + east side line + east return
  [
    { x: 14.5, y: 43.8 },
    { x: 0.6, y: 43.8 },
    { x: 0.6, y: 119.4 },
    { x: 69.6, y: 119.4 },
    { x: 69.6, y: 81.2 },
    { x: 54.6, y: 81.2 },
  ],
];

/** 1.0' railroad-tie retaining wall along the west line (typical). */
const RETAINING_WALL: Pt[] = [
  { x: 1.6, y: 20.0 },
  { x: 1.6, y: 100.0 },
];

let n = 0;
const id = (p: string) => `base-${p}-${++n}`;

function area(
  key: string,
  name: string,
  points: Pt[],
  surface: AreaObj['surface'],
  layer: AreaObj['layer'],
  kind: AreaObj['kind'] = 'area',
  height?: number,
): AreaObj {
  return { id: id(key), name, kind, layer, points, surface, locked: true, height };
}

/**
 * Survey-derived base plan. Everything here is locked: it is the record of
 * what is on the ground, not part of the new design.
 */
export const BASE_OBJECTS: DesignObj[] = [
  area(
    'house',
    'Existing residence',
    HOUSE_OUTLINE,
    'existing-structure',
    'structures',
    'structure',
    24, // two-story eave height, used for shadow casting
  ),
  area(
    'porch',
    'Covered front entry',
    FRONT_PORCH,
    'existing-concrete',
    'structures',
    'structure',
    10,
  ),
  area(
    'shed',
    'Frame shed (no foundation)',
    SHED,
    'existing-structure',
    'structures',
    'structure',
    8,
  ),
  area('drive', 'Existing concrete driveway', DRIVEWAY, 'existing-concrete', 'structures'),
  area('walk', 'Existing concrete front walk', FRONT_WALK, 'existing-concrete', 'structures'),
  area('patio', 'Existing concrete patio', REAR_PATIO, 'existing-concrete', 'structures'),

  ...FENCE_RUNS.map(
    (points, i): PathObj => ({
      id: id(`fence${i}`),
      name: 'Existing wood fence (0.5′ typ.)',
      kind: 'path',
      layer: 'structures',
      points,
      material: 'fence-wood',
      width: 0.5,
      locked: true,
    }),
  ),
  {
    id: id('retwall'),
    name: 'Railroad-tie retaining wall (1.0′ typ.)',
    kind: 'path',
    layer: 'structures',
    points: RETAINING_WALL,
    material: 'wall-retaining',
    width: 1.0,
    locked: true,
  } satisfies PathObj,

  {
    id: id('ac'),
    name: 'A/C condenser',
    kind: 'feature',
    layer: 'structures',
    feature: 'ac-unit',
    at: { x: 13.0, y: 47.2 },
    sizeFt: 3,
    locked: true,
    notes: 'Existing condensing unit on the west side yard — keep 24" clear for service.',
  } satisfies FeatureObj,
];

/**
 * Design constraints the app enforces visually. These come off the plat and
 * from ordinary good practice; they are advisory, not a substitute for
 * checking City of McKinney ordinances or the Glenwood Estates deed
 * restrictions before building anything permanent.
 */
export const CONSTRAINTS = [
  {
    id: 'front-bl',
    label: '25′ front building line',
    detail:
      'No structures forward of this line per the recorded plat. Planting is fine.',
  },
  {
    id: 'tpl-easement',
    label: '10′ T.P.& L. easement',
    detail:
      'Utility easement across the frontage. Avoid trees and anything permanent — the utility can excavate here.',
  },
  {
    id: 'flood',
    label: 'Zone X — outside the 100-year floodplain',
    detail: 'Per F.I.R.M. No. 48085C0260K. No floodplain constraint on grading.',
  },
  {
    id: 'ac-clearance',
    label: 'A/C service clearance',
    detail: 'Keep 24″ clear around the west-side condenser.',
  },
];
