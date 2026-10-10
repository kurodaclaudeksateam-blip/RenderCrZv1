// Quita el fondo de una imagen en el propio navegador (no se sube a ningún servicio).
// Pensado para logotipos e imágenes de fondo parejo: borra el color que toca las orillas
// y las zonas que el usuario toque, suaviza el borde y recorta lo que sobra alrededor.

export const CUTOUT_MAX_SIDE = 640;

export interface CutoutOptions {
  /** 0..100: cuánto puede diferir un color del fondo y aun así borrarse */
  tolerance: number;
  /** borra el fondo que toca las orillas de la imagen */
  edges: boolean;
  /** borra también ese color donde quedó encerrado (huecos de las letras) */
  inner: boolean;
  /** puntos tocados (0..1): se borra la zona de ese color */
  picks: { x: number; y: number }[];
}

export interface Cutout {
  /** data URL con transparencia, recortada a la figura */
  image: string;
  /** ancho / alto de la figura */
  aspect: number;
  /** color medio de la figura, oscurecido: queda bien como canto */
  color: string;
}

/** Alfa por debajo del cual un pixel ya cuenta como transparente. */
const CLEAR = 16;
/** Colores distintos que se pueden borrar en una imagen (las marcas caben en un byte). */
const MAX_REFS = 250;

type Rgb = [number, number, number];

/** Abre el selector de archivos; devuelve null si se cancela. Debe llamarse desde un clic. */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.onchange = () => done(input.files?.[0] ?? null);
    input.oncancel = () => done(null);
    // algunos navegadores móviles solo avisan del cambio si el campo está en el documento
    document.body.appendChild(input);
    input.click();
  });
}

/** Lee la imagen reducida a `maxSide`, conservando su transparencia. */
export function readImage(file: Blob, maxSide = CUTOUT_MAX_SIDE): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.width || !img.height) return reject(new Error('Imagen sin medidas'));
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(g.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida'));
    };
    img.src = url;
  });
}

/** ¿La imagen ya trae fondo transparente? */
export function hasTransparency(img: ImageData) {
  let clear = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 128) clear++;
  return clear > (img.data.length / 4) * 0.02;
}

