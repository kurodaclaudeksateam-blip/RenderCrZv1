import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DURATION = 5; // segundos

// Plano de una casa irregular (metros) que se "arma" en la animación
const ROOMS: [number, number][][] = [
  [[0, 0], [7, 0], [7, 5], [4.5, 5], [4.5, 6.5], [0, 6.5]],
  [[7, 0], [10.5, 0], [10.5, 3.5], [7, 3.5]],
  [[7, 3.5], [10.5, 3.5], [10.5, 5], [7, 5]],
  [[4.5, 5], [10.5, 5], [9, 8], [4.5, 8]],
  [[0, 6.5], [4.5, 6.5], [4.5, 9.5], [1.5, 9.5], [0, 8]],
];
const CX = 5.25;
const CZ = 4.75;
const WALL = 2.6;

interface TubeSpec {
  curve: THREE.Curve<THREE.Vector3>;
  color: THREE.Color;
  start: number; // segundos
  dur: number;
  radius: number;
}

function buildTubes(): TubeSpec[] {
  const tubes: TubeSpec[] = [];
  const seen = new Set<string>();
  const verts = new Map<string, THREE.Vector3>();
  let i = 0;
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  for (const room of ROOMS) {
    room.forEach((p, k) => {
      const q = room[(k + 1) % room.length];
      const key = [p.join(','), q.join(',')].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const a = new THREE.Vector3(p[0] - CX, 0, p[1] - CZ);
      const b = new THREE.Vector3(q[0] - CX, 0, q[1] - CZ);
      edges.push([a, b]);
      verts.set(p.join(','), a);
      verts.set(q.join(','), b);
    });
  }
  const n = edges.length;
  // 1) contorno del plano a ras de piso: tubos de colores que se dibujan en cadena
  edges.forEach(([a, b]) => {
    tubes.push({
      curve: new THREE.LineCurve3(a, b),
      color: new THREE.Color().setHSL((i / n) * 0.85, 0.9, 0.58),
      start: 0.15 + (i / n) * 1.9,
      dur: 0.7,
      radius: 0.09,
    });
    i++;
  });
  // 2) columnas que suben desde cada vértice
  [...verts.values()].forEach((v, k, arr) => {
    tubes.push({
      curve: new THREE.LineCurve3(v, v.clone().setY(WALL)),
      color: new THREE.Color().setHSL(0.5 + (k / arr.length) * 0.4, 0.95, 0.62),
      start: 2.3 + (k / arr.length) * 0.6,
      dur: 0.6,
      radius: 0.06,
    });
  });
  // 3) contorno superior
  edges.forEach(([a, b], k) => {
    tubes.push({
      curve: new THREE.LineCurve3(a.clone().setY(WALL), b.clone().setY(WALL)),
      color: new THREE.Color().setHSL(0.75 + (k / n) * 0.3, 0.9, 0.62),
      start: 3.0 + (k / n) * 0.9,
      dur: 0.5,
      radius: 0.07,
    });
  });
  // 4) arcos de "trazado" que flotan sobre el plano
  for (let k = 0; k < 6; k++) {
    const a = edges[(k * 5) % n][0];
    const b = edges[(k * 7 + 3) % n][1];
    const mid = a.clone().lerp(b, 0.5).setY(3.5 + k * 0.4);
    tubes.push({
      curve: new THREE.QuadraticBezierCurve3(a.clone().setY(0.1), mid, b.clone().setY(0.1)),
      color: new THREE.Color().setHSL(k / 6, 1, 0.65),
      start: 0.6 + k * 0.35,
      dur: 1.2,
      radius: 0.025,
    });
  }
  return tubes;
}

