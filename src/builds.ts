// Obras de la intro: cada carga arma una distinta (una megatorre escalonada de más de cien
// pisos, una torre torcida, torres gemelas, un puente atirantado o una ciudad entera), con
// medidas y colores al azar. Aquí solo se describe la obra; Intro.tsx la anima.

import * as THREE from 'three';
import { pick, rint, rnd } from './random';

export const DURATION = 6; // segundos
/** Momento en que empieza a subir la obra, en que se coloca el último piso y en que queda el remate. */
export const T0 = 0.7;
export const T1 = 4.5;
export const TOP = 5.2;

type V3 = [number, number, number];

/** Pieza de la obra: una caja que cae, crece hacia arriba o se extiende en planta. */
export interface Block {
  /** centro final */
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  color: THREE.Color;
  start: number;
  dur: number;
  mode: 'drop' | 'rise' | 'grow';
  /** altura desde la que cae (modo drop) */
  fall?: number;
  /** destello al colocarse (1 = completo) */
  flash?: number;
}

/** Tubo de luz que se dibuja de un extremo al otro. */
export interface TubeSpec {
  curve: THREE.Curve<THREE.Vector3>;
  color: THREE.Color;
  start: number;
  dur: number;
  radius: number;
  /** avanza a ritmo constante en vez de frenar al final */
  linear?: boolean;
  segments?: number;
  radial?: number;
}

export interface Build {
  name: string;
  /** qué se cuenta mientras se arma: pisos o tramos */
  unit: string;
  /** segundo en que se coloca cada unidad, en orden */
  marks: number[];
  /** dato que queda al terminar */
  summary: string;
  blocks: Block[];
  tubes: TubeSpec[];
  /** alto total y radio en planta, para encuadrar la cámara */
  height: number;
  radius: number;
  /** altura de la última planta (hasta ahí sube la grúa) */
  roof: number;
  /** altura del frente de obra en el segundo t */
  front: (t: number) => number;
  /** dónde hay una grúa en lo alto de la obra (x, z) */
  cranes: [number, number][];
  /** balizas que parpadean al terminar */
  beacons: V3[];
  hue: number;
  /** ángulo inicial de la cámara y velocidad de giro */
  angle: number;
  spin: number;
  /** la obra va sobre agua y es más ancha que alta */
  water?: boolean;
}

interface Slab {
  x: number;
  z: number;
  sx: number;
  sz: number;
  ry: number;
}

const hsl = (h: number, s: number, l: number) => new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const line = (a: V3, b: V3) => new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
const floorStart = (f: number, span: number) => T0 + ((T1 - T0) * f) / span;
/** Frente de obra de una torre: sube piso a piso hasta `roof` y después hasta la punta. */
const towerFront = (roof: number, tip: number) => (t: number) => roof * clamp01((t - T0) / (T1 - T0)) + (tip - roof) * clamp01((t - T1) / (TOP - T1));

/** Curva definida punto a punto; avanza parejo con su parámetro (la altura), no con su longitud. */
class Path extends THREE.Curve<THREE.Vector3> {
  constructor(private at: (u: number) => V3) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    return target.set(...this.at(u));
  }
  getUtoTmapping(u: number) {
    return u;
  }
}

const ring = (r: number, y: number, x = 0, z = 0) => new Path((u) => [x + Math.cos(u * Math.PI * 2) * r, y, z + Math.sin(u * Math.PI * 2) * r]);

/** Color de un piso: vidrio del tono de la obra, con plantas técnicas oscuras y alguna planta encendida. */
function glass(hue: number, f: number, n: number) {
  if (f % 28 === 27) return hsl(hue, 0.3, 0.12);
  if (Math.random() < 0.09) return hsl(0.11, 0.85, 0.66);
  return hsl(hue + (f / n) * 0.06, 0.6, 0.36 + Math.random() * 0.1);
}

