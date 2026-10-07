import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { Furniture } from '../types';

type V3 = [number, number, number];

const shade = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

interface MatProps {
  c: string;
  rough?: number;
  metal?: number;
  opacity?: number;
  emissive?: string;
}

function Mat({ c, rough = 0.75, metal = 0, opacity, emissive }: MatProps) {
  return (
    <meshStandardMaterial
      color={c}
      roughness={rough}
      metalness={metal}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissive ? 1 : 0}
      depthWrite={opacity === undefined}
    />
  );
}

/** Caja definida por su centro y tamaño. */
function B({ p, s, ...m }: { p: V3; s: V3 } & MatProps) {
  return (
    <mesh position={p} castShadow={m.opacity === undefined} receiveShadow>
      <boxGeometry args={s} />
      <Mat {...m} />
    </mesh>
  );
}

/** Caja apoyada: y0 = base, h = alto. */
function Bx({ x = 0, z = 0, y0 = 0, w, h, d, ...m }: { x?: number; z?: number; y0?: number; w: number; h: number; d: number } & MatProps) {
  return <B p={[x, y0 + h / 2, z]} s={[w, h, d]} {...m} />;
}

function Cyl({ p, r, h, r2, seg = 24, ...m }: { p: V3; r: number; h: number; r2?: number; seg?: number } & MatProps) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
      <Mat {...m} />
    </mesh>
  );
}

function Soft({ p, s, c, r = 0.05 }: { p: V3; s: V3; c: string; r?: number }) {
  return (
    <RoundedBox args={s} radius={Math.min(r, ...s.map((x) => x / 2.1))} smoothness={3} position={p} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={0.95} />
    </RoundedBox>
  );
}

function Legs({ w, d, h, inset = 0.05, r = 0.025, c }: { w: number; d: number; h: number; inset?: number; r?: number; c: string }) {
  const xs = [-w / 2 + inset, w / 2 - inset];
  const zs = [-d / 2 + inset, d / 2 - inset];
  return (
    <>
      {xs.flatMap((x) => zs.map((z) => <Cyl key={`${x}${z}`} p={[x, h / 2, z]} r={r} h={h} c={c} seg={10} />))}
    </>
  );
}