/** Colores que dominan las orillas: el fondo, o los dos o tres tonos que lo forman. */
function borderColors(px: Uint8ClampedArray, border: number[]): Rgb[] {
  const buckets = new Map<number, [number, number, number, number]>();
  let total = 0;
  for (const i of border) {
    const p = i * 4;
    if (px[p + 3] < CLEAR) continue;
    total++;
    const key = ((px[p] >> 4) << 8) | ((px[p + 1] >> 4) << 4) | (px[p + 2] >> 4);
    const b = buckets.get(key) ?? [0, 0, 0, 0];
    b[0]++;
    b[1] += px[p];
    b[2] += px[p + 1];
    b[3] += px[p + 2];
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .sort((a, b) => b[0] - a[0])
    .filter((b, i) => i === 0 || b[0] >= total * 0.1)
    .slice(0, 4)
    .map(([n, r, g, b]): Rgb => [r / n, g / n, b / n]);
}

/** Devuelve una copia de la imagen con el fondo transparente. */
export function removeBackground(src: ImageData, o: CutoutOptions): ImageData {
  const { width: W, height: H } = src;
  const N = W * H;
  const px = new Uint8ClampedArray(src.data);
  // 0 = se conserva; k = borrado por el color refs[k - 1]; 255 = ya era transparente
  const gone = new Uint8Array(N);
  const refs: Rgb[] = [];
  const tol = 10 + o.tolerance * 1.7;
  const tol2 = tol * tol;
  const dist2 = (i: number, c: Rgb) => {
    const p = i * 4;
    const dr = px[p] - c[0];
    const dg = px[p + 1] - c[1];
    const db = px[p + 2] - c[2];
    return dr * dr + dg * dg + db * db;
  };
  for (let i = 0; i < N; i++) if (px[i * 4 + 3] < CLEAR) gone[i] = 255;

  // borra la zona conectada a las semillas cuyo color se parece a `ref`
  const stack = new Int32Array(N);
  const flood = (seeds: number[], ref: Rgb) => {
    if (refs.length >= MAX_REFS) return;
    refs.push(ref);
    const tag = refs.length;
    let top = 0;
    const visit = (i: number) => {
      if (gone[i] || dist2(i, ref) > tol2) return;
      gone[i] = tag;
      stack[top++] = i;
    };
    seeds.forEach(visit);
    while (top) {
      const i = stack[--top];
      const x = i % W;
      if (x > 0) visit(i - 1);
      if (x < W - 1) visit(i + 1);
      if (i >= W) visit(i - W);
      if (i < N - W) visit(i + W);
    }
  };

  if (o.edges) {
    const border: number[] = [];
    for (let x = 0; x < W; x++) border.push(x, N - W + x);
    for (let y = 1; y < H - 1; y++) border.push(y * W, y * W + W - 1);
    for (const ref of borderColors(px, border)) flood(border, ref);
  }
  for (const pick of o.picks) {
    const x = Math.min(W - 1, Math.max(0, Math.round(pick.x * (W - 1))));
    const y = Math.min(H - 1, Math.max(0, Math.round(pick.y * (H - 1))));
    const i = y * W + x;
    if (!gone[i]) flood([i], [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  }
  if (o.inner) {
    refs.forEach((ref, k) => {
      for (let i = 0; i < N; i++) if (!gone[i] && dist2(i, ref) <= tol2) gone[i] = k + 1;
    });
  }

  // los pixeles de la orilla mezclan figura y fondo: se les resta la parte de fondo
  const soft = tol + 24;
  const erased = (j: number) => (gone[j] === 255 ? 0 : gone[j]);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    if (gone[i]) {
      px[p + 3] = 0;
      continue;
    }
    const x = i % W;
    const tag = (x > 0 && erased(i - 1)) || (x < W - 1 && erased(i + 1)) || (i >= W && erased(i - W)) || (i < N - W && erased(i + W)) || 0;
    if (!tag) continue;
    const ref = refs[tag - 1];
    const a = (Math.sqrt(dist2(i, ref)) - tol) / soft;
    if (a >= 1) continue;
    if (a <= 0.04) {
      px[p + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) px[p + c] = (px[p + c] - (1 - a) * ref[c]) / a;
    px[p + 3] *= a;
  }
  return new ImageData(px, W, H);
}

/** Parte de la imagen (0..1) que sigue siendo visible. */
export function keptShare(img: ImageData) {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] >= 128) n++;
  return n / (img.data.length / 4);
}

/** Recorta la imagen a su figura y la deja lista para guardar; null si no quedó nada. */
export function finishCutout(img: ImageData): Cutout | null {
  const { width: W, height: H, data } = img;
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (data[p + 3] < 128) continue;
      n++;
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (n < 16) return null;
  // un pixel de margen para no cortar el borde suavizado
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  const w = Math.min(W - 1, x1 + 1) - x0 + 1;
  const h = Math.min(H - 1, y1 + 1) - y0 + 1;
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  full.getContext('2d')!.putImageData(img, 0, 0);
  const crop = (maxSide: number) => {
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d')!.drawImage(full, x0, y0, w, h, 0, 0, c.width, c.height);
    return c;
  };
  let image = crop(CUTOUT_MAX_SIDE).toDataURL('image/webp', 0.82);
  // los navegadores que no generan WebP devuelven PNG, que pesa mucho más: se guarda más chico
  if (!image.startsWith('data:image/webp')) image = crop(360).toDataURL('image/png');
  const hex = (v: number) => Math.round((v / n) * 0.55).toString(16).padStart(2, '0');
  return { image, aspect: w / h, color: `#${hex(r)}${hex(g)}${hex(b)}` };
}
