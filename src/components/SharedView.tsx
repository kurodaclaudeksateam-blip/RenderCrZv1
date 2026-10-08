import { lazy, Suspense, useEffect, useState } from 'react';
import { fetchShared, type SharedProject } from '../cloud';

const Viewer3D = lazy(() => import('../three/Viewer3D'));

/** Vista pública de una liga: sin contraseña, muestra el armado del proyecto y luego la vista 3D o el recorrido. */
export default function SharedView({ share }: { share: string }) {
  const [state, setState] = useState<SharedProject | 'loading' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetchShared(share)
      .then((s) => {
        if (!alive) return;
        setState(s ?? 'missing');
        if (s) document.title = `${s.name} · RenderCrZ`;
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [share]);

  const loading = (
    <div className="shared-state">
      <span className="spinner" />
      <p>Cargando el proyecto…</p>
    </div>
  );

  if (state === 'loading') return loading;
  if (state === 'missing' || state === 'error') {
    return (
      <div className="shared-state">
        <h1>{state === 'missing' ? 'Este proyecto ya no está disponible' : 'No se pudo cargar el proyecto'}</h1>
        <p>{state === 'missing' ? 'La liga no existe o el proyecto fue eliminado.' : 'Revisa tu conexión y vuelve a abrir la liga.'}</p>
      </div>
    );
  }
  return (
    <Suspense fallback={loading}>
      <Viewer3D project={state.project} shared />
    </Suspense>
  );
}
