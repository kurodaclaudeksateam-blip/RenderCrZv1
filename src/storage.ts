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

/** Centro de distribución de ejemplo: nave irregular, racks, zonas, andenes y mezzanine. */
export function sampleWarehouse(name: string): Project {
  const p = newProject(name, 2, 7.5);
  p.wallThickness = 0.2;
  const [l0, l1] = p.levels;
  l0.name = 'Nave de almacén';
  l1.name = 'Mezzanine oficinas';
  l1.height = 3;

  const nave = room('Nave de almacenaje', [[0, 0], [36, 0], [36, 22], [28, 28], [0, 28]], 'epoxi', '#9aa5b1', '#e5e7eb');
  const office = room('Oficinas', [[-8, 0], [0, 0], [0, 10], [-8, 10]], 'ceramica', '#e7e2d8', '#f8fafc');
  const wc = room('Servicios higiénicos', [[-8, 10], [0, 10], [0, 15], [-8, 15]], 'ceramica', '#dbeafe', '#e0f2fe');
  const yard = room('Patio de maniobras', [[0, 28], [28, 28], [36, 22], [42, 22], [42, 40], [0, 40]], 'concreto', '#a8a29e');
  yard.hasWalls = false;
  l0.rooms = [nave, office, wc, yard];

  const op = (roomId: string, edge: number, t: number, width: number, height: number, kind: 'door' | 'window', sill = 0) => ({ id: uid(), roomId, edge, t, width, height, sill, kind });
  l0.openings = [
    // andenes de carga (borde inferior de la nave)
    ...[0.15, 0.35, 0.55, 0.75].map((t) => op(nave.id, 3, t, 3, 3.6, 'door')),
    op(nave.id, 2, 0.5, 3.5, 4.2, 'door'), // acceso vehicular en el chaflán
    op(nave.id, 1, 0.75, 1.0, 2.2, 'door'), // puerta de emergencia
    ...[0.15, 0.35, 0.55, 0.75].map((t) => op(nave.id, 0, t, 3, 1.2, 'window', 5.5)),
    op(office.id, 1, 0.5, 1.0, 2.2, 'door'),
    op(office.id, 3, 0.5, 1.0, 2.2, 'door'),
    op(office.id, 0, 0.5, 4, 1.4, 'window', 1),
    op(wc.id, 1, 0.5, 0.9, 2.1, 'door'),
  ];

  const f = (type: string, name: string, x: number, y: number, w: number, d: number, h: number, color: string, rotation = 0, extra: Partial<Furniture> = {}): Furniture => ({
    id: uid(), type: type as Furniture['type'], name, x, y, w, d, h, color, rotation, elevation: 0, ...extra,
  });

  const racks: Furniture[] = [];
  const rows: [number, number, string][] = [
    [0.85, 1.1, 'A'],
    [5.75, 2.3, 'B'],
    [11.25, 2.3, 'C'],
    [16.75, 2.3, 'D'],
  ];
  for (const [y, d, id] of rows) {
    [7.05, 15.15, 23.25].forEach((x, i) => racks.push(f('rack', `Rack ${id}${i + 1}`, x, y, 8.1, d, 6.5, '#f97316', 0, { shelves: 4 })));
  }

  l0.furniture = [
    // zonas de piso
    f('zona', 'Zona recepción', 7, 23.2, 10, 6.5, 0.01, '#3b82f6', 0, { label: 'RECEPCIÓN' }),
    f('zona', 'Zona despacho', 20.5, 23.2, 10, 6.5, 0.01, '#22c55e', 0, { label: 'DESPACHO' }),
    f('zona', 'Zona picking', 32, 5, 6.5, 8.5, 0.01, '#eab308', 0, { label: 'PICKING' }),
    f('zona', 'Zona cuarentena', 32, 13, 6.5, 4, 0.01, '#ef4444', 0, { label: 'CUARENTENA' }),
    f('zona', 'Pasillo peatonal', 1.4, 14.3, 1.2, 26, 0.01, '#f97316', 0, { label: 'PEATONAL' }),
    // estructuras de almacenaje
    ...racks,
    ...[2.3, 4.8, 7.3].flatMap((y) => [
      f('estanteria_metal', 'Anaquel picking', 30.2, y, 2.0, 0.6, 2.4, '#64748b', 90, { shelves: 6 }),
      f('estanteria_metal', 'Anaquel picking', 33.8, y, 2.0, 0.6, 2.4, '#64748b', 90, { shelves: 6 }),
    ]),
    f('cantilever', 'Cantilever perfiles', 32, 18.6, 5, 1.2, 3.5, '#16a34a', 0, { shelves: 3 }),
    // carga y equipos
    ...[[4, 21.2], [5.6, 21.2], [7.2, 21.2], [4, 22.8], [5.6, 22.8]].map(([x, y]) => f('pallet_carga', 'Pallet con carga', x, y, 1.2, 1.0, 1.4, '#c69c6d')),
    ...[[17.5, 21.2], [19.1, 21.2], [17.5, 22.8]].map(([x, y]) => f('pallet_carga', 'Pallet con carga', x, y, 1.2, 1.0, 1.2, '#b88a58')),
    f('pallet', 'Pallets vacíos', 10.5, 21.2, 1.2, 1.0, 0.15, '#c8a26b'),
    f('montacargas', 'Montacargas 1', 14, 8.5, 1.2, 3.2, 2.2, '#facc15', 90),
    f('montacargas', 'Montacargas 2', 13.5, 24, 1.2, 3.2, 2.2, '#facc15', 180),
    f('transpaleta', 'Transpaleta', 9.5, 25, 0.55, 1.6, 1.2, '#dc2626', 180),
    f('banda', 'Banda transportadora', 28.4, 13, 6, 0.8, 0.85, '#334155', 90),
    f('mesa_embalaje', 'Mesa de embalaje', 24.5, 20.3, 1.8, 0.9, 0.9, '#a3a3a3'),
    f('mesa_embalaje', 'Mesa de embalaje', 27.2, 20.3, 1.8, 0.9, 0.9, '#a3a3a3'),
    f('bascula', 'Báscula de piso', 24.3, 24.5, 1.5, 1.5, 0.1, '#475569'),
    f('malla', 'Malla cuarentena', 32, 15.1, 6.5, 0.06, 2.4, '#facc15'),
    // señalización
    ...([['PASILLO 1', 3.2], ['PASILLO 2', 8.5], ['PASILLO 3', 14]] as const).map(([t, y]) =>
      f('letrero', `Letrero ${t}`, 2.6, y, 1.8, 0.05, 0.6, '#1d4ed8', 90, { label: t, elevation: 4.5 }),
    ),
    f('letrero', 'Letrero recepción', 7, 19.9, 3, 0.05, 0.8, '#2563eb', 0, { label: 'RECEPCIÓN', elevation: 5 }),
    f('letrero', 'Letrero despacho', 20.5, 19.9, 3, 0.05, 0.8, '#16a34a', 0, { label: 'DESPACHO', elevation: 5 }),
    f('letrero', 'Letrero salida', 35.7, 16.5, 1.0, 0.05, 0.35, '#16a34a', 90, { label: 'SALIDA', elevation: 2.4 }),
    ...[0.15, 0.35, 0.55, 0.75].map((t, i) => f('letrero_pie', `Andén ${4 - i}`, 28 - 28 * t + 2.1, 27.3, 0.8, 0.08, 1.8, '#f59e0b', 0, { label: `ANDÉN ${4 - i}` })),
    // seguridad
    f('extintor', 'Extintor', 0.4, 19, 0.25, 0.25, 0.75, '#dc2626'),
    f('extintor', 'Extintor', 35.6, 10, 0.25, 0.25, 0.75, '#dc2626'),
    f('extintor', 'Extintor', 12, 27.6, 0.25, 0.25, 0.75, '#dc2626'),
    ...[3.4, 9, 14.6, 20.2].flatMap((x) => [f('bolardo', 'Bolardo', x, 28.6, 0.2, 0.2, 1, '#facc15'), f('bolardo', 'Bolardo', x + 3.4, 28.6, 0.2, 0.2, 1, '#facc15')]),
    ...[[30, 32], [32, 32], [34, 32]].map(([x, y]) => f('cono', 'Cono', x, y, 0.35, 0.35, 0.7, '#f97316')),
    // oficinas y servicios
    f('escritorio', 'Escritorio', -6, 2.5, 1.4, 0.7, 0.75, '#d6c4a8'),
    f('escritorio', 'Escritorio', -2.5, 2.5, 1.4, 0.7, 0.75, '#d6c4a8'),
    f('silla_oficina', 'Silla', -6, 3.3, 0.6, 0.6, 1.1, '#222222', 180),
    f('silla_oficina', 'Silla', -2.5, 3.3, 0.6, 0.6, 1.1, '#222222', 180),
    f('mesa', 'Mesa de reuniones', -4, 7, 2.2, 1.0, 0.76, '#7a4e2d'),
    f('estanteria_metal', 'Archivo', -7.5, 7, 1.2, 0.5, 2.1, '#94a3b8', 90, { shelves: 5 }),
    f('inodoro', 'Inodoro', -7.4, 11, 0.4, 0.7, 0.75, '#ffffff', -90),
    f('inodoro', 'Inodoro', -7.4, 12.5, 0.4, 0.7, 0.75, '#ffffff', -90),
    f('lavamanos', 'Lavamanos', -3, 14.6, 0.6, 0.45, 0.85, '#ffffff', 180),
    f('lavamanos', 'Lavamanos', -4.5, 14.6, 0.6, 0.45, 0.85, '#ffffff', 180),
  ];

  const adm = room('Administración', [[-8, 0], [0, 0], [0, 15], [-8, 15]], 'madera', '#c49a6c', '#f1f5f9');
  l1.rooms = [adm];
  l1.openings = [op(adm.id, 0, 0.5, 4, 1.4, 'window', 1), op(adm.id, 1, 0.5, 5, 1.6, 'window', 1)];
  l1.furniture = [
    f('escritorio', 'Gerencia', -4, 3, 1.6, 0.8, 0.75, '#d6c4a8'),
    f('silla_oficina', 'Silla', -4, 2.2, 0.6, 0.6, 1.1, '#222222'),
    f('mesa', 'Sala de control', -4, 9, 2.4, 1.1, 0.76, '#7a4e2d'),
    f('estanteria_metal', 'Archivo', -7.5, 12, 1.2, 0.5, 2.1, '#94a3b8', 90, { shelves: 5 }),
  ];
  return p;
}
