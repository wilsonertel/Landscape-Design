import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { computeTakeoff, usd, usdRate } from '../model/takeoff';
import { SUN_LABEL, WATER_LABEL } from '../data/plants';
import { exportScheduleCSV, planDataUrl, printPlanSheet } from '../export/exporters';
import { SymbolPreview } from './PalettePanel';

export function ScheduleModal({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const [busy, setBusy] = useState(false);
  const t = useMemo(() => computeTakeoff(doc.objects, doc.base), [doc.objects, doc.base]);

  const lotArea = doc.site.lotAreaSqFt;
  const pct = (v: number) => `${((v / lotArea) * 100).toFixed(0)}%`;
  const covered =
    t.areas.lawn + t.areas.beds + t.areas.paving + t.areas.water + t.areas.existingHardscape + t.areas.house;

  const doPrint = async () => {
    setBusy(true);
    try {
      const svg = document.querySelector<SVGSVGElement>('svg.plan-svg');
      printPlanSheet(doc, svg ? await planDataUrl(svg) : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Plant schedule and estimate">
        <header className="modal-head">
          <div>
            <h2>{doc.name}</h2>
            <p>{doc.site.address} · {doc.site.city}, {doc.site.state} · Lot {lotArea.toLocaleString()} sq ft</p>
          </div>
          <div className="modal-actions">
            <button onClick={() => exportScheduleCSV(doc)}>Export CSV</button>
            <button className="primary" onClick={doPrint} disabled={busy}>
              {busy ? 'Preparing…' : 'Print / save as PDF'}
            </button>
            <button className="ghost close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="modal-body">
          <section className="summary-grid">
            <Stat label="Estimated total" value={usd(t.grandTotal)} accent />
            <Stat label="Plant material" value={usd(t.plantsTotal)} />
            <Stat label="Hardscape & surfaces" value={usd(t.materialsTotal)} />
            <Stat label="Prep, irrigation, contingency" value={usd(t.softTotal)} />
            <Stat label="Plants" value={String(t.plantRows.reduce((s, r) => s + r.qty, 0))} />
            <Stat
              label="Est. irrigation demand"
              value={`${Math.round(t.waterGalPerYear).toLocaleString()} gal/yr`}
            />
          </section>

          <h3>Site coverage</h3>
          <div className="coverage">
            {(
              [
                ['House & shed', t.areas.house, '#c9c3ba'],
                ['Existing concrete', t.areas.existingHardscape, '#d5d5d0'],
                ['New paving', t.areas.paving, '#c8bda9'],
                ['Lawn', t.areas.lawn, '#a9c67f'],
                ['Planting beds', t.areas.beds, '#7a5f45'],
                ['Water', t.areas.water, '#7fa9c4'],
                [
                  covered > lotArea ? 'Overlap (drawn twice)' : 'Unassigned',
                  Math.abs(lotArea - covered),
                  covered > lotArea ? '#d9534f' : '#efece5',
                ],
              ] as const
            )
              .filter(([, v]) => v > 1)
              .map(([label, v, color]) => (
                <div key={label} className="cov-row">
                  <span className="cov-swatch" style={{ background: color }} />
                  <span className="cov-label">{label}</span>
                  <span className="cov-bar">
                    <span style={{ width: pct(v), background: color }} />
                  </span>
                  <span className="cov-val">{Math.round(v).toLocaleString()} sq ft</span>
                  <span className="cov-pct">{pct(v)}</span>
                </div>
              ))}
          </div>

          <h3>Plant schedule</h3>
          {t.plantRows.length ? (
            <table className="sched">
              <thead>
                <tr>
                  <th></th>
                  <th>Key</th>
                  <th className="num">Qty</th>
                  <th>Botanical / common name</th>
                  <th>Size</th>
                  <th>Mature</th>
                  <th>Exposure</th>
                  <th>Water</th>
                  <th className="num">Unit</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {t.plantRows.map((r) => (
                  <tr key={r.key}>
                    <td className="symcell"><SymbolPreview species={r.species} size={30} /></td>
                    <td className="code">{r.code}</td>
                    <td className="num">{r.qty}</td>
                    <td>
                      <strong>{r.species.common}</strong>
                      <br />
                      <em>{r.species.botanical}</em>
                      {r.species.native && <span className="badge native">TX</span>}
                    </td>
                    <td>{r.size}</td>
                    <td>{r.species.h}′ × {r.species.w}′</td>
                    <td>{SUN_LABEL[r.species.sun].split(' (')[0]}</td>
                    <td>{WATER_LABEL[r.species.water]}</td>
                    <td className="num">{usdRate(r.unitCost)}</td>
                    <td className="num">{usd(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9}>Plant material subtotal</td>
                  <td className="num">{usd(t.plantsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="empty">No plants placed yet. Pick something from the plant library and click on the plan.</p>
          )}

          <h3>Materials &amp; installation</h3>
          {t.lines.length || t.softCosts.length ? (
            <table className="sched">
              <thead>
                <tr>
                  <th>Category</th><th>Item</th><th className="num">Qty</th><th>Unit</th>
                  <th className="num">Unit cost</th><th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...t.lines, ...t.softCosts].map((l, i) => (
                  <tr key={i}>
                    <td>{l.category}</td>
                    <td>{l.item}</td>
                    <td className="num">{Math.round(l.qty).toLocaleString()}</td>
                    <td>{l.unit}</td>
                    <td className="num">{usdRate(l.unitCost)}</td>
                    <td className="num">{usd(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Estimated total</td>
                  <td className="num">{usd(t.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="empty">Nothing taken off yet.</p>
          )}

          <p className="note">
            Planning-level estimates for the North Texas market, not a bid. Quantities come straight off the
            drawing — field-verify before ordering. Plant prices assume container stock installed with
            amended backfill; large caliper trees vary widely with availability and access.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
