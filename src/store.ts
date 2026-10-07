import { create } from 'zustand';
import type { Level, Project, Selection, Tool } from './types';
import { saveProject } from './storage';

export type Screen = 'home' | 'editor' | 'viewer';

interface EditorState {
  screen: Screen;
  project: Project | null;
  levelId: string | null;
  selection: Selection;
  tool: Tool;
  gridSize: number;
  snap: boolean;
  showGhost: boolean;
  past: Project[];
  future: Project[];
  dirty: boolean;
  savedAt: number | null;
  autosave: boolean;
  toast: string | null;

  openProject: (p: Project, screen?: Screen) => void;
  closeProject: () => void;
  setScreen: (s: Screen) => void;
  setTool: (t: Tool) => void;
  setLevel: (id: string) => void;
  select: (s: Selection) => void;
  setGrid: (g: number) => void;
  toggleSnap: () => void;
  toggleGhost: () => void;
  setAutosave: (b: boolean) => void;
  /** Guarda el estado actual en el historial (para empezar un arrastre). */
  checkpoint: () => void;
  /** Aplica un cambio sobre una copia del proyecto. */
  mutate: (fn: (p: Project, level: Level) => void, record?: boolean) => void;
  undo: () => void;
  redo: () => void;
  save: () => boolean;
  notify: (msg: string) => void;
}

const HISTORY = 120;

function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`rendercrz:pref:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`rendercrz:pref:${key}`, JSON.stringify(value));
  } catch {
    /* sin acceso */
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<EditorState>((set, get) => ({
  screen: 'home',
  project: null,
  levelId: null,
  selection: null,
  tool: 'select',
  gridSize: readPref('grid', 0.1),
  snap: readPref('snap', true),
  showGhost: readPref('ghost', true),
  past: [],
  future: [],
  dirty: false,
  savedAt: null,
  autosave: readPref('autosave', true),
  toast: null,

  openProject: (p, screen = 'editor') =>
    set({ project: p, levelId: p.levels[0]?.id ?? null, selection: null, tool: 'select', past: [], future: [], dirty: false, savedAt: p.updatedAt, screen }),
  closeProject: () => set({ project: null, levelId: null, selection: null, past: [], future: [], screen: 'home' }),
  setScreen: (screen) => set({ screen }),
  setTool: (tool) => set({ tool }),
  setLevel: (levelId) => set({ levelId, selection: null }),
  select: (selection) => set({ selection }),
  setGrid: (gridSize) => {
    writePref('grid', gridSize);
    set({ gridSize });
  },
  toggleSnap: () => {
    writePref('snap', !get().snap);
    set({ snap: !get().snap });
  },
  toggleGhost: () => {
    writePref('ghost', !get().showGhost);
    set({ showGhost: !get().showGhost });
  },
  setAutosave: (autosave) => {
    writePref('autosave', autosave);
    set({ autosave });
  },

  checkpoint: () => {
    const { project, past } = get();
    if (!project) return;
    set({ past: [...past, project].slice(-HISTORY), future: [] });
  },

  mutate: (fn, record = true) => {
    const { project, past, future, levelId } = get();
    if (!project) return;
    const next = structuredClone(project);
    const level = next.levels.find((l) => l.id === levelId) ?? next.levels[0];
    fn(next, level);
    next.updatedAt = Date.now();
    set({
      project: next,
      past: record ? [...past, project].slice(-HISTORY) : past,
      future: record ? [] : future,
      dirty: true,
    });
  },

  undo: () => {
    const { past, project, future, levelId } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future],
      dirty: true,
      selection: null,
      levelId: prev.levels.some((l) => l.id === levelId) ? levelId : prev.levels[0]?.id,
    });
  },

  redo: () => {
    const { past, project, future, levelId } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({
      project: next,
      past: [...past, project],
      future: future.slice(1),
      dirty: true,
      selection: null,
      levelId: next.levels.some((l) => l.id === levelId) ? levelId : next.levels[0]?.id,
    });
  },

  save: () => {
    const { project } = get();
    if (!project) return false;
    const ok = saveProject(project);
    if (ok) set({ dirty: false, savedAt: Date.now() });
    else get().notify('⚠️ No se pudo guardar: el almacenamiento local está lleno o bloqueado');
    return ok;
  },

  notify: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));

export function useCurrentLevel(): Level | null {
  return useStore((s) => s.project?.levels.find((l) => l.id === s.levelId) ?? s.project?.levels[0] ?? null);
}
