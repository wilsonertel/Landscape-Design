import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import type { AreaObj, DesignObj, LayerId, PathObj, PlantObj } from '../model/types';
import { LAYER_ORDER } from '../model/types';
import { netArea, perimeter } from '../model/geometry';
import { getSpecies, SPECIES, SUN_LABEL, WATER_LABEL } from '../data/plants';
import { FEATURES, getPathSpec, getSurface, PATH_MATERIALS, SURFACES } from '../data/materials';
import { sizeAdjustedCost, sizeOptions, usd, usdRate } from '../model/takeoff';
import { designStats, runChecks, type CheckResult } from '../model/checks';
import { SEASON_PRESETS } from '../model/sun';
import { CONSTRAINTS } from '../data/property';
import { BloomBar, SymbolPreview } from './PalettePanel';
import { formatFeet } from './PlanObjects';

export function InspectorPanel({ exposure }: { exposure: Map<string, number> | null }) {
  const [tab, setTab] = useState<'props' | 'checks' | 'sun' | 'layers'>('props');
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);

  const checks = useMemo(() => runChecks(doc.objects, exposure), [doc.objects, exposure]);
  const errors = checks.filter((c) => c.severity === 'error').length;
  const warns = checks.filter((c) => c.severity === 'warn').length;

  return (
    <aside className="panel panel-right">
      <div className="tabs">
        <button className={tab === 'props' ? 'active' : ''} onClick={() => setTab('props')}>
          Properties{selection.length > 1 ? ` (${selection.length})` : ''}
        </button>
        <button className={tab === 'checks' ? 'active' : ''} onClick={() => setTab('checks')}>
          Review
          {(errors > 0 || warns > 0) && (
            <span className={`pill ${errors ? 'err' : 'warn'}`}>{errors + warns}</span>
          )}
        </button>
        <button className={tab === 'sun' ? 'active' : ''} onClick={() => setTab('sun')}>Sun</button>
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => setTab('layers')}>Layers</button>
      </div>
      <div className="panel-body">
        {tab === 'props' && <Properties />}
        {tab === 'checks' && <Review checks={checks} />}
        {tab === 'sun' && <SunControls />}
        {tab === 'layers' && <Layers />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function Properties() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const updateObject = useStore((s) => s.updateObject);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const duplicateSelected = useStore((s) => s.duplicateSelected);

  const objs = doc.objects.filter((o) => selection.includes(o.id));

  if (!objs.length) return <SiteSummary />;

  if (objs.length > 1) {
    return (
      <div className="prop-block">
        <h4>{objs.length} objects selected</h4>
        <p className="panel-hint">Drag to move them together, or use the actions below.</p>
        <div className="row-actions">
          <button onClick={duplicateSelected}>Duplicate</button>
          <button className="danger" onClick={deleteSelected}>Delete</button>
        </div>
      </div>
    );
  }

  const o = objs[0];
  return (
    <div className="prop-block">
      <ObjectEditor obj={o} onChange={(patch) => updateObject(o.id, patch)} />
      <div className="row-actions">
        <button onClick={duplicateSelected}>Duplicate</button>
        <button className="danger" onClick={deleteSelected}>Delete</button>
      </div>
    </div>
  );
}

