import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { cloudInfo, shareProject } from '../cloud';
import { ProjectTooLarge } from '../auth';
import { useStore } from '../store';
import type { Project } from '../types';

/** Código QR de la liga: se ve en pantalla y se descarga como imagen para imprimirlo o mandarlo. */
function ShareQr({ url, name }: { url: string; name: string }) {
  const { size, path, dark } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const cells: [number, number][] = [];
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (qr.isDark(row, col)) cells.push([col, row]);
    return { size: n, dark: cells, path: cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('') };
  }, [url]);
  const margin = 2;

  const download = () => {
    const scale = 16;
    const c = document.createElement('canvas');
    c.width = c.height = (size + margin * 2) * scale;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000000';
    for (const [x, y] of dark) g.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim() || 'proyecto'}-qr.png`;
    a.click();
  };

  return (
    <div className="share-qr">
      <svg viewBox={`${-margin} ${-margin} ${size + margin * 2} ${size + margin * 2}`} role="img" aria-label="Código QR de la liga para compartir">
        <rect x={-margin} y={-margin} width={size + margin * 2} height={size + margin * 2} fill="#ffffff" />
        <path d={path} fill="#000000" />
      </svg>
      <div>
        <p className="muted small">Escanéalo con la cámara del teléfono para abrir el proyecto.</p>
        <button className="secondary small" onClick={download}>
          ⤓ Descargar QR
        </button>
      </div>
    </div>
  );
}

/** Sube el proyecto y muestra su liga pública de solo lectura. */
export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const notify = useStore((s) => s.notify);
  const bytes = cloudInfo()[project.id]?.bytes;

  useEffect(() => {
    let alive = true;
    // se comparte la versión más reciente que esté abierta en el editor
    const current = useStore.getState().project;
    shareProject(current?.id === project.id ? current : project)
      .then((u) => alive && setUrl(u))
      .catch((e) => alive && setError(e instanceof ProjectTooLarge ? 'El proyecto supera 600 KB: quita o reduce imágenes de anuncios y vuelve a intentarlo.' : 'No se pudo subir el proyecto a la nube. Revisa tu conexión e inténtalo de nuevo.'));
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
          <p className="danger-text">{error}</p>
        ) : !url ? (
          <p className="muted">
            <span className="spinner inline-spinner" /> Guardando en la nube…
          </p>
        ) : (
          <>
            <p className="muted small">
              Cualquier persona con esta liga puede ver el proyecto sin contraseña: verá cómo se arma en 10 segundos y después podrá recorrerlo, verlo en 3D o dejarlo en recorrido automático. No puede editarlo.
            </p>
            <div className="share-row">
              <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Liga para compartir" />
              <button className="primary" onClick={copy}>
                Copiar
              </button>
            </div>
            <ShareQr url={url} name={project.name} />
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
