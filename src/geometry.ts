import type { Level, Opening, Room, Vec2, DoorStyle, WallMaterial } from './types';

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

/** Rejilla de cajas de un rack o tarima a medida: columnas (ancho), filas (fondo) y capas (alto). */
export function cellGrid(f: { type: string; cols?: number; rows?: number; shelves?: number }) {
  const cols = Math.max(1, Math.round(f.cols ?? 2));
  const levels = Math.max(1, Math.round(f.shelves ?? 3));
  // el rack carga también a piso; sus cajas ocupan todo el fondo
  return f.type === 'rack_custom' ? { cols, rows: 1, layers: levels + 1 } : { cols, rows: Math.max(1, Math.round(f.rows ?? 2)), layers: levels };
}

export const cellIndex = (g: { cols: number; rows: number }, layer: number, row: number, col: number) => (layer * g.rows + row) * g.cols + col;

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).slice(0, 12);

export const round = (n: number, step: number) => Math.round(n / step) * step;
export const fmt = (n: number, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/** Área con signo (fórmula del cordón). */
export function signedArea(pts: Vec2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const area = (pts: Vec2[]) => Math.abs(signedArea(pts));

export function perimeter(pts: Vec2[]) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) p += dist(pts[i], pts[(i + 1) % pts.length]);
  return p;
}

export function centroid(pts: Vec2[]): Vec2 {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    const s = pts.reduce((acc, p) => add(acc, p), v(0, 0));
    return mul(s, 1 / Math.max(1, pts.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return v(cx / (6 * a), cy / (6 * a));
}

export function pointInPolygon(p: Vec2, pts: Vec2[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Un punto que cae dentro del polígono (para etiquetas y puntos de inicio). */
export function interiorPoint(pts: Vec2[]): Vec2 {
  const c = centroid(pts);
  if (pointInPolygon(c, pts)) return c;
  const b = bounds(pts);
  // barrido horizontal por el centro vertical: tomamos el tramo interior más largo
  const y = (b.minY + b.maxY) / 2;
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const q = pts[(i + 1) % pts.length];
    if ((a.y > y) !== (q.y > y)) xs.push(a.x + ((y - a.y) * (q.x - a.x)) / (q.y - a.y));
  }
  xs.sort((m, n) => m - n);
  let best = c;
  let bestW = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > bestW) {
      bestW = xs[i + 1] - xs[i];
      best = v((xs[i] + xs[i + 1]) / 2, y);
    }
  }
  return best;
}

export function bounds(pts: Vec2[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1e-9;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const point = lerp(a, b, t);
  return { t, point, dist: dist(p, point) };
}

/** Normal que apunta hacia el interior del polígono para la arista con dirección d. */
export function inwardNormal(d: Vec2, ccw: boolean): Vec2 {
  return ccw ? v(-d.y, d.x) : v(d.y, -d.x);
}

/** Polígono desplazado hacia dentro con uniones en inglete. */
export function insetPolygon(pts: Vec2[], t: number): Vec2[] {
  const n = pts.length;
  const ccw = signedArea(pts) > 0;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const n1 = inwardNormal(norm(sub(p, prev)), ccw);
    const n2 = inwardNormal(norm(sub(next, p)), ccw);
    const k = 1 + dot(n1, n2);
    if (k < 0.15) return add(p, mul(n1, t)); // ángulo casi de 180° hacia atrás
    let off = mul(add(n1, n2), t / k);
    const maxLen = t * 4;
    if (len(off) > maxLen) off = mul(norm(off), maxLen);
    return add(p, off);
  });
}

// ---------------------------------------------------------------------------
// Muros
// ---------------------------------------------------------------------------

export interface WallPiece {
  /** exterior a, exterior b, interior b, interior a */
  quad: Vec2[];
  y0: number;
  y1: number;
  glass?: boolean;
  color: string;
  roomId: string;
  material?: WallMaterial;
  /** tramo de cerco: eje del tramo, para dibujarlo como malla o barrotes */
  fence?: { a: Vec2; b: Vec2 };
}

/** Puerta colocada en su vano: jambas a y b sobre el eje del muro. */
export interface DoorPlacement {
  id: string;
  a: Vec2;
  b: Vec2;
  inward: Vec2;
  height: number;
  depth: number;
  /** sin tipo es un vano abierto, sin hojas */
  style?: DoorStyle;
  fence: boolean;
}

