import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { area, bounds, computeWalls, interiorPoint, levelElevations, levelHeights, localToWorld, pointInPolygon, projectOnSegment } from '../geometry';
import { LevelMesh, type BuildClock } from './Building';
import type { Project, Vec2 } from '../types';
import { EditPanel, type MoveTarget, type Pick } from './EditPanel';
import { moveFurnitureTo, moveOpeningTo } from '../actions';
import { WalkControls, walkInput } from './WalkControls';
import { grassTexture } from './textures';

type Mode = 'orbit' | 'walk';

/** Objetos que no bloquean el recorrido. */
const NON_BLOCKING = new Set(['zona', 'alfombra', 'letrero', 'escalera', 'escalera_metal', 'rampa_curva', 'planta', 'lampara', 'cono']);

function Ground() {
  const map = useMemo(() => {
    const t = grassTexture().clone();
    t.repeat.set(100, 100);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial map={map} color="#a3b18a" roughness={1} />
    </mesh>
  );
}

function SunLight({ cx, cz, size }: { cx: number; cz: number; size: number }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
  }, [cx, cz]);
  const s = Math.max(12, size * 0.9);
  return (
    <directionalLight
      ref={ref}
      position={[cx + s * 0.8, s * 1.4, cz + s * 0.5]}
      intensity={2.4}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-s}
      shadow-camera-right={s}
      shadow-camera-top={s}
      shadow-camera-bottom={-s}
      shadow-camera-near={0.5}
      shadow-camera-far={s * 5}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

