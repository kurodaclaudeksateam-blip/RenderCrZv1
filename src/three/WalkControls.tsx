import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { pointInPolygon, type WallSegment } from '../geometry';
import type { Vec2 } from '../types';

/** Entrada compartida con los controles táctiles en pantalla. */
export const walkInput = { forward: 0, right: 0, turn: 0, run: false };

const RADIUS = 0.22;

function collide(x: number, z: number, segs: WallSegment[]) {
  for (let iter = 0; iter < 3; iter++) {
    for (const s of segs) {
      const ax = s.a.x;
      const az = s.a.y;
      const dx = s.b.x - ax;
      const dz = s.b.y - az;
      const l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const qx = ax + dx * t;
      const qz = az + dz * t;
      const ex = x - qx;
      const ez = z - qz;
      const d = Math.hypot(ex, ez);
      const min = RADIUS + s.half;
      if (d < min && d > 1e-6) {
        x = qx + (ex / d) * min;
        z = qz + (ez / d) * min;
      }
    }
  }
  return { x, z };
}

/** ¿El punto queda metido en algún muro u objeto? */
function blocked(x: number, z: number, segs: WallSegment[]) {
  for (const s of segs) {
    const dx = s.b.x - s.a.x;
    const dz = s.b.y - s.a.y;
    const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.y) * dz) / (dx * dx + dz * dz || 1e-9)));
    if (Math.hypot(x - s.a.x - dx * t, z - s.a.y - dz * t) < RADIUS + s.half - 0.02) return true;
  }
  return false;
}

/**
 * Siguiente posición con colisiones. Nunca deja al visitante encajado: si ya está
 * dentro de un mueble o pegado a un muro (por el punto de inicio o un cambio de nivel)
 * lo deja salir caminando, y si el paso completo no cabe (hueco estrecho o esquina)
 * prueba deslizarse por un solo eje antes de detenerlo.
 */
export function step(x: number, z: number, dx: number, dz: number, segs: WallSegment[], solids: Vec2[][] = []) {
  if (blocked(x, z, segs) || solids.some((poly) => pointInPolygon({ x, y: z }, poly))) return { x: x + dx, z: z + dz };
  const tries = [collide(x + dx, z + dz, segs), collide(x + dx, z, segs), collide(x, z + dz, segs)];
  for (const p of tries) if (!blocked(p.x, p.z, segs)) return p;
  return { x, z };
}

export function WalkControls({
  start,
  eyeY,
  segments,
  solids,
  collisions,
  ground,
  onLevel,
  onLockChange,
}: {
  start: { x: number; z: number; yaw: number };
  eyeY: number;
  segments: WallSegment[];
  /** contorno en planta de los objetos que bloquean el paso */
  solids: Vec2[][];
  collisions: boolean;
  /** altura del suelo bajo el visitante (escaleras y rampas) y, si toca, cambio de nivel */
  ground?: (x: number, z: number) => { h: number; go?: number };
  onLevel?: (delta: number) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { camera, gl } = useThree();
  const pos = useRef({ x: start.x, y: eyeY, z: start.z });
  const yaw = useRef(start.yaw);
  const pitch = useRef(-0.05);
  const keys = useRef(new Set<string>());
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const bob = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      keys.current.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();

    const look = (dx: number, dy: number, k: number) => {
      yaw.current -= dx * k;
      pitch.current = Math.max(-1.45, Math.min(1.45, pitch.current - dy * k));
    };
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement === el) look(e.movementX, e.movementY, 0.0022);
    };
    const pd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !matchMedia('(pointer: coarse)').matches) {
        if (document.pointerLockElement !== el) {
          const req = el.requestPointerLock() as unknown as Promise<void> | undefined;
          // algunos navegadores rechazan la promesa si el bloqueo no se concede
          req?.catch?.(() => {
            dragging.current = { x: e.clientX, y: e.clientY };
          });
        }
      } else {
        dragging.current = { x: e.clientX, y: e.clientY };
      }
    };
    const pm = (e: PointerEvent) => {
      if (!dragging.current || document.pointerLockElement === el) return;
      look(e.clientX - dragging.current.x, e.clientY - dragging.current.y, 0.005);
      dragging.current = { x: e.clientX, y: e.clientY };
    };
    const pu = () => (dragging.current = null);
    const lockChange = () => onLockChange(document.pointerLockElement === el);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('mousemove', mm);
    document.addEventListener('pointerlockchange', lockChange);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('pointerlockchange', lockChange);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl, onLockChange]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + walkInput.forward;
    const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + walkInput.right;
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0) + walkInput.turn;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || walkInput.run;

    yaw.current += turn * dt * 1.8;
    const speed = run ? 3.4 : 1.5;
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    let dx = (-sin * fwd + cos * strafe) * speed * dt;
    let dz = (-cos * fwd - sin * strafe) * speed * dt;
    const mag = Math.hypot(fwd, strafe);
    if (mag > 1) {
      dx /= mag;
      dz /= mag;
    }

    let nx = pos.current.x + dx;
    let nz = pos.current.z + dz;
    if (collisions) ({ x: nx, z: nz } = step(pos.current.x, pos.current.z, dx, dz, segments, solids));
    const moving = Math.hypot(nx - pos.current.x, nz - pos.current.z) > 1e-5;
    pos.current.x = nx;
    pos.current.z = nz;
    const g = ground?.(nx, nz);
    if (g?.go) onLevel?.(g.go);
    pos.current.y += (eyeY + (g?.h ?? 0) - pos.current.y) * Math.min(1, dt * 6);
    bob.current = moving ? bob.current + dt * (run ? 13 : 8) : bob.current * 0.9;

    camera.position.set(pos.current.x, pos.current.y + Math.sin(bob.current) * 0.025, pos.current.z);
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });

  return null;
}
