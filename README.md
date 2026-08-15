# Landscape Studio — 3610 Creekstone Court

A browser-based landscape design tool, pre-loaded with the surveyed site plan for
**3610 Creekstone Court, McKinney, Texas** — Lot 41, Block E, Glenwood Estates No. 2.

Everything is drawn to scale in real feet on top of the boundary survey, so the
plan you produce carries the actual dimensions of the lot rather than a sketch
that happens to look about right.

## Opening it

**No install — one file.** `dist/landscape-studio.html` is a single self-contained
HTML file. Download it and double-click; it opens in any browser with no server
and no dependencies. Rebuild it with:

```bash
npm install
npm run build:single    # -> dist/landscape-studio.html (~330 KB)
```

**Development.**

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production bundle into dist/
```

Note that `dist/index.html` from a plain `npm run build` will *not* open by
double-clicking — browsers block module scripts over `file://` as a
cross-origin request. That is exactly what `build:single` exists to solve.

No backend, no accounts, no network calls. Work is saved to `localStorage` as you
go, and can be exported to a file.

---

## What it does

**Draws on the record survey.** The lot (70.00′ × 120.00′, 8,400 sq ft), the
L-shaped two-story house footprint, the covered entry, the 8′ × 8′ frame shed,
the existing drive/walk/patio, the wood fence, the railroad-tie retaining wall
and the A/C condenser are all digitized from the CBG Surveying plat. So are the
25′ front building line and the 10′ T.P.& L. easement. That base layer is locked
— the design can't drift off the recorded dimensions.

**Plant library for zone 8a.** 63 species chosen for North Texas blackland clay:
mature size, exposure, water use, bloom calendar, spacing, cost, and a note on
what actually goes wrong with each one here. Filter by type, exposure, Texas
native, or low water. Plants draw at **mature canopy spread**, which is the whole
point — a live oak looks fine on paper until you see its 55′ crown on a 70′ lot.

**Sun and shade, modelled properly.** Solar position at 33.20°N via the NOAA
algorithm; shadows projected from the house, fence, shed and every plant tall
enough to matter. Scrub through the day, jump between solstices and equinoxes,
and toggle deciduous canopies leaf-on/leaf-off to see the winter case. A
sun-hours heat map shows direct sun across the whole lot.

**Automated plan review.** Every plant is checked against:

- mature canopy crossing a property line
- clearance from the house (15–20′ for shade trees on expansive clay)
- shrubs that will grow into a wall
- woody material inside the utility easement
- tree-on-tree crowding at mature spread
- **exposure vs. modelled direct sun** — flags a full-sun plant in shade and a
  shade plant that will scorch
- overlapping surfaces, which silently double-bill in the takeoff

**Schedule and estimate.** A proper plant schedule with plan keys, botanical
names, sizes and quantities, plus a materials takeoff, site-coverage breakdown,
irrigation demand, and a cost rollup with bed prep, irrigation and contingency.

**Export.** Print/save-as-PDF produces a single sheet with a title block, the
plan drawing, the plant schedule and the estimate. Also PNG, CSV, and a JSON
design file you can reload.

---

## The example scheme

The app opens on "Creekstone — Scheme A", a complete worked design. It exists
partly as a demo and partly as a worked example of the reasoning:

- The house faces **south**, so the front yard bakes and the back yard is the
  comfortable side. Living space goes in back.
- Nothing woody sits in the 10′ frontage easement — the utility can excavate it.
- A 70′ lot can't carry a live oak or a Shumard without eventually overhanging
  both neighbours, so the front gets ornamental trees and the back gets a single
  30′-spread Chinese pistache, sited to shade the terrace from the west by 4pm.
- The narrow west side yard *looks* like a shade bed. The sun model says
  otherwise — the house takes the morning sun and the west sun arrives
  unobstructed all afternoon — so it gets sun natives and a dry creek instead of
  the ferns the shape suggests.

The scheme passes its own review with zero warnings. Getting there took five
rounds of the checker catching genuine errors — a perennial row planted inside a
hedge canopy, a specimen tree sitting on top of a foundation row, plants inside
the shed footprint, and a bed overlapping the lawn.

`File ▸ New — empty lot` clears it and leaves you the bare survey.

---

## Controls

| | |
|---|---|
| `V` | Select — drag to move, drag a vertex to reshape, shift-click to multi-select |
| `B` `L` `P` | Planting bed / lawn / paving — click corners, `Enter` or double-click to close |
| `W` `E` | Walk / edging — click along the run, `Enter` to finish |
| `T` | Place plant (dashed circle = mature spread) |
| `G` `N` `D` `M` | Feature / note / dimension / measure |
| `F` | Fit the lot to the window |
| `⌘Z` `⇧⌘Z` `⌘D` `⌘A` | Undo / redo / duplicate / select all |
| Scroll · Alt-drag · Middle-drag | Zoom · pan · pan |

---

## Layout

```
src/
  data/
    property.ts       Survey geometry — the record drawing, as typed data
    plants.ts         63 species for USDA 8a / North Central Texas
    materials.ts      Surfaces, edging, walls, features + installed unit costs
    starterDesign.ts  "Scheme A", with the reasoning in comments
  model/
    types.ts          Document model. All geometry in FEET, origin at the SW corner
    geometry.ts       Polygon area/centroid/offset, curve fitting, label fitting
    sun.ts            Solar position, shadow silhouettes, sun-hours grid, exposure
    checks.ts         Automated plan review
    takeoff.ts        Plant schedule, quantity takeoff, cost rollup
  components/         Canvas, survey base, plant symbols, panels, schedule
  export/exporters.ts PNG / CSV / JSON / print sheet
```

Two model details worth knowing, because the naive version of each is wrong:

**Shadows are Minkowski sums, not convex hulls.** The house is L-shaped. A
convex hull fills in the notch, which would mark the entire front-right yard as
shaded around the clock. Each caster's shadow is the footprint, its translated
copy, and one quad per swept edge, filled as a single nonzero path.

**Exposure is judged at the crown, not at grade, and excludes the plant
itself.** Sampling a sun grid at a tree's trunk puts the point under that tree's
own canopy, so every tree reports zero sun. And only *taller* things count as
shading — otherwise a hedge row, which is meant to be planted tight, reads as
deep shade because each shrub throws a long low-angle shadow onto its neighbours
at dawn and dusk. Exposure is also fixed to the September equinox rather than
following the Sun tab, since a plant's light requirement describes the growing
season, not December.

---

## Accuracy and limits

Dimensions lettered on the plat (the 70.00′ and 120.00′ lines, the house's 55.2′
/ 40.1′ / 36.9′ / 12.1′ / 7.6′ / 8.0′ / 25.9′ / 20.0′ calls, the 14.5′ setback,
the shed's 9.0′ offset) are exact — the traced footprint closes on itself.
Anything scaled off the drawing at its stated 1″ = 20′ — the driveway, front
walk, and rear patio — is good to roughly ±0.5′.

Known limits:

- **Neighbouring houses are not modelled.** The survey doesn't show them, so
  afternoon shade from a two-story house on Lot 40 isn't in the sun model. The
  west side yard is probably shadier in reality than the app reports.
- **Flat ground.** Shadows are projected on a level plane. Fine for this lot.
- **Costs are planning-level estimates** for the DFW market, not a bid.
- **Not a permit set.** Confirm setbacks, easements, the Glenwood Estates deed
  restrictions and City of McKinney requirements before building anything
  permanent. Call 811 before you dig.
