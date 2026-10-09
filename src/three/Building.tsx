import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { SLAB, computeWalls, pointInPolygon } from '../geometry';
import { Door, DoorTarget } from './Doors';
import type { Furniture, Level, Room, Vec2 } from '../types';
import { floorTexture, wallTexture } from './textures';
import { FurnitureModel } from './FurnitureModel';

/** Prisma vertical a partir de un polígono del plano. */
function prism(poly: Vec2[], y0: number, y1: number) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Superficie horizontal (normal hacia arriba) con UV en metros. */
function flat(poly: Vec2[], y: number) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const obj = useMemo(factory, deps);
  useEffect(() => () => obj.dispose(), [obj]);
  return obj;
}

/** Segundos transcurridos de la animación de armado; sin reloj todo se muestra completo. */
export type BuildClock = RefObject<number>;

/** Ventana de tiempo (inicio, duración) en la que se arma un nivel. */
export interface BuildWindow {
  clock: BuildClock;
  at: number;
  span: number;
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeBack = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

/** Hace aparecer a sus hijos: 'spread' crece en planta, 'rise' sube desde el piso, 'pop' crece completo. */
function Reveal({ clock, at, dur, pivot, mode, children }: { clock?: BuildClock; at: number; dur: number; pivot: [number, number, number]; mode: 'spread' | 'rise' | 'pop'; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const last = useRef(-1);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const k = clock ? Math.max(0, Math.min(1, (clock.current - at) / dur)) : 1;
    if (k === last.current) return;
    last.current = k;
    const s = Math.max(0.001, mode === 'pop' ? easeBack(k) : easeOut(k));
    g.visible = k > 0;
    const sx = mode === 'rise' ? 1 : s;
    const sy = mode === 'spread' ? 1 : s;
    g.scale.set(sx, sy, sx);
    g.position.set(pivot[0] * (1 - sx), pivot[1] * (1 - sy), pivot[2] * (1 - sx));
  });
  return (
    <group ref={ref} visible={!clock}>
      {children}
    </group>
  );
}

const centroid = (pts: Vec2[]) => ({ x: pts.reduce((n, p) => n + p.x, 0) / pts.length, y: pts.reduce((n, p) => n + p.y, 0) / pts.length });

/** Reparte las piezas dentro de un tramo de la ventana, ordenadas por su posición en el plano. */
function stagger(points: Vec2[], from: number, to: number, build?: BuildWindow) {
  if (!build) return points.map(() => 0);
  const order = points.map((p, i) => ({ i, k: p.x + p.y * 0.35 })).sort((a, b) => a.k - b.k);
  const at = new Array<number>(points.length);
  order.forEach((o, rank) => (at[o.i] = build.at + build.span * (from + ((to - from) * rank) / Math.max(1, points.length))));
  return at;
}

/** Lleva techo el ambiente cuyas paredes llegan hasta arriba (no los cercos ni los muros bajos). */
const roofed = (r: Room) => r.hasWalls && !r.wallHeight && r.wallMaterial !== 'malla' && r.wallMaterial !== 'cerco';

/** Objeto de cerco equivalente a un tramo de muro de cerco entre a y b. */
function fenceModel(a: Vec2, b: Vec2, h: number, color: string, mesh: boolean): Furniture {
  return {
    id: `fence-${a.x},${a.y},${b.x},${b.y}`,
    type: mesh ? 'cerco_malla' : 'cerco',
    name: '',
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    rotation: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    w: Math.hypot(b.x - a.x, b.y - a.y),
    d: 0.06,
    h,
    elevation: 0,
    color,
  };
}

