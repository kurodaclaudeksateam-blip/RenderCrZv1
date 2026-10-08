import { useEffect, useState } from 'react';
import { cloudInfo, shareProject } from '../cloud';
import { useStore } from '../store';
import type { Project } from '../types';

/** Sube el proyecto y muestra su liga pública de solo lectura. */
export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const notify = useStore((s) => s.notify);
  const bytes = cloudInfo()[project.id]?.bytes;

  useEffect(() => {
    let alive = true;
    // se comparte la versión más reciente que esté abierta en el editor
    const current = useStore.getState().project;
    shareProject(current?.id === project.id ? current : project)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [project]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify('🔗 Liga copiada');
    } catch {
      notify('Selecciona la liga y cópiala manualmente');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Compartir “{project.name}”</h2>
        {error ? (
          <p className="danger-text">No se pudo subir el proyecto a la nube. Revisa tu conexión e inténtalo de nuevo.</p>
        ) : !url ? (
          <p className="muted">
            <span className="spinner inline-spinner" /> Guardando en la nube…
          </p>
        ) : (
          <>
            <p className="muted small">
              Cualquier persona con esta liga puede ver el proyecto sin contraseña: verá cómo se arma en 10 segundos y después podrá recorrerlo o verlo en 3D. No puede editarlo.
            </p>
            <div className="share-row">
              <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Liga para compartir" />
              <button className="primary" onClick={copy}>
                Copiar
              </button>
            </div>
            <p className="muted tiny">
              La liga siempre muestra la última versión guardada{bytes ? ` · pesa ${(bytes / 1024).toFixed(1)} KB en la nube` : ''}.
            </p>
          </>
        )}
        <div className="row end">
          {url && (
            <a className="ghost button-link" href={url} target="_blank" rel="noreferrer">
              Abrir liga ↗
            </a>
          )}
          <button className="secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