function ObjectEditor({ obj, onChange }: { obj: DesignObj; onChange: (p: Partial<DesignObj>) => void }) {
  const setLayer = (layer: LayerId) => onChange({ layer } as Partial<DesignObj>);

  const common = (
    <>
      <label className="field">
        <span>Name</span>
        <input
          value={obj.name ?? ''}
          placeholder="Untitled"
          onChange={(e) => onChange({ name: e.target.value } as Partial<DesignObj>)}
        />
      </label>
      <label className="field">
        <span>Layer</span>
        <select value={obj.layer} onChange={(e) => setLayer(e.target.value as LayerId)}>
          {LAYER_ORDER.filter((l) => l !== 'survey').map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>
    </>
  );

  if (obj.kind === 'plant') return <PlantEditor obj={obj} onChange={onChange} common={common} />;

  if (obj.kind === 'area' || obj.kind === 'structure') {
    const a = obj as AreaObj;
    const spec = getSurface(a.surface);
    const sqft = netArea(a.points, a.holes);
    return (
      <>
        <h4>{spec.name}</h4>
        {common}
        <label className="field">
          <span>Surface</span>
          <select value={a.surface} onChange={(e) => onChange({ surface: e.target.value } as Partial<DesignObj>)}>
            {SURFACES.filter((s) => s.group !== 'Existing').map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <dl className="facts">
          <div><dt>Area</dt><dd>{Math.round(sqft).toLocaleString()} sq ft</dd></div>
          <div><dt>Perimeter</dt><dd>{formatFeet(perimeter(a.points))}</dd></div>
          <div><dt>Vertices</dt><dd>{a.points.length}</dd></div>
          <div><dt>Est. cost</dt><dd>{usd(sqft * spec.costPerSqFt)}</dd></div>
          {spec.waterGalSqFtYr > 0 && (
            <div><dt>Water</dt><dd>{Math.round(sqft * spec.waterGalSqFtYr).toLocaleString()} gal/yr</dd></div>
          )}
        </dl>
        {spec.notes && <p className="note">{spec.notes}</p>}
        <NotesField obj={obj} onChange={onChange} />
      </>
    );
  }

  if (obj.kind === 'path') {
    const p = obj as PathObj;
    const spec = getPathSpec(p.material);
    const len = perimeter(p.points, !!p.closed);
    return (
      <>
        <h4>{spec.name}</h4>
        {common}
        <label className="field">
          <span>Material</span>
          <select value={p.material} onChange={(e) => onChange({ material: e.target.value } as Partial<DesignObj>)}>
            {PATH_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Width</span>
          <input
            type="number"
            step={0.25}
            min={0.1}
            value={p.width}
            onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<DesignObj>)}
          />
        </label>
        <dl className="facts">
          <div><dt>Length</dt><dd>{formatFeet(len)}</dd></div>
          <div>
            <dt>Est. cost</dt>
            <dd>{usd(spec.priceBy === 'area' ? len * p.width * spec.cost : len * spec.cost)}</dd>
          </div>
        </dl>
        {spec.notes && <p className="note">{spec.notes}</p>}
        <NotesField obj={obj} onChange={onChange} />
      </>
    );
  }

  if (obj.kind === 'feature') {
    const spec = FEATURES[obj.feature];
    return (
      <>
        <h4>{spec?.name ?? 'Feature'}</h4>
        {common}
        <label className="field">
          <span>Size (ft)</span>
          <input
            type="number"
            step={0.5}
            min={0.5}
            value={obj.sizeFt ?? spec?.defaultSizeFt ?? 2}
            onChange={(e) => onChange({ sizeFt: Number(e.target.value) } as Partial<DesignObj>)}
          />
        </label>
        <label className="field">
          <span>Rotation</span>
          <input
            type="range"
            min={0}
            max={359}
            value={obj.rotation ?? 0}
            onChange={(e) => onChange({ rotation: Number(e.target.value) } as Partial<DesignObj>)}
          />
        </label>
        <dl className="facts">
          <div><dt>Est. cost</dt><dd>{usd(spec?.cost ?? 0)}</dd></div>
          <div><dt>Position</dt><dd>{obj.at.x.toFixed(1)}′ E, {obj.at.y.toFixed(1)}′ N</dd></div>
        </dl>
        {spec?.notes && <p className="note">{spec.notes}</p>}
        <NotesField obj={obj} onChange={onChange} />
      </>
    );
  }

  if (obj.kind === 'label') {
    return (
      <>
        <h4>Note</h4>
        {common}
        <label className="field col">
          <span>Text</span>
          <textarea
            rows={3}
            value={obj.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<DesignObj>)}
          />
        </label>
      </>
    );
  }

  return (
    <>
      <h4>Dimension</h4>
      {common}
    </>
  );
}