function Floor({ room, y }: { room: Room; y: number }) {
  const geo = useDisposable(() => flat(room.points, y), [room.points, y]);
  // imagen propia del piso: ajustada al contorno del ambiente o repetida como mosaico
  const image = useMemo(() => {
    if (!room.floorImage) return null;
    const t = new THREE.TextureLoader().load(room.floorImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const xs = room.points.map((p) => p.x);
    const ys = room.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxY = Math.max(...ys);
    const tw = room.floorTile || Math.max(...xs) - minX || 1;
    const th = room.floorTile || maxY - Math.min(...ys) || 1;
    // la geometría usa (x, −y) en metros como coordenadas de textura
    t.repeat.set(1 / tw, 1 / th);
    t.offset.set(-minX / tw, maxY / th);
    return t;
  }, [room.floorImage, room.floorTile, room.points]);
  useEffect(() => () => image?.dispose(), [image]);
  const map = image ?? floorTexture(room.floor);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial key={image ? 'img' : 'tex'} map={map} color={image ? '#ffffff' : room.floorColor} roughness={room.floor === 'marmol' || room.floor === 'ceramica' ? 0.35 : 0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Slab({ room, top, ceiling }: { room: Room; top: number; ceiling: boolean }) {
  const geo = useDisposable(() => prism(room.points, top - SLAB, top), [room.points, top]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={ceiling ? '#f8f8f6' : '#d6d3d1'} roughness={0.9} />
    </mesh>
  );
}

export function LevelMesh({
  level,
  elevation,
  thickness,
  ceiling,
  wallOpacity = 1,
  build,
  height = level.height,
  above,
  onPick,
}: {
  level: Level;
  elevation: number;
  /** altura real del nivel (ver levelHeights) */
  height?: number;
  /** nivel de encima: los ambientes que no cubre llevan su propio techo */
  above?: Level;
  /** con edición 3D activa: avisa qué puerta, pared u objeto se tocó */
  onPick?: (kind: 'opening' | 'room' | 'furniture' | 'floor', id: string, point: Vec2) => void;
  thickness: number;
  ceiling: boolean;
  wallOpacity?: number;
  /** si se indica, el nivel se arma por pasos: piso, muros y objetos */
  build?: BuildWindow;
}) {
  const walls = useMemo(() => computeWalls(level, thickness, height), [level, thickness, height]);

  const wallGeos = useMemo(
    () =>
      walls.pieces.map((p) => ({
        geo: prism(p.quad, elevation + p.y0, elevation + p.y1),
        color: p.color,
        glass: !!p.glass || p.material === 'vidrio',
        material: p.material,
        roomId: p.roomId,
        // un tramo de cerco se dibuja con el modelo de cerco, orientado sobre su eje
        fence: p.fence && fenceModel(p.fence.a, p.fence.b, p.y1 - p.y0, p.color, p.material === 'malla'),
        mid: centroid(p.quad),
      })),
    [walls, elevation],
  );
  useEffect(() => () => wallGeos.forEach((w) => w.geo.dispose()), [wallGeos]);

  const transparent = wallOpacity < 1;
  const clock = build?.clock;
  const roomMid = useMemo(() => level.rooms.map((r) => centroid(r.points)), [level.rooms]);
  const floorAt = useMemo(() => stagger(roomMid, 0, 0.14, build), [roomMid, build]);
  const wallAt = useMemo(() => stagger(wallGeos.map((w) => w.mid), 0.2, 0.46, build), [wallGeos, build]);
  // las zonas pintadas van primero; después racks y equipos
  const furnAt = useMemo(() => stagger(level.furniture.map((f) => ({ x: f.type === 'zona' ? -1e4 + f.x : f.x, y: f.y })), 0.5, 0.94, build), [level.furniture, build]);

  const doorAt = build ? build.at + build.span * 0.47 : 0;
  // un clic (no un arrastre de la cámara) sobre la pieza más cercana
  const pick = (kind: 'opening' | 'room' | 'furniture' | 'floor', id: string) =>
    onPick &&
    ((e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta < 6) onPick(kind, id, { x: e.point.x, y: e.point.z });
    });

  return (
    <group>
      {level.rooms.map((r, i) => (
        <Reveal key={r.id} clock={clock} at={floorAt[i]} dur={0.7} pivot={[roomMid[i].x, 0, roomMid[i].y]} mode="spread">
          {elevation > 0 && <Slab room={r} top={elevation} ceiling={false} />}
          <group onClick={pick('floor', r.id)}>
            <Floor room={r} y={elevation + 0.004} />
          </group>
        </Reveal>
      ))}
      {wallGeos.map((w, i) => (
        <Reveal key={i} clock={clock} at={wallAt[i]} dur={0.8} pivot={[0, elevation, 0]} mode="rise">
          <group onClick={pick('room', w.roomId)}>
          {w.fence ? (
            <FurnitureModel f={w.fence} baseY={elevation} />
          ) : w.glass ? (
            <mesh geometry={w.geo}>
              <meshPhysicalMaterial color="#cfeaff" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
            </mesh>
          ) : (
            <mesh geometry={w.geo} castShadow={!transparent} receiveShadow>
              <meshStandardMaterial key={w.material} map={wallTexture(w.material)} color={w.color} metalness={w.material === 'lamina' ? 0.15 : 0} roughness={w.material === 'lamina' ? 0.5 : 0.85} transparent={transparent} opacity={wallOpacity} depthWrite={!transparent} />
            </mesh>
          )}
          </group>
        </Reveal>
      ))}
      {walls.doors.map((d) => (
        <Reveal key={d.id} clock={clock} at={doorAt} dur={0.6} pivot={[d.a.x, elevation, d.a.y]} mode="pop">
          <group onClick={pick('opening', d.id)}>
            {d.style && <Door d={{ ...d, style: d.style }} y={elevation} />}
            {onPick && <DoorTarget d={d} y={elevation} />}
          </group>
        </Reveal>
      ))}
      {/* techo (losa de cubierta) de los ambientes que no tienen otro nivel encima */}
      {ceiling && level.rooms.filter((r, i) => roofed(r) && !(above?.rooms.some((u) => pointInPolygon(roomMid[i], u.points)))).map((r) => <Slab key={`c${r.id}`} room={r} top={elevation + height + SLAB} ceiling />)}
      {level.furniture.map((f, i) => (
        <Reveal key={f.id} clock={clock} at={furnAt[i]} dur={0.5} pivot={[f.x, elevation + f.elevation, f.y]} mode="pop">
          <group onClick={pick('furniture', f.id)}>
            <FurnitureModel f={f} baseY={elevation} />
          </group>
        </Reveal>
      ))}
    </group>
  );
}
