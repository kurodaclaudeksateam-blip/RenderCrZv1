import * as THREE from 'three';
import type { FloorMaterial } from '../types';

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
