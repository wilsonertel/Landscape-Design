import { create } from 'zustand';
import type {
  DesignObj,
  Document,
  FeatureId,
  LayerId,
  LayerState,
  PathMaterialId,
  Pt,
  SurfaceId,
  Tool,
} from '../model/types';
import { LAYER_ORDER } from '../model/types';
import { BASE_OBJECTS, LOT_DEPTH, LOT_WIDTH, SITE } from '../data/property';
import { buildStarterDesign } from '../data/starterDesign';

const STORAGE_KEY = 'landscape-studio:3610-creekstone:v1';
const DOC_VERSION = 1;

const LAYER_NAMES: Record<LayerId, string> = {
  survey: 'Survey & constraints',
  structures: 'Existing structures',
  hardscape: 'Hardscape',
  beds: 'Beds & lawn',
  plants: 'Planting',
  irrigation: 'Irrigation',
  lighting: 'Lighting',
  annotation: 'Notes & dimensions',
};

function defaultLayers(): Record<LayerId, LayerState> {
  const out = {} as Record<LayerId, LayerState>;
  for (const id of LAYER_ORDER) {
    out[id] = { id, name: LAYER_NAMES[id], visible: true, locked: id === 'survey' };
  }
  return out;
}

export function newDocument(withStarter: boolean): Document {
  return {
    version: DOC_VERSION,
    site: SITE,
    name: withStarter ? 'Creekstone — Scheme A' : 'Untitled scheme',
    base: BASE_OBJECTS,
    objects: withStarter ? buildStarterDesign() : [],
    layers: defaultLayers(),
    updatedAt: new Date().toISOString(),
  };
}

export interface SunSettings {
  enabled: boolean;
  showHeatmap: boolean;
  month: number; // 0-11
  day: number;
  hour: number; // decimal local clock hour
  leafOn: boolean;
}

export interface ViewState {
  /** Pixels per foot. */
  scale: number;
  /** Pan offset in screen pixels. */
  tx: number;
  ty: number;
}

interface Store {
  doc: Document;
  selection: string[];
  tool: Tool;
  /** Vertices captured so far by a polygon/path tool. */
  draft: Pt[];
  /** Live cursor position in feet, for the readout and rubber-banding. */
  cursor: Pt | null;

  activeSurface: SurfaceId;
  activePath: PathMaterialId;
  activeSpecies: string;
  activeFeature: FeatureId;

  view: ViewState;
  snap: boolean;
  snapSize: number;
  showDimensions: boolean;
  sun: SunSettings;

  past: DesignObj[][];
  future: DesignObj[][];

  // --- actions
  setTool: (t: Tool) => void;
  setDraft: (d: Pt[]) => void;
  pushDraft: (p: Pt) => void;
  clearDraft: () => void;
  setCursor: (p: Pt | null) => void;

  commit: (next: DesignObj[], label?: string) => void;
  addObject: (o: DesignObj) => void;
  addObjects: (o: DesignObj[]) => void;
  updateObject: (id: string, patch: Partial<DesignObj>) => void;
  /** Move without pushing history — used during a drag. */
  liveUpdate: (objs: DesignObj[]) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string, additive: boolean) => void;

  undo: () => void;
  redo: () => void;

  setView: (v: Partial<ViewState>) => void;
  setSnap: (on: boolean) => void;
  setSnapSize: (n: number) => void;
  setShowDimensions: (on: boolean) => void;
  setSun: (s: Partial<SunSettings>) => void;
  setLayer: (id: LayerId, patch: Partial<LayerState>) => void;

  setActiveSurface: (s: SurfaceId) => void;
  setActivePath: (p: PathMaterialId) => void;
  setActiveSpecies: (id: string) => void;
  setActiveFeature: (f: FeatureId) => void;

  rename: (name: string) => void;
  loadDocument: (d: Document) => void;
  resetDocument: (withStarter: boolean) => void;
}

