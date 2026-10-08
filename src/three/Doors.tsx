import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { DoorPlacement } from '../geometry';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const OPEN = (78 * Math.PI) / 180;

const STYLE = {
  madera: { frame: '#5b3a21', leaf: '#8b5e3c' },
  metal: { frame: '#4b5563', leaf: '#9ca3af' },
  vidrio: { frame: '#cbd5e1', leaf: '#cfeaff' },
  malla: { frame: '#94a3b8', leaf: '#cbd5e1' },
};

function Box({ p, s, c, metal = 0, rough = 0.7 }: { p: [number, number, number]; s: [number, number, number]; c: string; metal?: number; rough?: number }) {
  return (
    <mesh position={p} scale={s} geometry={BOX} castShadow receiveShadow>
      <meshStandardMaterial color={c} metalness={metal} roughness={rough} />
    </mesh>
  );
}

/** Hoja abatible de ancho w que parte de la bisagra (x = 0) hacia +x. */
function Leaf({ w, h, style }: { w: number; h: number; style: DoorPlacement['style'] }) {
  const c = STYLE[style];
  const t = 0.045;
  if (style === 'vidrio') {
    const f = 0.06;
    return (
      <group>
        <mesh position={[w / 2, h / 2, 0]}>
          <boxGeometry args={[w - f * 2, h - f * 2, 0.012]} />
          <meshPhysicalMaterial color={c.leaf} transparent opacity={0.3} roughness={0.05} metalness={0.1} depthWrite={false} />
        </mesh>
        <Box p={[f / 2, h / 2, 0]} s={[f, h, t]} c={c.frame} metal={0.7} rough={0.3} />
        <Box p={[w - f / 2, h / 2, 0]} s={[f, h, t]} c={c.frame} metal={0.7} rough={0.3} />
        <Box p={[w / 2, f / 2, 0]} s={[w, f, t]} c={c.frame} metal={0.7} rough={0.3} />
        <Box p={[w / 2, h - f / 2, 0]} s={[w, f, t]} c={c.frame} metal={0.7} rough={0.3} />
        <Box p={[w - 0.12, h * 0.48, 0]} s={[0.03, 0.4, t + 0.06]} c="#64748b" metal={0.8} rough={0.25} />
      </group>
    );
  }
  if (style === 'malla') {
    const f = 0.045;
    return (
      <group>
        <mesh position={[w / 2, h / 2, 0]}>
          <boxGeometry args={[w - f * 2, h - f * 2, 0.008, Math.max(3, Math.round(w / 0.09)), Math.max(4, Math.round(h / 0.09)), 1]} />
          <meshStandardMaterial color={c.leaf} wireframe metalness={0.7} roughness={0.35} />
        </mesh>
        <Box p={[f / 2, h / 2, 0]} s={[f, h, f]} c={c.frame} metal={0.6} rough={0.4} />
        <Box p={[w - f / 2, h / 2, 0]} s={[f, h, f]} c={c.frame} metal={0.6} rough={0.4} />
        <Box p={[w / 2, f / 2 + 0.05, 0]} s={[w, f, f]} c={c.frame} metal={0.6} rough={0.4} />
        <Box p={[w / 2, h - f / 2, 0]} s={[w, f, f]} c={c.frame} metal={0.6} rough={0.4} />
        <Box p={[w / 2, h / 2, 0]} s={[w, f * 0.8, f * 0.8]} c={c.frame} metal={0.6} rough={0.4} />
      </group>
    );
  }
  const metal = style === 'metal';
  const inset = Math.min(0.12, w * 0.15);
  return (
    <group>
      <Box p={[w / 2, h / 2, 0]} s={[w, h, t]} c={c.leaf} metal={metal ? 0.6 : 0} rough={metal ? 0.45 : 0.75} />
      {/* tableros (madera) o refuerzos (metal) */}
      {(metal ? [0.25, 0.5, 0.75] : [0.27, 0.73]).map((k) => (
        <Box key={k} p={[w / 2, h * k, 0]} s={[w - inset * 2, metal ? 0.05 : h * 0.36, t + 0.012]} c={metal ? '#6b7280' : '#7a4f30'} metal={metal ? 0.6 : 0} rough={0.6} />
      ))}
      <Box p={[w - 0.09, h * 0.47, 0]} s={[0.035, 0.14, t + 0.09]} c={metal ? '#1f2937' : '#d4af37'} metal={0.8} rough={0.3} />
    </group>
  );
}

