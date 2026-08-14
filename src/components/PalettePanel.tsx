import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  SPECIES,
  SUN_LABEL,
  TYPE_LABEL,
  WATER_LABEL,
  type PlantType,
  type Species,
} from '../data/plants';
import { FEATURES, PATH_MATERIALS, SURFACES } from '../data/materials';
import type { FeatureId, PathMaterialId, SurfaceId } from '../model/types';
import { shade, symbolGeometry } from './symbols';

type Tab = 'plants' | 'surfaces' | 'hardscape' | 'features';

export function PalettePanel() {
  const [tab, setTab] = useState<Tab>('plants');

  return (
    <aside className="panel panel-left">
      <div className="tabs">
        {(
          [
            ['plants', 'Plants'],
            ['surfaces', 'Surfaces'],
            ['hardscape', 'Hardscape'],
            ['features', 'Features'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'plants' && <PlantLibrary />}
        {tab === 'surfaces' && <SurfaceLibrary />}
        {tab === 'hardscape' && <HardscapeLibrary />}
        {tab === 'features' && <FeatureLibrary />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function PlantLibrary() {
  const activeSpecies = useStore((s) => s.activeSpecies);
  const setActiveSpecies = useStore((s) => s.setActiveSpecies);
  const setTool = useStore((s) => s.setTool);

  const [q, setQ] = useState('');
  const [type, setType] = useState<PlantType | 'all'>('all');
  const [sun, setSun] = useState<'all' | 'full' | 'part' | 'shade'>('all');
  const [nativeOnly, setNativeOnly] = useState(false);
  const [lowWater, setLowWater] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SPECIES.filter((s) => {
      if (type !== 'all' && s.type !== type) return false;
      if (nativeOnly && !s.native) return false;
      if (lowWater && s.water !== 'low' && s.water !== 'very-low') return false;
      if (sun === 'full' && !s.sun.startsWith('full')) return false;
      if (sun === 'part' && !s.sun.includes('part')) return false;
      if (sun === 'shade' && !s.sun.includes('shade')) return false;
      if (
        needle &&
        !s.common.toLowerCase().includes(needle) &&
        !s.botanical.toLowerCase().includes(needle)
      )
        return false;
      return true;
    });
  }, [q, type, sun, nativeOnly, lowWater]);

  const grouped = useMemo(() => {
    const m = new Map<PlantType, Species[]>();
    for (const s of list) {
      const arr = m.get(s.type) ?? [];
      arr.push(s);
      m.set(s.type, arr);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <>
      <div className="filters">
        <input
          className="search"
          placeholder="Search plants…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value as never)}>
          <option value="all">All types</option>
          {(Object.keys(TYPE_LABEL) as PlantType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={sun} onChange={(e) => setSun(e.target.value as never)}>
          <option value="all">Any exposure</option>
          <option value="full">Full sun</option>
          <option value="part">Part sun</option>
          <option value="shade">Shade</option>
        </select>
        <div className="chip-row">
          <button className={`chip ${nativeOnly ? 'on' : ''}`} onClick={() => setNativeOnly((v) => !v)}>
            Texas native
          </button>
          <button className={`chip ${lowWater ? 'on' : ''}`} onClick={() => setLowWater((v) => !v)}>
            Low water
          </button>
        </div>
        <div className="count">{list.length} of {SPECIES.length} species</div>
      </div>

      {grouped.map(([t, items]) => (
        <section key={t} className="lib-group">
          <h4>{TYPE_LABEL[t]}</h4>
          {items.map((s) => (
            <button
              key={s.id}
              className={`plant-card ${activeSpecies === s.id ? 'active' : ''}`}
              onClick={() => {
                setActiveSpecies(s.id);
                setTool('plant');
              }}
              title={s.notes}
            >
              <SymbolPreview species={s} />
              <div className="plant-meta">
                <div className="pc-name">
                  {s.common}
                  {s.native && <span className="badge native" title="Texas native">TX</span>}
                  {s.evergreen && <span className="badge evergreen" title="Evergreen">EV</span>}
                </div>
                <div className="pc-bot">{s.botanical}</div>
                <div className="pc-facts">
                  <span>{s.h}′ × {s.w}′</span>
                  <span>·</span>
                  <span>{SUN_LABEL[s.sun].split(' (')[0]}</span>
                  <span>·</span>
                  <span>{WATER_LABEL[s.water]} water</span>
                </div>
                {s.bloom.length > 0 && <BloomBar months={s.bloom} color={s.bloomColor} />}
              </div>
            </button>
          ))}
        </section>
      ))}
      {!list.length && <p className="empty">No plants match those filters.</p>}
    </>
  );
}

export function SymbolPreview({ species, size = 44 }: { species: Species; size?: number }) {
  const r = size / 2 - 3;
  const g = symbolGeometry(species.symbol, r);
  const outline = shade(species.foliage, 0.62);
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="sym-preview">
      <path d={g.outline} fill={species.foliage} fillOpacity={0.55} stroke={outline} strokeWidth={1.1} strokeLinejoin="round" />
      {g.detail && <path d={g.detail} fill="none" stroke={outline} strokeOpacity={g.detailOpacity} strokeWidth={0.8} strokeLinecap="round" />}
      {g.centerDot > 0 && <circle r={g.centerDot} fill={outline} />}
    </svg>
  );
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function BloomBar({ months, color }: { months: number[]; color?: string }) {
  return (
    <div className="bloom-bar" title={color ? `Blooms ${color.toLowerCase()}` : 'Bloom season'}>
      {MONTH_INITIALS.map((m, i) => (
        <span key={i} className={months.includes(i + 1) ? 'on' : ''}>
          {m}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SurfaceLibrary() {
  const active = useStore((s) => s.activeSurface);
  const setActive = useStore((s) => s.setActiveSurface);
  const setTool = useStore((s) => s.setTool);

  const groups = ['Lawn', 'Planting bed', 'Paving', 'Water'] as const;

  return (
    <>
      <p className="panel-hint">
        Pick a surface, then draw its outline. Click each corner and close the shape by clicking
        the first point again, or press Enter.
      </p>
      {groups.map((g) => (
        <section key={g} className="lib-group">
          <h4>{g}</h4>
          {SURFACES.filter((s) => s.group === g).map((s) => (
            <button
              key={s.id}
              className={`mat-card ${active === s.id ? 'active' : ''}`}
              onClick={() => {
                setActive(s.id as SurfaceId);
                setTool(g === 'Lawn' ? 'lawn' : g === 'Paving' ? 'patio' : 'bed');
              }}
            >
              <span className="swatch" style={{ background: s.fill, borderColor: s.stroke }} />
              <span className="mat-meta">
                <strong>{s.name}</strong>
                <em>${s.costPerSqFt.toFixed(2)}/sq ft{s.waterGalSqFtYr ? ` · ${s.waterGalSqFtYr} gal/sf/yr` : ''}</em>
                {s.notes && <small>{s.notes}</small>}
              </span>
            </button>
          ))}
        </section>
      ))}
    </>
  );
}

function HardscapeLibrary() {
  const active = useStore((s) => s.activePath);
  const setActive = useStore((s) => s.setActivePath);
  const setTool = useStore((s) => s.setTool);
  const groups = ['Walks', 'Edging', 'Walls & fences', 'Irrigation'] as const;

  return (
    <>
      <p className="panel-hint">Linear elements. Click along the run, then double-click or press Enter to finish.</p>
      {groups.map((g) => (
        <section key={g} className="lib-group">
          <h4>{g}</h4>
          {PATH_MATERIALS.filter((p) => p.group === g).map((p) => (
            <button
              key={p.id}
              className={`mat-card ${active === p.id ? 'active' : ''}`}
              onClick={() => {
                setActive(p.id as PathMaterialId);
                setTool(g === 'Walks' ? 'walk' : g === 'Edging' ? 'edging' : 'fence');
              }}
            >
              <span className="swatch line" style={{ background: p.fill === 'none' ? p.stroke : p.fill, borderColor: p.stroke }} />
              <span className="mat-meta">
                <strong>{p.name}</strong>
                <em>
                  ${p.cost.toFixed(2)}/{p.priceBy === 'area' ? 'sq ft' : 'lin ft'} · {p.defaultWidth}′ wide
                </em>
                {p.notes && <small>{p.notes}</small>}
              </span>
            </button>
          ))}
        </section>
      ))}
    </>
  );
}

function FeatureLibrary() {
  const active = useStore((s) => s.activeFeature);
  const setActive = useStore((s) => s.setActiveFeature);
  const setTool = useStore((s) => s.setTool);
  const groups = ['Amenities', 'Lighting', 'Irrigation'] as const;

  return (
    <>
      <p className="panel-hint">Point objects. Pick one, then click on the plan to place it.</p>
      {groups.map((g) => (
        <section key={g} className="lib-group">
          <h4>{g}</h4>
          {Object.entries(FEATURES)
            .filter(([, f]) => f.group === g)
            .map(([id, f]) => (
              <button
                key={id}
                className={`mat-card ${active === id ? 'active' : ''}`}
                onClick={() => {
                  setActive(id as FeatureId);
                  setTool('feature');
                }}
              >
                <span className="swatch dot" style={{ background: f.color, borderColor: shade(f.color, 0.6) }} />
                <span className="mat-meta">
                  <strong>{f.name}</strong>
                  <em>${f.cost.toLocaleString()} ea · {f.defaultSizeFt}′</em>
                  {f.notes && <small>{f.notes}</small>}
                </span>
              </button>
            ))}
        </section>
      ))}
    </>
  );
}
