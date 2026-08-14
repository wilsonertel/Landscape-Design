/**
 * "Scheme A" — a complete worked landscape design for 3610 Creekstone Court,
 * shipped so the app opens on something real rather than an empty lot.
 *
 * The reasoning behind it, since a plan should be able to explain itself:
 *
 *  - The house faces SOUTH onto Creekstone Court, so the front yard takes
 *    brutal afternoon sun and the back yard (north of the house) is the
 *    comfortable side. The scheme puts the living space in back.
 *  - A 10' T.P.& L. easement crosses the frontage, so nothing woody or
 *    permanent goes within 10' of the street — lawn and low perennials only.
 *  - The lot is 70' wide. A live oak or Shumard would eventually overhang
 *    both neighbours, so the front gets ornamental trees and the back gets a
 *    single 30'-spread Chinese pistache placed to shade the patio from the
 *    west in late afternoon.
 *  - The west side yard is a narrow 14.5' slot with the A/C unit in it. It
 *    looks like a shade bed but the sun model says otherwise: the house takes
 *    the morning sun and the afternoon west sun arrives unobstructed, so it
 *    gets sun natives plus a gravel dry creek rather than turf or ferns.
 *  - Beds are kept off the foundation by a few feet and the turf is pulled
 *    into simple shapes a mower can actually follow.
 *
 * Delete it all from the File menu if you want to start clean.
 */

import type { AreaObj, DesignObj, FeatureObj, PathObj, PlantObj, Pt } from '../model/types';
import { getSpecies } from './plants';

let n = 0;
const id = (p: string) => `s-${p}-${++n}`;

const area = (
  name: string,
  points: Pt[],
  surface: AreaObj['surface'],
  layer: AreaObj['layer'] = 'beds',
  notes?: string,
): AreaObj => ({ id: id('a'), kind: 'area', name, layer, points, surface, notes });

const plant = (speciesId: string, at: Pt, size?: string): PlantObj => ({
  id: id('p'),
  kind: 'plant',
  layer: 'plants',
  speciesId,
  at,
  ...(size ? { size } : {}),
});

/** A drift of one species along a line, at the species' own spacing. */
function drift(speciesId: string, a: Pt, b: Pt, count: number, jitter = 0.9): PlantObj[] {
  const out: PlantObj[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    // Deterministic wobble so a mass reads as planted, not stamped.
    const w = Math.sin(i * 2.399963) * jitter;
    const perpX = -(b.y - a.y);
    const perpY = b.x - a.x;
    const l = Math.hypot(perpX, perpY) || 1;
    out.push(
      plant(speciesId, {
        x: +(a.x + (b.x - a.x) * t + (perpX / l) * w).toFixed(2),
        y: +(a.y + (b.y - a.y) * t + (perpY / l) * w).toFixed(2),
      }),
    );
  }
  return out;
}

/** A staggered mass filling a rectangle at the species' spacing. */
function mass(speciesId: string, x0: number, y0: number, x1: number, y1: number): PlantObj[] {
  const sp = getSpecies(speciesId);
  const s = sp?.spacing ?? 3;
  const rowH = (s * Math.sqrt(3)) / 2;
  const out: PlantObj[] = [];
  let row = 0;
  for (let y = y0 + s / 2; y <= y1 - s / 4; y += rowH, row++) {
    const off = row % 2 ? s / 2 : 0;
    for (let x = x0 + s / 2 + off; x <= x1 - s / 4; x += s) {
      out.push(plant(speciesId, { x: +x.toFixed(2), y: +y.toFixed(2) }));
    }
  }
  return out;
}

/** Shared so the lawn can carry it as a hole instead of overlapping it. */
const STREET_BAND: Pt[] = [
  { x: 41.0, y: 1.5 },
  { x: 69.0, y: 1.5 },
  { x: 69.0, y: 7.5 },
  { x: 41.0, y: 7.5 },
];

