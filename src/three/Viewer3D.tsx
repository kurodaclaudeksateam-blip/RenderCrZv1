import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { area, bounds, computeWalls, interiorPoint, levelElevations, pointInPolygon, projectOnSegment } from '../geometry';
import { LevelMesh } from './Building';
import { WalkControls, walkInput } from './WalkControls';
import { grassTexture } from './textures';

type Mode = 'orbit' | 'walk';

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

export default function Viewer3D() {
  const project = useStore((s) => s.project)!;
  const editorLevelId = useStore((s) => s.levelId);
  const setScreen = useStore((s) => s.setScreen);
  const levels = project.levels;
  const elevations = useMemo(() => levelElevations(levels), [levels]);

  const [mode, setMode] = useState<Mode>('orbit');
  const [maxLevel, setMaxLevel] = useState(levels.length - 1);
  const [walkLevel, setWalkLevel] = useState(Math.max(0, levels.findIndex((l) => l.id === editorLevelId)));
  const [shadows, setShadows] = useState(true);
  const [xray, setXray] = useState(false);
  const [collisions, setCollisions] = useState(true);
  const [locked, setLocked] = useState(false);
  const snapRef = useRef<() => string>(() => '');

  const allPts = levels.flatMap((l) => l.rooms.flatMap((r) => r.points));
  const b = allPts.length ? bounds(allPts) : { minX: -5, minY: -5, maxX: 5, maxY: 5 };
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const size = Math.max(6, b.maxX - b.minX, b.maxY - b.minY);
  const totalH = elevations[elevations.length - 1] + levels[levels.length - 1].height;

  const walkLvl = levels[Math.min(walkLevel, levels.length - 1)];
  const walkSegments = useMemo(() => computeWalls(walkLvl, project.wallThickness).segments, [walkLvl, project.wallThickness]);

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
          if (f.type === 'alfombra') continue;
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
                thickness={project.wallThickness}
                ceiling={mode === 'walk'}
                isTop={i === levels.length - 1}
                wallOpacity={mode === 'orbit' && xray ? 0.35 : 1}
              />
            ) : null,
          )}
          {mode === 'orbit' ? (
            <OrbitControls makeDefault target={[cx, Math.min(totalH, 3) / 2, cz]} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1.5} maxDistance={size * 6} enableDamping />
          ) : (
            <WalkControls start={start} eyeY={elevations[walkLevel] + 1.62} segments={walkSegments} collisions={collisions} onLockChange={onLockChange} />
          )}
          <Snapshot onReady={onSnapReady} />
        </Suspense>
      </Canvas>

      <header className="viewer-bar">
        <button className="ghost" onClick={() => setScreen('editor')}>
          ← <span className="hide-sm">Editar plano</span>
        </button>
        <strong className="viewer-title">{project.name}</strong>
        <div className="seg">
          <button className={mode === 'orbit' ? 'active' : ''} onClick={() => setMode('orbit')}>
            🧊 <span className="hide-sm">Vista volumen</span>
          </button>
          <button className={mode === 'walk' ? 'active' : ''} onClick={() => setMode('walk')}>
            🚶 <span className="hide-sm">Recorrido virtual</span>
          </button>
        </div>
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

      {empty && (
        <div className="viewer-empty">
          <p>Aún no hay ambientes en el plano.</p>
          <button className="primary" onClick={() => setScreen('editor')}>
            Dibujar el plano
          </button>
        </div>
      )}

      {mode === 'orbit' && !empty && <div className="viewer-hint">Arrastra para girar · Clic derecho para desplazar · Rueda para zoom</div>}

      {mode === 'walk' && (
        <>
          {!locked && (
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
