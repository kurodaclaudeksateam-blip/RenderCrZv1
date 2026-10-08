import { useCurrentLevel, useStore } from '../store';
import { useState } from 'react';
import { area, cellGrid, cellIndex, dist, fmt, levelHeights, perimeter } from '../geometry';
import { CATALOG, DOOR_STYLES, FLOOR_MATERIALS, WALL_MATERIALS, isFence } from '../catalog';
import { deleteSelection, duplicateSelection, rotateSelection, updateFurniture } from '../actions';
import type { DoorStyle, FloorMaterial, Furniture, Level, Opening, Project, Room, WallMaterial } from '../types';

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

const TEXT_TYPES = new Set(['letrero', 'letrero_pie', 'zona', 'anuncio_torre', 'anuncio_cuadro', 'anuncio_poste']);
const AD_TYPES = new Set(['anuncio_torre', 'anuncio_cuadro', 'anuncio_poste']);
const AD_MAX_SIDE = 640;

/** Reduce la imagen elegida y la devuelve en data URL como WebP al 70 % de calidad, para que el proyecto pese poco. */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, AD_MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const webp = c.toDataURL('image/webp', 0.7);
      // los navegadores que no generan WebP devuelven PNG: ahí se usa JPEG
      resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida'));
    };
    img.src = url;
  });
}

/** Imagen que rellena el anuncio; sin imagen se muestra el texto. */
function AdImage({ f, set }: { f: Furniture; set: (patch: Partial<Furniture>) => void }) {
  const notify = useStore((s) => s.notify);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      set({ image: await shrinkImage(file) });
    } catch {
      notify('⚠️ No se pudo leer la imagen');
    }
  };
  return (
    <div className="ad-image">
      {f.image && <img src={f.image} alt="Imagen del anuncio" />}
      <div className="row wrap">
        <label className="secondary small file-button">
          🖼️ {f.image ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {f.image && (
          <button className="secondary small" onClick={() => set({ image: undefined })}>
            Quitar imagen
          </button>
        )}
      </div>
      <p className="muted small">
        {f.image ? `La imagen rellena el anuncio por ambas caras · ${(f.image.length / 1024).toFixed(0)} KB.` : 'Sin imagen se muestra el texto. La imagen se ajusta al tamaño del anuncio y se reduce para que el proyecto pese poco.'}
      </p>
    </div>
  );
}
const SHELF_TYPES = new Set(['rack', 'estanteria_metal', 'cantilever']);
const CELL_TYPES = new Set(['rack_custom', 'tarima_custom']);
const BOX_COLORS = ['#c69c6d', '#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#f8fafc', '#334155'];