/**
 * Apila `n` pisos: `plan` dice qué cajas forman cada uno. `span` es el número de pisos que
 * se colocan en toda la animación (así varias torres suben al mismo ritmo).
 */
function stack(out: Block[], n: number, fh: number, hue: number, plan: (f: number) => Slab[], ox = 0, oz = 0, span = n, delay = 0) {
  for (let f = 0; f < n; f++) {
    const color = glass(hue, f, n);
    const start = floorStart(f, span) + delay;
    for (const s of plan(f)) out.push({ x: ox + s.x, y: (f + 0.5) * fh, z: oz + s.z, sx: s.sx, sy: fh * 0.8, sz: s.sz, ry: s.ry, color, start, dur: 0.3, mode: 'drop', fall: 2.5 });
  }
}

/** Remate: cuerpos cada vez más delgados y una aguja de luz. Devuelve la altura de la punta. */
function spire(blocks: Block[], tubes: TubeSpec[], x: number, z: number, y: number, size: number, hue: number, bodies = 5, needle = 6) {
  for (let i = 0; i < bodies; i++) {
    const s = size * (1 - i / (bodies + 1));
    blocks.push({ x, y: y + 0.9, z, sx: s, sy: 1.8, sz: s, ry: i * 0.5, color: hsl(hue, 0.25, 0.72), start: T1 + i * 0.08, dur: 0.3, mode: 'rise' });
    y += 1.8;
  }
  tubes.push({ curve: line([x, y, z], [x, y + needle, z]), color: hsl(hue + 0.5, 1, 0.7), start: T1 + 0.45, dur: 0.5, radius: 0.09 });
  return y + needle;
}

/**
 * Ciudad baja alrededor de la obra: da escala. Aparece en onda desde el centro y es más
 * baja cerca de la obra, para no tapar a la cámara mientras la sigue.
 */
function cityRing(out: Block[], inner: number, outer: number, hue: number) {
  const cell = 7;
  const n = Math.ceil(outer / cell);
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const x = (i + 0.5) * cell;
      const z = (j + 0.5) * cell;
      const r = Math.hypot(x, z);
      // hacia afuera la ciudad se va despoblando
      if (r < inner || r > outer || Math.random() < 0.18 + 0.6 * ((r - inner) / (outer - inner)) ** 2) continue;
      const h = r < inner + 30 ? rnd(0.8, 3.5) : r > outer * 0.7 && Math.random() < 0.12 ? rnd(10, 20) : rnd(1.2, 8);
      out.push({ x, y: h / 2, z, sx: rnd(3.6, 5.6), sy: h, sz: rnd(3.6, 5.6), ry: 0, color: hsl(hue + rnd(-0.05, 0.05), 0.3, rnd(0.1, 0.2)), start: 0.1 + ((r - inner) / (outer - inner)) * 1.1, dur: 0.6, mode: 'rise', flash: 0.25 });
    }
  }
}

const marksOf = (n: number, span = n) => Array.from({ length: n }, (_, f) => floorStart(f, span));
/** Altura real aproximada: cada piso del modelo equivale a 3.9 m. */
const meters = (y: number, fh: number) => Math.round(((y / fh) * 3.9) / 5) * 5;

