import * as THREE from 'three';
import type { FloorMaterial, WallMaterial } from '../types';

// Texturas procedurales en escala de grises claros; el color del material las tiñe.

const cache = new Map<string, THREE.Texture>();

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function make(key: string, size: number, metres: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

function noise(g: CanvasRenderingContext2D, s: number, amount: number, seed: number, alpha = 0.08) {
  const r = rand(seed);
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(r() * 80);
    g.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3);
  }
}

/** Textura de muro (gris claro, la tiñe el color del muro); null para acabados sin textura. */
export function wallTexture(kind: WallMaterial | undefined): THREE.Texture | null {
  switch (kind) {
    case 'ladrillo':
      return make('w-ladrillo', 512, 1.2, (g, s) => {
        const r = rand(11);
        g.fillStyle = '#d9d9d9';
        g.fillRect(0, 0, s, s);
        const rows = 16;
        const cols = 5;
        const h = s / rows;
        const w = s / cols;
        for (let i = 0; i < rows; i++) {
          for (let j = -1; j < cols; j++) {
            const v = 205 + Math.floor(r() * 50);
            g.fillStyle = `rgb(${v},${v},${v})`;
            g.fillRect(j * w + (i % 2 ? w / 2 : 0) + 3, i * h + 3, w - 6, h - 6);
          }
        }
        noise(g, s, 2500, 5);
      });
    case 'block':
      return make('w-block', 512, 1.2, (g, s) => {
        const r = rand(13);
        g.fillStyle = '#9a9a9a';
        g.fillRect(0, 0, s, s);
        const rows = 6;
        const cols = 3;
        const h = s / rows;
        const w = s / cols;
        for (let i = 0; i < rows; i++) {
          for (let j = -1; j < cols; j++) {
            const v = 220 + Math.floor(r() * 30);
            g.fillStyle = `rgb(${v},${v},${v})`;
            g.fillRect(j * w + (i % 2 ? w / 2 : 0) + 3, i * h + 3, w - 6, h - 6);
          }
        }
        noise(g, s, 5000, 9, 0.12);
      });
    case 'concreto':
      return make('w-concreto', 512, 2.4, (g, s) => {
        g.fillStyle = '#e6e6e6';
        g.fillRect(0, 0, s, s);
        noise(g, s, 9000, 21, 0.14);
        g.strokeStyle = 'rgba(70,70,70,0.25)';
        g.lineWidth = 2;
        for (const k of [0, 0.5]) {
          g.strokeRect(-2, k * s, s + 4, s / 2);
          g.strokeRect(k * s, -2, s / 2, s + 4);
        }
      });
    case 'lamina':
      return make('w-lamina', 256, 0.9, (g, s) => {
        const ribs = 6;
        const w = s / ribs;
        for (let i = 0; i < ribs; i++) {
          const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
          grad.addColorStop(0, '#b5b5b5');
          grad.addColorStop(0.35, '#ffffff');
          grad.addColorStop(0.7, '#d0d0d0');
          grad.addColorStop(1, '#8f8f8f');
          g.fillStyle = grad;
          g.fillRect(i * w, 0, w, s);
        }
      });
    case 'madera':
      return make('w-madera', 512, 1.2, (g, s) => {
        const r = rand(17);
        const planks = 8;
        const w = s / planks;
        for (let i = 0; i < planks; i++) {
          const v = 205 + Math.floor(r() * 45);
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.fillRect(i * w, 0, w, s);
          g.fillStyle = 'rgba(60,60,60,0.35)';
          g.fillRect(i * w, 0, 2, s);
          for (let k = 0; k < 6; k++) {
            g.strokeStyle = `rgba(90,90,90,${0.05 + r() * 0.08})`;
            g.beginPath();
            const x = i * w + r() * w;
            g.moveTo(x, 0);
            g.lineTo(x + (r() - 0.5) * 6, s);
            g.stroke();
          }
        }
      });
    default:
      return null;
  }
}