function Tube({ spec, clock }: { spec: TubeSpec; clock: React.MutableRefObject<number> }) {
  const segs = spec.curve instanceof THREE.LineCurve3 ? 24 : 64;
  const radial = 12;
  const geo = useMemo(() => new THREE.TubeGeometry(spec.curve, segs, spec.radius, radial, false), [spec, segs]);
  const tip = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const total = segs * radial * 6;

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const t = Math.min(1, Math.max(0, (clock.current - spec.start) / spec.dur));
    const e = 1 - Math.pow(1 - t, 3);
    geo.setDrawRange(0, Math.floor((total * e) / (radial * 6)) * radial * 6);
    if (tip.current) {
      tip.current.visible = t > 0 && t < 1;
      tip.current.position.copy(spec.curve.getPoint(e));
    }
    if (mat.current) mat.current.emissiveIntensity = 0.6 + (1 - t) * 1.6;
  });

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial ref={mat} color={spec.color} emissive={spec.color} emissiveIntensity={1} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh ref={tip} visible={false}>
        <sphereGeometry args={[spec.radius * 2.2, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function FloorGlow({ clock }: { clock: React.MutableRefObject<number> }) {
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const geos = useMemo(
    () =>
      ROOMS.map((r) => {
        const s = new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x - CX, -(y - CZ))));
        const g = new THREE.ShapeGeometry(s);
        g.rotateX(-Math.PI / 2);
        return g;
      }),
    [],
  );
  useFrame(() => {
    mats.current.forEach((m, i) => {
      const t = Math.min(1, Math.max(0, (clock.current - 1.6 - i * 0.25) / 1));
      m.opacity = t * 0.22;
    });
  });
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0.01, 0]}>
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color={new THREE.Color().setHSL(i / ROOMS.length, 0.8, 0.6)}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Scene({ clock }: { clock: React.MutableRefObject<number> }) {
  const tubes = useMemo(buildTubes, []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    const t = clock.current;
    // cámara: comienza cenital y baja en espiral hacia una vista en perspectiva
    const k = Math.min(1, t / DURATION);
    const e = k * k * (3 - 2 * k);
    const ang = -0.6 + t * 0.35;
    const r = 17 - e * 2;
    const h = 20 - e * 9;
    camera.position.set(Math.sin(ang) * r * e + 0.001, h, Math.cos(ang) * r * e + 0.001 + (1 - e) * 0.5);
    camera.lookAt(0, -2.2 * e, 0);
  });
  return (
    <group ref={group}>
      <gridHelper args={[60, 60, '#1e3a5f', '#13233a']} position={[0, -0.01, 0]} />
      <FloorGlow clock={clock} />
      {tubes.map((s, i) => (
        <Tube key={i} spec={s} clock={clock} />
      ))}
    </group>
  );
}

export default function Intro({ onStart }: { onStart: () => void }) {
  const clock = useRef(0);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), DURATION * 1000);
    return () => clearTimeout(t);
  }, []);

  const start = () => {
    setLeaving(true);
    setTimeout(onStart, 450);
  };

  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`}>
      <Canvas dpr={[1, 2]} camera={{ fov: 45, position: [0, 20, 0.5] }}>
        <color attach="background" args={['#050b16']} />
        <fog attach="fog" args={['#050b16', 18, 45]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 8, 0]} intensity={60} color="#7dd3fc" />
        <pointLight position={[8, 4, 8]} intensity={40} color="#f0abfc" />
        <Scene clock={clock} />
      </Canvas>

      <div className={`intro-overlay ${done ? 'show' : ''}`}>
        <div className="intro-logo">
          Render<span>CrZ</span>
        </div>
        <p className="intro-tag">Dibuja planos irregulares · amuebla · recorre en 3D</p>
        <button className="intro-start" onClick={start} disabled={!done}>
          Iniciar
        </button>
      </div>
      {!done && (
        <button className="intro-skip" onClick={() => { clock.current = DURATION; setDone(true); }}>
          Saltar ›
        </button>
      )}
      <div className="intro-progress" style={{ animationDuration: `${DURATION}s` }} />
    </div>
  );
}