// ---------------------------------------------------------------------------
// 1 · Megatorre escalonada: planta en Y, tres alas que se retranquean en espiral y aguja
// ---------------------------------------------------------------------------
function megatorre(): Build {
  const n = rint(148, 172);
  const fh = 0.42;
  const H = n * fh;
  const hue = rnd(0.52, 0.62);
  const a0 = rnd(0, Math.PI * 2);
  const core = 1.9;
  const wing = rnd(7, 8.4);
  const width = 2.7;
  const tiers = 9;
  const body = n * 0.86; // hasta este piso llegan las alas
  const step = body / tiers;
  const blocks: Block[] = [];
  const tubes: TubeSpec[] = [];
  // cada ala pierde un tramo cada `step` pisos, y las tres lo hacen a destiempo
  const wingLen = (f: number, w: number) => wing * Math.max(0, 1 - Math.floor((f + (w * step) / 3) / step) / tiers);

  stack(blocks, n, fh, hue, (f) => {
    const taper = f < body ? 1 : 1 - 0.24 * (1 + Math.floor(((f - body) / (n - body)) * 3));
    const slabs: Slab[] = [{ x: 0, z: 0, sx: core * 2 * taper, sz: core * 2 * taper, ry: a0 + Math.PI / 6 }];
    for (let w = 0; w < 3; w++) {
      const L = wingLen(f, w);
      if (L < 0.4) continue;
      const a = a0 + (w * 2 * Math.PI) / 3;
      const c = (L + core) / 2;
      slabs.push({ x: Math.cos(a) * c, z: Math.sin(a) * c, sx: L + core, sz: width * (0.7 + 0.3 * (L / wing)), ry: -a });
    }
    return slabs;
  });
  const tip = spire(blocks, tubes, 0, 0, H, core * 0.5, hue, 6, 7);

  for (let w = 0; w < 3; w++) {
    const a = a0 + (w * 2 * Math.PI) / 3;
    const dir = [Math.cos(a), Math.sin(a)];
    const nrm = [-dir[1], dir[0]];
    const at = (along: number, across: number): V3 => [dir[0] * along + nrm[0] * across, 0.08, dir[1] * along + nrm[1] * across];
    // planta del ala trazada a ras de piso
    const far = wing + core;
    const corners = [at(core * 0.4, width / 2), at(far, width / 2), at(far, -width / 2), at(core * 0.4, -width / 2)];
    for (let k = 0; k < 3; k++) tubes.push({ curve: line(corners[k], corners[k + 1]), color: hsl(hue + (w * 3 + k) * 0.05, 0.95, 0.6), start: 0.05 + (w * 3 + k) * 0.06, dur: 0.55, radius: 0.12 });
    // guía en espiral que sube con la obra
    tubes.push({
      curve: new Path((u) => {
        const r = (u < 0.86 ? wing * (1 - u / 0.86) + core : core) * 1.12 + 0.4;
        const ang = a + u * Math.PI * 3;
        return [Math.cos(ang) * r, u * H, Math.sin(ang) * r];
      }),
      color: hsl(hue + 0.35 + w * 0.12, 1, 0.62),
      start: T0,
      dur: T1 - T0,
      radius: 0.07,
      linear: true,
      segments: 220,
      radial: 6,
    });
  }
  cityRing(blocks, wing + core + 6, 96, hue);

  return {
    name: 'Megatorre escalonada',
    unit: 'Piso',
    marks: marksOf(n),
    summary: `${n} pisos · ${meters(tip, fh)} m`,
    blocks,
    tubes,
    height: tip,
    radius: wing + core,
    roof: H,
    front: towerFront(H, tip),
    cranes: [[0, 0]],
    beacons: [[0, tip, 0]],
    hue,
    angle: rnd(0, Math.PI * 2),
    spin: 0.3,
  };
}

