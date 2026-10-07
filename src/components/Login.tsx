import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { verifyPassword } from '../auth';
import { pick, rint, rnd, shuffle, snap } from '../random';

const BUILD = 4; // segundos que tarda en armarse el almacén

type Mode = 'rise' | 'drop' | 'grow';

interface Piece {
  x: number;
  y: number; // centro final
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  color: string;
  start: number;
  dur: number;
  mode: Mode;
  metal?: number;
}

interface Warehouse {
  pieces: Piece[];
  w: number;
  d: number;
  h: number;
  angle: number;
}

/** Genera un almacén aleatorio: losa, columnas, muros con andenes, racks, pallets y cerchas. */
function makeWarehouse(): Warehouse {
  const W = snap(rnd(20, 30), 1);
  const D = snap(rnd(14, 20), 1);
  const H = rnd(6.5, 8.5);
  const beam = pick(['#f97316', '#ef4444', '#eab308', '#22c55e', '#06b6d4']);
  const frame = pick(['#1e3a8a', '#0f766e', '#334155', '#6d28d9', '#1d4ed8']);
  const wall = pick(['#e5e7eb', '#cbd5e1', '#d6d3d1', '#f1f5f9', '#e2e8f0']);
  const stripe = pick(['#0ea5e9', '#f59e0b', '#16a34a', '#dc2626', '#8b5cf6']);
  const cardboard = ['#c69c6d', '#b88a58', '#d2a979', '#a9784a'];
  const pieces: Piece[] = [];
  const x0 = -W / 2;
  const z0 = -D / 2;
  const T = 0.25;

  // 1) losa
  pieces.push({ x: 0, y: -0.1, z: 0, sx: W + 6, sy: 0.2, sz: D + 8, ry: 0, color: '#9ca3af', start: 0, dur: 0.6, mode: 'grow' });
  // franja de patio frente a los andenes
  pieces.push({ x: 0, y: 0.005, z: D / 2 + 2.5, sx: W, sy: 0.01, sz: 0.25, ry: 0, color: stripe, start: 0.4, dur: 0.5, mode: 'grow' });

  // 2) muros perimetrales en paneles; algunos del frente son andenes
  const sides: [number, number, number, number, boolean][] = [
    [x0, z0, x0 + W, z0, false],
    [x0 + W, z0, x0 + W, z0 + D, false],
    [x0 + W, z0 + D, x0, z0 + D, true],
    [x0, z0 + D, x0, z0, false],
  ];
  const wallPieces: Piece[] = [];
  const colPieces: Piece[] = [];
  for (const [ax, az, bx, bz, front] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / 3.2));
    const seg = len / n;
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    const ry = -Math.atan2(dz, dx);
    const docks = front ? new Set(shuffle([...Array(n).keys()].slice(1, -1)).slice(0, rint(2, Math.min(5, n - 2)))) : new Set<number>();
    for (let i = 0; i < n; i++) {
      const cx = ax + dx * seg * (i + 0.5);
      const cz = az + dz * seg * (i + 0.5);
      if (docks.has(i)) {
        const door = 3.8;
        wallPieces.push({ x: cx, y: door + (H - door) / 2, z: cz, sx: seg, sy: H - door, sz: T, ry, color: wall, start: 0, dur: 0.35, mode: 'rise' });
        wallPieces.push({ x: cx, y: door / 2, z: cz, sx: seg * 0.8, sy: door, sz: 0.08, ry, color: '#475569', start: 0, dur: 0.35, mode: 'rise', metal: 0.5 });
        pieces.push({ x: cx, y: 0.5, z: cz + 0.35, sx: seg * 0.85, sy: 1.0, sz: 0.5, ry, color: '#111827', start: 2.4 + Math.random() * 0.6, dur: 0.3, mode: 'rise' });
      } else {
        wallPieces.push({ x: cx, y: H / 2, z: cz, sx: seg, sy: H, sz: T, ry, color: wall, start: 0, dur: 0.35, mode: 'rise' });
        // franja de color a media altura
        wallPieces.push({ x: cx - dz * 0.01, y: 1.1, z: cz + dx * 0.01, sx: seg, sy: 0.35, sz: T + 0.04, ry, color: stripe, start: 0, dur: 0.3, mode: 'rise' });
      }
      colPieces.push({ x: ax + dx * seg * i, y: H / 2 + 0.2, z: az + dz * seg * i, sx: 0.45, sy: H + 0.4, sz: 0.45, ry, color: '#64748b', start: 0, dur: 0.45, mode: 'rise', metal: 0.4 });
    }
  }
  shuffle(colPieces).forEach((p, i, a) => pieces.push({ ...p, start: 0.35 + (i / a.length) * 0.7 }));
  shuffle(wallPieces).forEach((p, i, a) => pieces.push({ ...p, start: 0.9 + (i / a.length) * 1.2 }));

  // 3) racks con largueros y pallets
  // fila simple contra el muro del fondo y filas dobles separadas por pasillos de 3.2 m
  const rows = Math.max(2, Math.min(5, 2 + Math.floor((D - 12.75) / 5.4)));
  const bays = Math.max(3, Math.floor((W - 6) / 2.7));
  const levels = rint(3, 4);
  const lh = (H - 1) / (levels + 1);
  const rackW = bays * 2.7;
  for (let r = 0; r < rows; r++) {
    const zc = r === 0 ? z0 + 1.8 : z0 + 6.65 + (r - 1) * 5.4;
    const depth = r === 0 ? 1.1 : 2.2;
    const rowStart = 1.7 + r * 0.12;
    for (let b = 0; b <= bays; b++) {
      const x = -rackW / 2 + b * 2.7;
      for (const s of [-1, 1]) {
        pieces.push({ x, y: (H - 1) / 2, z: zc + (s * depth) / 2, sx: 0.09, sy: H - 1, sz: 0.09, ry: 0, color: frame, start: rowStart + Math.random() * 0.5, dur: 0.35, mode: 'rise', metal: 0.4 });
      }
    }
    for (let b = 0; b < bays; b++) {
      const xc = -rackW / 2 + b * 2.7 + 1.35;
      for (let k = 1; k <= levels; k++) {
        for (const s of [-1, 1]) {
          pieces.push({ x: xc, y: k * lh, z: zc + (s * depth) / 2, sx: 2.6, sy: 0.12, sz: 0.06, ry: 0, color: beam, start: rowStart + 0.4 + k * 0.08 + Math.random() * 0.2, dur: 0.25, mode: 'grow', metal: 0.3 });
        }
      }
      for (let k = 0; k <= levels; k++) {
        for (const slot of [-0.62, 0.62]) {
          if (Math.random() > 0.78) continue;
          const t = 2.55 + Math.random() * 1.05;
          const loadH = Math.min(1.4, lh - 0.35) * rnd(0.6, 1);
          const y = k * lh + (k === 0 ? 0 : 0.06);
          pieces.push({ x: xc + slot, y: y + 0.07, z: zc, sx: 1.15, sy: 0.14, sz: depth - 0.15, ry: 0, color: '#c8a26b', start: t, dur: 0.35, mode: 'drop' });
          pieces.push({ x: xc + slot, y: y + 0.14 + loadH / 2, z: zc, sx: 1.1, sy: loadH, sz: depth - 0.2, ry: 0, color: pick(cardboard), start: t, dur: 0.35, mode: 'drop' });
        }
      }
    }
  }

  // 4) montacargas que cae en el pasillo
  pieces.push({ x: rnd(-W / 4, W / 4), y: 1.0, z: z0 + 3.95, sx: 2.6, sy: 2.0, sz: 1.2, ry: 0, color: '#facc15', start: 3.1, dur: 0.4, mode: 'drop' });

  // 5) cerchas del techo (solo estructura, para ver el interior)
  const trusses = Math.max(3, Math.round(W / 5));
  for (let i = 0; i <= trusses; i++) {
    pieces.push({ x: x0 + (i * W) / trusses, y: H + 0.25, z: 0, sx: 0.25, sy: 0.4, sz: D, ry: 0, color: '#475569', start: 3.3 + (i / trusses) * 0.5, dur: 0.3, mode: 'drop', metal: 0.5 });
  }
  pieces.push({ x: 0, y: H + 0.55, z: 0, sx: W, sy: 0.15, sz: 0.3, ry: 0, color: '#475569', start: 3.6, dur: 0.3, mode: 'grow', metal: 0.5 });

  return { pieces, w: W, d: D, h: H, angle: Math.random() * Math.PI * 2 };
}

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (c: string, metal = 0) => {
  const k = `${c}|${metal}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: metal ? 0.45 : 0.8 }));
  return mats.get(k)!;
};

function Build({ wh, clock }: { wh: Warehouse; clock: React.MutableRefObject<number> }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    const t = clock.current;
    wh.pieces.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      const k = Math.min(1, Math.max(0, (t - p.start) / p.dur));
      m.visible = k > 0;
      if (!m.visible) return;
      if (p.mode === 'rise') {
        const e = 1 - Math.pow(1 - k, 3);
        m.scale.set(p.sx, Math.max(0.001, p.sy * e), p.sz);
        m.position.set(p.x, p.y - p.sy / 2 + (p.sy * e) / 2, p.z);
      } else if (p.mode === 'grow') {
        const e = 1 - Math.pow(1 - k, 3);
        m.scale.set(Math.max(0.001, p.sx * e), p.sy, Math.max(0.001, p.sz * e));
        m.position.set(p.x, p.y, p.z);
      } else {
        // caída con un pequeño rebote
        const e = k < 0.75 ? Math.pow(k / 0.75, 2) : 1 - Math.sin(((k - 0.75) / 0.25) * Math.PI) * 0.08;
        m.scale.set(p.sx, p.sy, p.sz);
        m.position.set(p.x, p.y + (1 - e) * 9, p.z);
      }
    });
    // cámara en órbita que desciende mientras se arma
    const size = Math.max(wh.w, wh.d);
    const k = Math.min(1, t / BUILD);
    const e = k * k * (3 - 2 * k);
    const ang = wh.angle + t * 0.22;
    // en pantallas angostas (celular) la cámara se aleja para que entre todo el almacén
    const fit = Math.max(1, 1.5 / (camera as THREE.PerspectiveCamera).aspect);
    const r = size * (1.35 - e * 0.2) * fit;
    camera.position.set(Math.sin(ang) * r, wh.h * (3.4 - e * 1.3) * fit, Math.cos(ang) * r);
    camera.lookAt(0, wh.h * 0.15, 0);
  });
  return (
    <group>
      {wh.pieces.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={UNIT}
          material={mat(p.color, p.metal)}
          rotation={[0, p.ry, 0]}
          visible={false}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const wh = useMemo(makeWarehouse, []);
  const clock = useRef(0);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), BUILD * 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      if (await verifyPassword(password)) {
        setLeaving(true);
        setTimeout(onSuccess, 500);
      } else {
        setError('Contraseña incorrecta');
        setShake((n) => n + 1);
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('No se pudo conectar con el servidor. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`login ${leaving ? 'leaving' : ''}`}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, position: [30, 25, 30] }}>
        <color attach="background" args={['#0a1222']} />
        <fog attach="fog" args={['#0a1222', 40, 110]} />
        <hemisphereLight args={['#dbeafe', '#1e293b', 0.9]} />
        <directionalLight position={[20, 30, 12]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <gridHelper args={[160, 80, '#1e3a5f', '#132239']} position={[0, -0.21, 0]} />
        <Build wh={wh} clock={clock} />
      </Canvas>

      {!ready && (
        <button
          className="intro-skip"
          onClick={() => {
            clock.current = BUILD + 0.5;
            setReady(true);
          }}
        >
          Saltar ›
        </button>
      )}
      <div className="intro-progress" style={{ animationDuration: `${BUILD}s` }} />

      <form key={shake} className={`login-card ${ready ? 'show' : ''} ${shake ? 'shake' : ''}`} onSubmit={submit}>
        <div className="login-logo">
          Render<span>CrZ</span>
        </div>
        <p className="login-sub">Ingresa la contraseña de acceso</p>
        <input
          ref={inputRef}
          type="password"
          className="login-input"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus={ready}
          disabled={!ready || busy}
          aria-label="Contraseña"
        />
        <button className="login-btn" type="submit" disabled={!ready || busy || !password}>
          {busy ? <span className="spinner" /> : 'Entrar'}
        </button>
        <p className="login-error" role="alert">
          {error}
        </p>
      </form>
    </div>
  );
}
