import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { DURATION, T0, T1, TOP, randomBuild, type Build, type TubeSpec } from '../builds';
import { BrandLogo } from './BrandLogo';

// Cada carga arma una obra distinta (ver builds.ts): trazo de luz en planta, la obra sube
// pieza a pieza con su grúa y su frente iluminado, y al terminar la recorre una onda de luz.

type Clock = React.MutableRefObject<number>;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (from: number, to: number, x: number) => {
  const k = clamp01((x - from) / (to - from));
  return k * k * (3 - 2 * k);
};

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

function Tube({ spec, clock }: { spec: TubeSpec; clock: Clock }) {
  const segs = spec.segments ?? (spec.curve instanceof THREE.LineCurve3 ? 24 : 64);
  const radial = spec.radial ?? 12;
  const geo = useMemo(() => new THREE.TubeGeometry(spec.curve, segs, spec.radius, radial, false), [spec, segs, radial]);
  const tip = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const t = clamp01((clock.current - spec.start) / spec.dur);
    const e = spec.linear ? t : 1 - Math.pow(1 - t, 3);
    geo.setDrawRange(0, Math.floor(segs * e) * radial * 6);
    if (tip.current) {
      tip.current.visible = t > 0 && t < 1;
      spec.curve.getPoint(e, tip.current.position);
    }
    if (mat.current) mat.current.emissiveIntensity = 0.55 + (1 - t) * 0.9;
  });

  return (
    <group>
      <mesh geometry={geo} frustumCulled={false}>
        <meshStandardMaterial ref={mat} color={spec.color} emissive={spec.color} emissiveIntensity={1} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh ref={tip} visible={false}>
        <sphereGeometry args={[spec.radius * 2.2, 10, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Todas las piezas de la obra en una sola malla instanciada: caen, crecen y destellan al colocarse. */
function Blocks({ build, clock }: { build: Build; clock: Clock }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color(), last: new Float32Array(build.blocks.length).fill(-1), pulsing: false }),
    [build],
  );

  useFrame(() => {
    const im = mesh.current;
    if (!im) return;
    const t = clock.current;
    const { m, p, q, s, c, last } = tmp;
    // al terminar, una onda de luz recorre la obra de abajo arriba
    const wave = ((t - TOP) / (DURATION - TOP - 0.1)) * build.height * 1.15;
    const band = build.height * 0.12;
    const pulsing = t > TOP && t < DURATION + 0.3;
    const sweep = pulsing || tmp.pulsing;
    tmp.pulsing = pulsing;
    let dirty = false;
    build.blocks.forEach((b, i) => {
      const k = clamp01((t - b.start) / b.dur);
      // las piezas ya colocadas solo se tocan mientras pasa la onda
      if (k === last[i] && !(sweep && k === 1)) return;
      last[i] = k;
      dirty = true;
      if (k === 0) {
        im.setMatrixAt(i, m.makeScale(0, 0, 0));
        return;
      }
      const e = 1 - Math.pow(1 - k, 3);
      p.set(b.x, b.y, b.z);
      s.set(b.sx, b.sy, b.sz);
      if (b.mode === 'rise') {
        s.y = Math.max(0.001, b.sy * e);
        p.y = b.y - b.sy / 2 + s.y / 2;
      } else if (b.mode === 'grow') {
        s.x = Math.max(0.001, b.sx * e);
        s.z = Math.max(0.001, b.sz * e);
      } else {
        // cae y rebota un poco
        p.y += (k < 0.75 ? 1 - Math.pow(k / 0.75, 2) : Math.sin(((k - 0.75) / 0.25) * Math.PI) * 0.06) * (b.fall ?? 3);
      }
      im.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(UP, b.ry), s));
      const glow = (b.flash ?? 1) * (1 - k) * (1 - k) * 5 + (pulsing ? Math.max(0, 1 - Math.abs(b.y - wave) / band) * 2.2 : 0);
      im.setColorAt(i, c.copy(b.color).multiplyScalar(1 + glow));
    });
    if (!dirty) return;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[UNIT, undefined, build.blocks.length]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.42} metalness={0.15} emissive="#0a1a33" />
    </instancedMesh>
  );
}

const CRANE = new THREE.MeshStandardMaterial({ color: '#facc15', emissive: '#facc15', emissiveIntensity: 0.45, roughness: 0.5 });

