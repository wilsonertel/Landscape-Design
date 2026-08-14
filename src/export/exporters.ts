import type { Document } from '../model/types';
import { computeTakeoff, usd, usdRate } from '../model/takeoff';

/** Save the design as a JSON file the app can read back. */
export function exportJSON(doc: Document) {
  download(
    new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    `${slug(doc.name)}.landscape.json`,
  );
}

export function importJSON(file: File): Promise<Document> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        resolve(JSON.parse(String(r.result)) as Document);
      } catch (err) {
        reject(err);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/**
 * Rasterize the live plan SVG to a PNG at print resolution. Everything is
 * inline (no external fonts or images), so serializing works without any
 * fetch step.
 */
export async function exportPNG(svg: SVGSVGElement, name: string, scaleFactor = 3) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || Number(svg.getAttribute('width'));
  const h = svg.clientHeight || Number(svg.getAttribute('height'));
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const data = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Could not rasterize the plan'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scaleFactor;
    canvas.height = h * scaleFactor;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#efece5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob) download(blob, `${slug(name)}-plan.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Open a print-ready sheet — plan image, plant schedule, and estimate — in a
 * new window. The browser's "Save as PDF" turns it into the document you
 * would hand a contractor.
 */
export function printPlanSheet(doc: Document, planPngDataUrl: string | null) {
  const t = computeTakeoff(doc.objects, doc.base);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Your browser blocked the print window. Allow pop-ups for this page and try again.');
    return;
  }

  const scheduleRows = t.plantRows
    .map(
      (r) => `<tr>
        <td class="code">${r.code}</td>
        <td>${r.qty}</td>
        <td><strong>${esc(r.species.common)}</strong><br><em>${esc(r.species.botanical)}</em></td>
        <td>${esc(r.size)}</td>
        <td>${r.species.h}′ × ${r.species.w}′</td>
        <td>${esc(sunShort(r.species.sun))}</td>
        <td>${esc(r.species.water)}</td>
        <td class="num">${usdRate(r.unitCost)}</td>
        <td class="num">${usd(r.total)}</td>
      </tr>`,
    )
    .join('');

  const materialRows = [...t.lines, ...t.softCosts]
    .map(
      (l) => `<tr>
        <td>${esc(l.category)}</td>
        <td>${esc(l.item)}</td>
        <td class="num">${l.qty.toLocaleString()}</td>
        <td>${esc(l.unit)}</td>
        <td class="num">${usdRate(l.unitCost)}</td>
        <td class="num">${usd(l.total)}</td>
      </tr>`,
    )
    .join('');

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(doc.name)} — ${esc(doc.site.address)}</title>
<style>
  @page { size: letter portrait; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font: 11px/1.5 'Inter', system-ui, -apple-system, sans-serif; color: #24221e; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.01em; }
  h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 0.08em;
       border-bottom: 1.5px solid #24221e; padding-bottom: 4px; }
  .sub { color: #6b6459; font-size: 11px; }
  .meta { display: flex; gap: 28px; margin-top: 10px; flex-wrap: wrap; }
  .meta div { font-size: 10px; }
  .meta b { display: block; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8378; font-size: 9px; }
  img.plan { width: 100%; border: 1px solid #cfc9bd; margin-top: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; background: #f0ede6; padding: 5px 6px; border-bottom: 1.5px solid #24221e;
       text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px; }
  td { padding: 5px 6px; border-bottom: 1px solid #e5e1d8; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.code { font-weight: 700; font-family: ui-monospace, monospace; }
  tfoot td { font-weight: 700; border-top: 1.5px solid #24221e; border-bottom: none; }
  .totals { margin-top: 14px; margin-left: auto; width: 300px; }
  .totals tr td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .note { font-size: 9.5px; color: #6b6459; margin-top: 10px; line-height: 1.6; }
  .pagebreak { page-break-before: always; }
</style></head><body>
  <h1>${esc(doc.name)}</h1>
  <div class="sub">${esc(doc.site.address)} · ${esc(doc.site.city)}, ${esc(doc.site.state)}</div>
  <div class="meta">
    <div><b>Legal</b>${esc(doc.site.legal)}</div>
    <div><b>Lot area</b>${doc.site.lotAreaSqFt.toLocaleString()} sq ft</div>
    <div><b>USDA zone</b>${esc(doc.site.usdaZone)}</div>
    <div><b>Base survey</b>${esc(doc.site.surveyor)}, ${esc(doc.site.surveyDate)}</div>
    <div><b>Issued</b>${new Date().toLocaleDateString()}</div>
  </div>
  ${planPngDataUrl ? `<img class="plan" src="${planPngDataUrl}" alt="Landscape plan">` : ''}

  <h2>Plant schedule</h2>
  <table>
    <thead><tr><th>Key</th><th>Qty</th><th>Botanical / common name</th><th>Size</th>
      <th>Mature H×W</th><th>Exposure</th><th>Water</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
    <tbody>${scheduleRows || '<tr><td colspan="9">No plants placed yet.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="8">Plant material subtotal</td><td class="num">${usd(t.plantsTotal)}</td></tr></tfoot>
  </table>

  <h2>Materials &amp; installation</h2>
  <table>
    <thead><tr><th>Category</th><th>Item</th><th class="num">Qty</th><th>Unit</th>
      <th class="num">Unit cost</th><th class="num">Total</th></tr></thead>
    <tbody>${materialRows || '<tr><td colspan="6">Nothing taken off yet.</td></tr>'}</tbody>
  </table>

  <table class="totals">
    <tr><td>Plant material</td><td>${usd(t.plantsTotal)}</td></tr>
    <tr><td>Hardscape &amp; surfaces</td><td>${usd(t.materialsTotal)}</td></tr>
    <tr><td>Site prep, irrigation &amp; contingency</td><td>${usd(t.softTotal)}</td></tr>
    <tr><td><strong>Estimated total</strong></td><td><strong>${usd(t.grandTotal)}</strong></td></tr>
  </table>

  <div class="note">
    <strong>Notes.</strong> Costs are planning-level estimates for the North Texas market and are not a bid.
    Quantities are taken off the drawing and should be field-verified. Base geometry is digitized from the
    referenced boundary survey; dimensions scaled off the plat carry roughly ±0.5′ of error. Confirm all
    setbacks, easements and any City of McKinney permit requirements before construction. This site lies in
    Flood Zone X, outside the 100-year floodplain, per F.I.R.M. No. 48085C0260K.
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 350);</script>
</body></html>`);
  w.document.close();
}

/** Render the plan to a data URL so it can be embedded in the print sheet. */
export async function planDataUrl(svg: SVGSVGElement, scaleFactor = 2.5): Promise<string | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('render failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scaleFactor;
    canvas.height = h * scaleFactor;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#efece5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportScheduleCSV(doc: Document) {
  const t = computeTakeoff(doc.objects, doc.base);
  const rows: string[][] = [
    ['Key', 'Qty', 'Common name', 'Botanical name', 'Size', 'Mature H (ft)', 'Mature W (ft)', 'Exposure', 'Water', 'Native', 'Unit cost', 'Total'],
    ...t.plantRows.map((r) => [
      r.code,
      String(r.qty),
      r.species.common,
      r.species.botanical,
      r.size,
      String(r.species.h),
      String(r.species.w),
      r.species.sun,
      r.species.water,
      r.species.native ? 'Yes' : 'No',
      r.unitCost.toFixed(2),
      r.total.toFixed(2),
    ]),
    [],
    ['Category', 'Item', 'Qty', 'Unit', 'Unit cost', 'Total'],
    ...[...t.lines, ...t.softCosts].map((l) => [
      l.category,
      l.item,
      String(Math.round(l.qty)),
      l.unit,
      l.unitCost.toFixed(2),
      l.total.toFixed(2),
    ]),
    [],
    ['', '', '', '', 'ESTIMATED TOTAL', t.grandTotal.toFixed(2)],
  ];
  const csv = rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${slug(doc.name)}-schedule.csv`);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'landscape-plan';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sunShort(s: string): string {
  return (
    { full: 'Full sun', part: 'Part sun', shade: 'Shade', 'full-part': 'Full–part', 'part-shade': 'Part–shade' } as Record<string, string>
  )[s] ?? s;
}
