import { CATALOG, ROOM_COLORS, type CatalogItem, doorForWall, OPENING_PRESETS, WALL_MATERIALS, type OpeningPreset } from './catalog';
import { DOOR_DEFAULT, WINDOW_DEFAULT, dist, uid, nearestEdge, wallSide, collides } from './geometry';
import { newLevel } from './storage';
import { useStore } from './store';
import type { Furniture, Level, OpeningKind, Room, Vec2, WallMaterial, WallSide } from './types';

/** Centro visible del editor 2D (lo actualiza el editor). */
export const editorView = { center: { x: 0, y: 0 } as Vec2 };

const st = () => useStore.getState();

export function addFurniture(item: CatalogItem, pos: Vec2 = editorView.center) {
  const id = uid();
  st().mutate((_, level) => {
    level.furniture.push({
      id,
      type: item.type,
      name: item.label,
      x: pos.x,
      y: pos.y,
      rotation: 0,
      w: item.w,
      d: item.d,
      h: item.h,
      elevation: item.elevation ?? 0,
      color: item.color,
      ...(item.text ? { label: item.text } : {}),
      ...(item.shelves ? { shelves: item.shelves } : {}),
      ...(item.cells ? { cells: [...item.cells] } : {}),
      ...(item.cols ? { cols: item.cols } : {}),
      ...(item.rows ? { rows: item.rows } : {}),
    });
  });
  st().select({ kind: 'furniture', id });
  st().setTool('select');
}

export function catalogItem(key: string) {
  return CATALOG[Number(key)] ?? null;
}

export function addRoom(points: Vec2[]) {
  if (points.length < 3) return;
  const id = uid();
  const wall = WALL_MATERIALS.find((m) => m.id === st().wallMaterial) ?? WALL_MATERIALS[0];
  st().mutate((_, level) => {
    const n = level.rooms.length;
    level.rooms.push({
      id,
      name: `Ambiente ${n + 1}`,
      points,
      floor: 'epoxi',
      floorColor: '#9aa5b1',
      wallColor: wall.id === 'liso' ? '#e7e5e4' : wall.color,
      hasWalls: true,
      ...(wall.id === 'liso' ? {} : { wallMaterial: wall.id }),
    });
  });
  st().select({ kind: 'room', id });
}

export function roomTint(index: number) {
  return ROOM_COLORS[index % ROOM_COLORS.length];
}

/** Portón de andén / acceso vehicular. */
export const DOCK_DEFAULT = { width: 3.0, height: 3.6, sill: 0 };

/** Medidas y tipo de lo que se va a colocar: el elegido en «Puertas y marcos» o el genérico de la herramienta. */
function openingSpec(kind: OpeningKind, dock: boolean) {
  const preset = OPENING_PRESETS.find((p) => p.id === st().openingPreset);
  if (preset) return preset;
  const def = dock ? DOCK_DEFAULT : kind === 'door' ? DOOR_DEFAULT : WINDOW_DEFAULT;
  return { ...def, kind, dock, door: kind === 'door' ? ('auto' as const) : undefined };
}

type OpeningSpec = Pick<OpeningPreset, 'kind' | 'door' | 'dock' | 'width' | 'height' | 'sill'>;

/** Inserta una puerta o ventana en el muro indicado de un nivel y devuelve su id. */
function insertOpening(levelId: string | null, roomId: string, edge: number, t: number, edgeLen: number, spec: OpeningSpec) {
  const width = Math.min(spec.width, Math.max(0.3, edgeLen - 0.1));
  const half = width / 2 / edgeLen;
  const id = uid();
  st().mutate((p, current) => {
    const level = p.levels.find((l) => l.id === levelId) ?? current;
    // la puerta se adapta al muro o cerco: su tipo sale del material y no rebasa la altura de un cerco
    const room = level.rooms.find((r) => r.id === roomId);
    const side = room && wallSide(room, edge, level.height, p.wallThickness);
    const height = spec.kind === 'door' && side ? Math.min(spec.height, side.height) : spec.height;
    const door = spec.door === 'auto' ? doorForWall(side?.material, !!spec.dock) : spec.door;
    level.openings.push({ id, roomId, edge, t: Math.min(1 - half, Math.max(half, t)), width, height, sill: spec.sill, kind: spec.kind, ...(spec.kind === 'door' && door ? { door } : {}) });
  });
  return id;
}

