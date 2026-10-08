import { useState } from 'react';
import { CATALOG } from '../catalog';
import { useCurrentLevel, useStore } from '../store';
import type { Furniture } from '../types';

const RACK_TYPES = new Set<Furniture['type']>(['rack', 'rack_custom', 'rack_tubos', 'estanteria_metal', 'cantilever']);
const ICONS = new Map(CATALOG.map((c) => [c.type, c.icon]));

/**
 * Tabla para nombrar los objetos del nivel y decidir cuáles muestran su rótulo.
 * Las filas siguen el orden en que se crearon los objetos; aquí nunca se reordenan.
 */
export function NamesDialog({ onClose }: { onClose: () => void }) {
  const level = useCurrentLevel()!;
  const mutate = useStore((s) => s.mutate);
  const select = useStore((s) => s.select);
  const [all, setAll] = useState(false);
  const [prefix, setPrefix] = useState('Rack ');
  const rows = level.furniture.map((f, i) => ({ f, i })).filter(({ f }) => all || RACK_TYPES.has(f.type));
  const ids = new Set(rows.map((r) => r.f.id));

  const patch = (id: string, change: Partial<Furniture>) =>
    mutate((_, l) => {
      const f = l.furniture.find((x) => x.id === id);
      if (f) Object.assign(f, change);
    });
  const patchListed = (change: (f: Furniture, n: number) => Partial<Furniture>) =>
    mutate((_, l) => {
      let n = 0;
      for (const f of l.furniture) if (ids.has(f.id)) Object.assign(f, change(f, n++));
    });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Nombres y rótulos · {level.name}</h2>
        <div className="row wrap">
          <div className="seg">
            <button className={all ? '' : 'active'} onClick={() => setAll(false)}>
              Racks y anaqueles
            </button>
            <button className={all ? 'active' : ''} onClick={() => setAll(true)}>
              Todos los objetos
            </button>
          </div>
          <div className="spacer" />
          <button className="secondary small" onClick={() => patchListed(() => ({ showName: true }))} disabled={!rows.length}>
            Mostrar todos los rótulos
          </button>
          <button className="secondary small" onClick={() => patchListed(() => ({ showName: false }))} disabled={!rows.length}>
            Ocultar todos
          </button>
        </div>
        <div className="row wrap">
          <label className="inline">
            Numerar con prefijo
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ width: 110 }} />
          </label>
          <button className="secondary small" onClick={() => patchListed((_, n) => ({ name: `${prefix}${String(n + 1).padStart(2, '0')}` }))} disabled={!rows.length} title="Renombra los objetos de la lista en su orden actual">
            Numerar la lista
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted">Este nivel no tiene {all ? 'objetos' : 'racks ni anaqueles'}.</p>
        ) : (
          <div className="names-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Medidas</th>
                  <th>Rótulo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ f, i }) => (
                  <tr key={f.id}>
                    <td className="muted">
                      {i + 1} {ICONS.get(f.type) ?? '⬜'}
                    </td>
                    <td>
                      <input value={f.name} onChange={(e) => patch(f.id, { name: e.target.value })} onFocus={() => select({ kind: 'furniture', id: f.id })} aria-label={`Nombre del objeto ${i + 1}`} />
                    </td>
                    <td className="muted small">
                      {f.w}×{f.d}×{f.h} m
                    </td>
                    <td>
                      <input type="checkbox" checked={!!f.showName} onChange={(e) => patch(f.id, { showName: e.target.checked })} aria-label={`Mostrar rótulo del objeto ${i + 1}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">El rótulo muestra el nombre sobre el objeto en la vista 3D, en el recorrido y en el plano. El número es el orden en que se creó cada objeto y no cambia.</p>
        <div className="row end">
          <button className="primary" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
