import { useEffect, useState } from 'react';

const DISMISS_KEY = 'rendercrz:pref:installHint';

/** Aviso de Chrome/Android de que la app se puede instalar; se guarda para lanzarlo desde el botón. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}
let pending: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pending = e as InstallPrompt;
    listeners.forEach((fn) => fn());
  });
}

/** ¿Ya está abierta como app instalada? */
const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** iPhone y iPad (los iPad recientes se anuncian como Mac con pantalla táctil). */
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Invita a instalar la app. En iPhone no hay botón de instalación: se explica el
 * camino de Safari (Compartir → Agregar a pantalla de inicio). En Android y escritorio
 * se ofrece el botón del navegador.
 */
export function InstallHint() {
  const [, refresh] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const fn = () => refresh((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);

  const ios = isIos();
  if (hidden || installed() || (!ios && !pending)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sin acceso */
    }
  };

  return (
    <div className="install-hint" role="note">
      <img src="/icon-192.png" alt="" />
      <div>
        <strong>Instala la app</strong>
        {ios ? (
          <p>
            En Safari toca <b>Compartir</b> (el cuadro con la flecha hacia arriba) y luego <b>«Agregar a pantalla de inicio»</b>. Se abrirá a pantalla completa, con su icono, como cualquier app.
          </p>
        ) : (
          <p>Se abre en su propia ventana, con su icono, y carga aunque la conexión falle.</p>
        )}
      </div>
      {!ios && pending && (
        <button
          className="primary small"
          onClick={async () => {
            await pending?.prompt();
            pending = null;
            dismiss();
          }}
        >
          Instalar
        </button>
      )}
      <button className="icon" onClick={dismiss} title="No volver a mostrar">
        ✕
      </button>
    </div>
  );
}