/** Rack y tarima a medida: se elige un color y se toca cada posición para poner o quitar su caja. */
function CellEditor({ f, set }: { f: Furniture; set: (patch: Partial<Furniture>) => void }) {
  const [color, setColor] = useState(BOX_COLORS[0]);
  const [layer, setLayer] = useState(0);
  const g = cellGrid(f);
  const isRack = f.type === 'rack_custom';
  const total = g.cols * g.rows * g.layers;
  const cells = Array.from({ length: total }, (_, i) => f.cells?.[i] ?? '');
  const shown = Math.min(layer, g.layers - 1);

  // al cambiar la rejilla cada caja conserva su posición (columna, fila, capa)
  const resize = (patch: Partial<Furniture>) => {
    const ng = cellGrid({ ...f, ...patch });
    const next = new Array<string>(ng.cols * ng.rows * ng.layers).fill('');
    for (let l = 0; l < Math.min(g.layers, ng.layers); l++)
      for (let r = 0; r < Math.min(g.rows, ng.rows); r++)
        for (let c = 0; c < Math.min(g.cols, ng.cols); c++) next[cellIndex(ng, l, r, c)] = cells[cellIndex(g, l, r, c)];
    set({ ...patch, cells: next });
  };
  const toggle = (i: number) => set({ cells: cells.map((v, j) => (j !== i ? v : v === color ? '' : color)) });
  const cell = (l: number, r: number, c: number) => {
    const i = cellIndex(g, l, r, c);
    return <button key={i} type="button" className={cells[i] ? 'full' : ''} style={{ background: cells[i] || undefined }} onClick={() => toggle(i)} title={cells[i] ? 'Quitar o cambiar caja' : 'Poner caja'} />;
  };

  return (
    <div className="cell-editor">
      <div className="grid2">
        <Num label={isRack ? 'Niveles de carga' : 'Capas de cajas'} value={f.shelves ?? 3} step={1} min={1} max={12} unit="" onChange={(n) => resize({ shelves: Math.max(1, Math.min(12, Math.round(n))) })} />
        <Num label="Posiciones a lo ancho" value={g.cols} step={1} min={1} max={24} unit="" onChange={(n) => resize({ cols: Math.max(1, Math.min(24, Math.round(n))) })} />
        {!isRack && <Num label="Posiciones a lo fondo" value={g.rows} step={1} min={1} max={12} unit="" onChange={(n) => resize({ rows: Math.max(1, Math.min(12, Math.round(n))) })} />}
      </div>
      <div className="cell-colors">
        {BOX_COLORS.map((c) => (
          <button key={c} type="button" className={c === color ? 'active' : ''} style={{ background: c }} onClick={() => setColor(c)} title={`Color ${c}`} />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Otro color" />
      </div>
      {!isRack && (
        <label className="field">
          <span>Capa que se edita (1 = sobre la tarima)</span>
          <select value={shown} onChange={(e) => setLayer(Number(e.target.value))}>
            {Array.from({ length: g.layers }, (_, l) => (
              <option key={l} value={l}>
                Capa {l + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="cell-grid" style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)` }}>
        {isRack
          ? Array.from({ length: g.layers }, (_, k) => g.layers - 1 - k).flatMap((l) => Array.from({ length: g.cols }, (_, c) => cell(l, 0, c)))
          : Array.from({ length: g.rows }, (_, r) => Array.from({ length: g.cols }, (_, c) => cell(shown, r, c)))}
      </div>
      <p className="muted small">
        {isRack ? 'Vista de frente: la fila de abajo es el piso. ' : 'Vista desde arriba. '}
        Elige un color y toca una posición para poner la caja; tócala otra vez con el mismo color para quitarla.
      </p>
      <div className="row wrap">
        <button className="secondary small" onClick={() => set({ cells: cells.map((v, i) => (isRack || Math.floor(i / (g.cols * g.rows)) === shown ? color : v)) })}>
          {isRack ? 'Llenar todo' : 'Llenar capa'}
        </button>
        <button className="secondary small" onClick={() => set({ cells: cells.map(() => '') })}>
          Vaciar
        </button>
      </div>
    </div>
  );
}

/** Posiciones de pallet de un rack: módulos × filas × (niveles + piso) × huecos por módulo. */
export function palletPositions(f: Furniture) {
  if (f.type === 'rack_custom') {
    const g = cellGrid(f);
    return g.cols * g.layers;
  }
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
      {AD_TYPES.has(f.type) && <AdImage f={f} set={set} />}
      {SHELF_TYPES.has(f.type) && (
        <Num label="Niveles de carga" value={f.shelves ?? 4} step={1} min={1} max={12} unit="" onChange={(n) => set({ shelves: Math.round(n) })} />
      )}
      {(f.type === 'rack' || f.type === 'estanteria_metal') && (
        <label className="field">
          <span>Carga</span>
          <select value={f.empty ? 'sin' : 'con'} onChange={(e) => set({ empty: e.target.value === 'sin' })}>
            <option value="con">Con cajas</option>
            <option value="sin">Sin cajas (solo estructura)</option>
          </select>
        </label>
      )}
      {CELL_TYPES.has(f.type) && <CellEditor f={f} set={set} />}
      {(f.type === 'rack' || f.type === 'rack_custom') && <p className="muted small">Capacidad: <b>{palletPositions(f)}</b> posiciones de pallet</p>}
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
      <label className="field">
        <span>Material de muros</span>
        <select
          value={r.wallMaterial ?? 'liso'}
          onChange={(e) => {
            const m = WALL_MATERIALS.find((x) => x.id === e.target.value)!;
            set({ wallMaterial: m.id as WallMaterial, wallColor: m.color });
          }}
        >
          {WALL_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {isFence(r.wallMaterial) && <Num label="Altura del cerco" value={r.wallHeight ?? 2} min={0.5} max={12} onChange={(wallHeight) => set({ wallHeight })} />}
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
      {o.kind === 'door' && (
        <label className="field">
          <span>Tipo de puerta</span>
          <select value={o.door ?? ''} onChange={(e) => set({ door: (e.target.value || undefined) as DoorStyle | undefined })}>
            <option value="">Sin puerta (solo el vano)</option>
            {DOOR_STYLES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}
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
  const realHeight = levelHeights(project.levels)[project.levels.indexOf(level)] ?? level.height;
  const positions = level.furniture.reduce((n, f) => n + palletPositions(f), 0);
  const zoneArea = level.furniture.filter((f) => f.type === 'zona').reduce((a, f) => a + f.w * f.d, 0);
  return (
    <div className="props">
      <h2>
        <span className="props-icon">🏠</span> Nivel actual
      </h2>
      <Text label="Nombre del nivel" value={level.name} onChange={(name) => mutate((_, l) => void (l.name = name))} />
      <Num label="Altura de piso a techo" value={level.height} min={2} max={30} onChange={(height) => mutate((_, l) => void (l.height = height))} />
      {realHeight > level.height && (
        <p className="muted small">
          En 3D este nivel mide <b>{fmt(realHeight)} m</b>: tiene objetos más altos que quedan debajo del nivel superior, y la losa de arriba se coloca por encima de ellos.
        </p>
      )}
      <div className="stats">
        <div><b>{level.rooms.length}</b><span>ambientes</span></div>
        <div><b>{fmt(totalArea, 1)}</b><span>m² totales</span></div>
        <div><b>{level.furniture.length}</b><span>objetos</span></div>
        <div><b>{positions}</b><span>posiciones pallet</span></div>
        <div><b>{fmt(zoneArea, 0)}</b><span>m² en zonas</span></div>
        <div><b>{level.furniture.filter((f) => f.type === 'rack' || f.type === 'rack_custom' || f.type === 'estanteria_metal' || f.type === 'cantilever').length}</b><span>estructuras</span></div>
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