function Model({ f }: { f: Furniture }) {
  const { w, d, h, color: c } = f;
  const dark = shade(c, 0.6);
  const metal = '#9ca3af';

  switch (f.type) {
    case 'sofa':
    case 'sillon': {
      const arm = Math.min(0.2, w * 0.18);
      const back = Math.min(0.22, d * 0.28);
      const seatH = Math.min(0.45, h * 0.52);
      const n = f.type === 'sofa' ? Math.max(2, Math.round((w - 2 * arm) / 0.65)) : 1;
      const cw = (w - 2 * arm) / n;
      return (
        <group>
          <Bx w={w} h={0.1} d={d} y0={0.04} c={dark} />
          <Legs w={w} d={d} h={0.06} r={0.02} c="#222" />
          <Soft p={[0, (h + seatH * 0.6) / 2, -d / 2 + back / 2]} s={[w, h - seatH * 0.6, back]} c={c} />
          <Soft p={[-w / 2 + arm / 2, (seatH + 0.2) / 2 + 0.07, 0]} s={[arm, seatH + 0.2, d]} c={c} />
          <Soft p={[w / 2 - arm / 2, (seatH + 0.2) / 2 + 0.07, 0]} s={[arm, seatH + 0.2, d]} c={c} />
          {Array.from({ length: n }, (_, i) => (
            <Soft key={i} p={[-w / 2 + arm + cw * (i + 0.5), seatH - 0.08, back / 2]} s={[cw - 0.02, 0.18, d - back - 0.02]} c={shade(c, 1.08)} />
          ))}
        </group>
      );
    }
    case 'mesa':
    case 'mesa_centro':
    case 'escritorio': {
      const top = 0.04;
      return (
        <group>
          <Bx w={w} h={top} d={d} y0={h - top} c={c} rough={0.5} />
          <Legs w={w} d={d} h={h - top} r={f.type === 'mesa_centro' ? 0.03 : 0.025} c={f.type === 'escritorio' ? '#333' : dark} />
          {f.type === 'mesa_centro' && <Bx w={w - 0.1} h={0.02} d={d - 0.1} y0={0.12} c={dark} />}
          {f.type === 'escritorio' && (
            <>
              <Bx x={w / 2 - 0.22} w={0.4} h={h - top - 0.1} d={d - 0.08} y0={0.08} c={shade(c, 0.9)} />
              <Bx z={-d / 2 + 0.15} w={0.08} h={0.12} d={0.06} y0={h} c="#222" />
              <Bx z={-d / 2 + 0.15} w={Math.min(0.6, w * 0.5)} h={0.36} d={0.03} y0={h + 0.1} c="#111" rough={0.3} />
              <Bx z={0.05} w={0.42} h={0.015} d={0.14} y0={h} c="#d4d4d4" />
            </>
          )}
        </group>
      );
    }
    case 'mesa_redonda':
      return (
        <group>
          <Cyl p={[0, h - 0.02, 0]} r={w / 2} h={0.04} c={c} rough={0.5} seg={40} />
          <Cyl p={[0, (h - 0.04) / 2, 0]} r={0.05} h={h - 0.04} c={dark} />
          <Cyl p={[0, 0.02, 0]} r={Math.min(w, d) * 0.25} h={0.04} c={dark} />
        </group>
      );
    case 'silla': {
      const seat = Math.min(0.46, h * 0.5);
      return (
        <group>
          <Bx w={w} h={0.05} d={d} y0={seat - 0.05} c={c} />
          <Legs w={w} d={d} h={seat - 0.05} r={0.018} inset={0.03} c={dark} />
          <Bx z={-d / 2 + 0.025} w={w} h={h - seat} d={0.04} y0={seat} c={c} />
        </group>
      );
    }
    case 'silla_oficina': {
      const seat = Math.min(0.5, h * 0.45);
      return (
        <group>
          {[0, 72, 144, 216, 288].map((a) => (
            <group key={a} rotation={[0, (a * Math.PI) / 180, 0]}>
              <Bx x={w * 0.22} w={w * 0.44} h={0.03} d={0.04} y0={0.05} c="#111" />
              <mesh position={[w * 0.43, 0.035, 0]}>
                <sphereGeometry args={[0.03, 10, 10]} />
                <Mat c="#111" />
              </mesh>
            </group>
          ))}
          <Cyl p={[0, (seat - 0.1) / 2 + 0.05, 0]} r={0.025} h={seat - 0.1} c={metal} metal={0.8} rough={0.3} />
          <Soft p={[0, seat, 0]} s={[w * 0.85, 0.08, d * 0.85]} c={c} />
          <Soft p={[0, seat + (h - seat) / 2 + 0.05, -d * 0.4]} s={[w * 0.8, h - seat - 0.05, 0.07]} c={c} />
        </group>
      );
    }
    case 'mueble_tv': {
      const tvW = Math.min(w * 0.85, 1.6);
      const tvH = (tvW * 9) / 16;
      return (
        <group>
          <Bx w={w} h={h} d={d} c={c} rough={0.5} />
          <Bx z={d / 2 + 0.002} w={w * 0.96} h={0.004} d={0.004} y0={h / 2} c="#000" />
          <Bx z={-d / 4} w={0.25} h={0.04} d={0.18} y0={h} c="#111" />
          <Bx z={-d / 4} w={0.05} h={0.12} d={0.04} y0={h} c="#111" />
          <Bx z={-d / 4} w={tvW} h={tvH} d={0.04} y0={h + 0.1} c="#0b0b0b" rough={0.25} metal={0.2} />
          <Bx z={-d / 4 + 0.021} w={tvW - 0.03} h={tvH - 0.03} d={0.002} y0={h + 0.115} c="#1e293b" rough={0.1} emissive="#0f172a" />
        </group>
      );
    }
    case 'estante': {
      const shelves = Math.max(2, Math.round(h / 0.38));
      const gap = (h - 0.04) / shelves;
      const r = mulberry(f.id);
      return (
        <group>
          <Bx x={-w / 2 + 0.01} w={0.02} h={h} d={d} c={c} />
          <Bx x={w / 2 - 0.01} w={0.02} h={h} d={d} c={c} />
          <Bx z={-d / 2 + 0.005} w={w} h={h} d={0.01} c={shade(c, 0.85)} />
          {Array.from({ length: shelves + 1 }, (_, i) => (
            <Bx key={i} w={w} h={0.02} d={d} y0={i * gap} c={c} />
          ))}
          {Array.from({ length: shelves }, (_, i) => {
            let x = -w / 2 + 0.04;
            const books = [];
            while (x < w / 2 - 0.1) {
              const bw = 0.025 + r() * 0.04;
              const bh = gap * (0.55 + r() * 0.3);
              if (r() > 0.15)
                books.push(<Bx key={x} x={x + bw / 2} w={bw} h={bh} d={d * 0.7} y0={i * gap + 0.02} c={BOOKS[Math.floor(r() * BOOKS.length)]} />);
              x += bw + 0.004;
            }
            return <group key={i}>{books}</group>;
          })}
        </group>
      );
    }
    case 'alfombra':
      return <Bx w={w} h={Math.max(0.01, h)} d={d} c={c} rough={1} />;
    case 'cama': {
      const base = h * 0.55;
      return (
        <group>
          <Bx w={w} h={base} d={d} y0={0.05} c={shade(c, 0.55)} />
          <Legs w={w} d={d} h={0.05} r={0.03} c="#3a2a1a" />
          <Soft p={[0, base + (h - base) / 2 + 0.05, 0.02]} s={[w - 0.04, h - base, d - 0.06]} c="#f8f8f6" r={0.06} />
          <Bx z={-d / 2 + 0.04} w={w + 0.04} h={h + 0.55} d={0.08} c={shade(c, 0.5)} />
          <Soft p={[0, h + 0.07, d * 0.18]} s={[w + 0.02, 0.06, d * 0.62]} c={c} r={0.03} />
          {w > 1.2 ? (
            <>
              <Soft p={[-w / 4, h + 0.11, -d / 2 + 0.3]} s={[w / 2 - 0.12, 0.13, 0.36]} c="#ffffff" r={0.06} />
              <Soft p={[w / 4, h + 0.11, -d / 2 + 0.3]} s={[w / 2 - 0.12, 0.13, 0.36]} c="#ffffff" r={0.06} />
            </>
          ) : (
            <Soft p={[0, h + 0.11, -d / 2 + 0.3]} s={[w - 0.2, 0.13, 0.36]} c="#ffffff" r={0.06} />
          )}
        </group>
      );
    }
    case 'mesa_noche':
    case 'comoda': {
      const drawers = f.type === 'comoda' ? 3 : 2;
      const dh = (h - 0.12) / drawers;
      return (
        <group>
          <Bx w={w} h={h - 0.08} d={d} y0={0.08} c={c} rough={0.55} />
          <Legs w={w} d={d} h={0.08} r={0.015} c={dark} />
          {Array.from({ length: drawers }, (_, i) => (
            <group key={i}>
              <Bx z={d / 2 + 0.005} w={w - 0.04} h={dh - 0.02} d={0.01} y0={0.1 + i * dh} c={shade(c, 1.08)} />
              <Bx z={d / 2 + 0.015} w={Math.min(0.2, w * 0.3)} h={0.015} d={0.015} y0={0.1 + i * dh + dh / 2} c={metal} metal={0.8} rough={0.3} />
            </group>
          ))}
        </group>
      );
    }
    case 'ropero': {
      const doors = Math.max(2, Math.round(w / 0.55));
      const dw = w / doors;
      return (
        <group>
          <Bx w={w} h={h} d={d} c={c} rough={0.55} />
          {Array.from({ length: doors }, (_, i) => (
            <group key={i}>
              <Bx x={-w / 2 + dw * (i + 0.5)} z={d / 2 + 0.005} w={dw - 0.01} h={h - 0.08} d={0.01} y0={0.04} c={shade(c, 1.06)} />
              <Bx x={-w / 2 + dw * (i + (i % 2 ? 0.12 : 0.88))} z={d / 2 + 0.02} w={0.02} h={0.3} d={0.02} y0={h / 2 - 0.15} c={metal} metal={0.8} rough={0.3} />
            </group>
          ))}
        </group>
      );
    }
    case 'cocina':
      return (
        <group>
          <Bx w={w} h={h - 0.02} d={d} c={c} metal={0.4} rough={0.35} />
          <Bx w={w} h={0.02} d={d} y0={h - 0.02} c="#111" rough={0.2} />
          {[-1, 1].flatMap((i) =>
            [-1, 1].map((j) => <Cyl key={`${i}${j}`} p={[(i * w) / 4, h + 0.005, (j * d) / 4]} r={Math.min(w, d) * 0.12} h={0.01} c="#333" metal={0.6} />),
          )}
          <Bx z={d / 2 + 0.005} w={w - 0.08} h={h * 0.5} d={0.01} y0={0.12} c="#1f2937" rough={0.15} opacity={0.85} />
          <Bx z={d / 2 + 0.03} w={w * 0.7} h={0.02} d={0.02} y0={h * 0.68} c={metal} metal={0.9} rough={0.2} />
        </group>
      );
    case 'refrigerador':
      return (
        <group>
          <Bx w={w} h={h} d={d} c={c} metal={0.3} rough={0.3} />
          <Bx z={d / 2 + 0.003} w={w} h={0.01} d={0.006} y0={h * 0.62} c="#9ca3af" />
          <Bx x={-w / 2 + 0.08} z={d / 2 + 0.03} w={0.025} h={h * 0.25} d={0.03} y0={h * 0.66} c={metal} metal={0.9} rough={0.2} />
          <Bx x={-w / 2 + 0.08} z={d / 2 + 0.03} w={0.025} h={h * 0.3} d={0.03} y0={h * 0.25} c={metal} metal={0.9} rough={0.2} />
        </group>
      );
    case 'encimera':
    case 'lavaplatos': {
      const doors = Math.max(1, Math.round(w / 0.5));
      const dw = w / doors;
      return (
        <group>
          <Bx w={w} h={h - 0.14} d={d - 0.04} y0={0.1} z={-0.02} c={c} rough={0.5} />
          <Bx w={w} h={0.1} d={d - 0.1} z={-0.05} c="#2a2a2a" />
          <Bx w={w + 0.01} h={0.04} d={d + 0.02} y0={h - 0.04} z={0.01} c="#3f3f46" rough={0.25} />
          {Array.from({ length: doors }, (_, i) => (
            <group key={i}>
              <Bx x={-w / 2 + dw * (i + 0.5)} z={d / 2 - 0.035} w={dw - 0.01} h={h - 0.2} d={0.02} y0={0.12} c={shade(c, 0.97)} rough={0.4} />
              <Bx x={-w / 2 + dw * (i + 0.5)} z={d / 2 - 0.015} w={dw * 0.4} h={0.015} d={0.02} y0={h - 0.16} c={metal} metal={0.9} rough={0.2} />
            </group>
          ))}
          {f.type === 'lavaplatos' && (
            <>
              <Bx x={-w * 0.12} w={w * 0.5} h={0.01} d={d * 0.6} y0={h - 0.005} c="#9ca3af" metal={0.9} rough={0.2} />
              <Bx x={-w * 0.12} w={w * 0.46} h={0.012} d={d * 0.54} y0={h - 0.004} c="#52525b" metal={0.8} rough={0.3} />
              <Cyl p={[-w * 0.12, h + 0.15, -d / 2 + 0.07]} r={0.015} h={0.3} c={metal} metal={0.9} rough={0.15} />
              <Bx x={-w * 0.12} z={-d / 2 + 0.15} w={0.025} h={0.025} d={0.18} y0={h + 0.28} c={metal} metal={0.9} rough={0.15} />
            </>
          )}
        </group>
      );
    }
    case 'inodoro':
      return (
        <group>
          <Bx z={-d / 2 + 0.1} w={w} h={0.4} d={0.2} y0={h - 0.4} c={c} rough={0.15} />
          <Cyl p={[0, 0.2, d * 0.06]} r={w * 0.38} r2={w * 0.3} h={0.4} c={c} rough={0.15} />
          <mesh position={[0, 0.41, d * 0.08]} scale={[1, 1, 1.25]} castShadow>
            <cylinderGeometry args={[w * 0.46, w * 0.46, 0.03, 32]} />
            <Mat c={c} rough={0.2} />
          </mesh>
        </group>
      );
    case 'lavamanos':
      return (
        <group>
          <Bx w={w * 0.9} h={h - 0.12} d={d * 0.85} z={-d * 0.07} c="#d6d3d1" rough={0.5} />
          <Bx w={w} h={0.12} d={d} y0={h - 0.12} c={c} rough={0.15} />
          <mesh position={[0, h - 0.015, 0.03]} scale={[1, 0.25, 0.8]}>
            <sphereGeometry args={[w * 0.32, 24, 12]} />
            <Mat c="#cbd5e1" rough={0.2} />
          </mesh>
          <Cyl p={[0, h + 0.08, -d / 2 + 0.06]} r={0.012} h={0.16} c={metal} metal={0.9} rough={0.15} />
          <Bx z={-d / 2 + 0.01} w={w * 0.9} h={0.7} d={0.015} y0={h + 0.3} c="#cfe8ff" metal={0.9} rough={0.05} />
        </group>
      );
    case 'ducha':
      return (
        <group>
          <Bx w={w} h={0.06} d={d} c="#f5f5f5" rough={0.2} />
          <Bx z={d / 2 - 0.005} w={w} h={h - 0.06} d={0.01} y0={0.06} c="#bfe3ff" opacity={0.25} rough={0.05} />
          <Bx x={w / 2 - 0.005} w={0.01} h={h - 0.06} d={d} y0={0.06} c="#bfe3ff" opacity={0.25} rough={0.05} />
          <Cyl p={[0, h - 0.4, -d / 2 + 0.03]} r={0.012} h={0.8} c={metal} metal={0.9} rough={0.15} />
          <Cyl p={[0, h - 0.02, -d / 2 + 0.12]} r={0.09} h={0.02} c={metal} metal={0.9} rough={0.15} />
        </group>
      );
    case 'tina': {
      const rim = 0.07;
      return (
        <group>
          <Bx w={w} h={0.08} d={d} c={c} rough={0.15} />
          <Bx z={-d / 2 + rim / 2} w={w} h={h} d={rim} c={c} rough={0.15} />
          <Bx z={d / 2 - rim / 2} w={w} h={h} d={rim} c={c} rough={0.15} />
          <Bx x={-w / 2 + rim / 2} w={rim} h={h} d={d} c={c} rough={0.15} />
          <Bx x={w / 2 - rim / 2} w={rim} h={h} d={d} c={c} rough={0.15} />
          <Bx w={w - 2 * rim} h={0.01} d={d - 2 * rim} y0={h * 0.55} c="#93c5fd" opacity={0.55} rough={0.05} />
          <Cyl p={[-w / 2 + 0.03, h + 0.1, 0]} r={0.012} h={0.2} c={metal} metal={0.9} rough={0.15} />
        </group>
      );
    }
    case 'planta': {
      const pot = Math.min(0.4, h * 0.3);
      const r = Math.min(w, d) / 2;
      return (
        <group>
          <Cyl p={[0, pot / 2, 0]} r={r * 0.7} r2={r * 0.5} h={pot} c="#b45309" rough={0.9} />
          <Cyl p={[0, pot - 0.01, 0]} r={r * 0.65} h={0.02} c="#3f2d1d" />
          <Cyl p={[0, pot + (h - pot) * 0.3, 0]} r={0.015} h={(h - pot) * 0.6} c="#4d3a22" />
          {[
            [0, 0.62, 0, 1],
            [0.35, 0.5, 0.2, 0.75],
            [-0.3, 0.55, -0.25, 0.7],
            [0.1, 0.8, -0.3, 0.65],
            [-0.2, 0.75, 0.3, 0.6],
          ].map(([x, y, z, s], i) => (
            <mesh key={i} position={[x * r, pot + (h - pot) * y, z * r]} castShadow>
              <icosahedronGeometry args={[r * 0.7 * s, 1]} />
              <Mat c={shade(c, 0.85 + i * 0.07)} rough={0.9} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'lampara':
      return (
        <group>
          <Cyl p={[0, 0.015, 0]} r={Math.min(w, d) * 0.4} h={0.03} c="#27272a" metal={0.6} />
          <Cyl p={[0, (h - 0.25) / 2, 0]} r={0.012} h={h - 0.25} c="#27272a" metal={0.6} />
          <mesh position={[0, h - 0.15, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.45, 0.3, 24, 1, true]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, h - 0.2, 0]} intensity={1.6} distance={5} color="#ffd9a0" />
        </group>
      );
    case 'escalera': {
      const n = Math.max(3, Math.round(h / 0.18));
      const rise = h / n;
      const run = d / n;
      return (
        <group>
          {Array.from({ length: n }, (_, i) => (
            <group key={i}>
              <Bx z={d / 2 - run * (i + 0.5)} w={w} h={rise * (i + 1) - 0.04} d={run} c={shade(c, 0.75)} />
              <Bx z={d / 2 - run * (i + 0.5)} w={w + 0.02} h={0.04} d={run + 0.02} y0={rise * (i + 1) - 0.04} c={c} rough={0.5} />
            </group>
          ))}
          <Railing w={w} d={d} h={h} />
        </group>
      );
    }
    case 'columna':
      return <Bx w={w} h={h} d={d} c={c} rough={0.8} />;
    default:
      return <Bx w={w} h={h} d={d} c={c} />;
  }
}

function Railing({ w, d, h }: { w: number; d: number; h: number }) {
  const len = Math.hypot(d, h);
  const ang = Math.atan2(h, d);
  return (
    <group position={[w / 2 - 0.03, 0, 0]}>
      <mesh position={[0, h / 2 + 0.9, 0]} rotation={[ang, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, len]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.3} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const t = (i + 0.5) / 5;
        const z = d / 2 - d * t;
        const y = h * t;
        return (
          <mesh key={i} position={[0, y + 0.45, z]}>
            <boxGeometry args={[0.025, 0.9, 0.025]} />
            <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

const BOOKS = ['#7f1d1d', '#1e3a8a', '#065f46', '#92400e', '#4c1d95', '#e5e7eb', '#111827', '#b45309', '#0f766e'];

function mulberry(seedStr: string) {
  let a = [...seedStr].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mueble posicionado en el mundo (x plano → x, y plano → z). */
export const FurnitureModel = memo(function FurnitureModel({ f, baseY }: { f: Furniture; baseY: number }) {
  const rotY = useMemo(() => (-f.rotation * Math.PI) / 180, [f.rotation]);
  return (
    <group position={[f.x, baseY + f.elevation, f.y]} rotation={[0, rotY, 0]}>
      <Model f={f} />
    </group>
  );
});