export function floorTexture(kind: FloorMaterial): THREE.Texture {
  switch (kind) {
    case 'madera':
      return make('madera', 512, 1.2, (g, s) => {
        const r = rand(7);
        const rows = 6;
        const h = s / rows;
        for (let i = 0; i < rows; i++) {
          const shade = 215 + Math.floor(r() * 40);
          g.fillStyle = `rgb(${shade},${shade},${shade})`;
          g.fillRect(0, i * h, s, h);
          // vetas
          for (let k = 0; k < 14; k++) {
            g.strokeStyle = `rgba(90,90,90,${0.05 + r() * 0.08})`;
            g.lineWidth = 1 + r() * 1.5;
            g.beginPath();
            const y = i * h + r() * h;
            g.moveTo(0, y);
            for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x / 40 + k) * 2 * r());
            g.stroke();
          }
          // juntas
          g.fillStyle = 'rgba(60,60,60,0.45)';
          g.fillRect(0, i * h, s, 2);
          const off = (i % 2) * (s / 2) + r() * 60;
          g.fillRect(off % s, i * h, 2, h);
        }
      });
    case 'ceramica':
      return make('ceramica', 256, 0.6, (g, s) => {
        g.fillStyle = '#f4f4f4';
        g.fillRect(0, 0, s, s);
        noise(g, s, 3000, 3, 0.05);
        g.strokeStyle = 'rgba(120,120,120,0.55)';
        g.lineWidth = 4;
        g.strokeRect(0, 0, s, s);
      });
    case 'marmol':
      return make('marmol', 512, 1.2, (g, s) => {
        g.fillStyle = '#fafafa';
        g.fillRect(0, 0, s, s);
        const r = rand(11);
        for (let k = 0; k < 18; k++) {
          g.strokeStyle = `rgba(110,110,120,${0.05 + r() * 0.15})`;
          g.lineWidth = 0.5 + r() * 2;
          g.beginPath();
          let x = r() * s;
          let y = 0;
          g.moveTo(x, y);
          while (y < s) {
            x += (r() - 0.5) * 40;
            y += 10 + r() * 30;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.strokeStyle = 'rgba(150,150,150,0.4)';
        g.lineWidth = 2;
        g.strokeRect(0, 0, s, s);
        g.beginPath();
        g.moveTo(s / 2, 0);
        g.lineTo(s / 2, s);
        g.moveTo(0, s / 2);
        g.lineTo(s, s / 2);
        g.stroke();
      });
    case 'alfombra':
      return make('alfombra', 256, 0.5, (g, s) => {
        g.fillStyle = '#e8e8e8';
        g.fillRect(0, 0, s, s);
        noise(g, s, 14000, 5, 0.2);
      });
    case 'epoxi':
      return make('epoxi', 256, 3, (g, s) => {
        g.fillStyle = '#eeeeee';
        g.fillRect(0, 0, s, s);
        noise(g, s, 2500, 29, 0.05);
      });
    case 'concreto':
    default:
      return make('concreto', 512, 2, (g, s) => {
        g.fillStyle = '#e2e2e2';
        g.fillRect(0, 0, s, s);
        const r = rand(13);
        for (let i = 0; i < 60; i++) {
          const grd = g.createRadialGradient(r() * s, r() * s, 0, r() * s, r() * s, 30 + r() * 80);
          grd.addColorStop(0, `rgba(120,120,120,${0.05 * r()})`);
          grd.addColorStop(1, 'rgba(120,120,120,0)');
          g.fillStyle = grd;
          g.fillRect(0, 0, s, s);
        }
        noise(g, s, 8000, 17, 0.12);
      });
  }
}

export function grassTexture() {
  return make('grass', 512, 4, (g, s) => {
    g.fillStyle = '#c8d8b0';
    g.fillRect(0, 0, s, s);
    const r = rand(23);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + Math.floor(r() * 90);
      g.fillStyle = `rgba(${v - 40},${v},${v - 60},0.25)`;
      g.fillRect(r() * s, r() * s, 1, 2 + r() * 4);
    }
  });
}

/** Textura con texto centrado para letreros y rótulos de piso. */
/** Textura de la imagen subida a un anuncio. */
export function imageTexture(src: string) {
  const key = `img:${src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = new THREE.TextureLoader().load(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

export function textTexture(text: string, fg: string, bg: string | null, aspect: number) {
  const key = `txt:${text}|${fg}|${bg}|${aspect.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 1024;
  const H = Math.max(64, Math.min(1024, Math.round(W / Math.max(0.25, aspect))));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(6, H * 0.05);
    g.strokeRect(g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2);
  }
  let size = H * 0.62;
  g.font = `800 ${size}px Inter, system-ui, sans-serif`;
  const maxW = W * 0.88;
  const mw = g.measureText(text).width;
  if (mw > maxW) size *= maxW / mw;
  g.font = `800 ${size}px Inter, system-ui, sans-serif`;
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Rótulo con profundidad: figura recortada de una imagen con transparencia
// ---------------------------------------------------------------------------

/** Alfa a partir del cual un punto de la imagen forma parte de la figura. */
export const CUTOUT_ALPHA = 0.4;

export interface CutoutAsset {
  /** la imagen, con el color extendido bajo la transparencia para que el borde no se aclare */
  map: THREE.Texture;
  /** la silueta en blanco: pinta el reverso de un solo color */
  mask: THREE.Texture;
  /** canto de la figura en un cubo unitario centrado; se escala a ancho × alto × profundidad */
  sides: THREE.BufferGeometry;
}

const cutouts = new Map<string, CutoutAsset>();
const cutoutLoads = new Map<string, Promise<CutoutAsset>>();

/** Figura ya preparada de una imagen, o null si todavía no se ha cargado. */
export function cutoutAsset(src: string) {
  return cutouts.get(src) ?? null;
}

export function loadCutout(src: string) {
  let load = cutoutLoads.get(src);
  if (!load) {
    load = pixelsOf(src).then((img) => {
      const asset = buildCutout(img);
      cutouts.set(src, asset);
      return asset;
    });
    cutoutLoads.set(src, load);
  }
  return load;
}

function pixelsOf(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      resolve(g.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => reject(new Error('Imagen inválida'));
    img.src = src;
  });
}

