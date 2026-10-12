import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import SharedView from './components/SharedView';
import './styles.css';

// las ligas públicas son /v/<clave>: abren directo la vista compartida, sin contraseña
const share = location.pathname.match(/^\/v\/([\w-]{6,40})\/?$/)?.[1];

// app instalable: el service worker guarda la app para abrirla aunque falle la conexión
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      const worker = (await navigator.serviceWorker.ready).active;
      // la vista 3D se carga aparte: se pide ya para que también funcione sin conexión
      await import('./three/Viewer3D').catch(() => undefined);
      // la primera vez la página carga antes de que el service worker tome el control:
      // se le pasan los archivos ya descargados para que también queden guardados
      const files = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((url) => url.startsWith(location.origin));
      worker?.postMessage({ cache: files });
    } catch {
      /* sin service worker la app funciona igual, solo que no se guarda */
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {share ? <SharedView share={share} /> : <App />}
  </StrictMode>,
);
