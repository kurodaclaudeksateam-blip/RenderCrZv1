import { useEffect, useMemo } from 'react';
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
}: {
  level: Level;
  elevation: number;
  thickness: number;
  ceiling: boolean;
  wallOpacity?: number;
  isTop: boolean;
}) {
  const walls = useMemo(() => computeWalls(level, thickness), [level, thickness]);

  const wallGeos = useMemo(
    () =>
      walls.pieces.map((p) => ({
        geo: prism(p.quad, elevation + p.y0, elevation + p.y1),
        color: p.color,
        glass: !!p.glass,
      })),
    [walls, elevation],
  );
  useEffect(() => () => wallGeos.forEach((w) => w.geo.dispose()), [wallGeos]);

  const transparent = wallOpacity < 1;

  return (
    <group>
      {elevation > 0 && level.rooms.map((r) => <Slab key={`s${r.id}`} room={r} top={elevation} ceiling={false} />)}
      {level.rooms.map((r) => (
        <Floor key={r.id} room={r} y={elevation + 0.004} />
      ))}
      {wallGeos.map((w, i) =>
        w.glass ? (
          <mesh key={i} geometry={w.geo}>
            <meshPhysicalMaterial color="#cfeaff" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
          </mesh>
        ) : (
          <mesh key={i} geometry={w.geo} castShadow={!transparent} receiveShadow>
            <meshStandardMaterial color={w.color} roughness={0.85} transparent={transparent} opacity={wallOpacity} depthWrite={!transparent} />
          </mesh>
        ),
      )}
      {/* techo propio del último nivel (losa de cubierta) cuando se recorre */}
      {ceiling && isTop && level.rooms.filter((r) => r.hasWalls).map((r) => <Slab key={`c${r.id}`} room={r} top={elevation + level.height + SLAB} ceiling />)}
      {level.furniture.map((f) => (
        <FurnitureModel key={f.id} f={f} baseY={elevation} />
      ))}
    </group>
  );
}
