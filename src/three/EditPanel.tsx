import { DOOR_STYLES, OPENING_PRESETS, WALL_MATERIALS } from '../catalog';
import { addOpeningAt, setWallSide } from '../actions';
import { dist, nearestEdge, wallSide } from '../geometry';
import { useStore } from '../store';
import type { DoorStyle, Furniture, Opening, Project, Room, Vec2, WallMaterial, WallSide } from '../types';

/** Lo que se tocó en la vista 3D con la edición activa. */
export type Pick = { kind: 'opening' | 'room' | 'furniture' | 'floor'; id: string; point?: Vec2 };

/** Elemento que se reubicará con el siguiente toque. */
export type MoveTarget = { kind: 'opening' | 'furniture'; id: string };

function Num({ label, value, onChange, min = 0.05, max = 60, step = 0.05 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}

/** Panel flotante de la vista 3D para editar la puerta, pared, cerco u objeto que se tocó. */
export function EditPanel({
  project,
  pick,
  onPick,
  onMove,
  onClose,
}: {
  project: Project;
  pick: Pick;
  /** cambia lo que se edita (p. ej. a la puerta recién agregada) */
  onPick: (p: Pick) => void;
  /** pide que el siguiente toque reubique esta puerta u objeto */
  onMove: (target: MoveTarget) => void;
  onClose: () => void;
}) {
  const mutate = useStore((s) => s.mutate);
  const level = project.levels.find((l) => (pick.kind === 'room' ? l.rooms : pick.kind === 'opening' ? l.openings : l.furniture).some((x) => x.id === pick.id));
  if (!level || pick.kind === 'floor') return null;

  // los cambios se aplican por id en el nivel del elemento, sin mover su lugar en la lista
  const edit = <T extends Opening | Room | Furniture>(list: 'openings' | 'rooms' | 'furniture', change: Partial<T>) =>
    mutate((p) => {
      const item = (p.levels.find((l) => l.id === level.id)?.[list] as { id: string }[] | undefined)?.find((x) => x.id === pick.id);
      if (item) Object.assign(item, change);
    });
  const remove = (list: 'openings' | 'furniture') => {
    mutate((p) => {
      const l = p.levels.find((x) => x.id === level.id);
      if (l) (l[list] as { id: string }[]) = l[list].filter((x) => x.id !== pick.id);
    });
    onClose();
  };

  let title = '';
  let body: React.ReactNode = null;

  if (pick.kind === 'opening') {
    const o = level.openings.find((x) => x.id === pick.id)!;
    const host = level.rooms.find((r) => r.id === o.roomId);
    const len = host ? dist(host.points[o.edge % host.points.length], host.points[(o.edge + 1) % host.points.length]) : 1;
    // deslizar por su pared sin salirse de ella; el muro se rellena y se reabre solo
    const slide = (s: number) => {
      const half = o.width / 2 / len;
      edit<Opening>('openings', { t: Math.min(1 - half, Math.max(half, s / len)) });
    };
    title = o.kind === 'window' ? '🪟 Ventana' : '🚪 Puerta';
    body = (
      <>
        {o.kind === 'door' && (
          <label className="field">
            <span>Tipo de puerta</span>
            <select value={o.door ?? ''} onChange={(e) => edit<Opening>('openings', { door: (e.target.value || undefined) as DoorStyle | undefined })}>
              <option value="">Sin puerta (solo el vano)</option>
              {DOOR_STYLES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid2">
          <Num label="Ancho (m)" value={o.width} min={0.3} max={Math.max(0.3, len - 0.1)} onChange={(width) => edit<Opening>('openings', { width })} />
          <Num label="Alto (m)" value={o.height} min={0.3} max={20} onChange={(height) => edit<Opening>('openings', { height })} />
          {o.kind === 'window' && <Num label="Alféizar (m)" value={o.sill} min={0} max={20} onChange={(sill) => edit<Opening>('openings', { sill })} />}
        </div>
        <label className="field">
          <span>
            Posición en la pared: {(o.t * len).toFixed(2)} de {len.toFixed(2)} m
          </span>
          <input type="range" min={0} max={len} step={0.05} value={o.t * len} onChange={(e) => slide(Number(e.target.value))} />
        </label>
        <div className="row">
          <button className="secondary small" onClick={() => slide(o.t * len - 0.25)} title="Mover 25 cm">
            ◀ 25 cm
          </button>
          <button className="secondary small" onClick={() => slide(len / 2)} title="Centrar en la pared">
            Centrar
          </button>
          <button className="secondary small" onClick={() => slide(o.t * len + 0.25)} title="Mover 25 cm">
            25 cm ▶
          </button>
        </div>
        <button className="secondary small" onClick={() => onMove({ kind: 'opening', id: o.id })}>
          ↔ Mover a otro punto u otra pared
        </button>
        <button className="danger small" onClick={() => remove('openings')}>
          🗑 Eliminar
        </button>
      </>
    );
  } else if (pick.kind === 'room') {
    const r = level.rooms.find((x) => x.id === pick.id)!;
    const spot = pick.point ? nearestEdge([r], pick.point, Infinity) : null;
    const side = spot ? r.sides?.[spot.edge] : null;
    const real = spot ? wallSide(r, spot.edge, level.height, project.wallThickness) : null;
    const setSide = (patch: WallSide | null) => spot && setWallSide(r.id, spot.edge, patch);
    title = `🧱 Paredes de «${r.name}»`;
    body = (
      <>
        <label className="field">
          <span>Tipo de pared o cerco (todo el ambiente)</span>
          <select
            value={r.wallMaterial ?? 'liso'}
            onChange={(e) => {
              const m = WALL_MATERIALS.find((x) => x.id === e.target.value)!;
              edit<Room>('rooms', { wallMaterial: m.id as WallMaterial, wallColor: m.color });
            }}
          >
            {WALL_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <Num label="Altura (0 = al techo)" value={r.wallHeight ?? 0} min={0} max={30} onChange={(h) => edit<Room>('rooms', { wallHeight: h || undefined })} />
          <Num label="Grosor (0 = proyecto)" value={r.wallThickness ?? 0} min={0} max={1.5} step={0.01} onChange={(t) => edit<Room>('rooms', { wallThickness: t || undefined })} />
        </div>
        <label className="field">
          <span>Color</span>
          <input type="color" value={r.wallColor} onChange={(e) => edit<Room>('rooms', { wallColor: e.target.value })} />
        </label>
        {spot && (
          <>
            <strong>
              Solo este tramo ({dist(spot.a, spot.b).toFixed(2)} m{real ? ` · ${real.height.toFixed(2)} m de alto` : ' · sin pared'})
            </strong>
            <label className="field">
              <span>Material del tramo</span>
              <select
                value={side?.material ?? ''}
                onChange={(e) => {
                  const m = WALL_MATERIALS.find((x) => x.id === e.target.value);
                  setSide(e.target.value === '' ? { material: undefined, color: undefined } : e.target.value === 'none' ? { material: 'none', color: undefined } : { material: m!.id, color: m!.color });
                }}
              >
                <option value="">Igual que el ambiente</option>
                {WALL_MATERIALS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="none">Sin pared en este tramo</option>
              </select>
            </label>
            <Num label="Altura del tramo (0 = la del ambiente)" value={side?.height ?? 0} min={0} max={30} onChange={(h) => setSide({ height: h || undefined })} />
          </>
        )}
        {r.hasWalls && real && pick.point && (
          <>
            <strong>Agregar donde tocaste</strong>
            <div className="edit3d-grid">
              {OPENING_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="secondary small"
                  title={`${p.label} — ${p.width}×${p.height} m`}
                  onClick={() => {
                    const id = addOpeningAt(r.id, pick.point!, p.id);
                    if (id) onPick({ kind: 'opening', id });
                  }}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  } else {
    const f = level.furniture.find((x) => x.id === pick.id)!;
    const set = (change: Partial<Furniture>) => edit<Furniture>('furniture', change);
    title = '📦 Objeto';
    body = (
      <>
        <label className="field">
          <span>Nombre</span>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="inline check">
          <input type="checkbox" checked={!!f.showName} onChange={(e) => set({ showName: e.target.checked })} /> Mostrar rótulo con el nombre
        </label>
        <div className="grid2">
          <Num label="Largo (m)" value={f.w} onChange={(w) => set({ w })} />
          <Num label="Fondo (m)" value={f.d} min={0.02} onChange={(d) => set({ d })} />
          <Num label="Alto (m)" value={f.h} min={0.01} onChange={(h) => set({ h })} />
          <Num label="Elevación (m)" value={f.elevation} min={0} onChange={(elevation) => set({ elevation })} />
        </div>
        <span className="muted small">Girar ({Math.round(f.rotation)}°)</span>
        <div className="row">
          {[-90, -15, 15, 90].map((deg) => (
            <button key={deg} className="secondary small" onClick={() => set({ rotation: (((f.rotation + deg) % 360) + 360) % 360 })}>
              {deg > 0 ? '⟳' : '⟲'} {Math.abs(deg)}°
            </button>
          ))}
        </div>
        <span className="muted small">Mover 25 cm</span>
        <div className="row">
          <button className="secondary small" onClick={() => set({ x: f.x - 0.25 })} title="Hacia −X">
            ◀
          </button>
          <button className="secondary small" onClick={() => set({ y: f.y - 0.25 })} title="Hacia el fondo">
            ▲
          </button>
          <button className="secondary small" onClick={() => set({ y: f.y + 0.25 })} title="Hacia el frente">
            ▼
          </button>
          <button className="secondary small" onClick={() => set({ x: f.x + 0.25 })} title="Hacia +X">
            ▶
          </button>
        </div>
        <button className="secondary small" onClick={() => onMove({ kind: 'furniture', id: f.id })}>
          ↔ Mover: tocar el lugar nuevo
        </button>
        <label className="field">
          <span>Color</span>
          <input type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
        <button className="danger small" onClick={() => remove('furniture')}>
          🗑 Eliminar objeto
        </button>
      </>
    );
  }

  return (
    <aside className="edit3d">
      <div className="row">
        <strong>{title}</strong>
        <div className="spacer" />
        <button className="icon" onClick={onClose} title="Cerrar">
          ✕
        </button>
      </div>
      {body}
    </aside>
  );
}
