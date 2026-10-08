// Formato compacto de proyecto para la nube: tuplas en vez de objetos, medidas en
// milímetros, sin ids internos (se regeneran al abrir) y comprimido con deflate.
// Texto resultante: "z1." + base64(deflate(json)) o "j1." + json si no hay compresión.

import type { Furniture, Level, Opening, Project, Room } from './types';
import { uid } from './geometry';

const mm = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

type RoomT = [string, number[], string, string, string, number, (string | 0)?, number?];
type OpeningT = [number, number, number, number, number, number, number, string?];
type FurnT = [string, string, number, number, number, number, number, number, number, string, (string | 0)?, number?, number?, number?, number?, (string | 0)?, number?];
type LevelT = [string, number, RoomT[], OpeningT[], FurnT[]];
type ProjectT = [1, string, number, number, number, LevelT[], string[]?];

function pack(p: Project): ProjectT {
  // cada imagen se guarda una sola vez aunque la usen varios anuncios
  const images: string[] = [];
  const imageRef = (src?: string) => {
    if (!src) return 0;
    const i = images.indexOf(src);
    return i >= 0 ? i + 1 : images.push(src);
  };
  const levels = p.levels.map((l): LevelT => {
      const roomIndex = new Map(l.rooms.map((r, i) => [r.id, i]));
      return [
        l.name,
        mm(l.height),
        l.rooms.map((r): RoomT => [r.name, r.points.flatMap((q) => [mm(q.x), mm(q.y)]), r.floor, r.floorColor, r.wallColor, r.hasWalls ? 1 : 0, ...(r.wallMaterial && r.wallMaterial !== 'liso' ? [r.wallMaterial, mm(r.wallHeight ?? 0)] : [])] as RoomT),
        l.openings
          .filter((o) => roomIndex.has(o.roomId))
          .map((o): OpeningT => [roomIndex.get(o.roomId)!, o.edge, r4(o.t), mm(o.width), mm(o.height), mm(o.sill), o.kind === 'window' ? 1 : 0, ...(o.door ? [o.door] : [])] as OpeningT),
        l.furniture.map((f): FurnT => {
          const t: FurnT = [f.type, f.name, mm(f.x), mm(f.y), mm(f.rotation), mm(f.w), mm(f.d), mm(f.h), mm(f.elevation), f.color, f.label || 0, f.shelves ?? 0, f.empty ? 1 : 0, f.cols ?? 0, f.rows ?? 0, f.cells?.some(Boolean) ? f.cells.join(',') : 0, imageRef(f.image)];
          while (t.length > 10 && !t[t.length - 1]) t.pop();
          return t;
        }),
      ];
  });
  return [1, p.name, mm(p.wallThickness), p.createdAt, p.updatedAt, levels, ...(images.length ? [images] : [])] as ProjectT;
}

function unpack(t: ProjectT, id: string): Project {
  if (!Array.isArray(t) || t[0] !== 1) throw new Error('Formato de proyecto desconocido');
  return {
    id,
    name: t[1],
    wallThickness: t[2],
    createdAt: t[3],
    updatedAt: t[4],
    levels: t[5].map((l): Level => {
      const rooms = l[2].map((r): Room => {
        const points = [];
        for (let i = 0; i + 1 < r[1].length; i += 2) points.push({ x: r[1][i], y: r[1][i + 1] });
        return { id: uid(), name: r[0], points, floor: r[2] as Room['floor'], floorColor: r[3], wallColor: r[4], hasWalls: !!r[5], ...(r[6] ? { wallMaterial: r[6] as Room['wallMaterial'] } : {}), ...(r[7] ? { wallHeight: r[7] } : {}) };
      });
      return {
        id: uid(),
        name: l[0],
        height: l[1],
        rooms,
        openings: l[3]
          .filter((o) => rooms[o[0]])
          .map((o): Opening => ({ id: uid(), roomId: rooms[o[0]].id, edge: o[1], t: o[2], width: o[3], height: o[4], sill: o[5], kind: o[6] ? 'window' : 'door', ...(o[7] ? { door: o[7] as Opening['door'] } : {}) })),
        furniture: l[4].map(
          (f): Furniture => ({
            id: uid(),
            type: f[0] as Furniture['type'],
            name: f[1],
            x: f[2],
            y: f[3],
            rotation: f[4],
            w: f[5],
            d: f[6],
            h: f[7],
            elevation: f[8],
            color: f[9],
            ...(f[10] ? { label: f[10] } : {}),
            ...(f[11] ? { shelves: f[11] } : {}),
            ...(f[12] ? { empty: true } : {}),
            ...(f[13] ? { cols: f[13] } : {}),
            ...(f[14] ? { rows: f[14] } : {}),
            ...(f[15] ? { cells: f[15].split(',') } : {}),
            ...(f[16] && t[6]?.[f[16] - 1] ? { image: t[6][f[16] - 1] } : {}),
          }),
        ),
      };
    }),
  };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(s: string) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encodeProject(p: Project): Promise<string> {
  const json = JSON.stringify(pack(p));
  if (typeof CompressionStream === 'undefined') return 'j1.' + json;
  return 'z1.' + toBase64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

export async function decodeProject(data: string, id: string): Promise<Project> {
  const body = data.slice(3);
  if (data.startsWith('j1.')) return unpack(JSON.parse(body), id);
  if (!data.startsWith('z1.')) throw new Error('Formato de proyecto desconocido');
  const json = new TextDecoder().decode(await pipe(fromBase64(body), new DecompressionStream('deflate-raw')));
  return unpack(JSON.parse(json), id);
}