/** Altura de un cerco cuando el ambiente no indica otra. */
export const FENCE_HEIGHT = 2;

export interface WallSegment {
  a: Vec2;
  b: Vec2;
  half: number;
}

export interface OpeningWorld extends Opening {
  center: Vec2;
  dir: Vec2;
  a: Vec2;
  b: Vec2;
}

export function openingWorld(o: Opening, rooms: Room[]): OpeningWorld | null {
  const room = rooms.find((r) => r.id === o.roomId);
  if (!room) return null;
  const n = room.points.length;
  const a = room.points[o.edge % n];
  const b = room.points[(o.edge + 1) % n];
  if (!a || !b) return null;
  return { ...o, a, b, center: lerp(a, b, o.t), dir: norm(sub(b, a)) };
}

export const DOOR_DEFAULT = { width: 0.9, height: 2.1, sill: 0 };
export const WINDOW_DEFAULT = { width: 1.2, height: 1.2, sill: 0.9 };

/**
 * Genera las piezas sólidas de muro de un nivel, recortando vanos de puertas y
 * ventanas. Un vano también recorta los muros colineales de ambientes vecinos,
 * así una puerta en un muro compartido atraviesa ambos.
 */
export function computeWalls(level: Level, thickness: number, height = level.height) {
  const H = height;
  const pieces: WallPiece[] = [];
  const segments: WallSegment[] = [];
  const doors: DoorPlacement[] = [];
  const fenced = (r?: Room) => r?.wallMaterial === 'malla' || r?.wallMaterial === 'cerco';
  const ops = level.openings
    .map((o) => openingWorld(o, level.rooms))
    .filter((o): o is OpeningWorld => !!o);

  for (const room of level.rooms) {
    if (!room.hasWalls || room.points.length < 3) continue;
    const pts = room.points;
    const n = pts.length;
    const ccw = signedArea(pts) > 0;
    const inner = insetPolygon(pts, thickness);
    const material = room.wallMaterial ?? 'liso';
    const fence = fenced(room);
    const fenceH = Math.min(H, room.wallHeight || FENCE_HEIGHT);

    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const L = dist(a, b);
      if (L < 1e-4) continue;
      const d = mul(sub(b, a), 1 / L);
      const nrm = inwardNormal(d, ccw);

      const outer = (s: number) => add(a, mul(d, s));
      const innerAt = (s: number) =>
        s <= 1e-6 ? inner[i] : s >= L - 1e-6 ? inner[(i + 1) % n] : add(outer(s), mul(nrm, thickness));
      const quad = (s0: number, s1: number, f0 = 0, f1 = 1) => {
        if (f0 === 0 && f1 === 1) return [outer(s0), outer(s1), innerAt(s1), innerAt(s0)];
        const o0 = outer(s0);
        const o1 = outer(s1);
        return [add(o0, mul(nrm, thickness * f0)), add(o1, mul(nrm, thickness * f0)), add(o1, mul(nrm, thickness * f1)), add(o0, mul(nrm, thickness * f1))];
      };
      const solid = (s0: number, s1: number, y0: number, y1: number) => {
        if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return;
        if (fence) {
          // un cerco no lleva dintel sobre la puerta: solo tramos desde el piso
          if (y0 > 0) return;
          const q = quad(s0, s1, 0.3, 0.7);
          const a = lerp(q[0], q[3], 0.5);
          const b = lerp(q[1], q[2], 0.5);
          pieces.push({ quad: q, y0: 0, y1: fenceH, color: room.wallColor, roomId: room.id, material, fence: { a, b } });
          segments.push({ a, b, half: 0.04 });
          return;
        }
        pieces.push({ quad: material === 'vidrio' ? quad(s0, s1, 0.35, 0.65) : quad(s0, s1), y0, y1, color: room.wallColor, roomId: room.id, material });
        if (y0 < 1.2 && y1 > 0.3) {
          const q = quad(s0, s1);
          segments.push({ a: lerp(q[0], q[3], 0.5), b: lerp(q[1], q[2], 0.5), half: thickness / 2 });
        }
      };

      const gaps = ops
        .filter((o) => {
          if (Math.abs(cross(o.dir, d)) > 0.02) return false;
          const rel = sub(o.center, a);
          if (Math.abs(cross(d, rel)) > Math.max(0.12, thickness * 1.2)) return false;
          const s = dot(rel, d);
          return s > 0 && s < L;
        })
        .map((o) => {
          const s = dot(sub(o.center, a), d);
          return { s0: Math.max(0, s - o.width / 2), s1: Math.min(L, s + o.width / 2), o };
        })
        .sort((m, k) => m.s0 - k.s0);

      let cursor = 0;
      for (const g of gaps) {
        if (g.s0 < cursor) continue; // vanos superpuestos: se ignora el segundo
        solid(cursor, g.s0, 0, H);
        const o = g.o;
        if (o.kind === 'door') {
          solid(g.s0, g.s1, Math.min(o.height, H - 0.05), H);
        } else if (fence) {
          solid(g.s0, g.s1, 0, H);
        } else {
          const top = Math.min(o.sill + o.height, H - 0.05);
          solid(g.s0, g.s1, 0, o.sill);
          solid(g.s0, g.s1, top, H);
          pieces.push({ quad: quad(g.s0, g.s1, 0.45, 0.55), y0: o.sill, y1: top, glass: true, color: '#9fd8ff', roomId: room.id });
          // el vidrio también bloquea el paso
          const q = quad(g.s0, g.s1);
          segments.push({ a: lerp(q[0], q[3], 0.5), b: lerp(q[1], q[2], 0.5), half: thickness / 2 });
        }
        cursor = g.s1;
      }
      solid(cursor, L, 0, H);
    }
  }

  for (const o of ops) {
    if (o.kind !== 'door') continue;
    const room = level.rooms.find((r) => r.id === o.roomId);
    if (!room) continue;
    const fence = fenced(room);
    const inward = inwardNormal(o.dir, signedArea(room.points) > 0);
    const c = add(o.center, mul(inward, thickness / 2));
    doors.push({
      id: o.id,
      a: add(c, mul(o.dir, -o.width / 2)),
      b: add(c, mul(o.dir, o.width / 2)),
      inward,
      height: Math.min(o.height, fence ? Math.min(H, room.wallHeight || FENCE_HEIGHT) : H - 0.05),
      depth: thickness,
      style: o.door,
      fence,
    });
  }
  return { pieces, segments, doors };
}

