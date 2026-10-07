import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
import HomeScreen from './components/HomeScreen';
import EditorScreen from './components/EditorScreen';
import Intro from './components/Intro';

const Viewer3D = lazy(() => import('./three/Viewer3D'));

export default function App() {
  const screen = useStore((s) => s.screen);
  const project = useStore((s) => s.project);
  const dirty = useStore((s) => s.dirty);
  const autosave = useStore((s) => s.autosave);
  const toast = useStore((s) => s.toast);
  const [intro, setIntro] = useState(true);

  // autoguardado con retardo
  useEffect(() => {
    if (!project || !dirty || !autosave) return;
    const t = setTimeout(() => useStore.getState().save(), 800);
    return () => clearTimeout(t);
  }, [project, dirty, autosave]);

  // aviso al cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const s = useStore.getState();
      if (s.project && s.dirty) {
        if (s.autosave) s.save();
        else e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  if (intro) return <Intro onStart={() => setIntro(false)} />;

  return (
    <>
      {screen === 'home' || !project ? (
        <HomeScreen />
      ) : screen === 'editor' ? (
        <EditorScreen />
      ) : (
        <Suspense fallback={<div className="loading">Preparando la vista 3D…</div>}>
          <Viewer3D />
        </Suspense>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
