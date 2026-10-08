import { useEffect, useState } from 'react';
import { listTrash, restoreProject, type TrashItem } from '../cloud';
import { useStore } from '../store';

const KEEP_DAYS = 30;

/** Proyectos eliminados en los últimos 30 días; se pueden restaurar. */
export function TrashDialog({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState(false);
  const notify = useStore((s) => s.notify);

  useEffect(() => {
    let alive = true;
    listTrash()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const restore = async (item: TrashItem) => {
    try {
      await restoreProject(item.id);
      setItems((list) => list?.filter((x) => x.id !== item.id) ?? null);
      notify(`♻️ "${item.name}" restaurado`);
      onRestored();
    } catch {
      notify('⚠️ No se pudo restaurar el proyecto');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>🗑 Papelera</h2>
        {error ? (
          <p className="danger-text">No se pudo consultar la papelera. Revisa tu conexión.</p>
        ) : !items ? (
          <p className="muted">
            <span className="spinner inline-spinner" /> Cargando…
          </p>
        ) : items.length === 0 ? (
          <p className="muted">La papelera está vacía.</p>
        ) : (
          <div className="names-table">
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Eliminado</th>
                  <th>Se borra en</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const left = Math.max(0, Math.ceil(KEEP_DAYS - (Date.now() - it.deletedAt) / 86400000));
                  return (
                    <tr key={it.id}>
                      <td>{it.name}</td>
                      <td className="muted small">{new Date(it.deletedAt).toLocaleString()}</td>
                      <td className="muted small">
                        {left} {left === 1 ? 'día' : 'días'}
                      </td>
                      <td>
                        <button className="primary small" onClick={() => restore(it)}>
                          ♻️ Restaurar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">Los proyectos eliminados se guardan {KEEP_DAYS} días. Al restaurar uno vuelve a «Mis proyectos» y su liga para compartir funciona de nuevo.</p>
        <div className="row end">
          <button className="secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