export function addOpening(kind: OpeningKind, roomId: string, edge: number, t: number, edgeLen: number, dock = false) {
  const id = insertOpening(st().levelId, roomId, edge, t, edgeLen, openingSpec(kind, dock));
  st().select({ kind: 'opening', id });
}

/** Punto del contorno de un ambiente más cercano a `near`: arista, posición 0..1 y largo de la arista. */
function wallSpot(room: Room, near: Vec2) {
  const hit = nearestEdge([room], near, Infinity);
  return hit && { edge: hit.edge, t: hit.t, len: dist(hit.a, hit.b) };
}

/** Desde la vista 3D: agrega la puerta o marco elegido en el punto que se tocó de una pared o cerco. */
export function addOpeningAt(roomId: string, near: Vec2, presetId: string): string | null {
  const preset = OPENING_PRESETS.find((p) => p.id === presetId);
  const level = st().project?.levels.find((l) => l.rooms.some((r) => r.id === roomId));
  const room = level?.rooms.find((r) => r.id === roomId);
  const spot = room && wallSpot(room, near);
  if (!preset || !level || !spot) return null;
  return insertOpening(level.id, roomId, spot.edge, spot.t, spot.len, preset);
}

/**
 * Mueve una puerta al punto tocado de una pared o cerco del mismo nivel. Los muros se
 * recalculan solos: el hueco anterior se rellena y se abre el nuevo.
 */
export function moveOpeningTo(openingId: string, roomId: string, near: Vec2): boolean {
  const level = st().project?.levels.find((l) => l.openings.some((o) => o.id === openingId));
  const room = level?.rooms.find((r) => r.id === roomId);
  const spot = room && wallSpot(room, near);
  if (!level || !spot) return false;
  st().mutate((p) => {
    const o = p.levels.find((l) => l.id === level.id)?.openings.find((x) => x.id === openingId);
    if (!o) return;
    const half = Math.min(o.width, spot.len - 0.1) / 2 / spot.len;
    Object.assign(o, { roomId, edge: spot.edge, t: Math.min(1 - half, Math.max(half, spot.t)), width: Math.min(o.width, Math.max(0.3, spot.len - 0.1)) });
  });
  return true;
}

/**
 * Elige una puerta, marco o ventana. Con un ambiente seleccionado se coloca de una vez
 * en el centro de su muro más largo; si no, queda lista para tocar el muro donde va.
 */
export function pickOpening(presetId: string) {
  const preset = OPENING_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  const { selection, project, levelId } = st();
  const level = project?.levels.find((l) => l.id === levelId);
  const room = selection?.kind === 'room' ? level?.rooms.find((r) => r.id === selection.id && r.hasWalls) : undefined;
  st().setTool(preset.kind === 'window' ? 'window' : preset.dock ? 'dock' : 'door');
  st().setOpeningPreset(preset.id);
  if (!room) return;
  let edge = 0;
  let longest = 0;
  room.points.forEach((a, i) => {
    const len = dist(a, room.points[(i + 1) % room.points.length]);
    if (len > longest) [edge, longest] = [i, len];
  });
  addOpening(preset.kind, room.id, edge, 0.5, longest, !!preset.dock);
  st().setTool('select');
}

export function deleteSelection() {
  const { selection } = st();
  if (!selection) return;
  st().mutate((_, level) => {
    if (selection.kind === 'furniture') level.furniture = level.furniture.filter((f) => f.id !== selection.id);
    if (selection.kind === 'opening') level.openings = level.openings.filter((o) => o.id !== selection.id);
    if (selection.kind === 'room') {
      level.rooms = level.rooms.filter((r) => r.id !== selection.id);
      level.openings = level.openings.filter((o) => o.roomId !== selection.id);
    }
  });
  st().select(null);
}