/** Cortina metálica enrollable recogida arriba (portones y andenes). */
function RollUp({ w, h, depth }: { w: number; h: number; depth: number }) {
  const drop = h * 0.28;
  const slats = Math.max(3, Math.round(drop / 0.1));
  const parts: ReactNode[] = [<Box key="drum" p={[w / 2, h - 0.14, 0]} s={[w, 0.28, Math.max(depth, 0.3)]} c="#4b5563" metal={0.6} rough={0.4} />];
  for (let i = 0; i < slats; i++) parts.push(<Box key={i} p={[w / 2, h - 0.28 - (drop * (i + 0.5)) / slats, 0]} s={[w - 0.1, drop / slats - 0.012, 0.03]} c={i % 2 ? '#9ca3af' : '#a8b0bb'} metal={0.6} rough={0.4} />);
  for (const x of [0.04, w - 0.04]) parts.push(<Box key={`g${x}`} p={[x, h / 2, 0]} s={[0.08, h, 0.09]} c="#4b5563" metal={0.6} rough={0.4} />);
  return <group>{parts}</group>;
}

/**
 * Puerta dentro de su vano, entreabierta para poder pasar en el recorrido: marco
 * ajustado al grosor del muro (o postes, si es un cerco) y una o dos hojas según el ancho.
 */
export function Door({ d, y }: { d: DoorPlacement; y: number }) {
  const dx = d.b.x - d.a.x;
  const dz = d.b.y - d.a.y;
  const w = Math.hypot(dx, dz);
  const h = d.height;
  const angle = -Math.atan2(dz, dx);
  // hacia qué lado local (+z o −z) queda el interior del ambiente
  const side = -dz * d.inward.x + dx * d.inward.y > 0 ? 1 : -1;
  const c = STYLE[d.style];
  const jamb = 0.06;
  const depth = d.fence ? 0.07 : d.depth + 0.03;
  const inner = w - jamb * 2;

  let leaves: ReactNode;
  if (d.style === 'metal' && w > 2.4) {
    leaves = <RollUp w={w} h={h} depth={d.depth} />;
  } else if (inner > 1.5) {
    leaves = (
      <>
        <group position={[jamb, 0, 0]} rotation={[0, -side * OPEN, 0]}>
          <Leaf w={inner / 2} h={h - jamb} style={d.style} />
        </group>
        <group position={[w - jamb, 0, 0]} rotation={[0, Math.PI + side * OPEN, 0]}>
          <Leaf w={inner / 2} h={h - jamb} style={d.style} />
        </group>
      </>
    );
  } else {
    leaves = (
      <group position={[jamb, 0, 0]} rotation={[0, -side * OPEN, 0]}>
        <Leaf w={inner} h={h - jamb} style={d.style} />
      </group>
    );
  }

  return (
    <group position={[d.a.x, y, d.a.y]} rotation={[0, angle, 0]}>
      <Box p={[jamb / 2, h / 2, 0]} s={[jamb, h, depth]} c={c.frame} metal={d.style === 'madera' ? 0 : 0.6} rough={0.5} />
      <Box p={[w - jamb / 2, h / 2, 0]} s={[jamb, h, depth]} c={c.frame} metal={d.style === 'madera' ? 0 : 0.6} rough={0.5} />
      {!d.fence && <Box p={[w / 2, h - jamb / 2, 0]} s={[w, jamb, depth]} c={c.frame} metal={d.style === 'madera' ? 0 : 0.6} rough={0.5} />}
      {leaves}
    </group>
  );
}