let seq = 0;
export const uid = (prefix = 'o') =>
  `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function persist(doc: Document) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...doc, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Quota or private-mode failures are not worth interrupting the user over.
  }
}

function restore(): Document | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Document;
    if (parsed.version !== DOC_VERSION) return null;
    // The survey base is code, not data — always take the current one.
    return { ...parsed, base: BASE_OBJECTS, site: SITE };
  } catch {
    return null;
  }
}

const initialDoc = restore() ?? newDocument(true);

export const useStore = create<Store>((set, get) => ({
  doc: initialDoc,
  selection: [],
  tool: 'select',
  draft: [],
  cursor: null,

  activeSurface: 'bed-mulch',
  activePath: 'walk-flagstone',
  activeSpecies: 'ilex-vomitoria-nana',
  activeFeature: 'boulder',

  view: { scale: 6, tx: 60, ty: 40 },
  snap: true,
  snapSize: 0.5,
  showDimensions: true,
  sun: { enabled: false, showHeatmap: false, month: 5, day: 21, hour: 15, leafOn: true },

  past: [],
  future: [],

  setTool: (tool) => set({ tool, draft: [], selection: tool === 'select' ? get().selection : [] }),
  setDraft: (draft) => set({ draft }),
  pushDraft: (p) => set({ draft: [...get().draft, p] }),
  clearDraft: () => set({ draft: [] }),
  setCursor: (cursor) => set({ cursor }),

  commit: (next) => {
    const { doc, past } = get();
    const doc2 = { ...doc, objects: next, updatedAt: new Date().toISOString() };
    set({ doc: doc2, past: [...past.slice(-49), doc.objects], future: [] });
    persist(doc2);
  },

  addObject: (o) => get().commit([...get().doc.objects, o]),
  addObjects: (o) => get().commit([...get().doc.objects, ...o]),

  updateObject: (id, patch) =>
    get().commit(
      get().doc.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as DesignObj) : o)),
    ),

  liveUpdate: (objs) => {
    const { doc } = get();
    set({ doc: { ...doc, objects: objs } });
  },

  deleteSelected: () => {
    const { doc, selection } = get();
    if (!selection.length) return;
    const keep = doc.objects.filter((o) => !selection.includes(o.id));
    get().commit(keep);
    set({ selection: [] });
  },

  duplicateSelected: () => {
    const { doc, selection } = get();
    const copies: DesignObj[] = [];
    for (const o of doc.objects) {
      if (!selection.includes(o.id)) continue;
      const c = structuredClone(o) as DesignObj;
      c.id = uid('cp');
      const nudge = (p: Pt) => ({ x: p.x + 3, y: p.y - 3 });
      if ('points' in c) c.points = c.points.map(nudge);
      if ('at' in c) c.at = nudge(c.at);
      if (c.kind === 'dimension') {
        c.a = nudge(c.a);
        c.b = nudge(c.b);
      }
      copies.push(c);
    }
    if (!copies.length) return;
    get().commit([...doc.objects, ...copies]);
    set({ selection: copies.map((c) => c.id) });
  },

  setSelection: (selection) => set({ selection }),
  toggleSelection: (id, additive) => {
    const { selection } = get();
    if (!additive) {
      set({ selection: [id] });
      return;
    }
    set({
      selection: selection.includes(id)
        ? selection.filter((s) => s !== id)
        : [...selection, id],
    });
  },

  undo: () => {
    const { past, future, doc } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    const doc2 = { ...doc, objects: prev };
    set({
      doc: doc2,
      past: past.slice(0, -1),
      future: [doc.objects, ...future].slice(0, 50),
      selection: [],
    });
    persist(doc2);
  },

  redo: () => {
    const { past, future, doc } = get();
    if (!future.length) return;
    const next = future[0];
    const doc2 = { ...doc, objects: next };
    set({
      doc: doc2,
      past: [...past, doc.objects],
      future: future.slice(1),
      selection: [],
    });
    persist(doc2);
  },

  setView: (v) => set({ view: { ...get().view, ...v } }),
  setSnap: (snap) => set({ snap }),
  setSnapSize: (snapSize) => set({ snapSize }),
  setShowDimensions: (showDimensions) => set({ showDimensions }),
  setSun: (s) => set({ sun: { ...get().sun, ...s } }),

  setLayer: (id, patch) => {
    const { doc } = get();
    const doc2 = {
      ...doc,
      layers: { ...doc.layers, [id]: { ...doc.layers[id], ...patch } },
    };
    set({ doc: doc2 });
    persist(doc2);
  },

  setActiveSurface: (activeSurface) => set({ activeSurface }),
  setActivePath: (activePath) => set({ activePath }),
  setActiveSpecies: (activeSpecies) => set({ activeSpecies }),
  setActiveFeature: (activeFeature) => set({ activeFeature }),

  rename: (name) => {
    const doc2 = { ...get().doc, name };
    set({ doc: doc2 });
    persist(doc2);
  },

  loadDocument: (d) => {
    const doc2: Document = { ...d, base: BASE_OBJECTS, site: SITE };
    set({ doc: doc2, past: [], future: [], selection: [] });
    persist(doc2);
  },

  resetDocument: (withStarter) => {
    const d = newDocument(withStarter);
    set({ doc: d, past: [], future: [], selection: [], draft: [] });
    persist(d);
  },
}));

/** The whole lot plus a margin, used to frame the initial view. */
export const SITE_BOUNDS = {
  minX: -6,
  minY: -14,
  maxX: LOT_WIDTH + 6,
  maxY: LOT_DEPTH + 6,
};

export const selectAllObjects = (d: Document): DesignObj[] => [...d.base, ...d.objects];