function PlantEditor({
  obj,
  onChange,
  common,
}: {
  obj: PlantObj;
  onChange: (p: Partial<DesignObj>) => void;
  common: React.ReactNode;
}) {
  const sp = getSpecies(obj.speciesId);
  if (!sp) return <p>Unknown species.</p>;
  const size = obj.size ?? sp.size;
  const r = obj.radiusFt ?? sp.w / 2;

  return (
    <>
      <div className="plant-head">
        <SymbolPreview species={sp} size={56} />
        <div>
          <h4>{sp.common}</h4>
          <em className="bot">{sp.botanical}</em>
          <div className="badges">
            {sp.native && <span className="badge native">Texas native</span>}
            {sp.evergreen && <span className="badge evergreen">Evergreen</span>}
            {sp.deerResistant && <span className="badge">Deer resistant</span>}
          </div>
        </div>
      </div>

      <label className="field">
        <span>Species</span>
        <select value={obj.speciesId} onChange={(e) => onChange({ speciesId: e.target.value } as Partial<DesignObj>)}>
          {SPECIES.map((s) => (
            <option key={s.id} value={s.id}>{s.common}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Nursery size</span>
        <select value={size} onChange={(e) => onChange({ size: e.target.value } as Partial<DesignObj>)}>
          {[...new Set([sp.size, ...sizeOptions(sp)])].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Draw at</span>
        <select
          value={obj.radiusFt ? 'custom' : 'mature'}
          onChange={(e) =>
            onChange({
              radiusFt: e.target.value === 'mature' ? undefined : sp.w / 4,
            } as Partial<DesignObj>)
          }
        >
          <option value="mature">Mature spread ({sp.w}′)</option>
          <option value="custom">Custom radius</option>
        </select>
      </label>
      {obj.radiusFt !== undefined && (
        <label className="field">
          <span>Radius</span>
          <input
            type="number"
            step={0.5}
            min={0.5}
            value={obj.radiusFt}
            onChange={(e) => onChange({ radiusFt: Number(e.target.value) } as Partial<DesignObj>)}
          />
        </label>
      )}

      {common}

      <dl className="facts">
        <div><dt>Mature size</dt><dd>{sp.h}′ H × {sp.w}′ W</dd></div>
        <div><dt>Drawn radius</dt><dd>{r.toFixed(1)}′</dd></div>
        <div><dt>Exposure</dt><dd>{SUN_LABEL[sp.sun]}</dd></div>
        <div><dt>Water</dt><dd>{WATER_LABEL[sp.water]}</dd></div>
        <div><dt>Spacing</dt><dd>{sp.spacing}′ o.c.</dd></div>
        <div><dt>To maturity</dt><dd>~{sp.yearsToMature} yrs</dd></div>
        <div><dt>Est. cost</dt><dd>{usdRate(sizeAdjustedCost(sp, size))}</dd></div>
      </dl>

      {sp.bloom.length > 0 && (
        <div className="bloom-block">
          <span className="bloom-label">Bloom{sp.bloomColor ? ` — ${sp.bloomColor.toLowerCase()}` : ''}</span>
          <BloomBar months={sp.bloom} color={sp.bloomColor} />
        </div>
      )}
      {sp.fallColor && <p className="note"><strong>Fall / winter:</strong> {sp.fallColor}</p>}
      <p className="note">{sp.notes}</p>
      <NotesField obj={obj} onChange={onChange} />
    </>
  );
}

function NotesField({ obj, onChange }: { obj: DesignObj; onChange: (p: Partial<DesignObj>) => void }) {
  return (
    <label className="field col">
      <span>Your notes</span>
      <textarea
        rows={2}
        value={obj.notes ?? ''}
        placeholder="Anything to remember about this…"
        onChange={(e) => onChange({ notes: e.target.value } as Partial<DesignObj>)}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */

function SiteSummary() {
  const doc = useStore((s) => s.doc);
  const stats = designStats(doc.objects);

  return (
    <div className="prop-block">
      <h4>{doc.site.address}</h4>
      <p className="panel-hint">Nothing selected. Click something on the plan to edit it.</p>

      <dl className="facts">
        <div><dt>Legal</dt><dd>Lot 41, Block E — Glenwood Estates No. 2</dd></div>
        <div><dt>Lot</dt><dd>70.00′ × 120.00′ · {doc.site.lotAreaSqFt.toLocaleString()} sq ft</dd></div>
        <div><dt>Orientation</dt><dd>House faces south onto Creekstone Court</dd></div>
        <div><dt>USDA zone</dt><dd>{doc.site.usdaZone} · {doc.site.latitude.toFixed(2)}°N</dd></div>
        <div><dt>Soil</dt><dd>Blackland clay, alkaline</dd></div>
        <div><dt>Flood</dt><dd>Zone X — outside the 100-yr floodplain</dd></div>
        <div><dt>Plants placed</dt><dd>{stats.plants} ({stats.trees} trees)</dd></div>
        <div><dt>Texas natives</dt><dd>{stats.nativePct}%</dd></div>
      </dl>

      <h5>Site constraints</h5>
      {CONSTRAINTS.map((c) => (
        <div key={c.id} className="constraint">
          <strong>{c.label}</strong>
          <span>{c.detail}</span>
        </div>
      ))}

      <p className="note small">
        Base geometry digitized from the {doc.site.surveyor} survey dated{' '}
        {new Date(doc.site.surveyDate).toLocaleDateString()}. Lettered plat calls are exact;
        anything scaled off the drawing is good to about ±0.5′.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Review({ checks }: { checks: CheckResult[] }) {
  const setSelection = useStore((s) => s.setSelection);

  return (
    <div className="prop-block">
      <p className="panel-hint">
        Every plant is checked against setbacks, clearances, mature spread and the direct sun it
        will actually receive. Exposure is modelled at the September equinox with canopies in
        leaf — a growing-season average — so it does not swing with the date on the Sun tab.
      </p>

      {!checks.length ? (
        <p className="empty good">Nothing flagged. Setbacks, clearances and spacing all look reasonable.</p>
      ) : (
        checks.map((c) => (
          <button
            key={c.id}
            className={`check ${c.severity}`}
            onClick={() => c.objectId && setSelection([c.objectId])}
          >
            <span className="check-title">{c.title}</span>
            <span className="check-detail">{c.detail}</span>
          </button>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SunControls() {
  const sun = useStore((s) => s.sun);
  const setSun = useStore((s) => s.setSun);

  const label = (() => {
    const h = Math.floor(sun.hour);
    const m = Math.round((sun.hour - h) * 60);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  })();

  return (
    <div className="prop-block">
      <label className="chk big">
        <input type="checkbox" checked={sun.enabled} onChange={(e) => setSun({ enabled: e.target.checked })} />
        Cast shadows
      </label>
      <label className="chk big">
        <input
          type="checkbox"
          checked={sun.showHeatmap}
          onChange={(e) => setSun({ showHeatmap: e.target.checked })}
        />
        Sun-hours map
      </label>
      <p className="panel-hint">
        Shadows are projected from the house, fence, shed and every plant tall enough to matter, at
        this site's latitude ({useStore.getState().doc.site.latitude.toFixed(2)}°N).
      </p>

      <h5>Date</h5>
      <div className="chip-row wrap">
        {SEASON_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${sun.month === p.month && sun.day === p.day ? 'on' : ''}`}
            onClick={() => setSun({ month: p.month, day: p.day })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="field col">
        <span>Time of day — {label}</span>
        <input
          type="range"
          min={5}
          max={21}
          step={0.25}
          value={sun.hour}
          onChange={(e) => setSun({ hour: Number(e.target.value) })}
        />
      </label>

      <label className="chk">
        <input type="checkbox" checked={sun.leafOn} onChange={(e) => setSun({ leafOn: e.target.checked })} />
        Deciduous trees in leaf
      </label>
      <p className="note small">
        Turn this off to see the winter case — bare-branch trees let sun through to the house, which
        is exactly why a deciduous shade tree on the south or west side beats an evergreen one.
      </p>

      {sun.showHeatmap && (
        <>
          <h5>Sun hours</h5>
          <div className="legend">
            <div className="legend-bar" />
            <div className="legend-labels"><span>deep shade</span><span>part sun</span><span>full sun</span></div>
          </div>
          <p className="note small">
            Direct sun over the whole day, sampled every 30 minutes. Under ~4 hrs is shade planting,
            4–6 is part sun, 6+ is full sun.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Layers() {
  const doc = useStore((s) => s.doc);
  const setLayer = useStore((s) => s.setLayer);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of [...doc.base, ...doc.objects]) m.set(o.layer, (m.get(o.layer) ?? 0) + 1);
    return m;
  }, [doc.base, doc.objects]);

  return (
    <div className="prop-block">
      {LAYER_ORDER.filter((l) => l !== 'survey').map((id) => {
        const l = doc.layers[id];
        return (
          <div key={id} className="layer-row">
            <button
              className={`eye ${l.visible ? 'on' : ''}`}
              onClick={() => setLayer(id, { visible: !l.visible })}
              title={l.visible ? 'Hide layer' : 'Show layer'}
            >
              {l.visible ? '👁' : '—'}
            </button>
            <span className="layer-name">{l.name}</span>
            <span className="layer-count">{counts.get(id) ?? 0}</span>
            <button
              className={`lock ${l.locked ? 'on' : ''}`}
              onClick={() => setLayer(id, { locked: !l.locked })}
              title={l.locked ? 'Unlock layer' : 'Lock layer'}
            >
              {l.locked ? '🔒' : '🔓'}
            </button>
          </div>
        );
      })}
      <p className="note small">
        The survey base — property lines, building line, easement, house and existing concrete — is
        always drawn and never editable, so the design can't drift off the record dimensions.
      </p>
    </div>
  );
}