function dataTexture(bytes: Uint8Array, w: number, h: number) {
  const t = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Lados de la celda que cruza el contorno en cada caso de «marching squares»: 0 arriba, 1 derecha, 2 abajo, 3 izquierda. */
const CONTOUR: number[][][] = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[0, 3], [2, 1]], [[0, 2]], [[0, 3]], [[0, 3]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];

function buildCutout({ width: W, height: H, data }: ImageData): CutoutAsset {
  const N = W * H;

  // 1) El color de la figura se extiende unos pixeles bajo la transparencia: al filtrar la
  //    textura el borde se mezcla con ese color y no con el del fondo que se borró.
  const rgb = new Uint8ClampedArray(data);
  const stamp = new Uint8Array(N); // 0 = sin color; k = lo recibió en la pasada k - 1
  const mean = [0, 0, 0];
  let solid = 0;
  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] < 128) continue;
    stamp[i] = 1;
    solid++;
    for (let c = 0; c < 3; c++) mean[c] += data[i * 4 + c];
  }
  for (let pass = 1; pass <= 8; pass++) {
    for (let i = 0; i < N; i++) {
      if (stamp[i]) continue;
      const x = i % W;
      let n = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || !stamp[j] || stamp[j] > pass) continue;
        n++;
        r += rgb[j * 4];
        g += rgb[j * 4 + 1];
        b += rgb[j * 4 + 2];
      }
      if (!n) continue;
      rgb[i * 4] = r / n;
      rgb[i * 4 + 1] = g / n;
      rgb[i * 4 + 2] = b / n;
      stamp[i] = pass + 1;
    }
  }
  // las filas van invertidas: en la textura la primera fila es la de abajo
  const image = new Uint8Array(N * 4);
  const silhouette = new Uint8Array(N * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = ((H - 1 - y) * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        image[o + c] = stamp[i] ? rgb[i * 4 + c] : mean[c] / Math.max(1, solid);
        silhouette[o + c] = 255;
      }
      image[o + 3] = silhouette[o + 3] = data[i * 4 + 3];
    }
  }

  // 2) Canto: el contorno de la figura sobre una rejilla reducida, con un marco vacío
  //    alrededor para que también se cierre donde la figura toca la orilla de la imagen.
  const s = Math.max(1, Math.ceil(Math.max(W, H) / 200));
  const gw = Math.ceil(W / s);
  const gh = Math.ceil(H / s);
  const fw = gw + 2;
  const fh = gh + 2;
  const field = new Float32Array(fw * fh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      let n = 0;
      for (let y = gy * s; y < Math.min(H, gy * s + s); y++) {
        for (let x = gx * s; x < Math.min(W, gx * s + s); x++) {
          sum += data[(y * W + x) * 4 + 3];
          n++;
        }
      }
      field[(gy + 1) * fw + gx + 1] = sum / n / 255;
    }
  }
  const T = CUTOUT_ALPHA;
  const ux = (fx: number) => Math.min(0.5, Math.max(-0.5, ((fx - 0.5) * s) / W - 0.5));
  const uy = (fy: number) => Math.min(0.5, Math.max(-0.5, 0.5 - ((fy - 0.5) * s) / H));
  const pos: number[] = [];
  for (let y = 0; y < fh - 1; y++) {
    for (let x = 0; x < fw - 1; x++) {
      const tl = field[y * fw + x];
      const tr = field[y * fw + x + 1];
      const bl = field[(y + 1) * fw + x];
      const br = field[(y + 1) * fw + x + 1];
      const segments = CONTOUR[(tl >= T ? 8 : 0) | (tr >= T ? 4 : 0) | (br >= T ? 2 : 0) | (bl >= T ? 1 : 0)];
      if (!segments.length) continue;
      const cut = (a: number, b: number) => (T - a) / (b - a);
      // punto donde el contorno cruza cada lado de la celda
      const cross = (side: number) => (side === 0 ? [x + cut(tl, tr), y] : side === 1 ? [x + 1, y + cut(tr, br)] : side === 2 ? [x + cut(bl, br), y + 1] : [x, y + cut(tl, bl)]);
      for (const [from, to] of segments) {
        const [ax, ay] = cross(from);
        const [bx, by] = cross(to);
        const x0 = ux(ax);
        const y0 = uy(ay);
        const x1 = ux(bx);
        const y1 = uy(by);
        if (x0 === x1 && y0 === y1) continue;
        pos.push(x0, y0, 0.5, x1, y1, 0.5, x1, y1, -0.5, x0, y0, 0.5, x1, y1, -0.5, x0, y0, -0.5);
      }
    }
  }
  const sides = new THREE.BufferGeometry();
  sides.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sides.computeVertexNormals();

  return { map: dataTexture(image, W, H), mask: dataTexture(silhouette, W, H), sides };
}
