import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { Tool } from '../model/types';
import { exportJSON, exportPNG, exportScheduleCSV, importJSON, planDataUrl, printPlanSheet } from '../export/exporters';

const TOOLS: { id: Tool; label: string; key: string; icon: string }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: 'M4 2 L4 17 L8 13 L10.5 18 L13 17 L10.5 12 L15.5 12 Z' },
  { id: 'bed', label: 'Planting bed', key: 'B', icon: 'M3 13 C3 7 7 3 12 4 C17 5 18 10 16 14 C14 18 6 18 3 13 Z' },
  { id: 'lawn', label: 'Lawn', key: 'L', icon: 'M2 15 L2 8 L10 4 L18 8 L18 15 Z' },
  { id: 'patio', label: 'Paving', key: 'P', icon: 'M3 4 H17 V16 H3 Z M3 10 H17 M10 4 V16' },
  { id: 'walk', label: 'Walk / path', key: 'W', icon: 'M6 18 C6 12 8 10 8 2 M14 18 C14 12 12 10 12 2' },
  { id: 'edging', label: 'Edging', key: 'E', icon: 'M2 12 C6 6 14 6 18 12' },
  { id: 'fence', label: 'Fence / wall', key: '', icon: 'M3 6 H17 M3 12 H17 M6 3 V17 M14 3 V17' },
  { id: 'plant', label: 'Place plant', key: 'T', icon: 'M10 18 V10 M10 10 C6 10 4 7 5 4 C8 3 11 5 10 10 C9 5 12 3 15 4 C16 7 14 10 10 10' },
  { id: 'feature', label: 'Feature', key: 'G', icon: 'M10 3 L17 10 L10 17 L3 10 Z' },
  { id: 'dimension', label: 'Dimension', key: 'D', icon: 'M2 10 H18 M4 6 V14 M16 6 V14' },
  { id: 'measure', label: 'Measure', key: 'M', icon: 'M3 13 L13 3 L17 7 L7 17 Z M6 10 L8 12 M9 7 L11 9' },
  { id: 'label', label: 'Note', key: 'N', icon: 'M4 4 H16 V13 H10 L6 17 V13 H4 Z' },
];

export function Toolbar({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const snap = useStore((s) => s.snap);
  const setSnap = useStore((s) => s.setSnap);
  const snapSize = useStore((s) => s.snapSize);
  const setSnapSize = useStore((s) => s.setSnapSize);
  const showDimensions = useStore((s) => s.showDimensions);
  const setShowDimensions = useStore((s) => s.setShowDimensions);
  const doc = useStore((s) => s.doc);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const rename = useStore((s) => s.rename);
  const loadDocument = useStore((s) => s.loadDocument);
  const resetDocument = useStore((s) => s.resetDocument);

  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const getSvg = () => document.querySelector<SVGSVGElement>('svg.plan-svg');

  const doPrint = async () => {
    const svg = getSvg();
    if (!svg) return;
    setBusy(true);
    try {
      const url = await planDataUrl(svg);
      printPlanSheet(doc, url);
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const doPng = async () => {
    const svg = getSvg();
    if (!svg) return;
    setBusy(true);
    try {
      await exportPNG(svg, doc.name);
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21 V13" stroke="#6f9455" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path
            d="M12 13 C6 13 3 9 4.5 4 C9.5 2.5 13.5 6 12 13 C10.5 6 14.5 2.5 19.5 4 C21 9 18 13 12 13 Z"
            fill="#7fae5f"
            stroke="#4f7a3f"
            strokeWidth="1.1"
          />
        </svg>
        <div>
          <input
            className="doc-name"
            value={doc.name}
            onChange={(e) => rename(e.target.value)}
            spellCheck={false}
            aria-label="Design name"
          />
          <div className="brand-sub">{doc.site.address} · {doc.site.city}, TX</div>
        </div>
      </div>

      <div className="tool-strip" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label}${t.key ? ` (${t.key})` : ''}`}
            aria-pressed={tool === t.id}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d={t.icon} fill={t.id === 'select' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <div className="seg">
          <button className="ghost" onClick={undo} disabled={!past.length} title="Undo (⌘Z)">↶</button>
          <button className="ghost" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)">↷</button>
        </div>

        <label className="chk" title="Snap new points to a grid">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Snap
          <select
            value={snapSize}
            onChange={(e) => setSnapSize(Number(e.target.value))}
            disabled={!snap}
            onClick={(e) => e.stopPropagation()}
          >
            <option value={0.25}>3″</option>
            <option value={0.5}>6″</option>
            <option value={1}>1′</option>
            <option value={2}>2′</option>
          </select>
        </label>

        <label className="chk" title="Show names, areas and lengths on the plan">
          <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
          Labels
        </label>

        <button className="primary" onClick={onOpenSchedule}>Schedule &amp; estimate</button>

        <div className="menu-wrap">
          <button className="ghost" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            File ▾
          </button>
          {menuOpen && (
            <>
              <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="menu">
                <button onClick={doPrint} disabled={busy}>
                  {busy ? 'Preparing…' : 'Print / save as PDF…'}
                </button>
                <button onClick={doPng} disabled={busy}>Export plan as PNG</button>
                <button onClick={() => { exportScheduleCSV(doc); setMenuOpen(false); }}>Export schedule as CSV</button>
                <hr />
                <button onClick={() => { exportJSON(doc); setMenuOpen(false); }}>Save design file (.json)</button>
                <button onClick={() => fileRef.current?.click()}>Open design file…</button>
                <hr />
                <button
                  onClick={() => {
                    if (confirm('Clear the design and start from the bare survey? This cannot be undone.')) {
                      resetDocument(false);
                    }
                    setMenuOpen(false);
                  }}
                >
                  New — empty lot
                </button>
                <button
                  onClick={() => {
                    if (confirm('Replace the current design with the example scheme?')) resetDocument(true);
                    setMenuOpen(false);
                  }}
                >
                  Reload example scheme
                </button>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              loadDocument(await importJSON(f));
            } catch {
              alert('That file could not be read as a landscape design.');
            }
            e.target.value = '';
            setMenuOpen(false);
          }}
        />
      </div>
    </header>
  );
}
