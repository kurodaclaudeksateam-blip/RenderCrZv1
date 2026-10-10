import { useState } from 'react';

/** Logotipo «powered by Cerezo»: el archivo vive en public/logo-cerezo.jpg. */
export const LOGO_URL = '/logo-cerezo.jpg';

/** El logotipo como imagen; si el archivo no está en el sitio no se muestra nada. */
export function BrandLogo({ className }: { className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className={className} src={LOGO_URL} alt="Powered by Cerezo" draggable={false} onError={() => setMissing(true)} />;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen inválida'));
    img.src = src;
  });
}

/** Pone el logotipo como marca de agua abajo a la derecha de una captura; sin logotipo la devuelve igual. */
export async function withWatermark(shotUrl: string): Promise<string> {
  try {
    const [shot, logo] = await Promise.all([loadImage(shotUrl), loadImage(LOGO_URL)]);
    const c = document.createElement('canvas');
    c.width = shot.width;
    c.height = shot.height;
    const g = c.getContext('2d')!;
    g.drawImage(shot, 0, 0);
    const w = Math.round(Math.max(96, shot.width * 0.1));
    const h = Math.round((w * logo.height) / logo.width);
    const margin = Math.round(shot.width * 0.012);
    const x = shot.width - w - margin;
    const y = shot.height - h - margin;
    g.globalAlpha = 0.9;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, w * 0.08);
    else g.rect(x, y, w, h);
    g.clip();
    g.drawImage(logo, x, y, w, h);
    return c.toDataURL('image/png');
  } catch {
    return shotUrl;
  }
}