export function buildStarterDesign(): DesignObj[] {
  n = 0;
  const objs: DesignObj[] = [];

  /* ---------------------------------------------------------------- */
  /* FRONT YARD (south of the house)                                   */
  /* ---------------------------------------------------------------- */

  // L-shaped foundation bed wrapping the front-east elevation and running
  // up the east side of the house.
  const frontBed: Pt[] = [
    { x: 40.5, y: 38.0 },
    { x: 61.0, y: 38.0 },
    { x: 61.0, y: 81.2 },
    { x: 54.6, y: 81.2 },
    { x: 54.6, y: 44.3 },
    { x: 40.5, y: 44.3 },
  ];
  objs.push(
    area(
      'Front foundation bed',
      frontBed,
      'bed-mulch',
      'beds',
      'Held 6′ off the wall so shrubs never touch the brick and the hose bibb stays reachable.',
    ),
  );

  // Front lawn, east of the walk and wrapping the east side yard. The
  // perennial band is cut out of it as a hole rather than drawn on top —
  // overlapping areas would each bill their full size in the takeoff.
  objs.push({
    ...area(
      'Front lawn',
      [
        { x: 40.5, y: 0 },
        { x: 70, y: 0 },
        { x: 70, y: 81.2 },
        { x: 61.0, y: 81.2 },
        { x: 61.0, y: 38.0 },
        { x: 40.5, y: 38.0 },
      ],
      'lawn-bermuda',
      'beds',
      'Full sun all day — bermuda is the only turf that will hold up here.',
    ),
    holes: [STREET_BAND],
  });

  // West of the driveway.
  objs.push(
    area(
      'Front lawn — west of drive',
      [
        { x: 0, y: 0 },
        { x: 15.5, y: 0 },
        { x: 15.5, y: 26.0 },
        { x: 0, y: 26.0 },
      ],
      'lawn-bermuda',
    ),
  );

  // Street-side perennial band, kept low and entirely inside the utility
  // easement's tolerance — nothing here that a backhoe would be a tragedy for.
  objs.push(
    area(
      'Street-side perennial band',
      STREET_BAND,
      'bed-decomposed-granite',
      'beds',
      'Inside the 10′ T.P.& L. easement — perennials only, nothing woody or permanent.',
    ),
  );

  /* ---------------------------------------------------------------- */
  /* WEST SIDE YARD — narrow, shaded, holds the A/C                    */
  /* ---------------------------------------------------------------- */

  objs.push(
    area(
      'West side yard — hot, dry bed',
      [
        { x: 0.8, y: 26.0 },
        { x: 14.5, y: 26.0 },
        { x: 14.5, y: 81.2 },
        { x: 0.8, y: 81.2 },
      ],
      'bed-mulch',
      'beds',
      'Turf will never fill in a 14.5′ slot. The house blocks the morning sun but the afternoon west sun is unobstructed, so this bakes — tough sun natives, not the ferns a narrow side yard suggests.',
    ),
  );

  objs.push(
    area(
      'Dry creek — west side drainage',
      [
        { x: 3.0, y: 44.5 },
        { x: 7.5, y: 44.5 },
        { x: 8.0, y: 60.0 },
        { x: 6.5, y: 78.0 },
        { x: 7.5, y: 95.0 },
        { x: 4.0, y: 95.0 },
        { x: 3.0, y: 78.0 },
        { x: 4.5, y: 60.0 },
      ],
      'gravel-river-rock',
      'beds',
      'Carries roof and side-yard runoff north to daylight instead of letting it stand against the foundation.',
    ),
  );

  /* ---------------------------------------------------------------- */
  /* BACK YARD (north of the house, inside the existing fence)         */
  /* ---------------------------------------------------------------- */

  // New flagstone wrapping the existing concrete patio into a real
  // outdoor room.
  objs.push(
    area(
      'New flagstone terrace',
      [
        { x: 53.0, y: 81.2 },
        { x: 58.5, y: 81.2 },
        { x: 58.5, y: 102.5 },
        { x: 40.5, y: 102.5 },
        { x: 40.5, y: 92.0 },
        { x: 53.0, y: 92.0 },
      ],
      'patio-flagstone',
      'hardscape',
      'Wraps the existing 12.5′ × 10.8′ slab so the dining table and the seating group each get their own zone.',
    ),
  );

  // Back lawn — one simple shape, no mower-trapping corners.
  objs.push(
    area(
      'Back lawn',
      [
        { x: 9.0, y: 81.2 },
        { x: 40.5, y: 81.2 },
        { x: 40.5, y: 102.5 },
        { x: 58.5, y: 102.5 },
        { x: 58.5, y: 81.2 },
        { x: 61.6, y: 81.2 },
        { x: 61.6, y: 106.0 },
        { x: 9.0, y: 106.0 },
      ],
      'lawn-zoysia',
      'beds',
      'Zoysia — the pistache and the fence put part of this in afternoon shade, where bermuda would thin out.',
    ),
  );

  // Perimeter beds against the fence.
  objs.push(
    // Notched around the existing 8′ × 8′ frame shed rather than run through it.
    area('Rear screen bed', [
      { x: 1.0, y: 106.0 },
      { x: 58.5, y: 106.0 },
      { x: 58.5, y: 112.0 },
      { x: 69.2, y: 112.0 },
      { x: 69.2, y: 119.0 },
      { x: 1.0, y: 119.0 },
    ], 'bed-mulch', 'beds',
      'Held 13′ deep so a 10′-wide holly screen fits inside the bed instead of hanging over the lawn.'),
  );
  objs.push(
    area('West fence bed', [
      { x: 1.0, y: 82.0 },
      { x: 9.0, y: 82.0 },
      { x: 9.0, y: 106.0 },
      { x: 1.0, y: 106.0 },
    ], 'bed-mulch', 'beds',
      'The two-story wall to the east takes the morning sun off this strip, so it reads as part shade despite facing an open fence.'),
  );
  objs.push(
    area('East fence bed', [
      { x: 61.6, y: 82.0 },
      { x: 69.2, y: 82.0 },
      { x: 69.2, y: 102.0 },
      { x: 61.6, y: 102.0 },
    ], 'bed-mulch'),
  );

  /* ---------------------------------------------------------------- */
  /* Hardscape details                                                 */
  /* ---------------------------------------------------------------- */

  objs.push({
    id: id('walk'),
    kind: 'path',
    layer: 'hardscape',
    name: 'Stepping stone path to the shed',
    points: [
      { x: 58.5, y: 99.0 },
      { x: 61.5, y: 103.0 },
      { x: 61.0, y: 107.0 },
    ],
    material: 'walk-stepper',
    width: 2,
  } satisfies PathObj);

  objs.push({
    id: id('edge'),
    kind: 'path',
    layer: 'hardscape',
    name: 'Steel edging — front bed',
    points: frontBed,
    material: 'edging-steel',
    width: 0.35,
    closed: true,
    notes: 'Steel is what keeps bermuda out of the bed. Skipping it is the most common regret.',
  } satisfies PathObj);

  objs.push({
    id: id('firepit'),
    kind: 'feature',
    layer: 'hardscape',
    feature: 'firepit',
    at: { x: 47.0, y: 97.5 },
    sizeFt: 4,
    name: 'Fire pit',
  } satisfies FeatureObj);

  objs.push({
    id: id('bench'),
    kind: 'feature',
    layer: 'hardscape',
    feature: 'bench',
    at: { x: 12.5, y: 105.0 },
    sizeFt: 4.5,
    name: 'Garden bench under the pistache',
  } satisfies FeatureObj);

  /* ---------------------------------------------------------------- */
  /* Planting                                                          */
  /* ---------------------------------------------------------------- */

  // Back yard — the one shade tree the lot can carry, sited to throw
  // late-afternoon shade across the terrace.
  objs.push(plant('pistacia-chinensis', { x: 28.0, y: 97.0 }, '30 gal / 2.5" cal.'));

  // Front ornamental trees. The lot is only 70′ wide, so nothing with a
  // 20′+ spread can go near a side line without eventually hanging over it —
  // the redbud sits well inside the front lawn, and the east side yard gets a
  // narrow-crowned yaupon rather than a crape myrtle that would not fit.
  objs.push(plant('cercis-texensis', { x: 52.0, y: 22.0 }, '30 gal'));
  objs.push(plant('ilex-vomitoria-tree', { x: 64.0, y: 66.0 }, '30 gal, multi-trunk'));

  // Evergreen privacy screen on the rear fence.
  objs.push(...drift('ilex-nellie-stevens', { x: 6, y: 113.5 }, { x: 64, y: 113.5 }, 8, 0.8));

  // Front foundation planting — evergreen structure, then seasonal colour.
  objs.push(...drift('ilex-vomitoria-nana', { x: 44.0, y: 41.0 }, { x: 59.0, y: 41.0 }, 5));
  objs.push(...drift('ilex-vomitoria-nana', { x: 58.0, y: 48.0 }, { x: 58.0, y: 56.0 }, 3));
  objs.push(...mass('salvia-mystic-spires', 41.0, 38.6, 53.0, 40.2));
  objs.push(...drift('muhlenbergia-capillaris', { x: 43.0, y: 43.0 }, { x: 52.0, y: 43.0 }, 4));
  objs.push(plant('yucca-recurvifolia', { x: 60.0, y: 40.0 }));

  // Street band — low, tough, and expendable if the utility digs.
  objs.push(...mass('lantana-new-gold', 41.5, 2.0, 55.0, 7.0));
  objs.push(...mass('melampodium-leucanthum', 55.5, 2.0, 68.5, 7.0));

  // West side yard — dry shade.
  objs.push(...drift('malvaviscus-drummondii', { x: 12.0, y: 50.0 }, { x: 12.0, y: 78.0 }, 7));
  objs.push(...drift('melampodium-leucanthum', { x: 3.0, y: 30.0 }, { x: 12.0, y: 30.0 }, 4));
  objs.push(...drift('schizachyrium-scoparium', { x: 2.5, y: 36.0 }, { x: 12.5, y: 36.0 }, 5));

  // Back yard beds.
  // West fence bed reads as part shade (morning sun blocked by the house).
  objs.push(...drift('chasmanthium-latifolium', { x: 3.5, y: 86.0 }, { x: 3.5, y: 102.0 }, 6));
  objs.push(...drift('malvaviscus-drummondii', { x: 6.5, y: 88.0 }, { x: 6.5, y: 100.0 }, 4));
  // East fence bed. The fence returns east-west along y=81.2, and a 6′ fence
  // throws ~4′ of shade north of itself at the equinox — so the bottom of this
  // bed is the one genuinely dark pocket on the lot and gets the ferns.
  objs.push(...drift('dryopteris-normalis', { x: 65.0, y: 83.5 }, { x: 65.0, y: 88.0 }, 3, 0.8));
  objs.push(...drift('conoclinium-greggii', { x: 63.5, y: 91.0 }, { x: 63.5, y: 101.0 }, 5));
  objs.push(...drift('salvia-greggii', { x: 66.5, y: 94.0 }, { x: 66.5, y: 101.5 }, 3));
  // Coneflower drift along the front edge of the screen bed — kept east of
  // the pistache, whose mature canopy will reach x≈43 and put anything under
  // it into shade a full-sun perennial will not take.
  objs.push(...drift('echinacea-purpurea', { x: 45.0, y: 107.0 }, { x: 57.0, y: 107.0 }, 7, 0.6));

  // Vine on the fence panel behind the terrace.
  objs.push(plant('lonicera-sempervirens', { x: 68.6, y: 95.0 }));

  /* ---------------------------------------------------------------- */
  /* Lighting                                                          */
  /* ---------------------------------------------------------------- */

  const lights: FeatureObj[] = [
    { at: { x: 38.0, y: 12.0 }, f: 'light-path' as const },
    { at: { x: 38.0, y: 22.0 }, f: 'light-path' as const },
    { at: { x: 38.0, y: 32.0 }, f: 'light-path' as const },
    { at: { x: 38.0, y: 42.0 }, f: 'light-path' as const },
    { at: { x: 55.0, y: 20.0 }, f: 'light-up' as const },
    { at: { x: 63.0, y: 52.0 }, f: 'light-up' as const },
    { at: { x: 30.0, y: 93.0 }, f: 'light-up' as const },
  ].map(
    (l): FeatureObj => ({
      id: id('lt'),
      kind: 'feature',
      layer: 'lighting',
      feature: l.f,
      at: l.at,
      sizeFt: 1,
    }),
  );
  objs.push(...lights);

  /* ---------------------------------------------------------------- */
  /* Notes on the plan                                                 */
  /* ---------------------------------------------------------------- */

  objs.push({
    id: id('note'),
    kind: 'label',
    layer: 'annotation',
    at: { x: 22.0, y: 90.0 },
    text: 'Pistache shades the terrace from the west by 4pm',
    fontSizeFt: 1.6,
  });
  return objs;
}