// ---------------------------------------------------------------------------
// 2 · Torre torcida: cada piso gira un poco sobre el anterior y se va afinando
// ---------------------------------------------------------------------------
function torreTorcida(): Build {
  const n = rint(104, 128);
  const fh = 0.46;
  const H = n * fh;
  const hue = pick([0.47, 0.76, 0.08, 0.58]);
  const a0 = rnd(0, Math.PI * 2);
  const twist = rnd(1.7, 3) * pick([-1, 1]);
  const base = rnd(4.6, 5.6);
  const half = (u: number) => base * (1 - 0.5 * Math.pow(u, 1.5));
  const blocks: Block[] = [];
  const tubes: TubeSpec[] = [];

  stack(blocks, n, fh, hue, (f) => {
    const u = f / n;
    const s = half(u) * 2;
    const ry = a0 + twist * u;
    return [
      { x: 0, z: 0, sx: s, sz: s, ry },
      { x: 0, z: 0, sx: s * 0.82, sz: s * 0.82, ry: ry + Math.PI / 4 },
    ];
  });
  const tip = spire(blocks, tubes, 0, 0, H, half(1) * 0.7, hue, 3, 5);

  for (let k = 0; k < 4; k++) {
    // aristas de luz que siguen las esquinas mientras giran
    tubes.push({
      curve: new Path((u) => {
        const r = half(u) * Math.SQRT2 * 1.03;
        const ang = Math.PI / 4 + (k * Math.PI) / 2 - (a0 + twist * u);
        return [Math.cos(ang) * r, u * H, Math.sin(ang) * r];
      }),
      color: hsl(hue + 0.3 + k * 0.1, 1, 0.62),
      start: T0,
      dur: T1 - T0,
      radius: 0.08,
      linear: true,
      segments: 180,
      radial: 6,
    });
    const c = (i: number): V3 => {
      const ang = Math.PI / 4 + (i * Math.PI) / 2 - a0;
      return [Math.cos(ang) * base * Math.SQRT2, 0.08, Math.sin(ang) * base * Math.SQRT2];
    };
    tubes.push({ curve: line(c(k), c(k + 1)), color: hsl(hue + k * 0.08, 0.95, 0.6), start: 0.05 + k * 0.1, dur: 0.55, radius: 0.12 });
  }
  tubes.push({ curve: ring(half(1) * 1.7, H + 0.6), color: hsl(hue + 0.5, 1, 0.68), start: T1 + 0.1, dur: 0.6, radius: 0.08, segments: 64, radial: 6 });
  cityRing(blocks, base * 1.5 + 6, 90, hue);

  return {
    name: 'Torre torcida',
    unit: 'Piso',
    marks: marksOf(n),
    summary: `${n} pisos · ${meters(tip, fh)} m · giro de ${Math.round((Math.abs(twist) * 180) / Math.PI)}°`,
    blocks,
    tubes,
    height: tip,
    radius: base * 1.5,
    roof: H,
    front: towerFront(H, tip),
    cranes: [[0, 0]],
    beacons: [[0, tip, 0]],
    hue,
    angle: rnd(0, Math.PI * 2),
    spin: 0.3,
  };
}

