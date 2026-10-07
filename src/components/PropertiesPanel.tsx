import { useCurrentLevel, useStore } from '../store';
import { area, dist, fmt, perimeter } from '../geometry';
import { CATALOG, FLOOR_MATERIALS } from '../catalog';
import { deleteSelection, duplicateSelection, rotateSelection, updateFurniture } from '../actions';
import type { FloorMaterial, Furniture, Level, Opening, Project, Room } from '../types';

/** Campo numérico que confirma con Enter o al salir. */
function Num({ label, value, onChange, step = 0.05, min, max, unit = 'm' }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; unit?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="num">
        <input
          key={value}
          type="number"
          step={step}
          min={min}
          max={max}
          defaultValue={Number(fmt(value, 3))}
          onBlur={(e) => {
            let n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            if (min !== undefined) n = Math.max(min, n);
            if (max !== undefined) n = Math.min(max, n);
            if (n !== value) onChange(n);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <em>{unit}</em>
      </div>
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input key={value} defaultValue={value} onBlur={(e) => e.target.value !== value && onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <label className="field color">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function PropertiesPanel() {
  const project = useStore((s) => s.project)!;
  const level = useCurrentLevel()!;
  const selection = useStore((s) => s.selection);

  if (selection?.kind === 'furniture') {
    const f = level.furniture.find((x) => x.id === selection.id);
    if (f) return <FurnitureProps f={f} />;
  }
  if (selection?.kind === 'room') {
    const r = level.rooms.find((x) => x.id === selection.id);
    if (r) return <RoomProps r={r} />;
  }
  if (selection?.kind === 'opening') {
    const o = level.openings.find((x) => x.id === selection.id);
    if (o) return <OpeningProps o={o} level={level} />;
  }
  return <ProjectProps project={project} level={level} />;
}

const TEXT_TYPES = new Set(['letrero', 'letrero_pie', 'zona']);
const SHELF_TYPES = new Set(['rack', 'estanteria_metal', 'cantilever']);

/** Posiciones de pallet de un rack: módulos × filas × (niveles + piso) × huecos por módulo. */
export function palletPositions(f: Furniture) {
  if (f.type !== 'rack') return 0;
  const bays = Math.max(1, Math.round(f.w / 2.7));
  const rows = f.d > 1.8 ? 2 : 1;
  const slots = Math.max(1, Math.floor((f.w / bays - 0.08) / 1.25));
  return bays * rows * slots * (Math.max(1, Math.round(f.shelves ?? 4)) + 1);
}

function Actions({ rotate = false, duplicate = true }: { rotate?: boolean; duplicate?: boolean }) {
  return (
    <div className="row wrap">
      {rotate && (
        <>
          <button className="secondary small" onClick={() => rotateSelection(-90)} title="Girar -90° (Shift+R)">⟲ 90°</button>
          <button className="secondary small" onClick={() => rotateSelection(90)} title="Girar 90° (R)">⟳ 90°</button>
        </>
      )}
      {duplicate && <button className="secondary small" onClick={duplicateSelection} title="Duplicar (Ctrl+D)">⧉ Duplicar</button>}
      <button className="danger small" onClick={deleteSelection} title="Eliminar (Supr)">🗑 Eliminar</button>
    </div>
  );
}

function FurnitureProps({ f }: { f: Furniture }) {
  const set = (patch: Partial<Furniture>) => updateFurniture(f.id, patch);
  const cat = CATALOG.find((c) => c.type === f.type);
  return (
    <div className="props">
      <h2>
        <span className="props-icon">{cat?.icon ?? '⬜'}</span> Objeto
      </h2>
      <Text label="Nombre" value={f.name} onChange={(name) => set({ name })} />
      {TEXT_TYPES.has(f.type) && <Text label="Texto del letrero / zona" value={f.label ?? ''} onChange={(label) => set({ label: label.toUpperCase() })} />}
      {SHELF_TYPES.has(f.type) && (
        <Num label="Niveles de carga" value={f.shelves ?? 4} step={1} min={1} max={12} unit="" onChange={(n) => set({ shelves: Math.round(n) })} />
      )}
      {f.type === 'rack' && <p className="muted small">Capacidad: <b>{palletPositions(f)}</b> posiciones de pallet</p>}
      <label className="field">
        <span>Tipo (modelo 3D)</span>
        <select value={f.type} onChange={(e) => set({ type: e.target.value as Furniture['type'] })}>
          {[...new Map(CATALOG.map((c) => [c.type, c])).values()].map((c) => (
            <option key={c.type} value={c.type}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid2">
        <Num label="Ancho" value={f.w} min={0.05} onChange={(w) => set({ w })} />
        <Num label="Profundidad" value={f.d} min={0.05} onChange={(d) => set({ d })} />
        <Num label="Alto" value={f.h} min={0.01} onChange={(h) => set({ h })} />
        <Num label="Elevación" value={f.elevation} min={0} onChange={(elevation) => set({ elevation })} />
        <Num label="Posición X" value={f.x} onChange={(x) => set({ x })} />
        <Num label="Posición Y" value={f.y} onChange={(y) => set({ y })} />
        <Num label="Rotación" value={f.rotation} step={15} unit="°" onChange={(r) => set({ rotation: ((r % 360) + 360) % 360 })} />
        <Color label="Color" value={f.color} onChange={(color) => set({ color })} />
      </div>
      <Actions rotate />
      <p className="tip">Arrastra el mueble para moverlo y usa el círculo ⟳ para girarlo (Shift = giro libre).</p>
    </div>
  );
}

function RoomProps({ r }: { r: Room }) {
  const mutate = useStore((s) => s.mutate);
  const set = (patch: Partial<Room>) =>
    mutate((_, l) => {
      const room = l.rooms.find((x) => x.id === r.id);
      if (room) Object.assign(room, patch);
    });
  return (
    <div className="props">
      <h2>
        <span className="props-icon">⬠</span> Ambiente
      </h2>
      <Text label="Nombre" value={r.name} onChange={(name) => set({ name })} />
      <div className="stats">
        <div><b>{fmt(area(r.points), 2)}</b><span>m² área</span></div>
        <div><b>{fmt(perimeter(r.points), 2)}</b><span>m perímetro</span></div>
        <div><b>{r.points.length}</b><span>vértices</span></div>
      </div>
      <label className="field">
        <span>Piso</span>
        <select
          value={r.floor}
          onChange={(e) => {
            const m = FLOOR_MATERIALS.find((x) => x.id === e.target.value)!;
            set({ floor: m.id as FloorMaterial, floorColor: m.color });
          }}
        >
          {FLOOR_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid2">
        <Color label="Color piso" value={r.floorColor} onChange={(floorColor) => set({ floorColor })} />
        <Color label="Color muros" value={r.wallColor} onChange={(wallColor) => set({ wallColor })} />
      </div>
      <label className="check">
        <input type="checkbox" checked={r.hasWalls} onChange={(e) => set({ hasWalls: e.target.checked })} />
        Levantar muros (desactívalo para terrazas o patios)
      </label>
      <details>
        <summary>Coordenadas de vértices</summary>
        <div className="vertex-list">
          {r.points.map((p, i) => (
            <div key={i} className="vertex-row">
              <span className="muted">{i + 1}</span>
              <Num label="x" value={p.x} onChange={(x) => mutate((_, l) => { const rr = l.rooms.find((q) => q.id === r.id); if (rr) rr.points[i].x = x; })} />
              <Num label="y" value={p.y} onChange={(y) => mutate((_, l) => { const rr = l.rooms.find((q) => q.id === r.id); if (rr) rr.points[i].y = y; })} />
              <span className="muted small">→ {fmt(dist(p, r.points[(i + 1) % r.points.length]))} m</span>
            </div>
          ))}
        </div>
      </details>
      <Actions />
      <p className="tip">
        Arrastra los vértices para deformar el ambiente. Doble clic sobre una arista agrega un vértice; Alt+clic en un vértice lo elimina.
        Al mover el ambiente se mueven también sus muebles (Shift para moverlo solo).
      </p>
    </div>
  );
}

function OpeningProps({ o, level }: { o: Opening; level: Level }) {
  const mutate = useStore((s) => s.mutate);
  const room = level.rooms.find((r) => r.id === o.roomId);
  const edgeLen = room ? dist(room.points[o.edge], room.points[(o.edge + 1) % room.points.length]) : 1;
  const set = (patch: Partial<Opening>) =>
    mutate((_, l) => {
      const op = l.openings.find((x) => x.id === o.id);
      if (!op) return;
      Object.assign(op, patch);
      const half = op.width / 2 / edgeLen;
      op.t = Math.min(1 - half, Math.max(half, op.t));
    });
  return (
    <div className="props">
      <h2>
        <span className="props-icon">{o.kind === 'door' ? '🚪' : '🪟'}</span> {o.kind === 'door' ? 'Puerta' : 'Ventana'}
      </h2>
      <div className="seg">
        <button className={o.kind === 'door' ? 'active' : ''} onClick={() => set({ kind: 'door', sill: 0, height: 2.1 })}>Puerta</button>
        <button className={o.kind === 'window' ? 'active' : ''} onClick={() => set({ kind: 'window', sill: 0.9, height: 1.2 })}>Ventana</button>
      </div>
      <div className="grid2">
        <Num label="Ancho" value={o.width} min={0.3} max={edgeLen} onChange={(width) => set({ width })} />
        <Num label="Alto" value={o.height} min={0.3} max={level.height} onChange={(height) => set({ height })} />
        {o.kind === 'window' && <Num label="Alféizar" value={o.sill} min={0} max={level.height - 0.3} onChange={(sill) => set({ sill })} />}
        <Num label="Posición en muro" value={o.t * edgeLen} min={0} max={edgeLen} onChange={(s) => set({ t: s / edgeLen })} />
      </div>
      <p className="muted small">Muro de {fmt(edgeLen)} m en «{room?.name}». Arrastra el vano para deslizarlo por el muro.</p>
      <Actions duplicate={false} />
    </div>
  );
}

function ProjectProps({ project, level }: { project: Project; level: Level }) {
  const mutate = useStore((s) => s.mutate);
  const gridSize = useStore((s) => s.gridSize);
  const snap = useStore((s) => s.snap);
  const ghost = useStore((s) => s.showGhost);
  const autosave = useStore((s) => s.autosave);
  const { setGrid, toggleSnap, toggleGhost, setAutosave } = useStore.getState();
  const totalArea = level.rooms.reduce((a, r) => a + area(r.points), 0);
  const positions = level.furniture.reduce((n, f) => n + palletPositions(f), 0);
  const zoneArea = level.furniture.filter((f) => f.type === 'zona').reduce((a, f) => a + f.w * f.d, 0);
  return (
    <div className="props">
      <h2>
        <span className="props-icon">🏠</span> Nivel actual
      </h2>
      <Text label="Nombre del nivel" value={level.name} onChange={(name) => mutate((_, l) => void (l.name = name))} />
      <Num label="Altura de piso a techo" value={level.height} min={2} max={30} onChange={(height) => mutate((_, l) => void (l.height = height))} />
      <div className="stats">
        <div><b>{level.rooms.length}</b><span>ambientes</span></div>
        <div><b>{fmt(totalArea, 1)}</b><span>m² totales</span></div>
        <div><b>{level.furniture.length}</b><span>objetos</span></div>
        <div><b>{positions}</b><span>posiciones pallet</span></div>
        <div><b>{fmt(zoneArea, 0)}</b><span>m² en zonas</span></div>
        <div><b>{level.furniture.filter((f) => f.type === 'rack' || f.type === 'estanteria_metal' || f.type === 'cantilever').length}</b><span>estructuras</span></div>
      </div>

      <h2>
        <span className="props-icon">📐</span> Proyecto
      </h2>
      <Num label="Grosor de muros" value={project.wallThickness} min={0.05} max={0.6} step={0.01} onChange={(t) => mutate((p) => void (p.wallThickness = t))} />
      <label className="field">
        <span>Cuadrícula</span>
        <select value={gridSize} onChange={(e) => setGrid(Number(e.target.value))}>
          {[0.05, 0.1, 0.25, 0.5, 1].map((g) => (
            <option key={g} value={g}>
              {g * 100} cm
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={snap} onChange={toggleSnap} /> Ajustar a la cuadrícula
      </label>
      <label className="check">
        <input type="checkbox" checked={ghost} onChange={toggleGhost} /> Mostrar nivel inferior como guía
      </label>
      <label className="check">
        <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} /> Autoguardado
      </label>

      <div className="help">
        <h4>Atajos</h4>
        <ul>
          <li><kbd>V</kbd> seleccionar · <kbd>P</kbd> ambiente irregular · <kbd>B</kbd> rectángulo</li>
          <li><kbd>D</kbd> puerta · <kbd>G</kbd> portón · <kbd>W</kbd> ventana · <kbd>H</kbd> desplazar · <kbd>F</kbd> encuadrar</li>
          <li><kbd>R</kbd> girar 90° · <kbd>Q</kbd>/<kbd>E</kbd> girar 15° · <kbd>Flechas</kbd> mover</li>
          <li><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+D</kbd> duplicar · <kbd>Supr</kbd> eliminar</li>
          <li><kbd>Espacio</kbd>+arrastrar o rueda del mouse para navegar</li>
        </ul>
      </div>
    </div>
  );
}
