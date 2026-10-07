import { CATALOG, ROOM_COLORS, type CatalogItem } from './catalog';
import { DOOR_DEFAULT, WINDOW_DEFAULT, dist, uid } from './geometry';
import { newLevel } from './storage';
import { useStore } from './store';
import type { Furniture, Level, OpeningKind, Vec2 } from './types';

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
  st().mutate((_, level) => {
    const n = level.rooms.length;
    level.rooms.push({
      id,
      name: `Ambiente ${n + 1}`,
      points,
      floor: 'epoxi',
      floorColor: '#9aa5b1',
      wallColor: '#e7e5e4',
      hasWalls: true,
    });
  });
  st().select({ kind: 'room', id });
}

export function roomTint(index: number) {
  return ROOM_COLORS[index % ROOM_COLORS.length];
}

/** Portón de andén / acceso vehicular. */
export const DOCK_DEFAULT = { width: 3.0, height: 3.6, sill: 0 };

export function addOpening(kind: OpeningKind, roomId: string, edge: number, t: number, edgeLen: number, dock = false) {
  const def = dock ? DOCK_DEFAULT : kind === 'door' ? DOOR_DEFAULT : WINDOW_DEFAULT;
  const width = Math.min(def.width, Math.max(0.3, edgeLen - 0.1));
  const half = width / 2 / edgeLen;
  const id = uid();
  st().mutate((_, level) => {
    level.openings.push({ id, roomId, edge, t: Math.min(1 - half, Math.max(half, t)), width, height: def.height, sill: def.sill, kind });
  });
  st().select({ kind: 'opening', id });
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