// ---------------------------------------------------------------------------
// 3 · Torres gemelas: planta en estrella de ocho puntas, retranqueos y puente entre ambas
// ---------------------------------------------------------------------------
function torresGemelas(): Build {
  const n = rint(96, 110);
  const fh = 0.48;
  const H = n * fh;
  const hue = pick([0.58, 0.1, 0.5, 0.86]);
  const gap = rnd(8.5, 10); // del centro a cada torre
  const s0 = 4.3;
  const cuts = [0.6, 0.74, 0.85, 0.93];
  const scale = [1, 0.84, 0.68, 0.5, 0.32];
  const half = (f: number) => s0 * scale[cuts.filter((c) => f / n >= c).length];
  const blocks: Block[] = [];
  const tubes: TubeSpec[] = [];
  const beacons: V3[] = [];
  let tip = H;

  [-1, 1].forEach((side, t) => {
    const x = side * gap;
    stack(
      blocks,
      n,
      fh,
      hue,
      (f) => {
        const s = half(f) * 2;
        return [
          { x: 0, z: 0, sx: s, sz: s, ry: 0 },
          { x: 0, z: 0, sx: s, sz: s, ry: Math.PI / 4 },
        ];
      },
      x,
      0,
      n,
      t * 0.12,
    );
    tip = spire(blocks, tubes, x, 0, H, s0 * 0.45, hue, 5, 6);
    beacons.push([x, tip, 0]);
    // cinturones de luz: en la base y en cada retranqueo
    tubes.push({ curve: ring(s0 * 1.6, 0.08, x), color: hsl(hue + 0.1, 0.95, 0.6), start: 0.05 + t * 0.2, dur: 0.6, radius: 0.12, segments: 64, radial: 6 });
    cuts.forEach((c, i) => tubes.push({ curve: ring(s0 * scale[i] * 1.48, c * H, x), color: hsl(hue + 0.3 + i * 0.1, 1, 0.64), start: floorStart(c * n, n) + 0.1, dur: 0.5, radius: 0.07, segments: 64, radial: 6 }));
  });

  // puente de dos plantas entre las torres, con sus dos patas en V
  const bf = Math.round(n * 0.44);
  const by = (bf + 1) * fh;
  const bt = floorStart(bf, n) + 0.3;
  blocks.push({ x: 0, y: by, z: 0, sx: 2 * (gap - s0 * 0.9), sy: fh * 2, sz: 1.5, ry: 0, color: hsl(hue, 0.2, 0.75), start: bt, dur: 0.6, mode: 'grow' });
  for (const side of [-1, 1]) tubes.push({ curve: line([0, by - fh, 0], [side * (gap - s0), by - 7, 0]), color: hsl(hue + 0.5, 1, 0.66), start: bt + 0.3, dur: 0.5, radius: 0.1 });
  cityRing(blocks, gap + s0 * 1.5 + 6, 92, hue);

  return {
    name: 'Torres gemelas',
    unit: 'Piso',
    marks: marksOf(n),
    summary: `2 torres · ${n} pisos · ${meters(tip, fh)} m`,
    blocks,
    tubes,
    height: tip,
    radius: gap + s0 * 1.5,
    roof: H,
    front: towerFront(H, tip),
    cranes: [
      [-gap, 0],
      [gap, 0],
    ],
    beacons,
    hue,
    angle: rnd(-0.9, -0.5) + pick([0, Math.PI]),
    spin: 0.16,
  };
}