export function duplicateSelection() {
  const { selection, project, levelId } = st();
  const level = project?.levels.find((l) => l.id === levelId);
  if (!selection || !level) return;
  const id = uid();
  if (selection.kind === 'furniture') {
    const f = level.furniture.find((x) => x.id === selection.id);
    if (!f) return;
    st().mutate((_, l) => l.furniture.push({ ...f, id, x: f.x + 0.3, y: f.y + 0.3 }));
    st().select({ kind: 'furniture', id });
  } else if (selection.kind === 'room') {
    const r = level.rooms.find((x) => x.id === selection.id);
    if (!r) return;
    st().mutate((_, l) => l.rooms.push({ ...r, id, name: `${r.name} (copia)`, points: r.points.map((p) => ({ x: p.x + 1, y: p.y + 1 })) }));
    st().select({ kind: 'room', id });
  }
}

export function rotateSelection(delta: number) {
  const { selection } = st();
  if (selection?.kind !== 'furniture') return;
  st().mutate((_, level) => {
    const f = level.furniture.find((x) => x.id === selection.id);
    if (f) f.rotation = (((f.rotation + delta) % 360) + 360) % 360;
  });
}

export function nudgeSelection(dx: number, dy: number) {
  const { selection } = st();
  if (!selection) return;
  st().mutate((_, level) => {
    if (selection.kind === 'furniture') {
      const f = level.furniture.find((x) => x.id === selection.id);
      if (f) {
        f.x += dx;
        f.y += dy;
      }
    } else if (selection.kind === 'room') {
      const r = level.rooms.find((x) => x.id === selection.id);
      r?.points.forEach((p) => {
        p.x += dx;
        p.y += dy;
      });
    }
  });
}

export function updateFurniture(id: string, patch: Partial<Furniture>) {
  st().mutate((_, level) => {
    const f = level.furniture.find((x) => x.id === id);
    if (f) Object.assign(f, patch);
  });
}

/** Inserta un vértice en la arista `edge` y reacomoda los vanos afectados. */
export function insertVertex(roomId: string, edge: number, point: Vec2) {
  st().mutate((_, level) => {
    const r = level.rooms.find((x) => x.id === roomId);
    if (!r) return;
    const n = r.points.length;
    const a = r.points[edge];
    const b = r.points[(edge + 1) % n];
    const L = dist(a, b) || 1;
    const s = dist(a, point) / L;
    r.points.splice(edge + 1, 0, point);
    // los dos tramos nuevos heredan los ajustes del tramo partido
    if (r.sides) {
      while (r.sides.length < n) r.sides.push(null);
      r.sides.splice(edge + 1, 0, r.sides[edge] ? { ...r.sides[edge] } : null);
    }
    for (const o of level.openings) {
      if (o.roomId !== roomId) continue;
      if (o.edge > edge) o.edge += 1;
      else if (o.edge === edge) {
        if (o.t < s) o.t = o.t / s;
        else {
          o.edge += 1;
          o.t = (o.t - s) / (1 - s);
        }
      }
    }
  });
}

export function removeVertex(roomId: string, index: number) {
  st().mutate((_, level) => {
    const r = level.rooms.find((x) => x.id === roomId);
    if (!r || r.points.length <= 3) return;
    const n = r.points.length;
    const prevEdge = (index - 1 + n) % n;
    r.points.splice(index, 1);
    r.sides?.splice(index, 1);
    level.openings = level.openings.filter((o) => !(o.roomId === roomId && (o.edge === index || o.edge === prevEdge)));
    for (const o of level.openings) if (o.roomId === roomId && o.edge > index) o.edge -= 1;
  });
}

export function setLevelCount(count: number) {
  const { project } = st();
  if (!project) return;
  count = Math.max(1, Math.min(20, Math.round(count)));
  st().mutate((p) => {
    while (p.levels.length < count) p.levels.push(newLevel(p.levels.length, p.levels[p.levels.length - 1]?.height ?? 2.6));
    if (p.levels.length > count) p.levels = p.levels.slice(0, count);
  });
  const { project: np, levelId } = st();
  if (np && !np.levels.some((l) => l.id === levelId)) st().setLevel(np.levels[np.levels.length - 1].id);
}

export function addLevel(copyFrom?: Level) {
  const { project } = st();
  if (!project) return;
  const lvl = newLevel(project.levels.length, copyFrom?.height ?? 2.6);
  if (copyFrom) {
    // copiar el contorno de los ambientes (sin muebles ni vanos)
    lvl.rooms = copyFrom.rooms.map((r) => ({ ...structuredClone(r), id: uid() }));
  }
  st().mutate((p) => p.levels.push(lvl));
  st().setLevel(lvl.id);
}