/** Grúa torre en lo alto de la obra: sube con ella y se desmonta al colocar el remate. */
function Crane({ build, at, clock }: { build: Build; at: [number, number]; clock: Clock }) {
  const body = useRef<THREE.Group>(null);
  const jib = useRef<THREE.Group>(null);
  const size = Math.min(1.4, Math.max(0.9, build.height * 0.014));
  useFrame(() => {
    const t = clock.current;
    const k = smooth(T0 - 0.1, T0 + 0.3, t) * (1 - smooth(T1, T1 + 0.4, t));
    if (!body.current || !jib.current) return;
    body.current.visible = k > 0.01;
    body.current.scale.setScalar(k * size);
    body.current.position.set(at[0], Math.min(build.front(t), build.roof), at[1]);
    jib.current.rotation.y = t * 1.4 + at[0];
  });
  return (
    <group ref={body} visible={false}>
      <mesh geometry={UNIT} material={CRANE} position={[0, 2.5, 0]} scale={[0.35, 5, 0.35]} />
      <group ref={jib} position={[0, 5, 0]}>
        <mesh geometry={UNIT} material={CRANE} position={[2.6, 0, 0]} scale={[8.4, 0.22, 0.3]} />
        <mesh geometry={UNIT} material={CRANE} position={[-1.3, -0.2, 0]} scale={[0.9, 0.7, 0.7]} />
        <mesh geometry={UNIT} material={CRANE} position={[0, 0.7, 0]} scale={[0.25, 1.4, 0.25]} />
        <mesh geometry={UNIT} material={CRANE} position={[5.6, -1.3, 0]} scale={[0.05, 2.6, 0.05]} />
        <mesh geometry={UNIT} material={CRANE} position={[5.6, -2.7, 0]} scale={[0.35, 0.3, 0.35]} />
      </group>
    </group>
  );
}

/** Reflector que gira alrededor del frente de obra e ilumina lo recién colocado. */
function FrontLight({ build, clock }: { build: Build; clock: Clock }) {
  const light = useRef<THREE.PointLight>(null);
  const r = Math.min(16, build.radius * 1.3);
  useFrame(() => {
    const t = clock.current;
    if (!light.current) return;
    light.current.position.set(Math.cos(t * 1.7) * r, build.front(t) + 3, Math.sin(t * 1.7) * r);
    light.current.intensity = 500 * (1 - 0.6 * smooth(TOP, DURATION, t));
  });
  return <pointLight ref={light} color="#bfe9ff" intensity={500} decay={2} />;
}

