import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Billboard, RoundedBox } from '@react-three/drei';
import type { Furniture } from '../types';
import { cellGrid, cellIndex } from '../geometry';
import { parsePipe, pipeStandLayout } from '../catalog';
import { CUTOUT_ALPHA, cutoutAsset, imageTexture, loadCutout, textTexture } from './textures';

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

// Geometría y materiales compartidos: un almacén puede tener miles de piezas.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map<string, THREE.MeshStandardMaterial>();

function sharedMat({ c, rough = 0.75, metal = 0, opacity, emissive }: MatProps) {
  const key = `${c}|${rough}|${metal}|${opacity}|${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: c,
      roughness: rough,
      metalness: metal,
      transparent: opacity !== undefined,
      opacity: opacity ?? 1,
      emissive: emissive ?? '#000000',
      emissiveIntensity: emissive ? 1 : 0,
      depthWrite: opacity === undefined,
    });
    materials.set(key, m);
  }
  return m;
}

/** Caja definida por su centro y tamaño. */
function B({ p, s, ...m }: { p: V3; s: V3 } & MatProps) {
  return <mesh position={p} scale={s} geometry={UNIT_BOX} material={sharedMat(m)} castShadow={m.opacity === undefined} receiveShadow />;
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

function Model({ f, ceil }: { f: Furniture; ceil?: number }) {
  const { w, d, h, color: c } = f;
  const dark = shade(c, 0.6);
  const metal = '#9ca3af';

  switch (f.type) {
    case 'rack':
      return <Rack f={f} />;
    case 'rack_custom':
      return <CustomRack f={f} />;
    case 'rack_tubos':
      return <PipeRack f={f} />;
    case 'rack_tubos_v':
      return <VerticalPipeRack f={f} />;
    case 'base_tubos':
      return <PipeStand f={f} />;
    case 'tarima_custom':
      return <CustomPallet f={f} />;
    case 'rampa_curva':
      return <CurvedRamp f={f} />;
    case 'escalera_metal':
      return <MetalStairs f={f} />;
    case 'escalera_vertical':
    case 'escalera_jaula':
      return <VerticalLadder f={f} />;
    case 'cerco':
      return <Fence f={f} />;
    case 'cerco_malla':
      return <MeshFence f={f} />;
    case 'barandal':
      return <Handrail f={f} />;
    case 'barrera':
      return <Barrier f={f} />;
    case 'mueble_tapa':
      return <LidBox f={f} />;
    case 'anuncio_torre':
    case 'anuncio_cuadro':
      return <LedAd f={f} />;
    case 'anuncio_poste':
      return <PoleAd f={f} />;
    case 'anuncio_relieve':
      return <CutoutSign f={f} />;
    case 'estanteria_metal':
      return <MetalShelf f={f} />;
    case 'cantilever':
      return <Cantilever f={f} />;
    case 'pallet':
      return <Pallet w={w} d={d} h={Math.min(h, 0.15)} />;
    case 'pallet_carga':
      return (
        <group>
          <Pallet w={w} d={d} h={0.15} />
          <Load w={w - 0.04} d={d - 0.04} h={Math.max(0.1, h - 0.15)} y0={0.15} c={c} seed={f.id} />
        </group>
      );
    case 'caja_carton':
      return (
        <group>
          <Bx w={w} h={h} d={d} c={c} rough={0.95} />
          <Bx w={w + 0.002} h={0.003} d={Math.min(0.06, d * 0.2)} y0={h} c="#a16207" rough={0.6} />
        </group>
      );
    case 'contenedor': {
      const t = 0.015;
      return (
        <group>
          <Bx w={w} h={t} d={d} c={c} rough={0.5} />
          <Bx z={-d / 2 + t / 2} w={w} h={h} d={t} c={c} rough={0.5} />
          <Bx z={d / 2 - t / 2} w={w} h={h} d={t} c={c} rough={0.5} />
          <Bx x={-w / 2 + t / 2} w={t} h={h} d={d} c={c} rough={0.5} />
          <Bx x={w / 2 - t / 2} w={t} h={h} d={d} c={c} rough={0.5} />
          <Bx z={d / 2 + 0.002} w={w * 0.4} h={h * 0.25} d={0.004} y0={h * 0.55} c="#ffffff" />
        </group>
      );
    }
    case 'montacargas':
      return <Forklift f={f} />;
    case 'transpaleta': {
      const body = 0.35;
      const forkL = d - 0.2 - body;
      return (
        <group>
          <Bx z={-d / 2 + 0.2 + body / 2} w={w} h={0.32} d={body} y0={0.05} c={c} rough={0.4} metal={0.3} />
          <Bx x={-w / 2 + 0.08} z={-d / 2 + 0.2 + body + forkL / 2} w={0.16} h={0.06} d={forkL} y0={0.03} c="#4b5563" metal={0.6} rough={0.4} />
          <Bx x={w / 2 - 0.08} z={-d / 2 + 0.2 + body + forkL / 2} w={0.16} h={0.06} d={forkL} y0={0.03} c="#4b5563" metal={0.6} rough={0.4} />
          <mesh position={[0, h / 2 + 0.2, -d / 2 + 0.22]} rotation={[-0.35, 0, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, h - 0.2, 10]} />
            <Mat c="#111827" />
          </mesh>
          <mesh position={[0, h, -d / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.1, 0.018, 8, 24]} />
            <Mat c="#111827" />
          </mesh>
          <Cyl p={[0, 0.08, -d / 2 + 0.3]} r={0.08} h={0.12} c="#111" />
        </group>
      );
    }
    case 'banda': {
      const n = Math.max(2, Math.ceil(w / 1.5));
      return (
        <group>
          {Array.from({ length: n + 1 }, (_, i) => {
            const x = -w / 2 + 0.1 + (i * (w - 0.2)) / n;
            return (
              <group key={i}>
                <Bx x={x} z={-d / 2 + 0.05} w={0.05} h={h - 0.1} d={0.05} c="#6b7280" metal={0.6} rough={0.4} />
                <Bx x={x} z={d / 2 - 0.05} w={0.05} h={h - 0.1} d={0.05} c="#6b7280" metal={0.6} rough={0.4} />
              </group>
            );
          })}
          <Bx z={-d / 2 + 0.025} w={w} h={0.14} d={0.05} y0={h - 0.14} c="#facc15" rough={0.5} />
          <Bx z={d / 2 - 0.025} w={w} h={0.14} d={0.05} y0={h - 0.14} c="#facc15" rough={0.5} />
          <Bx w={w - 0.02} h={0.04} d={d - 0.1} y0={h - 0.08} c={c} rough={0.9} />
          <Bx x={-w / 4} w={0.4} h={0.3} d={0.3} y0={h - 0.04} c="#c69c6d" rough={0.95} />
          <Bx x={w / 5} w={0.5} h={0.25} d={0.35} y0={h - 0.04} c="#b88a58" rough={0.95} />
        </group>
      );
    }
    case 'mesa_embalaje':
      return (
        <group>
          <Bx w={w} h={0.04} d={d} y0={h - 0.04} c="#d6c4a8" rough={0.6} />
          <Legs w={w} d={d} h={h - 0.04} r={0.025} c="#4b5563" />
          <Bx w={w - 0.1} h={0.02} d={d - 0.1} y0={0.25} c={c} metal={0.4} rough={0.5} />
          <Bx x={-w / 2 + 0.04} z={-d / 2 + 0.04} w={0.04} h={0.7} d={0.04} y0={h} c="#4b5563" />
          <Bx x={w / 2 - 0.04} z={-d / 2 + 0.04} w={0.04} h={0.7} d={0.04} y0={h} c="#4b5563" />
          <mesh position={[0, h + 0.62, -d / 2 + 0.04]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, w * 0.6, 24]} />
            <Mat c="#c69c6d" rough={0.9} />
          </mesh>
          <Bx x={w / 4} w={0.4} h={0.3} d={0.3} y0={h} c="#c69c6d" rough={0.95} />
        </group>
      );
    case 'bascula':
      return (
        <group>
          <Bx w={w} h={Math.max(0.05, h)} d={d} c={c} metal={0.7} rough={0.35} />
          <Bx x={-w / 2 - 0.15} z={-d / 2 + 0.1} w={0.06} h={1.1} d={0.06} c="#334155" />
          <Bx x={-w / 2 - 0.15} z={-d / 2 + 0.12} w={0.35} h={0.22} d={0.08} y0={1.05} c="#0f172a" />
          <Bx x={-w / 2 - 0.15} z={-d / 2 + 0.165} w={0.28} h={0.1} d={0.002} y0={1.1} c="#22c55e" emissive="#16a34a" />
        </group>
      );
    case 'malla':
      return (
        <group>
          <Bx x={-w / 2 + 0.03} w={0.06} h={h} d={0.06} c={c} rough={0.5} />
          <Bx x={w / 2 - 0.03} w={0.06} h={h} d={0.06} c={c} rough={0.5} />
          <Bx w={w} h={0.05} d={0.05} y0={h - 0.05} c={c} rough={0.5} />
          <Bx w={w} h={0.05} d={0.05} y0={0.1} c={c} rough={0.5} />
          <mesh position={[0, (h + 0.1) / 2, 0]}>
            <boxGeometry args={[w - 0.12, h - 0.2, 0.01, Math.max(4, Math.round(w / 0.08)), Math.max(4, Math.round(h / 0.08)), 1]} />
            <meshStandardMaterial color="#d4d4d8" wireframe metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      );
    case 'letrero':
    case 'letrero_pie':
      return <Sign f={f} ceil={ceil} />;
    case 'zona':
      return <Zone f={f} />;
    case 'extintor':
      return (
        <group>
          <Cyl p={[0, h * 0.42, 0]} r={Math.min(w, d) * 0.38} h={h * 0.8} c={c} rough={0.3} />
          <mesh position={[0, h * 0.82, 0]} castShadow>
            <sphereGeometry args={[Math.min(w, d) * 0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat c={c} rough={0.3} />
          </mesh>
          <Bx w={0.05} h={0.1} d={0.05} y0={h * 0.85} c="#111" />
          <Bx x={0.06} w={0.12} h={0.02} d={0.03} y0={h * 0.95} c="#111" />
          <Bx z={Math.min(w, d) * 0.38} w={Math.min(w, d) * 0.4} h={h * 0.25} d={0.005} y0={h * 0.35} c="#fff" />
        </group>
      );
    case 'cono':
      return (
        <group>
          <Bx w={w} h={0.03} d={d} c="#111827" />
          <Cyl p={[0, (h - 0.03) / 2 + 0.03, 0]} r={0.02} r2={Math.min(w, d) * 0.4} h={h - 0.03} c={c} rough={0.6} />
          <Cyl p={[0, h * 0.55, 0]} r={Math.min(w, d) * 0.19} r2={Math.min(w, d) * 0.23} h={h * 0.12} c="#ffffff" rough={0.4} />
        </group>
      );
    case 'bolardo':
      return (
        <group>
          <Cyl p={[0, h / 2, 0]} r={Math.min(w, d) / 2} h={h} c={c} rough={0.5} />
          {[0.25, 0.55, 0.85].map((t) => (
            <Cyl key={t} p={[0, h * t, 0]} r={Math.min(w, d) / 2 + 0.003} h={0.06} c="#111827" />
          ))}
        </group>
      );
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

// ---------------------------------------------------------------------------
// Logística
// ---------------------------------------------------------------------------

const WOOD = '#c8a26b';
const CARDBOARD = ['#c69c6d', '#b88a58', '#d2a979', '#a9784a'];

function Pallet({ w, d, h, y0 = 0 }: { w: number; d: number; h: number; y0?: number }) {
  const deck = Math.min(0.025, h * 0.2);
  const slats = Math.max(3, Math.round(w / 0.24));
  const sw = (w / slats) * 0.75;
  return (
    <group position={[0, y0, 0]}>
      {Array.from({ length: slats }, (_, i) => (
        <Bx key={i} x={-w / 2 + sw / 2 + (i * (w - sw)) / (slats - 1)} w={sw} h={deck} d={d} y0={h - deck} c={WOOD} rough={0.95} />
      ))}
      {[-1, 0, 1].map((k) => (
        <Bx key={k} z={(k * (d - 0.1)) / 2} w={w} h={h - deck * 2} d={0.1} y0={deck} c={shade(WOOD, 0.8)} rough={0.95} />
      ))}
      {[-1, 0, 1].map((k) => (
        <Bx key={`b${k}`} z={(k * (d - 0.1)) / 2} w={w} h={deck} d={0.1} c={shade(WOOD, 0.9)} rough={0.95} />
      ))}
    </group>
  );
}

/** Carga paletizada: cajas apiladas con film stretch. */
function Load({ w, d, h, y0, c, seed }: { w: number; d: number; h: number; y0: number; c: string; seed: string }) {
  const r = mulberry(seed);
  const nx = Math.max(1, Math.round(w / 0.4));
  const nz = Math.max(1, Math.round(d / 0.34));
  const ny = Math.max(1, Math.round(h / 0.32));
  const many = nx * ny * nz > 48;
  const bw = w / nx;
  const bd = d / nz;
  const bh = h / ny;
  return (
    <group position={[0, y0, 0]}>
      {many ? (
        <Bx w={w} h={h} d={d} c={c} rough={0.95} />
      ) : (
        Array.from({ length: ny }, (_, iy) =>
          Array.from({ length: nx }, (_, ix) =>
            Array.from({ length: nz }, (_, iz) => (
              <Bx
                key={`${ix}${iy}${iz}`}
                x={-w / 2 + bw * (ix + 0.5)}
                z={-d / 2 + bd * (iz + 0.5)}
                w={bw - 0.012}
                h={bh - 0.01}
                d={bd - 0.012}
                y0={iy * bh}
                c={iy === 0 && ix === 0 && iz === 0 ? c : shade(CARDBOARD[Math.floor(r() * CARDBOARD.length)], 0.92 + r() * 0.12)}
                rough={0.95}
              />
            )),
          ),
        )
      )}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.01, h + 0.005, d + 0.01]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.18} roughness={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Rack({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const levels = Math.max(1, Math.round(f.shelves ?? 4));
  const bays = Math.max(1, Math.round(w / 2.7));
  const bw = w / bays;
  const rows = d > 1.8 ? 2 : 1;
  const rd = (d - (rows - 1) * 0.15) / rows;
  const post = 0.08;
  const frame = '#1e3a8a';
  const s = h / (levels + 1);
  const loadH = Math.max(0.3, Math.min(1.45, s - 0.3));
  const r = mulberry(f.id);
  const slots = Math.max(1, Math.floor((bw - post) / 1.25));
  const slotW = (bw - post) / slots;

  const parts: React.ReactNode[] = [];
  for (let row = 0; row < rows; row++) {
    const zf = -d / 2 + row * (rd + 0.15);
    const zb = zf + rd;
    const zc = (zf + zb) / 2;
    // marcos (postes + travesaños)
    for (let i = 0; i <= bays; i++) {
      const x = Math.min(w / 2 - post / 2, Math.max(-w / 2 + post / 2, -w / 2 + i * bw));
      parts.push(<Bx key={`pf${row}-${i}`} x={x} z={zf + post / 2} w={post} h={h} d={post} c={frame} metal={0.5} rough={0.45} />);
      parts.push(<Bx key={`pb${row}-${i}`} x={x} z={zb - post / 2} w={post} h={h} d={post} c={frame} metal={0.5} rough={0.45} />);
      for (let y = 0.15; y < h; y += 1.2) {
        parts.push(<Bx key={`t${row}-${i}-${y}`} x={x} z={zc} w={0.03} h={0.04} d={rd - post} y0={y} c={frame} metal={0.5} rough={0.45} />);
      }
    }
    // largueros y pallets
    for (let b = 0; b < bays; b++) {
      const x0 = -w / 2 + b * bw + post / 2;
      const xc = x0 + (bw - post) / 2;
      for (let k = 1; k <= levels; k++) {
        const y = k * s;
        parts.push(<Bx key={`bf${row}-${b}-${k}`} x={xc} z={zf + 0.03} w={bw - post} h={0.11} d={0.05} y0={y - 0.11} c={color} metal={0.4} rough={0.45} />);
        parts.push(<Bx key={`bb${row}-${b}-${k}`} x={xc} z={zb - 0.03} w={bw - post} h={0.11} d={0.05} y0={y - 0.11} c={color} metal={0.4} rough={0.45} />);
      }
      for (let k = 0; k <= levels; k++) {
        const y = k * s;
        const lh = k === levels ? Math.min(loadH, Math.max(0, h - y - 0.1)) : loadH;
        if (lh < 0.2) continue;
        for (let sIdx = 0; sIdx < slots; sIdx++) {
          if (f.empty || r() > 0.82) continue;
          const px = x0 + post / 2 + slotW * (sIdx + 0.5);
          const pw = Math.min(1.2, slotW - 0.12);
          const pd = Math.min(1.0, rd - 0.1);
          const ch = lh * (0.55 + r() * 0.45);
          parts.push(<Bx key={`pl${row}-${b}-${k}-${sIdx}`} x={px} z={zc} w={pw} h={0.14} d={pd} y0={y} c={WOOD} rough={0.95} />);
          parts.push(<Bx key={`ld${row}-${b}-${k}-${sIdx}`} x={px} z={zc} w={pw - 0.04} h={ch} d={pd - 0.04} y0={y + 0.14} c={CARDBOARD[Math.floor(r() * CARDBOARD.length)]} rough={0.95} />);
          parts.push(<Bx key={`lb${row}-${b}-${k}-${sIdx}`} x={px} z={zc} w={pw - 0.03} h={0.05} d={pd - 0.03} y0={y + 0.14 + ch * 0.55} c="#e0f2fe" rough={0.3} opacity={0.5} />);
        }
      }
    }
  }
  return <group>{parts}</group>;
}

// tubo unitario acostado a lo largo de x: se escala a [largo, diámetro, diámetro]
const UNIT_PIPE = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2);

/** Rack alargado de brazos para tuberías; cada nivel lleva tubos de un material y diámetro (f.cells). */
function PipeRack({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const levels = Math.max(1, Math.round(f.shelves ?? 4));
  const cols = Math.max(2, Math.round(w / 1.5) + 1);
  const gapY = (h - 0.3) / levels;
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + 0.08 + (i * (w - 0.16)) / (cols - 1);
    parts.push(<Bx key={`c${i}`} x={x} z={-d / 2 + 0.06} w={0.1} h={h} d={0.12} c={color} metal={0.5} rough={0.45} />);
    parts.push(<Bx key={`f${i}`} x={x} w={0.1} h={0.1} d={d} c={color} metal={0.5} rough={0.45} />);
    for (let k = 0; k < levels; k++) {
      const y = 0.25 + k * gapY;
      parts.push(<Bx key={`a${i}-${k}`} x={x} w={0.07} h={0.07} d={d} y0={y - 0.07} c={shade(color, 0.85)} metal={0.5} rough={0.45} />);
      parts.push(<Bx key={`s${i}-${k}`} x={x} z={d / 2 - 0.03} w={0.07} h={0.16} d={0.05} y0={y - 0.07} c={shade(color, 0.85)} metal={0.5} rough={0.45} />);
    }
  }
  for (let k = 0; k < levels; k++) {
    const pipe = parsePipe(f.cells?.[k]);
    if (!pipe) continue;
    const y = 0.25 + k * gapY;
    const across = Math.max(1, Math.min(16, Math.floor((d - 0.24) / pipe.d)));
    const layers = Math.max(1, Math.min(3, Math.floor((gapY - 0.14) / pipe.d)));
    const mat = sharedMat({ c: pipe.material.color, metal: pipe.material.metal, rough: pipe.material.rough });
    for (let l = 0; l < layers; l++) {
      for (let j = 0; j < across - (l % 2); j++) {
        const z = -d / 2 + 0.16 + pipe.d / 2 + j * pipe.d + (l % 2) * (pipe.d / 2);
        parts.push(<mesh key={`p${k}-${l}-${j}`} position={[0, y + pipe.d / 2 + l * pipe.d * 0.87, z]} scale={[w * 1.03, pipe.d, pipe.d]} geometry={UNIT_PIPE} material={mat} castShadow />);
      }
    }
  }
  return <group>{parts}</group>;
}

const UNIT_PIPE_UP = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);

/**
 * Rack para tubos de pie: base encajonada que guarda el pie de los tubos, compartimentos
 * (uno por tipo de tubería, f.cells) y tope superior con barandal que evita que se vuelquen.
 */
function VerticalPipeRack({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const bays = Math.max(1, Math.round(f.shelves ?? 4));
  const bw = w / bays;
  const base = Math.min(0.4, h * 0.18);
  const t = 0.04;
  const dark = shade(color, 0.8);
  const steel = { metal: 0.5, rough: 0.45 };
  const parts: React.ReactNode[] = [
    // base encajonada: fondo, frente, respaldo y costados
    <Bx key="floor" w={w} h={t} d={d} c={dark} {...steel} />,
    <Bx key="front" z={d / 2 - t / 2} w={w} h={base} d={t} c={color} {...steel} />,
    <Bx key="back" z={-d / 2 + t / 2} w={w} h={base} d={t} c={color} {...steel} />,
    // tope superior: marco que rodea la punta de los tubos
    <Bx key="capF" z={d / 2 - t / 2} w={w} h={0.06} d={t} y0={h - 0.06} c={color} {...steel} />,
    <Bx key="capB" z={-d / 2 + t / 2} w={w} h={0.06} d={t} y0={h - 0.06} c={color} {...steel} />,
    // barandal de media altura al frente
    <Bx key="rail" z={d / 2 - t / 2} w={w} h={0.05} d={t} y0={base + (h - base) * 0.55} c="#facc15" {...steel} />,
  ];
  for (let i = 0; i <= bays; i++) {
    const x = Math.max(-w / 2 + t / 2, Math.min(w / 2 - t / 2, -w / 2 + i * bw));
    // divisor del cajón, postes de piso a tope y travesaño del tope
    parts.push(<Bx key={`div${i}`} x={x} w={t} h={base} d={d} c={color} {...steel} />);
    parts.push(<Bx key={`pb${i}`} x={x} z={-d / 2 + 0.03} w={0.06} h={h} d={0.06} c={color} {...steel} />);
    parts.push(<Bx key={`pf${i}`} x={x} z={d / 2 - 0.03} w={0.06} h={h} d={0.06} c={color} {...steel} />);
    parts.push(<Bx key={`cap${i}`} x={x} w={t} h={0.06} d={d} y0={h - 0.06} c={color} {...steel} />);
  }
  const len = h - t - 0.12;
  for (let b = 0; b < bays; b++) {
    const pipe = parsePipe(f.cells?.[b]);
    if (!pipe) continue;
    const nx = Math.max(1, Math.min(8, Math.floor((bw - 0.12) / pipe.d)));
    const nz = Math.max(1, Math.min(6, Math.floor((d - 0.14) / pipe.d)));
    const mat = sharedMat({ c: pipe.material.color, metal: pipe.material.metal, rough: pipe.material.rough });
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = -w / 2 + b * bw + bw / 2 + (ix - (nx - 1) / 2) * pipe.d;
        const z = (iz - (nz - 1) / 2) * pipe.d;
        parts.push(<mesh key={`p${b}-${ix}-${iz}`} position={[x, t + len / 2, z]} scale={[pipe.d, len, pipe.d]} geometry={UNIT_PIPE_UP} material={mat} castShadow />);
      }
    }
  }
  return <group>{parts}</group>;
}

// disco unitario acostado, visto desde arriba: la boca de un tubo
const UNIT_DISC = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);

/** Rollo de tubería flexible: vueltas apiladas alrededor de un pico. */
function Coil({ p, R, r, turns, layers, mat }: { p: V3; R: number; r: number; turns: number; layers: number; mat: THREE.Material }) {
  const rings = useMemo(() => Array.from({ length: layers }, (_, l) => new THREE.TorusGeometry(R - l * r * 1.9, r, 5, 18).rotateX(Math.PI / 2)), [R, r, layers]);
  useEffect(() => () => rings.forEach((g) => g.dispose()), [rings]);
  return (
    <group position={p}>
      {rings.flatMap((g, l) => Array.from({ length: turns }, (_, t) => <mesh key={`${l}-${t}`} position={[0, r + t * r * 1.94, 0]} geometry={g} material={mat} castShadow />))}
    </group>
  );
}

/**
 * Base redonda con picos para tubería suelta. Cada pico lleva lo que diga f.cells
 * («material:diámetro»): pedacería de pie alrededor del pico o, con «:r», rollos ensartados.
 */
function PipeStand({ f }: { f: Furniture }) {
  const { h, color } = f;
  const { R, n, ring, slot, pegs } = pipeStandLayout(f);
  const plate = Math.min(0.06, h * 0.12);
  const top = h - plate;
  const pegH = top * 0.7;
  const pegR = Math.max(0.008, Math.min(0.02, slot * 0.14));
  const dark = shade(color, 0.75);
  const steel = { metal: 0.5, rough: 0.45 };
  const pegMat = sharedMat({ c: '#cbd5e1', metal: 0.8, rough: 0.3 });
  const hole = sharedMat({ c: '#0b0f17', rough: 0.9 });
  const parts: React.ReactNode[] = [
    <Cyl key="plate" p={[0, plate / 2, 0]} r={R} h={plate} c={color} seg={48} {...steel} />,
    <Cyl key="mat" p={[0, plate + 0.004, 0]} r={R * 0.94} h={0.008} c={dark} seg={48} rough={0.9} />,
  ];
  // poste central con argolla para izar la base; solo si los picos le dejan sitio
  const post = Math.min(0.035, (ring - slot) * 0.7);
  if (n >= 3 && post >= 0.012) {
    parts.push(<Cyl key="post" p={[0, plate + (top - 0.1) / 2, 0]} r={post} h={top - 0.1} c={color} {...steel} />);
    parts.push(
      <mesh key="eye" position={[0, h - 0.06, 0]} castShadow>
        <torusGeometry args={[0.046, 0.014, 8, 20]} />
        <Mat c={color} {...steel} />
      </mesh>,
    );
  }
  pegs.forEach((peg, k) => {
    const x = peg.x;
    const z = peg.y;
    parts.push(<Cyl key={`foot${k}`} p={[x, plate + 0.012, z]} r={pegR * 2.4} h={0.024} c={dark} seg={14} {...steel} />);
    parts.push(<mesh key={`peg${k}`} position={[x, plate + pegH / 2, z]} scale={[pegR * 2, pegH, pegR * 2]} geometry={UNIT_PIPE_UP} material={pegMat} castShadow />);
    parts.push(<Cyl key={`tip${k}`} p={[x, plate + pegH + pegR * 1.5, z]} r={pegR * 0.15} r2={pegR} h={pegR * 3} c="#cbd5e1" metal={0.8} rough={0.3} seg={10} />);
    const pipe = parsePipe(f.cells?.[k]);
    if (!pipe) return;
    const mat = sharedMat({ c: pipe.material.color, metal: pipe.material.metal, rough: pipe.material.rough });
    const pr = pipe.d / 2;
    const rnd = mulberry(`${f.id}:${k}`);
    if (pipe.coil) {
      const coilR = Math.max(pegR + pr * 3, slot - pr);
      const layers = Math.max(1, Math.min(2, Math.floor((coilR - pegR - pr) / (pr * 1.9))));
      const turns = Math.max(2, Math.min(5, Math.round(0.12 / pipe.d)));
      const coilH = turns * pr * 1.94 + pr * 0.4;
      const count = Math.max(1, Math.min(Math.floor((pegH - 0.03) / coilH), 2 + Math.floor(rnd() * 2)));
      for (let i = 0; i < count; i++) parts.push(<Coil key={`coil${k}-${i}`} p={[x, plate + 0.01 + i * coilH, z]} R={coilR} r={pr} turns={turns} layers={layers} mat={mat} />);
      return;
    }
    // pedacería: un tramo ensartado en el pico (si cabe) y más tramos de pie a su alrededor
    const spots: [number, number][] = pr >= pegR + 0.004 ? [[0, 0]] : [];
    for (let i = 1; i <= 2; i++) {
      const rr = Math.max(i * pipe.d, pegR + pr + 0.003 + (i - 1) * pipe.d);
      if (rr + pr > slot) break;
      const m = Math.min(i * 6, Math.floor((2 * Math.PI * rr) / pipe.d));
      for (let j = 0; j < m; j++) {
        const a = (j / m) * 2 * Math.PI + i * 0.5;
        if (rnd() < 0.82) spots.push([rr * Math.cos(a), rr * Math.sin(a)]);
      }
    }
    if (!spots.length) spots.push([0, 0]);
    spots.forEach(([sx, sz], j) => {
      const len = top * (0.3 + 0.7 * rnd());
      parts.push(<mesh key={`p${k}-${j}`} position={[x + sx, plate + len / 2, z + sz]} scale={[pipe.d, len, pipe.d]} geometry={UNIT_PIPE_UP} material={mat} castShadow />);
      if (pr >= 0.02) parts.push(<mesh key={`h${k}-${j}`} position={[x + sx, plate + len + 0.0015, z + sz]} scale={[pipe.d * 0.76, 1, pipe.d * 0.76]} geometry={UNIT_DISC} material={hole} />);
    });
  });
  return <group>{parts}</group>;
}

/** Rack a medida: la carga de cada posición la decide el usuario (f.cells). */
function CustomRack({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const g = cellGrid(f);
  const levels = g.layers - 1;
  const post = 0.08;
  const frame = '#1e3a8a';
  const s = h / (levels + 1);
  const cw = (w - post) / g.cols;
  const bays = Math.max(1, Math.round(w / 2.7));
  const perBay = Math.max(1, Math.round(g.cols / bays));
  const loadH = Math.max(0.2, Math.min(1.45, s - 0.3));
  const parts: React.ReactNode[] = [];
  for (let c = 0; c <= g.cols; c++) {
    if (c % perBay !== 0 && c !== g.cols) continue;
    const x = -w / 2 + post / 2 + c * cw;
    for (const z of [-d / 2 + post / 2, d / 2 - post / 2]) parts.push(<Bx key={`p${c}${z}`} x={x} z={z} w={post} h={h} d={post} c={frame} metal={0.5} rough={0.45} />);
    for (let y = 0.15; y < h; y += 1.2) parts.push(<Bx key={`t${c}-${y}`} x={x} w={0.03} h={0.04} d={d - post} y0={y} c={frame} metal={0.5} rough={0.45} />);
  }
  for (let k = 1; k <= levels; k++) {
    for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) parts.push(<Bx key={`b${k}${z}`} z={z} w={w - post} h={0.11} d={0.05} y0={k * s - 0.11} c={color} metal={0.4} rough={0.45} />);
  }
  for (let k = 0; k < g.layers; k++) {
    for (let c = 0; c < g.cols; c++) {
      const box = f.cells?.[cellIndex(g, k, 0, c)];
      if (!box) continue;
      const x = -w / 2 + post / 2 + cw * (c + 0.5);
      const pw = Math.min(1.2, cw - 0.1);
      const pd = Math.min(1.0 * Math.max(1, Math.round(d / 1.1)), d - 0.1);
      parts.push(<Bx key={`pl${k}-${c}`} x={x} w={pw} h={0.14} d={pd} y0={k * s} c={WOOD} rough={0.95} />);
      parts.push(<Bx key={`ld${k}-${c}`} x={x} w={pw - 0.04} h={loadH} d={pd - 0.04} y0={k * s + 0.14} c={box} rough={0.9} />);
    }
  }
  return <group>{parts}</group>;
}

/** Tarima a medida: cajas del color elegido en cada posición y capa. */
function CustomPallet({ f }: { f: Furniture }) {
  const { w, d, h } = f;
  const g = cellGrid(f);
  const base = Math.min(0.15, h * 0.3);
  const bw = w / g.cols;
  const bd = d / g.rows;
  const bh = (h - base) / g.layers;
  const boxes: React.ReactNode[] = [];
  for (let l = 0; l < g.layers; l++) {
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const box = f.cells?.[cellIndex(g, l, r, c)];
        if (box) boxes.push(<Bx key={`${l}-${r}-${c}`} x={-w / 2 + bw * (c + 0.5)} z={-d / 2 + bd * (r + 0.5)} w={bw - 0.015} h={bh - 0.01} d={bd - 0.015} y0={base + l * bh} c={box} rough={0.9} />);
      }
    }
  }
  return (
    <group>
      <Pallet w={w} d={d} h={base} />
      {boxes}
    </group>
  );
}

/** Rampa en cuarto de círculo: arranca a nivel de piso en el frente y sube girando hasta h. */
function CurvedRamp({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const N = 20;
  const inner = 0.45;
  const geo = useMemo(() => {
    const pos: number[] = [];
    // centro del arco en la esquina frontal izquierda del objeto
    const pt = (i: number, r: number, y: number) => {
      const a = (i / N) * (Math.PI / 2);
      return [-w / 2 + r * Math.cos(a) * w, y, d / 2 - r * Math.sin(a) * d];
    };
    const quad = (a: number[], b: number[], c: number[], e: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    for (let i = 0; i < N; i++) {
      const y0 = (h * i) / N;
      const y1 = (h * (i + 1)) / N;
      quad(pt(i, inner, y0), pt(i, 1, y0), pt(i + 1, 1, y1), pt(i + 1, inner, y1)); // rodadura
      quad(pt(i, 1, 0), pt(i + 1, 1, 0), pt(i + 1, 1, y1), pt(i, 1, y0)); // cara exterior
      quad(pt(i + 1, inner, 0), pt(i, inner, 0), pt(i, inner, y0), pt(i + 1, inner, y1)); // cara interior
    }
    quad(pt(N, 1, 0), pt(N, inner, 0), pt(N, inner, h), pt(N, 1, h)); // remate alto
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, [w, d, h]);
  const posts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 5) * (Math.PI / 2);
    return { x: -w / 2 + 0.985 * Math.cos(a) * w, z: d / 2 - 0.985 * Math.sin(a) * d, y: (h * i) / 5 };
  });
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {posts.map((p, i) => (
        <group key={i}>
          <Bx x={p.x} z={p.z} w={0.07} h={1} d={0.07} y0={p.y} c="#facc15" metal={0.4} rough={0.5} />
          {i > 0 && <Beam a={[posts[i - 1].x, posts[i - 1].y + 1, posts[i - 1].z]} b={[p.x, p.y + 1, p.z]} t={0.06} c="#facc15" />}
          {i > 0 && <Beam a={[posts[i - 1].x, posts[i - 1].y + 0.5, posts[i - 1].z]} b={[p.x, p.y + 0.5, p.z]} t={0.04} c="#facc15" />}
        </group>
      ))}
    </group>
  );
}

/** Barra recta entre dos puntos. */
function Beam({ a, b, t, c }: { a: V3; b: V3; t: number; c: string }) {
  const { mid, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const dir = new THREE.Vector3(...b).sub(va);
    const l = dir.length();
    return { mid: va.clone().addScaledVector(dir, 0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize()), len: l };
  }, [a, b]);
  return <mesh position={mid} quaternion={quat} scale={[t, t, len]} geometry={UNIT_BOX} material={sharedMat({ c, metal: 0.5, rough: 0.4 })} castShadow />;
}

/** Escalera industrial: zancas, peldaños de rejilla y barandal a ambos lados. Sube hacia el fondo. */
function MetalStairs({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const n = Math.max(3, Math.round(h / 0.2));
  const rise = h / n;
  const run = d / n;
  const steel = '#6b7280';
  const sides = [-w / 2 + 0.03, w / 2 - 0.03];
  const bottom = (x: number, y: number): V3 => [x, y, d / 2];
  const top = (x: number, y: number): V3 => [x, h + y, -d / 2];
  const postCount = Math.max(2, Math.round(d / 1.1) + 1);
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <Bx key={i} z={d / 2 - run * (i + 0.5)} w={w - 0.08} h={0.035} d={run * 0.92} y0={rise * (i + 1) - 0.035} c={steel} metal={0.7} rough={0.55} />
      ))}
      {sides.map((x) => (
        <group key={x}>
          <Beam a={bottom(x, 0.05)} b={top(x, 0.05)} t={0.06} c={shade(color, 0.55)} />
          <Beam a={bottom(x, 1)} b={top(x, 1)} t={0.05} c={color} />
          <Beam a={bottom(x, 0.55)} b={top(x, 0.55)} t={0.035} c={color} />
          {Array.from({ length: postCount }, (_, i) => {
            const t = i / (postCount - 1);
            return <Bx key={i} x={x} z={d / 2 - d * t} w={0.045} h={1} d={0.045} y0={h * t} c={color} metal={0.5} rough={0.4} />;
          })}
        </group>
      ))}
    </group>
  );
}

/** Cara luminosa de un anuncio: la imagen subida o, si no hay, su texto. */
function LedFace({ f, w, h, y, z, back }: { f: Furniture; w: number; h: number; y: number; z: number; back?: boolean }) {
  const map = f.image ? imageTexture(f.image) : textTexture(f.label || 'TU ANUNCIO', '#ffffff', '#1d4ed8', w / h);
  return (
    <mesh position={[0, y, z]} rotation={[0, back ? Math.PI : 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.4} toneMapped={false} />
    </mesh>
  );
}

/** Torre de anuncio (tótem) o cuadro con luz LED; el anuncio se ve por ambas caras. */
function LedAd({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const tower = f.type === 'anuncio_torre';
  const base = tower ? Math.min(0.3, h * 0.08) : 0;
  const m = Math.min(0.1, w * 0.06);
  const pw = w - m * 2;
  const ph = h - base - m * 2;
  const py = base + m + ph / 2;
  return (
    <group>
      {tower && <Bx w={w + 0.2} h={base} d={d + 0.2} c="#374151" rough={0.9} />}
      <Bx w={w} h={h - base} d={d} y0={base} c={color} metal={0.4} rough={0.5} />
      {[1, -1].map((s) => (
        <group key={s}>
          {/* marco de luz LED alrededor del anuncio */}
          <B p={[0, py, s * (d / 2 + 0.001)]} s={[pw + 0.05, ph + 0.05, 0.004]} c="#ffffff" emissive="#e0f2fe" />
          <LedFace f={f} w={pw} h={ph} y={py} z={s * (d / 2 + 0.006)} back={s < 0} />
        </group>
      ))}
    </group>
  );
}

/** Rótulo en poste: tubo largo con el rótulo rectangular luminoso arriba (ancho × alto total). */
function PoleAd({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  // el rótulo ocupa la parte alta; el resto de la altura es tubo
  const sh = Math.min(h * 0.45, Math.max(0.6, w * 0.5));
  const y0 = h - sh;
  const r = Math.max(0.08, Math.min(0.35, w * 0.05));
  const m = Math.min(0.1, w * 0.04);
  const pw = w - m * 2;
  const ph = sh - m * 2;
  const py = y0 + sh / 2;
  return (
    <group>
      <Cyl p={[0, 0.03, 0]} r={r * 2.6} h={0.06} c="#374151" rough={0.8} seg={20} />
      <Cyl p={[0, (y0 + 0.1) / 2, 0]} r={r} h={y0 + 0.1} c="#9ca3af" metal={0.7} rough={0.35} seg={20} />
      <Bx w={w} h={sh} d={d} y0={y0} c={color} metal={0.4} rough={0.5} />
      {[1, -1].map((s) => (
        <group key={s}>
          <B p={[0, py, s * (d / 2 + 0.001)]} s={[pw + 0.05, ph + 0.05, 0.004]} c="#ffffff" emissive="#e0f2fe" />
          <LedFace f={f} w={pw} h={ph} y={py} z={s * (d / 2 + 0.006)} back={s < 0} />
        </group>
      ))}
    </group>
  );
}

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/** Figura recortada de la imagen de un rótulo con profundidad; null mientras se prepara. */
function useCutout(src?: string) {
  const [asset, setAsset] = useState(() => (src ? cutoutAsset(src) : null));
  useEffect(() => {
    let alive = true;
    setAsset(src ? cutoutAsset(src) : null);
    if (src && !cutoutAsset(src)) loadCutout(src).then((a) => alive && setAsset(a), () => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return asset;
}

/**
 * Rótulo con profundidad: la figura de una imagen sin fondo, con el grosor del objeto
 * (su profundidad) y el canto de su color. El reverso repite la imagen o, con «empty», va liso.
 */
function CutoutSign({ f }: { f: Furniture }) {
  const { w, h, color } = f;
  const d = Math.max(0.005, f.d);
  const asset = useCutout(f.image);
  if (!asset) {
    // sin imagen (o mientras se prepara) queda una placa con el aviso
    const map = textTexture(f.image ? 'PREPARANDO…' : 'ADJUNTA UNA IMAGEN', '#ffffff', '#334155', w / h);
    return (
      <group>
        <Bx w={w} h={h} d={d} c={color} />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, h / 2, s * (d / 2 + 0.002)]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial map={map} roughness={0.6} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group position={[0, h / 2, 0]}>
      <mesh scale={[w, h, d]} geometry={asset.sides} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, d / 2]} scale={[w, h, 1]} geometry={UNIT_PLANE} castShadow>
        <meshStandardMaterial map={asset.map} emissiveMap={asset.map} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.5} alphaTest={CUTOUT_ALPHA} alphaToCoverage />
      </mesh>
      {/* el reverso es la misma cara vista por detrás: comparte la silueta */}
      <mesh position={[0, 0, -d / 2]} scale={[w, h, 1]} geometry={UNIT_PLANE}>
        {f.empty ? (
          <meshStandardMaterial map={asset.mask} color={color} roughness={0.55} metalness={0.25} alphaTest={CUTOUT_ALPHA} alphaToCoverage side={THREE.BackSide} />
        ) : (
          <meshStandardMaterial map={asset.map} emissiveMap={asset.map} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.5} alphaTest={CUTOUT_ALPHA} alphaToCoverage side={THREE.BackSide} />
        )}
      </mesh>
    </group>
  );
}

/** Barandal industrial a medida: postes con placa, pasamanos, travesaños (f.shelves) y rodapié. */
function Handrail({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const t = Math.max(0.04, Math.min(d, 0.06));
  const panels = Math.max(1, Math.round(w / 1.5));
  const rails = Math.max(1, Math.min(6, Math.round(f.shelves ?? 2)));
  const parts: React.ReactNode[] = [];
  for (let i = 0; i <= panels; i++) {
    const x = Math.max(-w / 2 + t / 2, Math.min(w / 2 - t / 2, -w / 2 + (i * w) / panels));
    parts.push(<Bx key={`p${i}`} x={x} w={t} h={h} d={t} c={color} metal={0.4} rough={0.45} />);
    parts.push(<Bx key={`b${i}`} x={x} w={t * 2.6} h={0.012} d={t * 2.6} c={shade(color, 0.7)} metal={0.4} rough={0.5} />);
  }
  // pasamanos arriba y travesaños repartidos hasta el rodapié
  for (let k = 0; k < rails; k++) parts.push(<Bx key={`r${k}`} w={w} h={t} d={t} y0={h - t - (k * (h - 0.16)) / rails} c={color} metal={0.4} rough={0.45} />);
  parts.push(<Bx key="toe" w={w} h={0.1} d={0.012} y0={0.012} c={shade(color, 0.85)} metal={0.4} rough={0.5} />);
  return <group>{parts}</group>;
}

/** Barrera de protección baja contra golpes de montacargas: postes robustos y dos largueros. */
function Barrier({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const post = Math.max(0.1, Math.min(d, 0.16));
  const panels = Math.max(1, Math.round(w / 1.5));
  const parts: React.ReactNode[] = [];
  for (let i = 0; i <= panels; i++) {
    const x = Math.max(-w / 2 + post / 2, Math.min(w / 2 - post / 2, -w / 2 + (i * w) / panels));
    parts.push(<Bx key={`p${i}`} x={x} w={post} h={h} d={post} c={color} metal={0.3} rough={0.5} />);
    parts.push(<Bx key={`b${i}`} x={x} w={post * 1.8} h={0.015} d={post * 1.8} c="#1f2937" rough={0.6} />);
    parts.push(<Bx key={`s${i}`} x={x} w={post + 0.004} h={0.06} d={post + 0.004} y0={h * 0.72} c="#111827" rough={0.6} />);
  }
  for (const y of [h * 0.3, h - 0.14]) parts.push(<Bx key={`r${y}`} w={w} h={0.1} d={post * 0.7} y0={y} c={color} metal={0.3} rough={0.5} />);
  return <group>{parts}</group>;
}

/** Mueble o contenedor a medida con tapa; `empty` lo muestra con la tapa abierta. */
function LidBox({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const t = Math.min(0.03, w * 0.08, d * 0.08);
  const lid = Math.min(0.05, h * 0.12);
  const body = h - lid;
  const dark = shade(color, 0.8);
  return (
    <group>
      <Bx w={w} h={t} d={d} c={dark} />
      <Bx z={-d / 2 + t / 2} w={w} h={body} d={t} c={color} />
      <Bx z={d / 2 - t / 2} w={w} h={body} d={t} c={color} />
      <Bx x={-w / 2 + t / 2} w={t} h={body} d={d} c={color} />
      <Bx x={w / 2 - t / 2} w={t} h={body} d={d} c={color} />
      <Bx z={d / 2 + 0.008} w={Math.min(0.14, w * 0.2)} h={0.025} d={0.016} y0={body * 0.8} c="#d1d5db" metal={0.7} rough={0.3} />
      {/* la tapa gira sobre la arista del fondo */}
      <group position={[0, body, -d / 2]} rotation={[f.empty ? -1.75 : 0, 0, 0]}>
        <Bx z={d / 2} w={w + 0.02} h={lid} d={d + 0.02} c={dark} />
      </group>
    </group>
  );
}

/**
 * Escalera vertical (marina) fija al muro que queda a su espalda. Sube hasta `h`, donde un
 * soporte la une al muro o plataforma y los largueros siguen 1.1 m como pasamanos de salida.
 * La versión con jaula lleva además la protección circular (aros y pletinas) desde 2.2 m.
 */
function VerticalLadder({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const caged = f.type === 'escalera_jaula';
  const rail = 0.045;
  const back = -d / 2;
  // plano de la escalera, separado del muro
  const z0 = back + Math.min(0.2, d * 0.4);
  const half = Math.min(w, 0.6) / 2 - rail / 2;
  const top = h + 1.1;
  const steel = '#9ca3af';
  const parts: React.ReactNode[] = [];
  for (const x of [-half, half]) {
    // larguero y pasamanos de salida: sube, vuelve hacia el muro y baja al nivel de llegada
    parts.push(<Bx key={`r${x}`} x={x} z={z0} w={rail} h={top} d={rail} c={color} metal={0.5} rough={0.4} />);
    parts.push(<Beam key={`t${x}`} a={[x, top - rail / 2, z0]} b={[x, top - rail / 2, back]} t={rail} c={color} />);
    parts.push(<Beam key={`d${x}`} a={[x, top, back + rail / 2]} b={[x, h, back + rail / 2]} t={rail} c={color} />);
    // soporte de llegada y anclajes al muro
    parts.push(<Beam key={`s${x}`} a={[x, h - 0.02, z0]} b={[x, h - 0.02, back]} t={rail * 1.3} c={shade(color, 0.7)} />);
    for (let y = 1.2; y < h - 0.6; y += 1.5) parts.push(<Beam key={`a${x}-${y}`} a={[x, y, z0]} b={[x, y, back]} t={0.03} c={shade(color, 0.7)} />);
  }
  for (let y = 0.3; y <= h + 0.01; y += 0.3) parts.push(<Bx key={`p${y}`} z={z0} w={half * 2} h={0.025} d={0.03} y0={y - 0.0125} c={steel} metal={0.7} rough={0.4} />);
  parts.push(<Bx key="plate" z={(z0 + back) / 2} w={half * 2 + rail} h={0.03} d={z0 - back} y0={h - 0.03} c={steel} metal={0.6} rough={0.5} />);

  if (caged) {
    const r = Math.max(0.3, Math.min(0.45, (d / 2 - z0) / 2 + 0.05, w / 2 + 0.08));
    const cz = z0 + r - 0.05;
    const from = Math.min(2.2, h * 0.5);
    const hoops = Math.max(2, Math.round((top - from) / 0.9) + 1);
    for (let i = 0; i < hoops; i++) {
      const y = from + (i * (top - from)) / (hoops - 1);
      parts.push(
        <mesh key={`h${i}`} position={[0, y, cz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[r, 0.014, 6, 24]} />
          <Mat c={color} metal={0.5} rough={0.4} />
        </mesh>,
      );
    }
    // pletinas verticales que unen los aros por el frente y los costados
    for (const a of [0.25, 0.75, 1.25, 1.75, 2.25].map((k) => (k * Math.PI) / 2.5 - Math.PI / 2)) {
      const x = Math.sin(a) * r;
      const z = cz + Math.cos(a) * r;
      if (z < z0 + 0.05) continue;
      parts.push(<Bx key={`v${a}`} x={x} z={z} w={0.03} h={top - from} d={0.008} y0={from} c={color} metal={0.5} rough={0.4} />);
    }
  }
  return <group>{parts}</group>;
}

/** Cerco de malla metálica: postes cada 2.4 m, largueros y paños de malla. */
function MeshFence({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const t = Math.max(0.04, Math.min(d, 0.07));
  const panels = Math.max(1, Math.round(w / 2.4));
  const pw = w / panels;
  const wire = shade(color, 0.85);
  const parts: React.ReactNode[] = [];
  for (let i = 0; i <= panels; i++) {
    const x = Math.max(-w / 2 + t / 2, Math.min(w / 2 - t / 2, -w / 2 + i * pw));
    parts.push(<Bx key={`p${i}`} x={x} w={t} h={h} d={t} c={color} metal={0.6} rough={0.4} />);
  }
  for (const y of [0.06, h - 0.06]) parts.push(<Bx key={`r${y}`} w={w} h={0.04} d={0.04} y0={y} c={color} metal={0.6} rough={0.4} />);
  for (let p = 0; p < panels; p++) {
    parts.push(
      <mesh key={`m${p}`} position={[-w / 2 + pw * (p + 0.5), h / 2, 0]}>
        <boxGeometry args={[pw - t, h - 0.16, 0.008, Math.max(4, Math.round(pw / 0.09)), Math.max(4, Math.round(h / 0.09)), 1]} />
        <meshStandardMaterial color={wire} wireframe metalness={0.7} roughness={0.35} />
      </mesh>,
    );
  }
  return <group>{parts}</group>;
}

/** Cerco metálico de barrotes: postes, largueros y barrotes verticales. */
function Fence({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const t = Math.max(0.04, Math.min(d, 0.07));
  const panels = Math.max(1, Math.round(w / 2.4));
  const pw = w / panels;
  const bars = Math.max(2, Math.round(pw / 0.12));
  const parts: React.ReactNode[] = [];
  for (let i = 0; i <= panels; i++) {
    const x = Math.max(-w / 2 + t / 2, Math.min(w / 2 - t / 2, -w / 2 + i * pw));
    parts.push(<Bx key={`p${i}`} x={x} w={t} h={h} d={t} c={color} metal={0.3} rough={0.45} />);
    parts.push(<Bx key={`c${i}`} x={x} w={t + 0.02} h={0.02} d={t + 0.02} y0={h} c={color} metal={0.3} rough={0.45} />);
  }
  for (const y of [0.12, h - 0.14]) parts.push(<Bx key={`r${y}`} w={w} h={0.045} d={t * 0.6} y0={y} c={color} metal={0.3} rough={0.45} />);
  for (let p = 0; p < panels; p++) {
    for (let b = 1; b < bars; b++) {
      parts.push(<Bx key={`b${p}-${b}`} x={-w / 2 + p * pw + (pw * b) / bars} w={0.018} h={h - 0.26} d={0.018} y0={0.12} c={color} metal={0.3} rough={0.45} />);
    }
  }
  return <group>{parts}</group>;
}

function MetalShelf({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const n = Math.max(2, Math.round(f.shelves ?? 5));
  const gap = (h - 0.05) / (n - 1);
  const r = mulberry(f.id);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < n - 1; i++) {
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.2) {
      const iw = 0.2 + r() * 0.3;
      if (x + iw > w / 2 - 0.04) break;
      if (r() > 0.2) {
        const bin = r() > 0.5;
        items.push(
          <Bx
            key={`${i}-${x}`}
            x={x + iw / 2}
            w={iw - 0.02}
            h={Math.min(gap - 0.08, bin ? 0.2 : 0.15 + r() * (gap - 0.25))}
            d={d * (0.6 + r() * 0.3)}
            y0={i * gap + 0.03}
            c={bin ? ['#2563eb', '#dc2626', '#16a34a', '#f59e0b'][Math.floor(r() * 4)] : CARDBOARD[Math.floor(r() * 4)]}
            rough={bin ? 0.5 : 0.95}
          />,
        );
      }
      x += iw;
    }
  }
  if (f.empty) items.length = 0;
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Bx key={`${sx}${sz}`} x={sx * (w / 2 - 0.02)} z={sz * (d / 2 - 0.02)} w={0.04} h={h} d={0.04} c={shade(color, 0.7)} metal={0.6} rough={0.4} />),
      )}
      {Array.from({ length: n }, (_, i) => (
        <Bx key={i} w={w} h={0.025} d={d} y0={i * gap} c={color} metal={0.5} rough={0.45} />
      ))}
      {items}
    </group>
  );
}

function Cantilever({ f }: { f: Furniture }) {
  const { w, d, h, color } = f;
  const levels = Math.max(1, Math.round(f.shelves ?? 4));
  const cols = Math.max(2, Math.round(w / 1.2) + 1);
  const r = mulberry(f.id);
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + 0.08 + (i * (w - 0.16)) / (cols - 1);
    parts.push(<Bx key={`c${i}`} x={x} w={0.14} h={h} d={0.2} c={color} metal={0.4} rough={0.5} />);
    parts.push(<Bx key={`f${i}`} x={x} w={0.14} h={0.12} d={d} c={color} metal={0.4} rough={0.5} />);
    for (let k = 1; k <= levels; k++) {
      const y = (k * h) / (levels + 0.3);
      parts.push(<Bx key={`a${i}-${k}`} x={x} w={0.08} h={0.08} d={d} y0={y} c={shade(color, 0.85)} metal={0.4} rough={0.5} />);
    }
  }
  for (let k = 0; k <= levels; k++) {
    const y = k === 0 ? 0.12 : (k * h) / (levels + 0.3) + 0.08;
    for (const side of [-1, 1]) {
      if (r() > 0.75) continue;
      const tubes = 3 + Math.floor(r() * 4);
      for (let t = 0; t < tubes; t++) {
        parts.push(
          <mesh key={`t${k}-${side}-${t}`} position={[0, y + 0.05, side * (0.18 + t * 0.09)]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, w * 1.02, 10]} />
            <Mat c={t % 2 ? '#9ca3af' : '#6b7280'} metal={0.8} rough={0.35} />
          </mesh>,
        );
      }
    }
  }
  return <group>{parts}</group>;
}

function Forklift({ f }: { f: Furniture }) {
  const { w, d, h, color: c } = f;
  const L = Math.min(d * 0.66, 2.2);
  const zb = -d / 2;
  const zm = zb + L;
  const dark = '#1f2937';
  const forkL = Math.max(0.3, d / 2 - (zm + 0.15));
  const wheel = (x: number, z: number, r: number) => (
    <mesh key={`${x}${z}`} position={[x, r, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[r, r, 0.22, 20]} />
      <Mat c="#111" rough={0.9} />
    </mesh>
  );
  return (
    <group>
      <Bx z={zb + L / 2} w={w} h={0.55} d={L} y0={0.18} c={c} rough={0.45} metal={0.2} />
      <Bx z={zb + 0.3} w={w} h={0.55} d={0.6} y0={0.6} c={shade(c, 0.85)} rough={0.45} />
      <Bx z={zb + L * 0.5} w={0.5} h={0.1} d={0.45} y0={0.75} c={dark} />
      <Bx z={zb + L * 0.35} w={0.5} h={0.45} d={0.08} y0={0.8} c={dark} />
      <mesh position={[0, 1.15, zb + L * 0.72]} rotation={[-0.9, 0, 0]}>
        <torusGeometry args={[0.16, 0.02, 8, 24]} />
        <Mat c={dark} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [zb + 0.45, zm - 0.25].map((z) => <Bx key={`g${sx}${z}`} x={sx * (w / 2 - 0.05)} z={z} w={0.06} h={h - 0.73} d={0.06} y0={0.73} c={dark} metal={0.5} />),
      )}
      <Bx z={(zb + 0.45 + zm - 0.25) / 2} w={w} h={0.05} d={zm - 0.25 - (zb + 0.45) + 0.1} y0={h - 0.05} c={dark} metal={0.5} />
      <Cyl p={[0, h + 0.05, zb + 0.5]} r={0.07} h={0.1} c="#f97316" emissive="#f97316" />
      {[-0.32, 0.32].map((x) => (
        <Bx key={`m${x}`} x={x} z={zm + 0.05} w={0.08} h={h + 0.3} d={0.1} y0={0.05} c="#374151" metal={0.6} rough={0.35} />
      ))}
      <Bx z={zm + 0.05} w={0.72} h={0.08} d={0.08} y0={h + 0.25} c="#374151" metal={0.6} />
      <Bx z={zm + 0.13} w={0.95} h={0.55} d={0.05} y0={0.1} c="#4b5563" metal={0.6} rough={0.35} />
      {[-0.3, 0.3].map((x) => (
        <Bx key={`fk${x}`} x={x} z={zm + 0.15 + forkL / 2} w={0.12} h={0.05} d={forkL} y0={0.08} c="#4b5563" metal={0.7} rough={0.3} />
      ))}
      {wheel(-(w / 2 - 0.08), zm - 0.35, 0.27)}
      {wheel(w / 2 - 0.08, zm - 0.35, 0.27)}
      {wheel(-(w / 2 - 0.08), zb + 0.4, 0.22)}
      {wheel(w / 2 - 0.08, zb + 0.4, 0.22)}
    </group>
  );
}

function Sign({ f, ceil }: { f: Furniture; ceil?: number }) {
  const { w, d, h, color } = f;
  const text = f.label || f.name;
  const hanging = f.type === 'letrero';
  const panelH = hanging ? h : Math.min(0.6, h * 0.4);
  const py = hanging ? h / 2 : h - panelH / 2;
  const t = Math.max(0.02, Math.min(d, 0.08));
  const map = textTexture(text, '#ffffff', color, w / panelH);
  // los tirantes del letrero colgante llegan justo al techo del nivel (1 m si no hay techo conocido)
  const rod = ceil === undefined ? 1 : Math.max(0, ceil - f.elevation - h);
  return (
    <group>
      <Bx w={w} h={panelH} d={t} y0={py - panelH / 2} c={shade(color, 0.8)} />
      <mesh position={[0, py, t / 2 + 0.002]}>
        <planeGeometry args={[w, panelH]} />
        <meshStandardMaterial map={map} roughness={0.5} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, py, -t / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, panelH]} />
        <meshStandardMaterial map={map} roughness={0.5} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.25} />
      </mesh>
      {hanging ? (
        rod > 0.02 && [-1, 1].map((sx) => <Cyl key={sx} p={[sx * w * 0.35, h + rod / 2, 0]} r={0.008} h={rod} c="#6b7280" metal={0.8} />)
      ) : (
        <>
          <Cyl p={[0, (h - panelH) / 2, 0]} r={0.035} h={h - panelH} c="#374151" metal={0.6} rough={0.4} />
          <Cyl p={[0, 0.02, 0]} r={0.25} h={0.04} c="#374151" metal={0.6} rough={0.4} />
        </>
      )}
    </group>
  );
}

function Zone({ f }: { f: Furniture }) {
  const { w, d, color } = f;
  const text = f.label || f.name;
  const tw = w * 0.85;
  const th = Math.max(0.2, Math.min(d * 0.35, (tw * 1.6) / Math.max(4, text.length)));
  const map = textTexture(text, color, null, tw / th);
  const b = Math.min(0.12, Math.min(w, d) * 0.05);
  const stripes = [
    [0, -d / 2 + b / 2, w, b],
    [0, d / 2 - b / 2, w, b],
    [-w / 2 + b / 2, 0, b, d],
    [w / 2 - b / 2, 0, b, d],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={color} transparent opacity={0.22} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {stripes.map(([x, z, sw, sd], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, z]} receiveShadow renderOrder={2}>
          <planeGeometry args={[sw, sd]} />
          <meshStandardMaterial color={color} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} renderOrder={3}>
        <planeGeometry args={[tw, th]} />
        <meshStandardMaterial map={map} transparent depthWrite={false} roughness={0.6} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </group>
  );
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

/** Rótulo con el nombre del objeto, siempre de frente a la cámara. */
function NameTag({ f, ceil }: { f: Furniture; ceil?: number }) {
  const aspect = Math.max(2, Math.min(9, f.name.length * 0.5));
  const h = 0.55;
  const map = textTexture(f.name, '#ffffff', '#0f172a', aspect);
  return (
    // sobre el objeto, pero sin pasar del techo del nivel
    <Billboard position={[0, ceil === undefined ? f.h + 0.5 : Math.min(f.h + 0.5, Math.max(0.4, ceil - f.elevation - 0.35)), 0]}>
      <mesh>
        <planeGeometry args={[h * aspect, h]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

/** Mueble posicionado en el mundo (x plano → x, y plano → z). */
export const FurnitureModel = memo(function FurnitureModel({ f, baseY, ceil }: { f: Furniture; baseY: number; /** altura del techo del nivel sobre su piso */ ceil?: number }) {
  const rotY = useMemo(() => (-f.rotation * Math.PI) / 180, [f.rotation]);
  return (
    <group position={[f.x, baseY + f.elevation, f.y]} rotation={[0, rotY, 0]}>
      <Model f={f} ceil={ceil} />
      {f.showName && f.name.trim() && <NameTag f={f} ceil={ceil} />}
    </group>
  );
});