/**
 * Copia un nivel sobre otro (reemplaza su contenido) o a un nivel nuevo si no se indica destino.
 * Con `full` copia también puertas, ventanas y objetos; sin él, solo el contorno de los ambientes.
 */
export function copyLevel(fromId: string, toId: string | null, full: boolean) {
  const { project } = st();
  const from = project?.levels.find((l) => l.id === fromId);
  if (!project || !from) return;
  const roomIds = new Map(from.rooms.map((r) => [r.id, uid()]));
  const rooms = from.rooms.map((r) => ({ ...structuredClone(r), id: roomIds.get(r.id)! }));
  const openings = full ? from.openings.filter((o) => roomIds.has(o.roomId)).map((o) => ({ ...o, id: uid(), roomId: roomIds.get(o.roomId)! })) : [];
  const furniture = full ? from.furniture.map((f) => ({ ...structuredClone(f), id: uid() })) : [];
  const targetId = toId ?? uid();
  st().mutate((p) => {
    let target = p.levels.find((l) => l.id === toId);
    if (!target) {
      target = { ...newLevel(p.levels.length, from.height), id: targetId };
      p.levels.push(target);
    }
    Object.assign(target, { rooms, openings, furniture });
  });
  st().setLevel(targetId);
}

/** Elige el tipo de pared: se aplica al ambiente seleccionado y queda para los ambientes nuevos. */
export function pickWallMaterial(id: WallMaterial) {
  const wall = WALL_MATERIALS.find((m) => m.id === id);
  if (!wall) return;
  st().setWallMaterial(id);
  const { selection } = st();
  if (selection?.kind !== 'room') return;
  st().mutate((_, level) => {
    const room = level.rooms.find((r) => r.id === selection.id);
    if (room) Object.assign(room, { wallMaterial: id, wallColor: wall.color, hasWalls: true });
  });
}

/**
 * Ajusta un tramo de pared de un ambiente (en cualquier nivel). Los valores vacíos
 * vuelven a tomarse del ambiente; `null` deja el tramo sin ajustes propios.
 */
export function setWallSide(roomId: string, edge: number, patch: WallSide | null) {
  st().mutate((p) => {
    const room = p.levels.flatMap((l) => l.rooms).find((r) => r.id === roomId);
    if (!room) return;
    const sides = Array.from({ length: room.points.length }, (_, i) => room.sides?.[i] ?? null);
    const next: WallSide = { ...sides[edge], ...patch };
    for (const k of Object.keys(next) as (keyof WallSide)[]) if (!next[k]) delete next[k];
    sides[edge] = patch && Object.keys(next).length ? next : null;
    if (sides.some(Boolean)) room.sides = sides;
    else delete room.sides;
  });
}

/** Agrega una esquina al ambiente a la mitad de su lado más largo, para darle forma irregular. */
export function addCorner(roomId: string) {
  const { project, levelId } = st();
  const room = project?.levels.find((l) => l.id === levelId)?.rooms.find((r) => r.id === roomId);
  if (!room) return;
  let edge = 0;
  let longest = 0;
  room.points.forEach((a, i) => {
    const len = dist(a, room.points[(i + 1) % room.points.length]);
    if (len > longest) [edge, longest] = [i, len];
  });
  const a = room.points[edge];
  const b = room.points[(edge + 1) % room.points.length];
  insertVertex(roomId, edge, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
}

/** Desde la vista 3D: lleva un objeto al punto que se tocó. */
export function moveFurnitureTo(id: string, point: Vec2): boolean {
  const level = st().project?.levels.find((l) => l.furniture.some((x) => x.id === id));
  const cur = level?.furniture.find((x) => x.id === id);
  if (!level || !cur) return false;
  const x = Math.round(point.x * 100) / 100;
  const y = Math.round(point.y * 100) / 100;
  // no se deja caer dentro de otro objeto
  if (st().avoidOverlap && collides({ ...cur, x, y }, level.furniture)) return false;
  st().mutate((p) => {
    const f = p.levels.flatMap((l) => l.furniture).find((o) => o.id === id);
    if (f) Object.assign(f, { x, y });
  });
  return true;
}
