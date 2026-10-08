import { DOOR_STYLES, OPENING_PRESETS, WALL_MATERIALS, isFence } from '../catalog';
import { addOpeningAt } from '../actions';
import { dist } from '../geometry';
import { useStore } from '../store';
import type { DoorStyle, Furniture, Opening, Project, Room, Vec2, WallMaterial } from '../types';

/** Lo que se tocó en la vista 3D con la edición activa. */
export type Pick = { kind: 'opening' | 'room' | 'furniture'; id: string; point?: Vec2 };

function Num({ label, value, onChange, min = 0.05, max = 60 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={0.05}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
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
  /** pide que el siguiente toque sobre una pared reubique esta puerta */
  onMove: (openingId: string) => void;
  onClose: () => void;
}) {
  const mutate = useStore((s) => s.mutate);
  const level = project.levels.find((l) => (pick.kind === 'room' ? l.rooms : pick.kind === 'opening' ? l.openings : l.furniture).some((x) => x.id === pick.id));
  if (!level) return null;

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
        <div className="grid2">
          <Num label="Ancho (m)" value={o.width} min={0.3} max={20} onChange={(width) => edit<Opening>('openings', { width })} />
          <Num label="Alto (m)" value={o.height} min={0.3} max={20} onChange={(height) => edit<Opening>('openings', { height })} />
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
        <button className="secondary small" onClick={() => onMove(o.id)}>
          ↔ Mover a otro punto u otra pared
        </button>
        <button className="danger small" onClick={() => remove('openings')}>
          🗑 Eliminar puerta
        </button>
      </>
    );
  } else if (pick.kind === 'room') {
    const r = level.rooms.find((x) => x.id === pick.id)!;
    title = `🧱 Paredes de «${r.name}»`;
    body = (
      <>
        <label className="field">
          <span>Tipo de pared o cerco</span>
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
        {isFence(r.wallMaterial) && <Num label="Altura del cerco (m)" value={r.wallHeight ?? 2} min={0.5} max={12} onChange={(wallHeight) => edit<Room>('rooms', { wallHeight })} />}
        <label className="field">
          <span>Color</span>
          <input type="color" value={r.wallColor} onChange={(e) => edit<Room>('rooms', { wallColor: e.target.value })} />
        </label>
        {r.hasWalls && pick.point && (
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
    title = '📦 Objeto';
    body = (
      <>
        <label className="field">
          <span>Nombre</span>
          <input value={f.name} onChange={(e) => edit<Furniture>('furniture', { name: e.target.value })} />
        </label>
        <label className="inline check">
          <input type="checkbox" checked={!!f.showName} onChange={(e) => edit<Furniture>('furniture', { showName: e.target.checked })} /> Mostrar rótulo con el nombre
        </label>
        <div className="grid2">
          <Num label="Largo (m)" value={f.w} onChange={(w) => edit<Furniture>('furniture', { w })} />
          <Num label="Alto (m)" value={f.h} onChange={(h) => edit<Furniture>('furniture', { h })} />
        </div>
        <label className="field">
          <span>Color</span>
          <input type="color" value={f.color} onChange={(e) => edit<Furniture>('furniture', { color: e.target.value })} />
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
