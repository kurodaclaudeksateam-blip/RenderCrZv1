import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
import HomeScreen from './components/HomeScreen';
import EditorScreen from './components/EditorScreen';
import Intro from './components/Intro';
import Login from './components/Login';
import { ProjectTooLarge, SessionExpired, isAuthenticated, logout } from './auth';
import { setCloudErrorHandler } from './cloud';

const Viewer3D = lazy(() => import('./three/Viewer3D'));

export default function App() {
  const screen = useStore((s) => s.screen);
  const project = useStore((s) => s.project);
  const dirty = useStore((s) => s.dirty);
  const autosave = useStore((s) => s.autosave);
  const toast = useStore((s) => s.toast);
  const [stage, setStage] = useState<'intro' | 'login' | 'app'>('intro');

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

  // fallos al subir a la nube: la copia local ya quedó guardada
  useEffect(() => {
    setCloudErrorHandler((e) => {
      if (e instanceof SessionExpired) {
        logout();
        useStore.getState().closeProject();
        setStage('login');
      } else if (e instanceof ProjectTooLarge) {
        useStore.getState().notify('⚠️ El proyecto supera 600 KB y no se subió a la nube: quita o reduce imágenes de anuncios');
      } else {
        useStore.getState().notify('⚠️ Sin conexión con la nube: el proyecto quedó guardado solo en este navegador');
      }
    });
  }, []);

  if (stage === 'intro') return <Intro onStart={() => setStage(isAuthenticated() ? 'app' : 'login')} />;
  if (stage === 'login') return <Login onSuccess={() => setStage('app')} />;

  const signOut = () => {
    logout();
    useStore.getState().closeProject();
    setStage('login');
  };

  return (
    <>
      {screen === 'home' || !project ? (
        <HomeScreen onLogout={signOut} />
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