// ---------------------------------------------------------------------------
// 4 · Puente atirantado: el tablero avanza desde las torres hasta cerrarse en el centro
// ---------------------------------------------------------------------------
function puente(): Build {
  const hue = rnd(0, 1);
  const P = rnd(24, 30); // alto de las torres
  const half = rint(10, 12); // tramos de cada torre al centro
  const side = Math.round(half * 0.8); // tramos de cada torre a su orilla
  const seg = 2.2;
  const S = half * seg;
  const deck = 6.5;
  const wide = 5.2;
  const blocks: Block[] = [];
  const tubes: TubeSpec[] = [];
  const marks: number[] = [];
  const concrete = hsl(hue, 0.12, 0.7);
  const segStart = (k: number) => 1.7 + (k / half) * 2.6;
  const X = S + side * seg; // de centro a cada orilla
  const land = deck - 0.3;

  for (const px of [-S, S]) {
    const sg = Math.sign(px);
    // cimiento y torre en A: dos patas en dovelas que se juntan arriba
    blocks.push({ x: px, y: 0.4, z: 0, sx: 4.5, sy: 2.4, sz: wide + 6, ry: 0, color: hsl(hue, 0.1, 0.35), start: 0.15, dur: 0.4, mode: 'rise', flash: 0.3 });
    const m = 12;
    for (let i = 0; i < m; i++) {
      const u = i / m;
      const off = (wide / 2 + 1.1) * (1 - u * 0.82);
      for (const s of [-1, 1]) blocks.push({ x: px, y: (i + 0.5) * (P / m), z: s * off, sx: 1.5 - u * 0.5, sy: P / m, sz: 1.3 - u * 0.4, ry: 0, color: concrete, start: 0.3 + u * 1.5, dur: 0.3, mode: 'rise' });
    }
    blocks.push({ x: px, y: deck - 0.9, z: 0, sx: 1.3, sy: 0.9, sz: wide + 2.6, ry: 0, color: concrete, start: 0.9, dur: 0.4, mode: 'grow' });
    blocks.push({ x: px, y: P + 0.5, z: 0, sx: 1.2, sy: 1, sz: 2.2, ry: 0, color: hsl(hue, 0.2, 0.8), start: 1.85, dur: 0.3, mode: 'drop', fall: 4 });

    // tablero en voladizo hacia el centro (dir = -sg) y hacia la orilla (dir = sg), con sus tirantes
    for (const [dir, count] of [
      [-sg, half],
      [sg, side],
    ]) {
      for (let k = 1; k <= count; k++) {
        const x = px + dir * (k - 0.5) * seg;
        const start = segStart(k);
        marks.push(start);
        blocks.push({ x, y: deck, z: 0, sx: seg * 0.96, sy: 0.5, sz: wide, ry: 0, color: hsl(hue, 0.1, 0.5 + (k % 2) * 0.06), start, dur: 0.32, mode: 'drop', fall: 4 });
        if (k % 2) continue;
        const top = P - 0.8 - ((half - k) / half) * P * 0.32;
        for (const s of [-1, 1]) tubes.push({ curve: line([px, top, s * 0.5], [x, deck + 0.25, s * (wide / 2 - 0.3)]), color: hsl(hue + (k / half) * 0.5, 1, 0.62), start: start + 0.15, dur: 0.35, radius: 0.06, segments: 12, radial: 6 });
      }
    }
    // orilla: una explanada a la altura del tablero, la calzada que sigue y edificios bajos
    blocks.push({ x: sg * (X + 100), y: land / 2, z: 0, sx: 200, sy: land, sz: 420, ry: 0, color: hsl(hue, 0.2, 0.06), start: 0.05, dur: 0.5, mode: 'rise', flash: 0 });
    blocks.push({ x: sg * (X + 60), y: land + 0.04, z: 0, sx: 120, sy: 0.08, sz: wide, ry: 0, color: hsl(hue, 0.1, 0.3), start: 0.3, dur: 0.6, mode: 'grow', flash: 0.3 });
    for (let i = 0; i < 13; i++) {
      for (let j = -12; j <= 12; j++) {
        if (j === 0 || Math.random() < 0.3 + i * 0.04) continue;
        const h = rnd(1, i > 3 && Math.random() < 0.1 ? 16 : 7);
        blocks.push({ x: sg * (X + 6 + i * 8), y: land + h / 2, z: j * 8, sx: rnd(3.6, 5.8), sy: h, sz: rnd(3.6, 5.8), ry: 0, color: hsl(hue + rnd(-0.05, 0.05), 0.3, rnd(0.1, 0.2)), start: 0.2 + i * 0.09 + Math.random() * 0.3, dur: 0.6, mode: 'rise', flash: 0.25 });
      }
    }
  }
  // alumbrado de punta a punta cuando el tablero se cierra
  for (const s of [-1, 1]) tubes.push({ curve: line([-X, deck + 0.4, s * (wide / 2 - 0.1)], [X, deck + 0.4, s * (wide / 2 - 0.1)]), color: hsl(0.11, 1, 0.68), start: 4.4, dur: 0.8, radius: 0.05, segments: 80, radial: 6 });

  return {
    name: 'Puente atirantado',
    unit: 'Tramo',
    marks: marks.sort((a, b) => a - b),
    summary: `Claro de ${Math.round(S * 2) * 10} m · torres de ${Math.round(P) * 10} m`,
    blocks,
    tubes,
    height: P + 1,
    radius: X + 4,
    roof: P,
    front: (t) => P * clamp01((t - 0.3) / 1.5),
    cranes: [],
    beacons: [
      [-S, P + 1.4, 0],
      [S, P + 1.4, 0],
    ],
    hue,
    angle: rnd(-0.2, 0.05) + pick([0, Math.PI]),
    spin: 0.11,
    water: true,
  };
}

