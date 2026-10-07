import type { FloorMaterial, FurnitureType } from './types';

export interface CatalogItem {
  type: FurnitureType;
  label: string;
  icon: string;
  category: string;
  w: number;
  d: number;
  h: number;
  color: string;
  elevation?: number;
}

export const CATEGORIES = ['Sala', 'Dormitorio', 'Comedor', 'Cocina', 'Baño', 'Oficina', 'Otros'];

export const CATALOG: CatalogItem[] = [
  { type: 'sofa', label: 'Sofá', icon: '🛋️', category: 'Sala', w: 2.1, d: 0.9, h: 0.85, color: '#6b7a8f' },
  { type: 'sillon', label: 'Sillón', icon: '💺', category: 'Sala', w: 0.9, d: 0.85, h: 0.85, color: '#a0785a' },
  { type: 'mesa_centro', label: 'Mesa de centro', icon: '▭', category: 'Sala', w: 1.1, d: 0.6, h: 0.42, color: '#8b5e3c' },
  { type: 'mueble_tv', label: 'Mueble TV', icon: '📺', category: 'Sala', w: 1.8, d: 0.45, h: 0.5, color: '#3d3d3d' },
  { type: 'estante', label: 'Librero', icon: '📚', category: 'Sala', w: 1.0, d: 0.35, h: 1.9, color: '#a67c52' },
  { type: 'alfombra', label: 'Alfombra', icon: '🟫', category: 'Sala', w: 2.0, d: 1.4, h: 0.02, color: '#b45f4d' },
  { type: 'cama', label: 'Cama 2 plazas', icon: '🛏️', category: 'Dormitorio', w: 1.6, d: 2.0, h: 0.55, color: '#e8e1d5' },
  { type: 'cama', label: 'Cama 1 plaza', icon: '🛏️', category: 'Dormitorio', w: 1.0, d: 1.95, h: 0.5, color: '#cfe0f0' },
  { type: 'mesa_noche', label: 'Velador', icon: '◻️', category: 'Dormitorio', w: 0.45, d: 0.4, h: 0.55, color: '#8b5e3c' },
  { type: 'ropero', label: 'Ropero', icon: '🚪', category: 'Dormitorio', w: 1.6, d: 0.6, h: 2.1, color: '#c8a27a' },
  { type: 'comoda', label: 'Cómoda', icon: '🗄️', category: 'Dormitorio', w: 1.2, d: 0.5, h: 0.85, color: '#9c6b43' },
  { type: 'mesa', label: 'Mesa comedor', icon: '🍽️', category: 'Comedor', w: 1.8, d: 0.95, h: 0.76, color: '#7a4e2d' },
  { type: 'mesa_redonda', label: 'Mesa redonda', icon: '⚪', category: 'Comedor', w: 1.1, d: 1.1, h: 0.76, color: '#7a4e2d' },
  { type: 'silla', label: 'Silla', icon: '🪑', category: 'Comedor', w: 0.45, d: 0.5, h: 0.9, color: '#5c3d24' },
  { type: 'cocina', label: 'Cocina', icon: '🔥', category: 'Cocina', w: 0.6, d: 0.6, h: 0.9, color: '#d9d9d9' },
  { type: 'refrigerador', label: 'Refrigerador', icon: '🧊', category: 'Cocina', w: 0.75, d: 0.7, h: 1.8, color: '#e5e7eb' },
  { type: 'encimera', label: 'Mueble cocina', icon: '🧱', category: 'Cocina', w: 1.2, d: 0.6, h: 0.9, color: '#f1f1f1' },
  { type: 'lavaplatos', label: 'Lavaplatos', icon: '🚰', category: 'Cocina', w: 1.0, d: 0.6, h: 0.9, color: '#f1f1f1' },
  { type: 'inodoro', label: 'Inodoro', icon: '🚽', category: 'Baño', w: 0.4, d: 0.7, h: 0.75, color: '#ffffff' },
  { type: 'lavamanos', label: 'Lavamanos', icon: '🪥', category: 'Baño', w: 0.6, d: 0.45, h: 0.85, color: '#ffffff' },
  { type: 'ducha', label: 'Ducha', icon: '🚿', category: 'Baño', w: 0.9, d: 0.9, h: 2.0, color: '#dbeafe' },
  { type: 'tina', label: 'Tina', icon: '🛁', category: 'Baño', w: 1.7, d: 0.75, h: 0.55, color: '#ffffff' },
  { type: 'escritorio', label: 'Escritorio', icon: '🖥️', category: 'Oficina', w: 1.4, d: 0.7, h: 0.75, color: '#d6c4a8' },
  { type: 'silla_oficina', label: 'Silla oficina', icon: '🪑', category: 'Oficina', w: 0.6, d: 0.6, h: 1.1, color: '#222222' },
  { type: 'planta', label: 'Planta', icon: '🪴', category: 'Otros', w: 0.5, d: 0.5, h: 1.2, color: '#3f8f4a' },
  { type: 'lampara', label: 'Lámpara pie', icon: '💡', category: 'Otros', w: 0.4, d: 0.4, h: 1.6, color: '#f5deb3' },
  { type: 'escalera', label: 'Escalera', icon: '🪜', category: 'Otros', w: 1.0, d: 3.2, h: 2.7, color: '#b08968' },
  { type: 'columna', label: 'Columna', icon: '▮', category: 'Otros', w: 0.3, d: 0.3, h: 2.6, color: '#d4d4d4' },
  { type: 'caja', label: 'Bloque genérico', icon: '⬜', category: 'Otros', w: 1.0, d: 1.0, h: 1.0, color: '#94a3b8' },
];

export const FLOOR_MATERIALS: { id: FloorMaterial; label: string; color: string }[] = [
  { id: 'madera', label: 'Madera', color: '#c49a6c' },
  { id: 'ceramica', label: 'Cerámica', color: '#e7e2d8' },
  { id: 'alfombra', label: 'Alfombra', color: '#8f9bb3' },
  { id: 'concreto', label: 'Concreto', color: '#a8a29e' },
  { id: 'marmol', label: 'Mármol', color: '#f2f0ec' },
];

export const ROOM_COLORS = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fbcfe8'];