/** Balizas rojas que parpadean en la punta cuando la obra queda terminada. */
function Beacons({ build, clock }: { build: Build; clock: Clock }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = clock.current > TOP && (clock.current * 1.6) % 1 < 0.55;
  });
  return (
    <group ref={group} visible={false}>
      {build.beacons.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[Math.max(0.35, build.height * 0.007), 12, 12]} />
          <meshBasicMaterial color="#ff4d4d" toneMapped={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

const RING = new THREE.RingGeometry(0.965, 1, 96).rotateX(-Math.PI / 2);

/** Anillo de luz que se abre sobre el suelo desde la obra. */
function Shockwave({ build, clock, at }: { build: Build; clock: Clock; at: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const color = useMemo(() => new THREE.Color().setHSL((build.hue + 0.45) % 1, 1, 0.65), [build]);
  useFrame(() => {
    const k = clamp01((clock.current - at) / 1.1);
    if (!mesh.current || !mat.current) return;
    mesh.current.visible = k > 0 && k < 1;
    const r = build.radius * (0.6 + k * 7);
    mesh.current.scale.set(r, 1, r);
    mat.current.opacity = (1 - k) * 0.9;
  });
  return (
    <mesh ref={mesh} geometry={RING} position={[0, 0.06, 0]} visible={false}>
      <meshBasicMaterial ref={mat} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Ground({ water }: { water?: boolean }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[3000, 3000]} />
        {water ? <meshStandardMaterial color="#0a2a4d" roughness={0.3} metalness={0.25} /> : <meshStandardMaterial color="#060d1a" roughness={0.95} />}
      </mesh>
      {!water && <gridHelper args={[420, 60, '#1e3a5f', '#13233a']} position={[0, 0.01, 0]} />}
    </>
  );
}

function Scene({ build, clock, hud, bar, onDone }: { build: Build; clock: Clock; hud: React.RefObject<HTMLElement | null>; bar: React.RefObject<HTMLDivElement | null>; onDone: () => void }) {
  const shown = useRef(-1);
  const finished = useRef(false);
  useFrame(({ camera, scene }, dt) => {
    // el reloj es el de la animación: si la pestaña estuvo oculta o un cuadro tardó, la obra no se salta
    clock.current += Math.min(dt, 0.1);
    const t = clock.current;
    if (bar.current) bar.current.style.transform = `scaleX(${clamp01(t / DURATION)})`;
    if (t >= DURATION && !finished.current) {
      finished.current = true;
      onDone();
    }
    const { height: H, radius: R } = build;
    const cam = camera as THREE.PerspectiveCamera;
    // distancia desde la que cabe toda la obra, a lo alto y a lo ancho (en celular se aleja más)
    const far = Math.max(H * 1.8, (R / (Math.tan((cam.fov * Math.PI) / 360) * cam.aspect)) * 1.15);
    const f = build.front(t);
    // tres tomas: la planta desde arriba, el frente de obra visto desde abajo y la obra completa
    const follow = smooth(0.3, 1.4, t);
    const reveal = smooth(T1 - 1.7, DURATION - 0.2, t);
    const mix = (plan: number, front: number, full: number) => lerp(lerp(plan, front, follow), full, reveal);
    const d = build.water ? mix(far * 0.95, far * 0.85, far) : mix(R * 1.6, R * 3 + f * 0.9, far);
    const y = build.water ? mix(H * 0.9, H * 0.4, Math.max(H * 0.42, far * 0.2)) : mix(R * 3, Math.max(10, R * 0.9, f * 0.45), Math.max(H * 0.42, far * 0.2));
    const look = build.water ? mix(H * 0.2, H * 0.36, H * 0.33) : mix(0, f * 0.8, H * 0.33);
    const ang = build.angle + t * build.spin;
    camera.position.set(Math.sin(ang) * d, y, Math.cos(ang) * d);
    camera.lookAt(0, look, 0);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = Math.max(d, far * 0.6) * 0.9;
      fog.far = Math.max(d, far * 0.6) * 3.4;
    }

    // contador de pisos (o tramos) colocados; al terminar deja el dato de la obra
    let n = Math.max(0, shown.current);
    while (n > 0 && build.marks[n - 1] > t) n--;
    while (n < build.marks.length && build.marks[n] <= t) n++;
    const key = t >= TOP ? build.marks.length + 1 : n;
    if (key !== shown.current && hud.current) {
      shown.current = key;
      hud.current.textContent = t >= TOP ? build.summary : `${build.unit} ${String(n).padStart(3, '0')} / ${build.marks.length}`;
    }
  });
  return (
    <group>
      <Ground water={build.water} />
      <Blocks build={build} clock={clock} />
      {build.tubes.map((s, i) => (
        <Tube key={i} spec={s} clock={clock} />
      ))}
      {build.cranes.map((at, i) => (
        <Crane key={i} build={build} at={at} clock={clock} />
      ))}
      <FrontLight build={build} clock={clock} />
      <Beacons build={build} clock={clock} />
      {[0.2, TOP, TOP + 0.3].map((at) => (
        <Shockwave key={at} build={build} clock={clock} at={at} />
      ))}
    </group>
  );
}

export default function Intro({ onStart }: { onStart: () => void }) {
  const clock = useRef(0);
  const hud = useRef<HTMLElement>(null);
  const build = useMemo(randomBuild, []);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => setDone(true), []);

  const start = () => {
    setLeaving(true);
    setTimeout(onStart, 450);
  };

  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`}>
      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.5, far: 1600, position: [0, build.radius * 3, build.radius * 1.6] }}>
        <color attach="background" args={['#050b16']} />
        <fog attach="fog" args={['#050b16', 100, 400]} />
        <Stars radius={520} depth={90} count={2200} factor={9} saturation={0.4} fade speed={0.5} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#9cc9ff', '#0b1220', 0.7]} />
        <directionalLight position={[60, 90, 40]} intensity={1.5} color="#cfe8ff" />
        <directionalLight position={[-70, 30, -60]} intensity={0.9} color="#f0abfc" />
        <Scene build={build} clock={clock} hud={hud} bar={bar} onDone={finish} />
      </Canvas>

      <div className="intro-hud">
        <small>
          {done ? 'Obra terminada' : 'Construyendo'} · {build.name}
        </small>
        <b ref={hud}>{`${build.unit} 000 / ${build.marks.length}`}</b>
      </div>
      <BrandLogo className={`intro-brand ${done ? 'show' : ''}`} />
      <div className={`intro-overlay ${done ? 'show' : ''}`}>
        <div className="intro-logo">
          Render<span>CrZ</span>
        </div>
        <p className="intro-tag">Planos de almacén · racks y zonas · recorrido 3D</p>
        <button className="intro-start" onClick={start} disabled={!done}>
          Iniciar
        </button>
      </div>
      {!done && (
        <button className="intro-skip" onClick={() => { clock.current = DURATION; setDone(true); }}>
          Saltar ›
        </button>
      )}
      <div ref={bar} className="intro-progress" style={{ animation: 'none', transform: 'scaleX(0)' }} />
    </div>
  );
}
