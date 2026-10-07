import type { Furniture, Level, Project, Room } from './types';
import { uid, v } from './geometry';

const INDEX_KEY = 'rendercrz:index';
const PROJECT_KEY = (id: string) => `rendercrz:project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  levels: number;
  rooms: number;
  furniture: number;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error('No se pudo guardar en localStorage', e);
    return false;
  }
}

export function listProjects(): ProjectMeta[] {
  try {
    const raw = safeGet(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadProject(id: string): Project | null {
  try {
    const raw = safeGet(PROJECT_KEY(id));
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function metaOf(p: Project): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    levels: p.levels.length,
    rooms: p.levels.reduce((n, l) => n + l.rooms.length, 0),
    furniture: p.levels.reduce((n, l) => n + l.furniture.length, 0),
  };
}

export function saveProject(p: Project): boolean {
  if (!safeSet(PROJECT_KEY(p.id), JSON.stringify(p))) return false;
  const list = listProjects().filter((m) => m.id !== p.id);
  list.push(metaOf(p));
  return safeSet(INDEX_KEY, JSON.stringify(list));
}

export function deleteProject(id: string) {
  try {
    localStorage.removeItem(PROJECT_KEY(id));
  } catch {
    /* sin acceso a storage */
  }
  safeSet(INDEX_KEY, JSON.stringify(listProjects().filter((m) => m.id !== id)));
}

export function storageUsageKB() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('rendercrz:')) total += (localStorage.getItem(k)?.length ?? 0) * 2;
    }
  } catch {
    /* sin acceso */
  }
  return Math.round(total / 1024);
}

/** Normaliza proyectos importados o de versiones anteriores. */
export function migrate(raw: unknown): Project {
  const p = raw as Partial<Project>;
  if (!p || !Array.isArray(p.levels)) throw new Error('Archivo de proyecto inválido');
  return {
    id: p.id || uid(),
    name: p.name || 'Proyecto importado',
    createdAt: p.createdAt || Date.now(),
    updatedAt: p.updatedAt || Date.now(),
    wallThickness: p.wallThickness ?? 0.15,
    levels: p.levels.map((l, i) => ({
      id: l.id || uid(),
      name: l.name || `Nivel ${i + 1}`,
      height: l.height ?? 2.6,
      rooms: (l.rooms || []).map((r) => ({ hasWalls: true, wallColor: '#f5f5f4', floor: 'madera', floorColor: '#c49a6c', ...(r as Partial<Room>) }) as Room),
      openings: l.openings || [],
      furniture: (l.furniture || []).map((f) => ({ elevation: 0, rotation: 0, ...(f as Partial<Furniture>) }) as Furniture),
    })),
  };
}

export function newLevel(index: number, height = 2.6): Level {
  return { id: uid(), name: index === 0 ? 'Planta baja' : `Nivel ${index + 1}`, height, rooms: [], openings: [], furniture: [] };
}

export function newProject(name: string, levels: number, height: number): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    wallThickness: 0.15,
    levels: Array.from({ length: Math.max(1, levels) }, (_, i) => newLevel(i, height)),
  };
}

function room(name: string, pts: [number, number][], floor: Room['floor'], floorColor: string, wallColor = '#f5f5f4'): Room {
  return { id: uid(), name, points: pts.map(([x, y]) => v(x, y)), floor, floorColor, wallColor, hasWalls: true };
}

/** Casa de ejemplo con planta irregular y dos niveles. */
export function sampleProject(name: string): Project {
  const p = newProject(name, 2, 2.7);
  const [l0, l1] = p.levels;

  const living = room('Sala - Comedor', [[0, 0], [7, 0], [7, 5], [4.5, 5], [4.5, 6.5], [0, 6.5]], 'madera', '#c49a6c');
  const kitchen = room('Cocina', [[7, 0], [10.5, 0], [10.5, 3.5], [7, 3.5]], 'ceramica', '#e7e2d8', '#fff7ed');
  const bath = room('Baño visitas', [[7, 3.5], [10.5, 3.5], [10.5, 5], [7, 5]], 'ceramica', '#dbeafe', '#e0f2fe');
  const terrace = room('Terraza', [[4.5, 5], [10.5, 5], [9, 8], [4.5, 8], [4.5, 6.5]], 'concreto', '#a8a29e');
  terrace.hasWalls = false;
  l0.rooms = [living, kitchen, bath, terrace];
  l0.openings = [
    { id: uid(), roomId: living.id, edge: 4, t: 0.75, width: 1.0, height: 2.1, sill: 0, kind: 'door' },
    { id: uid(), roomId: living.id, edge: 0, t: 0.3, width: 1.6, height: 1.3, sill: 0.9, kind: 'window' },
    { id: uid(), roomId: living.id, edge: 0, t: 0.75, width: 1.6, height: 1.3, sill: 0.9, kind: 'window' },
    { id: uid(), roomId: living.id, edge: 1, t: 0.4, width: 1.0, height: 2.1, sill: 0, kind: 'door' },
    { id: uid(), roomId: living.id, edge: 2, t: 0.5, width: 1.8, height: 2.2, sill: 0, kind: 'door' },
    { id: uid(), roomId: kitchen.id, edge: 0, t: 0.5, width: 1.2, height: 1.0, sill: 1.1, kind: 'window' },
    { id: uid(), roomId: bath.id, edge: 3, t: 0.4, width: 0.8, height: 2.1, sill: 0, kind: 'door' },
  ];
  const f = (type: Room['floor'] | string, name: string, x: number, y: number, w: number, d: number, h: number, color: string, rotation = 0, elevation = 0) => ({
    id: uid(), type: type as never, name, x, y, w, d, h, color, rotation, elevation,
  });
  l0.furniture = [
    f('sofa', 'Sofá', 2.2, 4.9, 2.2, 0.9, 0.85, '#6b7a8f', 180),
    f('alfombra', 'Alfombra', 2.2, 3.7, 2.4, 1.6, 0.02, '#b45f4d'),
    f('mesa_centro', 'Mesa de centro', 2.2, 3.7, 1.1, 0.6, 0.42, '#8b5e3c'),
    f('mueble_tv', 'Mueble TV', 2.2, 2.3, 1.8, 0.45, 0.5, '#3d3d3d'),
    f('sillon', 'Sillón', 0.8, 3.7, 0.9, 0.85, 0.85, '#a0785a', -90),
    f('mesa', 'Mesa comedor', 5.3, 2.2, 1.8, 0.95, 0.76, '#7a4e2d', 90),
    f('silla', 'Silla', 4.65, 1.7, 0.45, 0.5, 0.9, '#5c3d24', -90),
    f('silla', 'Silla', 4.65, 2.7, 0.45, 0.5, 0.9, '#5c3d24', -90),
    f('silla', 'Silla', 5.95, 1.7, 0.45, 0.5, 0.9, '#5c3d24', 90),
    f('silla', 'Silla', 5.95, 2.7, 0.45, 0.5, 0.9, '#5c3d24', 90),
    f('planta', 'Planta', 0.45, 0.45, 0.5, 0.5, 1.3, '#3f8f4a'),
    f('escalera', 'Escalera', 0.75, 1.8, 1.0, 3.2, 2.85, '#b08968', 180),
    f('encimera', 'Mueble cocina', 8.0, 0.32, 1.8, 0.6, 0.9, '#f1f1f1'),
    f('cocina', 'Cocina', 9.2, 0.32, 0.6, 0.6, 0.9, '#d9d9d9'),
    f('lavaplatos', 'Lavaplatos', 10.15, 1.3, 1.0, 0.6, 0.9, '#f1f1f1', 90),
    f('refrigerador', 'Refrigerador', 10.1, 2.9, 0.75, 0.7, 1.8, '#e5e7eb', 90),
    f('inodoro', 'Inodoro', 10.1, 4.25, 0.4, 0.7, 0.75, '#ffffff', 90),
    f('lavamanos', 'Lavamanos', 9.0, 3.8, 0.6, 0.45, 0.85, '#ffffff'),
    f('mesa_redonda', 'Mesa terraza', 6.8, 6.6, 1.0, 1.0, 0.74, '#e5e5e5'),
    f('planta', 'Planta', 8.3, 7.5, 0.6, 0.6, 1.0, '#2f7a3a'),
  ];

  const hall = room('Hall', [[0, 0], [2.5, 0], [2.5, 6.5], [0, 6.5]], 'madera', '#b88a5a');
  const master = room('Dormitorio principal', [[2.5, 0], [7, 0], [7, 4], [2.5, 4]], 'alfombra', '#8f9bb3', '#eef2ff');
  const bed2 = room('Dormitorio 2', [[2.5, 4], [7, 4], [7, 6.5], [2.5, 6.5]], 'madera', '#c49a6c', '#fef3c7');
  const bath2 = room('Baño', [[7, 0], [10.5, 0], [10.5, 3], [7, 3]], 'marmol', '#f2f0ec', '#f0f9ff');
  l1.rooms = [hall, master, bed2, bath2];
  l1.openings = [
    { id: uid(), roomId: master.id, edge: 3, t: 0.3, width: 0.9, height: 2.1, sill: 0, kind: 'door' },
    { id: uid(), roomId: master.id, edge: 0, t: 0.5, width: 2.0, height: 1.3, sill: 0.9, kind: 'window' },
    { id: uid(), roomId: master.id, edge: 1, t: 0.4, width: 0.8, height: 2.1, sill: 0, kind: 'door' },
    { id: uid(), roomId: bed2.id, edge: 3, t: 0.5, width: 0.9, height: 2.1, sill: 0, kind: 'door' },
    { id: uid(), roomId: bed2.id, edge: 2, t: 0.5, width: 1.6, height: 1.3, sill: 0.9, kind: 'window' },
    { id: uid(), roomId: bath2.id, edge: 0, t: 0.5, width: 0.8, height: 0.6, sill: 1.5, kind: 'window' },
  ];
  l1.furniture = [
    f('cama', 'Cama 2 plazas', 4.75, 1.2, 1.6, 2.0, 0.55, '#e8e1d5'),
    f('mesa_noche', 'Velador', 3.65, 0.35, 0.45, 0.4, 0.55, '#8b5e3c'),
    f('mesa_noche', 'Velador', 5.85, 0.35, 0.45, 0.4, 0.55, '#8b5e3c'),
    f('ropero', 'Ropero', 4.75, 3.6, 1.8, 0.6, 2.1, '#c8a27a', 180),
    f('cama', 'Cama 1 plaza', 5.85, 5.2, 1.0, 1.95, 0.5, '#cfe0f0', 90),
    f('escritorio', 'Escritorio', 3.6, 6.1, 1.4, 0.7, 0.75, '#d6c4a8', 180),
    f('silla_oficina', 'Silla', 3.6, 5.5, 0.6, 0.6, 1.1, '#222222'),
    f('tina', 'Tina', 9.6, 0.45, 1.7, 0.75, 0.55, '#ffffff'),
    f('inodoro', 'Inodoro', 10.1, 2.4, 0.4, 0.7, 0.75, '#ffffff', 90),
    f('lavamanos', 'Lavamanos', 7.5, 2.7, 0.6, 0.45, 0.85, '#ffffff', 180),
    f('lampara', 'Lámpara', 1.2, 5.8, 0.4, 0.4, 1.6, '#f5deb3'),
  ];
  return p;
}