/** Avisa cuando se dibujó el primer cuadro. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

/** Expone una función para capturar la imagen del lienzo. */
function Snapshot({ onReady }: { onReady: (fn: () => string) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

/** Duración de la animación en la que el proyecto se arma desde cero. */
/** Lo que tarda la vuelta completa de la vista 3D en el recorrido automático. */
const TOUR_ORBIT_SECONDS = 16;
const BUILD_SECONDS = 10;
const BUILD_START = 0.6;
const BUILD_END = 9.2;
const BUILD_STEPS = ['Trazando el piso', 'Levantando muros y accesos', 'Colocando racks y equipos'];

/** Avanza el reloj del armado y lleva la cámara en órbita hasta la vista final. */
function BuildDirector({
  clock,
  target,
  end,
  levels,
  bar,
  onStep,
  onDone,
}: {
  clock: BuildClock;
  target: [number, number, number];
  end: [number, number, number];
  levels: number;
  bar: React.RefObject<HTMLDivElement | null>;
  onStep: (text: string) => void;
  onDone: () => void;
}) {
  const { camera } = useThree();
  const step = useRef('');
  const done = useRef(false);
  const frames = useRef(0);
  useFrame((_, dt) => {
    // los primeros cuadros compilan materiales: no cuentan para el reloj
    if (frames.current++ > 2) clock.current = Math.min(BUILD_SECONDS, clock.current + Math.min(dt, 0.25));
    const t = clock.current;
    const k = t / BUILD_SECONDS;
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    const dx = end[0] - target[0];
    const dy = end[1] - target[1];
    const dz = end[2] - target[2];
    const angle = Math.atan2(dz, dx) - (1 - e) * 2.4;
    const r = Math.hypot(dx, dz) * (1 + 0.3 * (1 - e));
    camera.position.set(target[0] + Math.cos(angle) * r, target[1] + dy * (1 + 0.2 * (1 - e)), target[2] + Math.sin(angle) * r);
    camera.lookAt(target[0], target[1], target[2]);
    if (bar.current) bar.current.style.transform = `scaleX(${k})`;

    const span = (BUILD_END - BUILD_START) / levels;
    const lvl = Math.max(0, Math.min(levels - 1, Math.floor((t - BUILD_START) / span)));
    const local = (t - BUILD_START - lvl * span) / span;
    const text = t >= BUILD_END ? 'Listo para recorrer' : `${levels > 1 ? `Nivel ${lvl + 1} de ${levels} · ` : ''}${BUILD_STEPS[local < 0.2 ? 0 : local < 0.5 ? 1 : 2]}`;
    if (text !== step.current) {
      step.current = text;
      onStep(text);
    }
    if (t >= BUILD_SECONDS && !done.current) {
      done.current = true;
      onDone();
    }
  });
  return null;
}

/**
 * Vista 3D. Con `project` se muestra ese proyecto en vez del abierto en el editor;
 * `shared` es la vista pública de una liga: arma el proyecto y solo deja ver en 3D o recorrer.
 */
export default function Viewer3D({ project: given, shared = false }: { project?: Project; shared?: boolean }) {
  const stored = useStore((s) => s.project);
  const project = given ?? stored!;
  const editorLevelId = useStore((s) => s.levelId);
  const setScreen = useStore((s) => s.setScreen);
  const levels = project.levels;
  const elevations = useMemo(() => levelElevations(levels), [levels]);
  const heights = useMemo(() => levelHeights(levels), [levels]);

  const [mode, setMode] = useState<Mode>('orbit');
  // recorrido automático: alterna una vuelta en vista 3D con una caminata, hasta que se salga
  const [tour, setTour] = useState(false);
  const [spin, setSpin] = useState(1);
  const [maxLevel, setMaxLevel] = useState(levels.length - 1);
  const [walkLevel, setWalkLevel] = useState(Math.max(0, levels.findIndex((l) => l.id === editorLevelId)));
  const [shadows, setShadows] = useState(true);
  const [xray, setXray] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [roof, setRoof] = useState(false);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const movingRef = useRef<MoveTarget | null>(null);
  movingRef.current = moving;
  const onPick = useCallback((kind: Pick['kind'], id: string, point: Vec2) => {
    const target = movingRef.current;
    // con «mover» activo, el siguiente toque reubica el objeto (en cualquier punto) o la puerta (sobre una pared o cerco)
    if (target?.kind === 'furniture') {
      if (!moveFurnitureTo(target.id, point)) useStore.getState().notify('Ese lugar está ocupado por otro objeto');
      setPick({ kind: 'furniture', id: target.id });
      setMoving(null);
      return;
    }
    if (target) {
      if (kind !== 'room') return;
      if (moveOpeningTo(target.id, id, point)) setPick({ kind: 'opening', id: target.id, point });
      else useStore.getState().notify('La puerta solo se puede mover a una pared del mismo nivel');
      setMoving(null);
      return;
    }
    if (kind !== 'floor') setPick({ kind, id, point });
  }, []);

  // --- recorrido: subir y bajar por escaleras y rampas ---
  const walkLevelRef = useRef(0);
  const walkGround = useCallback(
    (x: number, z: number) => {
      const li = Math.min(walkLevelRef.current, levels.length - 1);
      // altura sobre el piso del nivel y avance (0 abajo, 1 arriba) si el punto cae sobre una escalera o rampa
      const climb = (index: number) => {
        for (const f of levels[index].furniture) {
          if (f.type !== 'escalera' && f.type !== 'escalera_metal' && f.type !== 'rampa_curva') continue;
          const r = (f.rotation * Math.PI) / 180;
          const dx = x - f.x;
          const dz = z - f.y;
          const lx = dx * Math.cos(r) + dz * Math.sin(r);
          const ly = -dx * Math.sin(r) + dz * Math.cos(r);
          if (Math.abs(lx) > f.w / 2 || Math.abs(ly) > f.d / 2) continue;
          let t = (f.d / 2 - ly) / f.d;
          if (f.type === 'rampa_curva') {
            const u = (lx + f.w / 2) / f.w;
            const v = (f.d / 2 - ly) / f.d;
            const rr = Math.hypot(u, v);
            if (rr < 0.45 || rr > 1) continue;
            t = Math.atan2(v, u) / (Math.PI / 2);
          }
          return { t, h: f.elevation + t * f.h, top: f.elevation + f.h };
        }
        return null;
      };
      const here = climb(li);
      if (here) return { h: here.h, go: here.t > 0.96 && li + 1 < levels.length && here.top >= heights[li] - 0.6 ? 1 : 0 };
      // en el nivel de arriba, la escalera que llega desde abajo sigue bajo los pies
      const below = li > 0 ? climb(li - 1) : null;
      if (below && below.top >= heights[li - 1] - 0.6) return { h: below.h - (elevations[li] - elevations[li - 1]), go: below.t < 0.9 ? -1 : 0 };
      return { h: 0 };
    },
    [levels, heights, elevations],
  );
  const [collisions, setCollisions] = useState(true);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const snapRef = useRef<() => string>(() => '');
  const [building, setBuilding] = useState(shared);
  const [step, setStep] = useState('Preparando la escena');
  const clock = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const finishBuild = useCallback(() => setBuilding(false), []);

  const allPts = levels.flatMap((l) => l.rooms.flatMap((r) => r.points));
  const b = allPts.length ? bounds(allPts) : { minX: -5, minY: -5, maxX: 5, maxY: 5 };
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const size = Math.max(6, b.maxX - b.minX, b.maxY - b.minY);
  const totalH = elevations[elevations.length - 1] + heights[heights.length - 1];

  // elegir un modo a mano termina el recorrido automático
  const pickMode = (m: Mode) => {
    setTour(false);
    setMode(m);
  };
  const toggleTour = () => {
    if (!tour) {
      setEditing(false);
      setPick(null);
      setMoving(null);
      setSpin(Math.random() < 0.5 ? -1 : 1);
      setMode('orbit');
    }
    setTour(!tour);
  };
  useEffect(() => {
    if (!tour || building) return;
    const timer = setTimeout(
      () => {
        if (mode === 'orbit') {
          // camina en un nivel al azar que tenga ambientes
          const walkable = levels.map((l, i) => (l.rooms.length ? i : -1)).filter((i) => i >= 0);
          if (walkable.length) setWalkLevel(walkable[Math.floor(Math.random() * walkable.length)]);
          setMode('walk');
        } else {
          setSpin(Math.random() < 0.5 ? -1 : 1);
          setMode('orbit');
        }
      },
      mode === 'orbit' ? TOUR_ORBIT_SECONDS * 1000 : 9000 + Math.random() * 6000,
    );
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTour(false);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [tour, mode, building, levels]);

  walkLevelRef.current = walkLevel;
  const onWalkLevel = useCallback((delta: number) => setWalkLevel((l) => Math.max(0, Math.min(levels.length - 1, l + delta))), [levels.length]);
  const walkLvl = levels[Math.min(walkLevel, levels.length - 1)];
  const { segs: walkSegments, solids: walkSolids } = useMemo(() => {
    const segs = computeWalls(walkLvl, project.wallThickness).segments;
    const solids: Vec2[][] = [];
    // racks, equipos y objetos altos también bloquean el paso
    for (const f of walkLvl.furniture) {
      if (NON_BLOCKING.has(f.type) || f.h < 0.45 || f.elevation > 1.2) continue;
      const c = [
        localToWorld(-f.w / 2, -f.d / 2, f.x, f.y, f.rotation),
        localToWorld(f.w / 2, -f.d / 2, f.x, f.y, f.rotation),
        localToWorld(f.w / 2, f.d / 2, f.x, f.y, f.rotation),
        localToWorld(-f.w / 2, f.d / 2, f.x, f.y, f.rotation),
      ];
      for (let i = 0; i < 4; i++) segs.push({ a: c[i], b: c[(i + 1) % 4], half: 0.02 });
      solids.push(c);
    }
    return { segs, solids };
  }, [walkLvl, project.wallThickness]);

  const start = useMemo(() => {
    const rooms = [...walkLvl.rooms].sort((a, c) => area(c.points) - area(a.points));
    const room = rooms.find((r) => r.hasWalls) ?? rooms[0];
    if (!room) return { x: cx, z: cz, yaw: 0 };
    // punto más despejado del ambiente: lejos de muebles y muros
    const center = interiorPoint(room.points);
    const rb = bounds(room.points);
    let best = center;
    let bestScore = -Infinity;
    for (let x = rb.minX + 0.4; x < rb.maxX - 0.3; x += 0.25) {
      for (let y = rb.minY + 0.4; y < rb.maxY - 0.3; y += 0.25) {
        const p = { x, y };
        if (!pointInPolygon(p, room.points)) continue;
        let score = Infinity;
        for (let i = 0; i < room.points.length; i++) {
          score = Math.min(score, projectOnSegment(p, room.points[i], room.points[(i + 1) % room.points.length]).dist);
        }
        for (const f of walkLvl.furniture) {
          if (f.type === 'alfombra' || f.type === 'zona' || f.elevation > 1.2) continue;
          score = Math.min(score, Math.hypot(f.x - x, f.y - y) - Math.hypot(f.w, f.d) / 2);
        }
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }
    // mirar hacia el centro del ambiente
    const yaw = Math.atan2(-(center.x - best.x), -(center.y - best.y));
    return { x: best.x, z: best.y, yaw: Math.hypot(center.x - best.x, center.y - best.y) > 0.3 ? yaw : 0 };
    // solo se recalcula al entrar al recorrido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // RePág / AvPág cambian de nivel durante el recorrido
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageUp') setWalkLevel((l) => Math.min(levels.length - 1, l + 1));
      if (e.key === 'PageDown') setWalkLevel((l) => Math.max(0, l - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levels.length]);

  const onLockChange = useCallback((l: boolean) => setLocked(l), []);
  const onFirstFrame = useCallback(() => setReady(true), []);
  const onSnapReady = useCallback((fn: () => string) => (snapRef.current = fn), []);

  const screenshot = () => {
    const url = snapRef.current();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'render'}-3d.png`;
    a.click();
  };

  const orbitCam: [number, number, number] = [cx + size * 0.75, totalH + size * 0.8, cz + size * 1.05];
  const orbitTarget: [number, number, number] = [cx, Math.min(totalH, 3) / 2, cz];
  const buildSpan = (BUILD_END - BUILD_START) / levels.length;
  const buildWindows = useMemo(() => levels.map((_, i) => ({ clock, at: BUILD_START + i * buildSpan, span: buildSpan })), [levels, buildSpan]);

  const press = (key: keyof typeof walkInput, value: number | boolean) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (walkInput[key] as number | boolean) = value;
    },
    onPointerUp: () => ((walkInput[key] as number | boolean) = typeof value === 'number' ? 0 : false),
    onPointerLeave: () => ((walkInput[key] as number | boolean) = typeof value === 'number' ? 0 : false),
  });

  const empty = allPts.length === 0;

  return (
    <div className="viewer">
      <Canvas
        key={mode}
        shadows={shadows}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ fov: mode === 'walk' ? 70 : 50, near: mode === 'walk' ? 0.05 : 0.1, far: 1000, position: orbitCam }}
      >
        <Suspense fallback={null}>
          <Sky sunPosition={[80, 50, 40]} turbidity={6} rayleigh={1.2} />
          <ambientLight intensity={mode === 'walk' ? 0.75 : 0.5} />
          <hemisphereLight args={['#dbeafe', '#6b7c4b', 0.7]} />
          <SunLight cx={cx} cz={cz} size={size} />
          <Ground />
          {levels.map((l, i) =>
            mode === 'walk' || i <= maxLevel ? (
              <LevelMesh
                key={l.id}
                level={l}
                elevation={elevations[i]}
                height={heights[i]}
                above={mode === 'walk' || i < maxLevel ? levels[i + 1] : undefined}
                thickness={project.wallThickness}
                ceiling={mode === 'walk' || roof}
                wallOpacity={mode === 'orbit' && xray ? 0.35 : 1}
                build={building ? buildWindows[i] : undefined}
                onPick={editing && mode === 'orbit' ? onPick : undefined}
              />
            ) : null,
          )}
          {building ? (
            <BuildDirector clock={clock} target={orbitTarget} end={orbitCam} levels={levels.length} bar={barRef} onStep={setStep} onDone={finishBuild} />
          ) : mode === 'orbit' ? (
            <OrbitControls makeDefault autoRotate={tour} autoRotateSpeed={(spin * 60) / TOUR_ORBIT_SECONDS} target={orbitTarget} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1.5} maxDistance={size * 6} enableDamping />
          ) : (
            <WalkControls auto={tour} start={tour ? { ...start, yaw: start.yaw + (Math.random() - 0.5) * 1.4 } : start} eyeY={elevations[walkLevel] + 1.62} segments={walkSegments} solids={walkSolids} collisions={collisions} ground={walkGround} onLevel={onWalkLevel} onLockChange={onLockChange} />
          )}
          <Snapshot onReady={onSnapReady} />
          <FirstFrame onReady={onFirstFrame} />
        </Suspense>
      </Canvas>

      {building && (
        <div className="build-intro">
          <div className="build-card">
            <div className="build-brand">
              Render<span>CrZ</span>
            </div>
            <h1>{project.name}</h1>
            <p>{step}</p>
            <div className="build-bar">
              <div ref={barRef} />
            </div>
          </div>
          <button className="ghost small build-skip" onClick={() => (clock.current = BUILD_SECONDS)}>
            Saltar ⏭
          </button>
        </div>
      )}

      {shared && !building && (
        <header className="viewer-bar">
          <div className="brand-mini hide-sm">RenderCrZ</div>
          <strong className="viewer-title">{project.name}</strong>
          <div className="spacer" />
          <div className="seg">
            <button className={mode === 'orbit' ? 'active' : ''} onClick={() => pickMode('orbit')}>
              🧊 Vista 3D
            </button>
            <button className={mode === 'walk' ? 'active' : ''} onClick={() => pickMode('walk')}>
              🚶 Recorrer
            </button>
          </div>
          <button className={tour ? 'primary' : 'secondary'} onClick={toggleTour} title="Alterna solo entre la vista 3D girando y una caminata, hasta que salgas">
            {tour ? '⏹ Salir' : '🎬 Automático'}
          </button>
        </header>
      )}

      <header className="viewer-bar" hidden={shared}>
        <button className="ghost" onClick={() => setScreen('editor')}>
          ← <span className="hide-sm">Editar plano</span>
        </button>
        <strong className="viewer-title">{project.name}</strong>
        <div className="seg">
          <button className={mode === 'orbit' ? 'active' : ''} onClick={() => pickMode('orbit')}>
            🧊 <span className="hide-sm">Vista volumen</span>
          </button>
          <button className={mode === 'walk' ? 'active' : ''} onClick={() => pickMode('walk')}>
            🚶 <span className="hide-sm">Recorrido virtual</span>
          </button>
        </div>
        <button className={tour ? 'primary' : 'secondary'} onClick={toggleTour} title="Alterna solo entre la vista 3D girando y una caminata, hasta que salgas">
          {tour ? '⏹ ' : '🎬 '}
          <span className="hide-sm">{tour ? 'Salir del automático' : 'Recorrido automático'}</span>
        </button>
        <div className="spacer" />
        {mode === 'orbit' ? (
          <>
            {levels.length > 1 && (
              <label className="inline">
                <span className="hide-sm">Mostrar hasta</span>
                <select value={maxLevel} onChange={(e) => setMaxLevel(Number(e.target.value))}>
                  {levels.map((l, i) => (
                    <option key={l.id} value={i}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="inline check">
              <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} /> Rayos X
            </label>
            <label className="inline check" title="Muestra la cubierta de la nave">
              <input type="checkbox" checked={roof} onChange={(e) => setRoof(e.target.checked)} /> Techo
            </label>
            <button className={editing ? 'primary' : 'secondary'} onClick={() => { setEditing(!editing); setPick(null); setMoving(null); }} title="Toca una puerta, pared, cerco u objeto para editarlo">
              ✏️ <span className="hide-sm">Editar en 3D</span>
            </button>
          </>
        ) : (
          <>
            <label className="inline">
              <span className="hide-sm">Nivel</span>
              <select value={walkLevel} onChange={(e) => setWalkLevel(Number(e.target.value))}>
                {levels.map((l, i) => (
                  <option key={l.id} value={i}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline check">
              <input type="checkbox" checked={collisions} onChange={(e) => setCollisions(e.target.checked)} /> Colisión
            </label>
          </>
        )}
        <label className="inline check hide-sm">
          <input type="checkbox" checked={shadows} onChange={(e) => setShadows(e.target.checked)} /> Sombras
        </label>
        <button className="secondary" onClick={screenshot} title="Descargar captura PNG">
          📷
        </button>
      </header>

      {editing && mode === 'orbit' && !shared && (moving ? (
        <div className="edit3d hint">
          {moving.kind === 'furniture' ? 'Toca el lugar del piso donde va el objeto.' : 'Toca el punto de la pared o cerco donde va la puerta.'}
          <button className="secondary small" onClick={() => setMoving(null)}>
            Cancelar
          </button>
        </div>
      ) : pick ? (
        <EditPanel project={project} pick={pick} onPick={setPick} onMove={setMoving} onClose={() => setPick(null)} />
      ) : (
        <div className="edit3d hint">Toca una pared o cerco para cambiar su tamaño o agregarle una puerta, o una puerta u objeto para editarlo, girarlo o moverlo.</div>
      ))}

      {!ready && !empty && !shared && <div className="viewer-loading"><span className="spinner" /> Construyendo la escena 3D…</div>}

      {empty && !building && (
        <div className="viewer-empty">
          <p>Aún no hay ambientes en el plano.</p>
          {!shared && (
            <button className="primary" onClick={() => setScreen('editor')}>
              Dibujar el plano
            </button>
          )}
        </div>
      )}

      {tour && !building && <div className="viewer-hint">🎬 Recorrido automático · elige Vista 3D o Recorrer para tomar el control, o pulsa Salir</div>}

      {mode === 'orbit' && !empty && !building && !tour && <div className="viewer-hint">Arrastra para girar · Clic derecho para desplazar · Rueda para zoom</div>}

      {mode === 'walk' && (
        <>
          {!locked && !tour && (
            <div className="viewer-hint walk">
              <b>Recorrido virtual</b> — Clic en la escena para mirar con el mouse · <kbd>W A S D</kbd> moverse · <kbd>Shift</kbd> correr ·{' '}
              <kbd>← →</kbd> girar · <kbd>RePág/AvPág</kbd> cambiar de nivel · <kbd>Esc</kbd> soltar el mouse
            </div>
          )}
          {locked && <div className="crosshair" />}
          <div className="touchpad">
            <div className="pad">
              <button {...press('forward', 1)}>▲</button>
              <div>
                <button {...press('turn', 1)}>⟲</button>
                <button {...press('forward', -1)}>▼</button>
                <button {...press('turn', -1)}>⟳</button>
              </div>
            </div>
            <div className="pad pad-right">
              <button onClick={() => setWalkLevel((l) => Math.min(levels.length - 1, l + 1))} disabled={walkLevel >= levels.length - 1}>
                ⇧ Subir
              </button>
              <button onClick={() => setWalkLevel((l) => Math.max(0, l - 1))} disabled={walkLevel <= 0}>
                ⇩ Bajar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
