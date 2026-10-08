import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SLAB, computeWalls } from '../geometry';
import type { Level, Room, Vec2 } from '../types';
import { floorTexture } from './textures';
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

function Floor({ room, y }: { room: Room; y: number }) {
  const geo = useDisposable(() => flat(room.points, y), [room.points, y]);
  const map = floorTexture(room.floor);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={map} color={room.floorColor} roughness={room.floor === 'marmol' || room.floor === 'ceramica' ? 0.35 : 0.8} side={THREE.DoubleSide} />
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
  isTop,
  build,
  height = level.height,
}: {
  level: Level;
  elevation: number;
  /** altura real del nivel (ver levelHeights) */
  height?: number;
  thickness: number;
  ceiling: boolean;
  wallOpacity?: number;
  isTop: boolean;
  /** si se indica, el nivel se arma por pasos: piso, muros y objetos */
  build?: BuildWindow;
}) {
  const walls = useMemo(() => computeWalls(level, thickness, height), [level, thickness, height]);

  const wallGeos = useMemo(
    () =>
      walls.pieces.map((p) => ({
        geo: prism(p.quad, elevation + p.y0, elevation + p.y1),
        color: p.color,
        glass: !!p.glass,
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

  return (
    <group>
      {level.rooms.map((r, i) => (
        <Reveal key={r.id} clock={clock} at={floorAt[i]} dur={0.7} pivot={[roomMid[i].x, 0, roomMid[i].y]} mode="spread">
          {elevation > 0 && <Slab room={r} top={elevation} ceiling={false} />}
          <Floor room={r} y={elevation + 0.004} />
        </Reveal>
      ))}
      {wallGeos.map((w, i) => (
        <Reveal key={i} clock={clock} at={wallAt[i]} dur={0.8} pivot={[0, elevation, 0]} mode="rise">
          {w.glass ? (
            <mesh geometry={w.geo}>
              <meshPhysicalMaterial color="#cfeaff" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
            </mesh>
          ) : (
            <mesh geometry={w.geo} castShadow={!transparent} receiveShadow>
              <meshStandardMaterial color={w.color} roughness={0.85} transparent={transparent} opacity={wallOpacity} depthWrite={!transparent} />
            </mesh>
          )}
        </Reveal>
      ))}
      {/* techo propio del último nivel (losa de cubierta) cuando se recorre */}
      {ceiling && isTop && level.rooms.filter((r) => r.hasWalls).map((r) => <Slab key={`c${r.id}`} room={r} top={elevation + height + SLAB} ceiling />)}
      {level.furniture.map((f, i) => (
        <Reveal key={f.id} clock={clock} at={furnAt[i]} dur={0.5} pivot={[f.x, elevation + f.elevation, f.y]} mode="pop">
          <FurnitureModel f={f} baseY={elevation} />
        </Reveal>
      ))}
    </group>
  );
}
