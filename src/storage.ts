import type { Furniture, Level, Opening, Project, Room } from './types';
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

export function metaOf(p: Project): ProjectMeta {
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

/**
 * Centro de distribución de ejemplo: cuatro secciones con distinto tipo de pared
 * (almacenaje, picking y empaque, recepción y despacho, oficinas y servicios),
 * patio con jaula de malla y mezzanine. Usa todos los tipos de objeto del catálogo.
 */
export function sampleWarehouse(name: string): Project {
  const p = newProject(name, 2, 7.5);
  p.wallThickness = 0.2;
  const [l0, l1] = p.levels;
  l0.name = 'Nave de almacén';
  l1.name = 'Mezzanine oficinas';
  l1.height = 3;

  const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const walled = (r: Room, wallMaterial: Room['wallMaterial'], wallColor: string, extra: Partial<Room> = {}) => Object.assign(r, { wallMaterial, wallColor }, extra);

  const storage = walled(room('1 · Almacenaje', rect(0, 0, 30, 20), 'epoxi', '#9aa5b1'), 'lamina', '#94a3b8');
  const picking = walled(room('2 · Picking y empaque', rect(30, 0, 50, 20), 'epoxi', '#a8b3bd'), 'block', '#b8b8b4');
  const docks = walled(room('3 · Recepción y despacho', rect(0, 20, 30, 32), 'concreto', '#a8a29e'), 'concreto', '#a8a29e');
  const offices = walled(room('4 · Oficinas y servicios', rect(30, 20, 50, 32), 'ceramica', '#e7e2d8'), 'ladrillo', '#b4533a');
  const yard = room('Patio de maniobras', rect(-2, 32, 52, 47), 'concreto', '#a8a29e');
  yard.hasWalls = false;
  const cage = walled(room('Jaula de tarimas', rect(1, 37, 13, 45), 'concreto', '#9ca3af'), 'malla', '#cbd5e1', { wallHeight: 2.4 });
  l0.rooms = [storage, picking, docks, offices, yard, cage];

  // arista 0 = lado norte, 1 = este, 2 = sur (de este a oeste), 3 = oeste (de sur a norte)
  const op = (roomId: string, edge: number, t: number, width: number, height: number, door?: Opening['door'], sill = 0): Opening => ({
    id: uid(), roomId, edge, t, width, height, sill, kind: door || sill === 0 ? 'door' : 'window', ...(door ? { door } : {}),
  });
  const win = (roomId: string, edge: number, t: number, width: number, height: number, sill: number): Opening => ({ id: uid(), roomId, edge, t, width, height, sill, kind: 'window' });
  l0.openings = [
    ...[0.15, 0.38, 0.62, 0.85].map((t) => op(docks.id, 2, t, 3, 3.6, 'metal')), // andenes
    op(docks.id, 0, 0.5, 4, 4.5, 'metal'), // almacenaje ↔ recepción
    op(picking.id, 3, 0.5, 4, 4.5, 'metal'), // almacenaje ↔ picking
    op(storage.id, 3, 0.5, 1, 2.2, 'metal'), // salida de emergencia
    op(offices.id, 0, 0.42, 1, 2.1, 'madera'), // picking ↔ oficinas
    op(offices.id, 3, 0.08, 1, 2.1, 'vidrio'), // recepción ↔ oficinas
    op(offices.id, 1, 0.5, 1.8, 2.2, 'vidrio'), // acceso principal
    op(cage.id, 0, 0.5, 3, 2.4, 'malla'), // portón de la jaula
    ...[0.2, 0.5, 0.8].map((t) => win(storage.id, 0, t, 4, 1.2, 5.5)),
    ...[0.25, 0.75].map((t) => win(picking.id, 0, t, 4, 1.2, 5.5)),
    win(offices.id, 1, 0.15, 1.6, 1.3, 1),
    win(offices.id, 1, 0.85, 1.6, 1.3, 1),
    win(offices.id, 2, 0.3, 2, 1.3, 1),
  ];

  const f = (type: Furniture['type'], name: string, x: number, y: number, w: number, d: number, h: number, color: string, rotation = 0, extra: Partial<Furniture> = {}): Furniture => ({
    id: uid(), type, name, x, y, w, d, h, color, rotation, elevation: 0, ...extra,
  });
  const cells = (pattern: string, colors: Record<string, string>) => [...pattern].map((c) => colors[c] ?? '');
  const BOX = { r: '#ef4444', a: '#3b82f6', v: '#22c55e', y: '#facc15', c: '#c69c6d' };

  // --- 1 · Almacenaje: racks, cantilever y rack a medida
  const racks: Furniture[] = [];
  const rows: [number, number, string, boolean][] = [
    [1.5, 1.1, 'A', true],
    [6.5, 2.3, 'B', false],
    [12, 2.3, 'C', false],
  ];
  for (const [y, d, id, empty] of rows) {
    [7, 15.2, 23.4].forEach((x, i) => racks.push(f('rack', `Rack ${id}${i + 1}`, x, y, 8.1, d, 6.5, '#f97316', 0, { shelves: 4, ...(empty && i === 2 ? { empty: true } : {}) })));
  }
  const storageItems = [
    f('zona', 'Pasillo peatonal', 1.4, 10, 1.2, 18, 0.01, '#f97316', 0, { label: 'PEATONAL' }),
    ...racks,
    f('rack_custom', 'Rack a medida', 8, 17.6, 8.1, 1.1, 4.5, '#2563eb', 0, { shelves: 3, cols: 6, cells: cells('r.a.v.yy..cc.rr.aa.c.c.c.', BOX) }),
    f('cantilever', 'Cantilever perfiles', 17.5, 17.6, 5, 1.2, 3.5, '#16a34a', 0, { shelves: 3 }),
    f('contenedor', 'Contenedor plástico', 22.5, 17.4, 0.6, 0.4, 0.32, '#2563eb'),
    f('contenedor', 'Contenedor plástico', 23.3, 17.4, 0.6, 0.4, 0.32, '#dc2626'),
    f('contenedor', 'Contenedor plástico', 22.9, 17.4, 0.6, 0.4, 0.32, '#16a34a', 0, { elevation: 0.32 }),
    f('caja', 'Bulto genérico', 25.5, 17.6, 1, 1, 1, '#94a3b8'),
    f('columna', 'Columna', 29.4, 17, 0.4, 0.4, 7.5, '#9ca3af'),
    f('columna', 'Columna', 29.4, 3, 0.4, 0.4, 7.5, '#9ca3af'),
    f('montacargas', 'Montacargas 1', 14, 9.3, 1.2, 3.2, 2.2, '#facc15', 90),
    ...([['PASILLO 1', 4], ['PASILLO 2', 9.3], ['PASILLO 3', 15]] as const).map(([t, y]) => f('letrero', `Letrero ${t}`, 2.8, y, 1.8, 0.05, 0.6, '#1d4ed8', 90, { label: t, elevation: 4.5 })),
    f('extintor', 'Extintor', 0.45, 18.5, 0.25, 0.25, 0.75, '#dc2626'),
    f('barrera', 'Barrera de protección', 2.3, 14.5, 4, 0.2, 0.5, '#facc15', 90),
  ];

  // --- 2 · Picking y empaque
  const pickingItems = [
    f('zona', 'Zona picking', 40, 4, 17, 6, 0.01, '#eab308', 0, { label: 'PICKING' }),
    ...[33, 36.5, 40, 43.5, 47].flatMap((x) => [
      f('estanteria_metal', 'Anaquel picking', x, 2.6, 2, 0.6, 2.4, '#64748b', 0, { shelves: 6 }),
      f('estanteria_metal', 'Anaquel picking', x, 5.4, 2, 0.6, 2.4, '#64748b', 0, { shelves: 6, ...(x === 47 ? { empty: true } : {}) }),
    ]),
    f('banda', 'Banda transportadora', 40, 9.5, 14, 0.8, 0.85, '#334155'),
    f('mesa_embalaje', 'Mesa de embalaje', 35, 12.5, 1.8, 0.9, 0.9, '#a3a3a3'),
    f('mesa_embalaje', 'Mesa de embalaje', 38.5, 12.5, 1.8, 0.9, 0.9, '#a3a3a3'),
    f('caja_carton', 'Caja de cartón', 34.6, 12.5, 0.6, 0.4, 0.4, '#c69c6d', 0, { elevation: 0.9 }),
    f('caja_carton', 'Caja de cartón', 38.9, 12.5, 0.6, 0.4, 0.4, '#b88a58', 20, { elevation: 0.9 }),
    f('caja_carton', 'Caja de cartón', 36.8, 13.6, 0.6, 0.4, 0.4, '#c69c6d'),
    f('caja_carton', 'Caja de cartón', 36.8, 13.6, 0.6, 0.4, 0.4, '#d2a979', 15, { elevation: 0.4 }),
    f('bascula', 'Báscula de piso', 33, 16.5, 1.5, 1.5, 0.1, '#475569'),
    f('transpaleta', 'Transpaleta', 37, 17, 0.55, 1.6, 1.2, '#dc2626', 90),
    f('zona', 'Zona cuarentena', 46, 16.5, 6.5, 5, 0.01, '#ef4444', 0, { label: 'CUARENTENA' }),
    f('malla', 'Malla cuarentena', 46, 13.9, 6.5, 0.06, 2.4, '#facc15'),
    f('cerco', 'Cerco blanco', 42.7, 16.5, 5, 0.06, 1.8, '#f8fafc', 90),
    f('pallet_carga', 'Pallet en cuarentena', 46, 17, 1.2, 1, 1.3, '#b88a58'),
    f('barandal', 'Barandal amarillo', 40, 8.3, 12, 0.08, 1.1, '#facc15', 0, { shelves: 2 }),
    f('mueble_tapa', 'Mueble con tapa', 41.6, 12.5, 1.2, 0.6, 0.9, '#8b5e3c', 0, { empty: true }),
    f('rack_tubos', 'Rack para tuberías', 40, 18.6, 5, 1, 2.4, '#1e3a8a', 0, { shelves: 4, cells: ['metal:0.1', 'cobre:0.05', 'pvc:0.1', 'abs:0.075'] }),
    f('rack_tubos_v', 'Rack vertical para tuberías', 34.4, 19.3, 3, 0.8, 3.2, '#1e3a8a', 180, { shelves: 4, cells: ['pvc:0.1', 'abs:0.075', 'cobre:0.05', 'metal:0.1'] }),
    f('letrero', 'Letrero picking', 40, 7.6, 3, 0.05, 0.8, '#ca8a04', 0, { label: 'PICKING', elevation: 4.5 }),
    f('extintor', 'Extintor', 49.55, 10, 0.25, 0.25, 0.75, '#dc2626'),
  ];

  // --- 3 · Recepción y despacho
  const dockItems = [
    f('zona', 'Zona recepción', 7.5, 26.5, 11, 6, 0.01, '#3b82f6', 0, { label: 'RECEPCIÓN' }),
    f('zona', 'Zona despacho', 22, 26.5, 11, 6, 0.01, '#22c55e', 0, { label: 'DESPACHO' }),
    ...[[4, 25], [5.6, 25], [7.2, 25], [4, 26.6], [5.6, 26.6]].map(([x, y]) => f('pallet_carga', 'Pallet con carga', x, y, 1.2, 1, 1.4, '#c69c6d')),
    f('pallet', 'Pallets vacíos', 10.5, 25, 1.2, 1, 0.15, '#c8a26b'),
    f('pallet', 'Pallets vacíos', 10.5, 25, 1.2, 1, 0.15, '#c8a26b', 0, { elevation: 0.15 }),
    f('tarima_custom', 'Tarima a medida', 19, 25, 1.2, 1, 1.2, '#c8a26b', 0, { shelves: 3, cols: 2, rows: 2, cells: cells('rayvra.y...v', BOX) }),
    f('tarima_custom', 'Tarima a medida', 21, 25, 1.2, 1, 1.2, '#c8a26b', 0, { shelves: 3, cols: 3, rows: 2, cells: cells('cccccccc.c.c', BOX) }),
    f('pallet_carga', 'Pallet con carga', 23.5, 25, 1.2, 1, 1.2, '#b88a58'),
    f('montacargas', 'Montacargas 2', 14.5, 27, 1.2, 3.2, 2.2, '#facc15', 180),
    f('bascula', 'Báscula de piso', 14.5, 22.5, 1.5, 1.5, 0.1, '#475569'),
    ...[0.15, 0.38, 0.62, 0.85].map((t, i) => f('letrero_pie', `Andén ${4 - i}`, 30 - 30 * t + 2.2, 31, 0.8, 0.08, 1.8, '#f59e0b', 0, { label: `ANDÉN ${4 - i}` })),
    f('anuncio_cuadro', 'Cuadro LED', 7.5, 20.35, 4, 0.12, 1.4, '#111827', 0, { label: 'RECEPCIÓN', elevation: 4.6 }),
    f('letrero', 'Letrero despacho', 22, 22.6, 3, 0.05, 0.8, '#16a34a', 0, { label: 'DESPACHO', elevation: 5 }),
    f('escalera_metal', 'Escalera al mezzanine', 28.9, 25.5, 1.1, 9, 7.65, '#facc15'),
    f('extintor', 'Extintor', 0.45, 30, 0.25, 0.25, 0.75, '#dc2626'),
  ];

  // --- 4 · Oficinas y servicios: oficina, sala de espera, comedor, descanso y baños
  const officeItems = [
    f('escritorio', 'Escritorio', 33, 21.2, 1.4, 0.7, 0.75, '#d6c4a8'),
    f('escritorio', 'Escritorio', 35.5, 21.2, 1.4, 0.7, 0.75, '#d6c4a8'),
    f('silla_oficina', 'Silla', 33, 22, 0.6, 0.6, 1.1, '#222222', 180),
    f('silla_oficina', 'Silla', 35.5, 22, 0.6, 0.6, 1.1, '#222222', 180),
    f('estante', 'Librero', 30.6, 22.6, 1, 0.35, 1.9, '#a67c52', 90),
    f('planta', 'Planta', 39.6, 20.8, 0.5, 0.5, 1.2, '#3f8f4a'),
    f('lampara', 'Lámpara de pie', 31, 20.8, 0.4, 0.4, 1.6, '#f5deb3'),
    f('alfombra', 'Alfombra', 34, 28.6, 2.6, 1.8, 0.02, '#b45f4d'),
    f('sofa', 'Sofá', 34, 30.3, 2.2, 0.9, 0.85, '#6b7a8f', 180),
    f('sillon', 'Sillón', 31.6, 28.6, 0.9, 0.85, 0.85, '#a0785a', -90),
    f('mesa_centro', 'Mesa de centro', 34, 28.6, 1.1, 0.6, 0.42, '#8b5e3c'),
    f('mueble_tv', 'Mueble TV', 34, 26.6, 1.8, 0.45, 0.5, '#3d3d3d'),
    f('mesa', 'Mesa de reuniones', 41, 22.6, 2.2, 1, 0.76, '#7a4e2d'),
    ...[[40.4, 21.8, 0], [41.6, 21.8, 0], [40.4, 23.4, 180], [41.6, 23.4, 180]].map(([x, y, r]) => f('silla', 'Silla', x, y, 0.45, 0.5, 0.9, '#5c3d24', r)),
    f('mesa_redonda', 'Mesa comedor', 44.6, 24.4, 1.1, 1.1, 0.76, '#e5e5e5'),
    f('encimera', 'Mueble cocina', 45, 20.6, 1.2, 0.6, 0.9, '#f1f1f1'),
    f('cocina', 'Cocina', 46.2, 20.6, 0.6, 0.6, 0.9, '#d9d9d9'),
    f('lavaplatos', 'Lavaplatos', 47.3, 20.6, 1, 0.6, 0.9, '#f1f1f1'),
    f('refrigerador', 'Refrigerador', 49.2, 20.7, 0.75, 0.7, 1.8, '#e5e7eb'),
    f('cama', 'Cama de guardia', 44.6, 28, 1, 1.95, 0.5, '#cfe0f0'),
    f('mesa_noche', 'Velador', 43.7, 27.3, 0.45, 0.4, 0.55, '#8b5e3c'),
    f('ropero', 'Casilleros', 41.5, 31.4, 1.6, 0.6, 2.1, '#c8a27a', 180),
    f('comoda', 'Cómoda', 42.6, 28, 1.2, 0.5, 0.85, '#9c6b43', 90),
    f('inodoro', 'Inodoro', 49.4, 30.2, 0.4, 0.7, 0.75, '#ffffff', 90),
    f('lavamanos', 'Lavamanos', 47.8, 31.4, 0.6, 0.45, 0.85, '#ffffff', 180),
    f('ducha', 'Ducha', 45.8, 31.1, 0.9, 0.9, 2, '#dbeafe'),
    f('tina', 'Tina', 43.5, 31.2, 1.7, 0.75, 0.55, '#ffffff'),
    f('letrero', 'Letrero salida', 49.7, 24.5, 1, 0.05, 0.35, '#16a34a', 90, { label: 'SALIDA', elevation: 2.4 }),
  ];

  // --- Patio: rampa, anuncios, cercos, jaula de tarimas
  const yardItems = [
    f('rampa_curva', 'Rampa de descarga curva', 46, 41, 6, 6, 1.2, '#9ca3af'),
    f('escalera', 'Escalera de andén', 31.5, 33.2, 1.2, 2, 1.1, '#9ca3af', 180),
    f('anuncio_poste', 'Rótulo en poste', 40, 44.5, 5, 0.4, 13, '#111827', 0, { label: 'CENTRO DE DISTRIBUCIÓN' }),
    f('anuncio_torre', 'Torre de anuncio', 34, 45.5, 1.6, 0.4, 5, '#111827', 0, { label: 'ACCESO' }),
    f('cerco_malla', 'Cerco de malla', 22, 46.8, 19.2, 0.06, 2, '#cbd5e1'),
    f('cerco', 'Cerco blanco', 45, 46.8, 9.6, 0.06, 1.8, '#f8fafc'),
    ...[2.7, 9.6, 16.8, 23.7].flatMap((x) => [f('bolardo', 'Bolardo', x, 32.8, 0.2, 0.2, 1, '#facc15'), f('bolardo', 'Bolardo', x + 3.6, 32.8, 0.2, 0.2, 1, '#facc15')]),
    ...[[38, 38], [40, 38.6], [42, 39.6]].map(([x, y]) => f('cono', 'Cono', x, y, 0.35, 0.35, 0.7, '#f97316')),
    ...[[3, 39], [4.6, 39], [6.2, 39], [3, 43], [4.6, 43]].map(([x, y]) => f('pallet', 'Pallets vacíos', x, y, 1.2, 1, 0.15, '#c8a26b')),
    f('contenedor', 'Contenedor plástico', 10, 43, 0.6, 0.4, 0.32, '#2563eb'),
    f('caja', 'Bulto genérico', 10.5, 39.5, 1, 1, 1, '#94a3b8'),
  ];

  l0.furniture = [...storageItems, ...pickingItems, ...dockItems, ...officeItems, ...yardItems];

  const adm = walled(room('Administración', rect(30, 20, 50, 32), 'madera', '#c49a6c'), 'vidrio', '#cfeaff');
  l1.rooms = [adm];
  l1.openings = [op(adm.id, 3, 0.87, 1, 2.1, 'vidrio')];
  l1.furniture = [
    f('escritorio', 'Gerencia', 44, 23, 1.6, 0.8, 0.75, '#d6c4a8'),
    f('silla_oficina', 'Silla', 44, 22.2, 0.6, 0.6, 1.1, '#222222'),
    f('mesa', 'Sala de control', 38, 27, 2.4, 1.1, 0.76, '#7a4e2d'),
    f('estanteria_metal', 'Archivo', 49.4, 29, 1.2, 0.5, 2.1, '#94a3b8', 90, { shelves: 5 }),
    f('planta', 'Planta', 31, 31, 0.5, 0.5, 1.2, '#3f8f4a'),
  ];
  return p;
}