// ---------------------------------------------------------------------------
// 5 · Ciudad vertical: una retícula de torres que suben todas a la vez
// ---------------------------------------------------------------------------
function ciudad(): Build {
  const hue = rnd(0.5, 0.95);
  const g = 5; // manzanas por lado
  const cell = 9;
  const fh = 0.45;
  const tallest = rint(100, 118);
  const blocks: Block[] = [];
  const tubes: TubeSpec[] = [];
  const beacons: V3[] = [];
  const mid = (g - 1) / 2;
  let towers = 0;

  for (let i = 0; i < g; i++) {
    for (let j = 0; j < g; j++) {
      const x = (i - mid) * cell;
      const z = (j - mid) * cell;
      const center = i === mid && j === mid;
      const n = center ? tallest : rint(16, Math.hypot(i - mid, j - mid) < 1.5 ? 78 : 52);
      const s = rnd(5.2, 6.4);
      const deep = s * rnd(0.75, 1);
      const star = center || Math.random() < 0.35;
      const cut = n * rnd(0.6, 0.8);
      towers++;
      stack(
        blocks,
        n,
        fh,
        hue + rnd(-0.08, 0.08),
        (f) => {
          const k = f > cut ? 0.68 : 1;
          return star
            ? [
                { x: 0, z: 0, sx: s * k, sz: s * k, ry: 0 },
                { x: 0, z: 0, sx: s * k * 0.82, sz: s * k * 0.82, ry: Math.PI / 4 },
              ]
            : [{ x: 0, z: 0, sx: s * k, sz: deep * k, ry: 0 }];
        },
        x,
        z,
        tallest,
      );
      if (center) beacons.push([x, spire(blocks, tubes, x, z, n * fh, s * 0.3, hue, 4, 5), z]);
    }
  }
  // calles trazadas con luz antes de que suban las torres
  const L = (g * cell) / 2 + 1.5;
  for (let k = 0; k <= g; k++) {
    const p = (k - g / 2) * cell;
    tubes.push({ curve: line([-L, 0.08, p], [L, 0.08, p]), color: hsl(hue + k * 0.06, 0.95, 0.6), start: 0.05 + k * 0.06, dur: 0.7, radius: 0.09 });
    tubes.push({ curve: line([p, 0.08, -L], [p, 0.08, L]), color: hsl(hue + 0.4 + k * 0.06, 0.95, 0.6), start: 0.1 + k * 0.06, dur: 0.7, radius: 0.09 });
  }
  cityRing(blocks, L + 5, 100, hue);
  const tip = beacons[0][1];

  return {
    name: 'Ciudad vertical',
    unit: 'Piso',
    marks: marksOf(tallest),
    summary: `${towers} torres · la más alta, ${tallest} pisos`,
    blocks,
    tubes,
    height: tip,
    radius: L,
    roof: tallest * fh,
    front: towerFront(tallest * fh, tip),
    cranes: [[0, 0]],
    beacons,
    hue,
    angle: rnd(0, Math.PI * 2),
    spin: 0.24,
  };
}

const MAKERS: Record<string, () => Build> = { megatorre, torcida: torreTorcida, gemelas: torresGemelas, puente, ciudad };
const LAST_KEY = 'rendercrz:pref:intro';

/**
 * Obra para esta carga: al azar, pero nunca la misma dos veces seguidas.
 * Con `?obra=megatorre|torcida|gemelas|puente|ciudad` en la dirección se elige una.
 */
export function randomBuild(): Build {
  const keys = Object.keys(MAKERS);
  const asked = new URLSearchParams(location.search).get('obra');
  if (asked && MAKERS[asked]) return MAKERS[asked]();
  let last = -1;
  try {
    last = keys.indexOf(localStorage.getItem(LAST_KEY) ?? '');
  } catch {
    /* sin acceso */
  }
  let i = Math.floor(Math.random() * (keys.length - (last >= 0 ? 1 : 0)));
  if (last >= 0 && i >= last) i++;
  try {
    localStorage.setItem(LAST_KEY, keys[i]);
  } catch {
    /* sin acceso */
  }
  return MAKERS[keys[i]]();
}
