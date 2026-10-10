import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG } from '../catalog';
import { addFurniture, updateFurniture } from '../actions';
import { type CutoutOptions, finishCutout, hasTransparency, keptShare, pickImage, readImage, removeBackground } from '../cutout';
import { type CutoutRequest, useStore } from '../store';

const ITEM = CATALOG.find((c) => c.type === 'anuncio_relieve')!;
const START: CutoutOptions = { tolerance: 30, edges: true, inner: false, picks: [] };
const MAX_PICKS = 40;
const cm = (n: number) => Math.round(n * 100) / 100;

/** Pide la imagen de un rótulo con profundidad, le quita el fondo y lo deja como objeto. */
export function CutoutDialog() {
  const req = useStore((s) => s.cutout);
  return req ? <CutoutForm req={req} /> : null;
}

function CutoutForm({ req }: { req: CutoutRequest }) {
  const { setCutout, notify } = useStore.getState();
  const [src, setSrc] = useState<ImageData | null>(null);
  const [opts, setOpts] = useState(START);
  const [error, setError] = useState('');
  const [side, setSide] = useState(String(ITEM.w));
  const [depth, setDepth] = useState(String(ITEM.d));
  const canvas = useRef<HTMLCanvasElement>(null);
  const close = () => setCutout(null);

  const load = async (file?: File | null) => {
    if (!file) return;
    try {
      const img = await readImage(file);
      setSrc(img);
      // una imagen que ya viene recortada se respeta: no se le borra nada por su cuenta
      setOpts({ ...START, edges: !hasTransparency(img) });
      setError('');
    } catch {
      setError('No se pudo leer la imagen. Prueba con un archivo PNG, JPG o WebP.');
    }
  };
  useEffect(() => {
    load(req.file);
  }, [req.file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const result = useMemo(() => (src ? removeBackground(src, opts) : null), [src, opts]);
  const kept = useMemo(() => (result ? keptShare(result) : 0), [result]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !result) return;
    c.width = result.width;
    c.height = result.height;
    c.getContext('2d')!.putImageData(result, 0, 0);
  }, [result]);

  const touch = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (opts.picks.length >= MAX_PICKS) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOpts({ ...opts, picks: [...opts.picks, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }] });
  };

  const confirm = () => {
    const cut = result && finishCutout(result);
    if (!cut) return setError('No quedó nada de la imagen: baja la tolerancia o deshaz los toques.');
    if (req.replaceId) {
      // el rótulo conserva su ancho; el alto sigue la proporción de la imagen nueva
      const old = useStore.getState().project?.levels.flatMap((l) => l.furniture).find((f) => f.id === req.replaceId);
      updateFurniture(req.replaceId, { image: cut.image, ...(old ? { h: cm(old.w / cut.aspect) } : {}) });
      notify('✂️ Imagen del rótulo cambiada');
    } else {
      const long = Math.min(30, Math.max(0.1, Number(side) || ITEM.w));
      const w = cut.aspect >= 1 ? long : long * cut.aspect;
      addFurniture(ITEM, req.pos, { image: cut.image, w: cm(w), h: cm(w / cut.aspect), d: Math.min(2, Math.max(0.01, Number(depth) || ITEM.d)), color: cut.color });
      notify('✂️ Rótulo creado: muévelo, gíralo o súbelo como cualquier objeto');
    }
    close();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal wide cutout" role="dialog" aria-label="Rótulo con profundidad">
        <h2>✂️ Rótulo con profundidad</h2>
        {!src ? (
          <button type="button" className="cutout-drop" onClick={async () => load(await pickImage())}>
            <span className="cutout-drop-icon">🖼️</span>
            <strong>Adjunta la imagen del rótulo</strong>
            <span className="muted small">Un logotipo o dibujo en PNG, JPG o WebP. Se le quita el fondo y queda como objeto con relieve.</span>
          </button>
        ) : (
          <>
            <div className="cutout-stage">
              <canvas ref={canvas} onClick={touch} title="Toca una zona para borrarla" />
            </div>
            <p className="muted small">
              Así queda sin fondo (los cuadros son transparencia). <b>Toca sobre la imagen</b> cualquier zona que todavía sobre para borrarla.
              {` Se conserva el ${Math.round(kept * 100)} % de la imagen.`}
            </p>
            <label className="field">
              <span>Tolerancia: {opts.tolerance} — súbela si quedan restos del fondo, bájala si se come la figura</span>
              <input type="range" min={0} max={100} value={opts.tolerance} onChange={(e) => setOpts({ ...opts, tolerance: Number(e.target.value) })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={opts.edges} onChange={(e) => setOpts({ ...opts, edges: e.target.checked })} /> Quitar el fondo que toca las orillas
            </label>
            <label className="check">
              <input type="checkbox" checked={opts.inner} onChange={(e) => setOpts({ ...opts, inner: e.target.checked })} /> Quitar ese color también dentro de la figura (huecos de las letras)
            </label>
            <div className="row wrap">
              <button className="secondary small" onClick={async () => load(await pickImage())}>
                🖼️ Cambiar imagen
              </button>
              <button className="secondary small" disabled={!opts.picks.length} onClick={() => setOpts({ ...opts, picks: opts.picks.slice(0, -1) })}>
                ↶ Deshacer toque{opts.picks.length ? ` (${opts.picks.length})` : ''}
              </button>
            </div>
            {!req.replaceId && (
              <div className="grid2">
                <label className="field">
                  <span>Lado más largo (m)</span>
                  <input type="number" min={0.1} max={30} step={0.1} value={side} onChange={(e) => setSide(e.target.value)} />
                </label>
                <label className="field">
                  <span>Profundidad (m)</span>
                  <input type="number" min={0.01} max={2} step={0.01} value={depth} onChange={(e) => setDepth(e.target.value)} />
                </label>
              </div>
            )}
          </>
        )}
        {error && <p className="danger-text">{error}</p>}
        <p className="muted tiny">
          Funciona mejor con fondos parejos (blanco o de un solo color). La imagen se procesa en tu navegador: no se envía a ningún servicio.
        </p>
        <div className="row end">
          <button className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={!result} onClick={confirm}>
            {req.replaceId ? 'Usar esta imagen' : 'Crear rótulo'}
          </button>
        </div>
      </div>
    </div>
  );
}
