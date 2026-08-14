import { useMemo, useState } from 'react';
import { useStore } from './state/store';
import { LOT_DEPTH, LOT_WIDTH } from './data/property';
import { computeExposure, computeSunGrid } from './model/sun';
import { getSpecies } from './data/plants';
import { PlanCanvas } from './components/PlanCanvas';
import { PalettePanel } from './components/PalettePanel';
import { InspectorPanel } from './components/InspectorPanel';
import { ScheduleModal } from './components/ScheduleModal';
import { Toolbar } from './components/Toolbar';

/** Growing-season reference date for the exposure review. */
const REVIEW_MONTH = 8; // September
const REVIEW_DAY = 22; // autumn equinox

export default function App() {
  const doc = useStore((s) => s.doc);
  const sun = useStore((s) => s.sun);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  /**
   * The sun-hours grid is the expensive derived value in the app, and both the
   * plan (heatmap) and the review pass (exposure checks) need the same one, so
   * it is computed once here and handed to both.
   */
  const sunGrid = useMemo(() => {
    if (!sun.showHeatmap) return null;
    return computeSunGrid(
      [...doc.base, ...doc.objects],
      { minX: 0, minY: 0, maxX: LOT_WIDTH, maxY: LOT_DEPTH },
      {
        latitude: doc.site.latitude,
        longitude: doc.site.longitude,
        utcOffsetStd: doc.site.utcOffsetStd,
        year: new Date().getFullYear(),
        month: sun.month,
        day: sun.day,
        cell: 2.5,
        stepMinutes: 30,
        leafOn: sun.leafOn,
      },
    );
  }, [sun.showHeatmap, sun.month, sun.day, sun.leafOn, doc.base, doc.objects, doc.site]);

  /**
   * Per-plant direct-sun hours driving the review's exposure warnings.
   *
   * Deliberately fixed to the September equinox with the canopy in leaf,
   * NOT the date on the Sun tab. A plant's sun requirement describes the
   * growing season; scoring a dormant perennial against a low December sun
   * would flag half the plan every time you looked at the winter shadows.
   * The Sun tab stays a visualization control.
   */
  const exposure = useMemo(() => {
    const samples = doc.objects.flatMap((o) => {
      if (o.kind !== 'plant') return [];
      const sp = getSpecies(o.speciesId);
      if (!sp) return [];
      // Judge the light at the crown, matching how casters are modelled.
      return [{ id: o.id, at: o.at, height: sp.h * 0.75 }];
    });
    if (!samples.length) return null;
    return computeExposure([...doc.base, ...doc.objects], samples, {
      latitude: doc.site.latitude,
      longitude: doc.site.longitude,
      utcOffsetStd: doc.site.utcOffsetStd,
      year: new Date().getFullYear(),
      month: REVIEW_MONTH,
      day: REVIEW_DAY,
      stepMinutes: 30,
      leafOn: true,
    });
  }, [doc.base, doc.objects, doc.site]);

  return (
    <div className="app">
      <Toolbar onOpenSchedule={() => setScheduleOpen(true)} />
      <main className="workspace">
        <PalettePanel />
        <PlanCanvas sunGrid={sunGrid} />
        <InspectorPanel exposure={exposure} />
      </main>
      {scheduleOpen && <ScheduleModal onClose={() => setScheduleOpen(false)} />}
    </div>
  );
}