/** Busca la arista más cercana entre los ambientes de un nivel. */
export function nearestEdge(rooms: Room[], p: Vec2, maxDist: number) {
  let best: { roomId: string; edge: number; t: number; dist: number; point: Vec2; a: Vec2; b: Vec2 } | null = null;
  for (const r of rooms) {
    const n = r.points.length;
    for (let i = 0; i < n; i++) {
      const a = r.points[i];
      const b = r.points[(i + 1) % n];
      const pr = projectOnSegment(p, a, b);
      if (pr.dist <= maxDist && (!best || pr.dist < best.dist)) best = { roomId: r.id, edge: i, t: pr.t, dist: pr.dist, point: pr.point, a, b };
    }
  }
  return best;
}

/** Rota un punto local (lx, ly) por grados horarios y lo traslada. */
export function localToWorld(lx: number, ly: number, cx: number, cy: number, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return v(cx + lx * c - ly * s, cy + lx * s + ly * c);
}

/** Holgura entre el objeto más alto de un nivel y la losa del nivel de arriba. */
const CLEARANCE = 0.3;

/**
 * Altura real de cada nivel: la indicada, o más si un rack u otro objeto que queda
 * debajo del nivel superior es más alto. Así la losa de arriba nunca corta los objetos.
 */
export function levelHeights(levels: Level[]) {
  return levels.map((l, i) => {
    const above = levels[i + 1];
    if (!above) return l.height;
    let need = l.height;
    for (const f of l.furniture) {
      const top = f.elevation + f.h + CLEARANCE;
      if (top > need && above.rooms.some((r) => pointInPolygon(f, r.points))) need = top;
    }
    return Math.round(need * 100) / 100;
  });
}

export function levelElevations(levels: Level[]) {
  const out: number[] = [];
  let acc = 0;
  levelHeights(levels).forEach((h) => {
    out.push(acc);
    acc += h + SLAB;
  });
  return out;
}

export const SLAB = 0.15;
