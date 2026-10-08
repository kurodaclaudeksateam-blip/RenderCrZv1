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
  /** texto de letreros y zonas */
  text?: string;
  shelves?: number;
  cols?: number;
  rows?: number;
}

/** Los anuncios tienen su propia sección en el panel, fuera de las categorías. */
export const ADS_CATEGORY = 'Anuncios';

export const CATEGORIES = ['Almacenaje', 'Carga', 'Equipos', 'Señalización', 'Zonas', 'Seguridad', 'Oficina', 'Servicios', 'Hogar'];

export const CATALOG: CatalogItem[] = [
  // --- Almacenaje
  { type: 'rack', label: 'Rack selectivo', icon: '🏗️', category: 'Almacenaje', w: 2.7, d: 1.1, h: 6.0, color: '#f97316', shelves: 4 },
  { type: 'rack', label: 'Rack doble fondo', icon: '🏗️', category: 'Almacenaje', w: 2.7, d: 2.3, h: 6.0, color: '#f97316', shelves: 4 },
  { type: 'rack', label: 'Rack bajo', icon: '🏗️', category: 'Almacenaje', w: 2.7, d: 1.1, h: 3.5, color: '#2563eb', shelves: 2 },
  { type: 'rack_custom', label: 'Rack a medida', icon: '🧩', category: 'Almacenaje', w: 2.7, d: 1.1, h: 4.5, color: '#f97316', shelves: 3, cols: 2 },
  { type: 'estanteria_metal', label: 'Anaquel metálico', icon: '🗄️', category: 'Almacenaje', w: 1.2, d: 0.5, h: 2.1, color: '#94a3b8', shelves: 5 },
  { type: 'estanteria_metal', label: 'Anaquel picking', icon: '🗄️', category: 'Almacenaje', w: 2.0, d: 0.6, h: 2.4, color: '#64748b', shelves: 6 },
  { type: 'cantilever', label: 'Cantilever', icon: '🪜', category: 'Almacenaje', w: 3.0, d: 1.2, h: 3.5, color: '#16a34a', shelves: 4 },
  { type: 'contenedor', label: 'Contenedor plástico', icon: '🧺', category: 'Almacenaje', w: 0.6, d: 0.4, h: 0.32, color: '#2563eb' },
  // --- Carga
  { type: 'pallet', label: 'Pallet vacío', icon: '🟫', category: 'Carga', w: 1.2, d: 1.0, h: 0.15, color: '#c8a26b' },
  { type: 'tarima_custom', label: 'Tarima a medida', icon: '🧩', category: 'Carga', w: 1.2, d: 1.0, h: 1.2, color: '#c8a26b', shelves: 3, cols: 2, rows: 2 },
  { type: 'pallet_carga', label: 'Pallet con carga', icon: '📦', category: 'Carga', w: 1.2, d: 1.0, h: 1.4, color: '#c69c6d' },
  { type: 'caja_carton', label: 'Caja de cartón', icon: '📦', category: 'Carga', w: 0.6, d: 0.4, h: 0.4, color: '#c69c6d' },
  { type: 'caja', label: 'Bulto genérico', icon: '⬜', category: 'Carga', w: 1.0, d: 1.0, h: 1.0, color: '#94a3b8' },
  // --- Equipos
  { type: 'montacargas', label: 'Montacargas', icon: '🚜', category: 'Equipos', w: 1.2, d: 3.2, h: 2.2, color: '#facc15' },
  { type: 'rampa_curva', label: 'Rampa de descarga curva', icon: '↪️', category: 'Equipos', w: 6, d: 6, h: 1.2, color: '#9ca3af' },
  { type: 'escalera_metal', label: 'Escalera metálica', icon: '🪜', category: 'Equipos', w: 1.0, d: 3.5, h: 3.0, color: '#facc15' },
  { type: 'transpaleta', label: 'Transpaleta', icon: '🛒', category: 'Equipos', w: 0.55, d: 1.6, h: 1.2, color: '#dc2626' },
  { type: 'banda', label: 'Banda transportadora', icon: '➖', category: 'Equipos', w: 4.0, d: 0.8, h: 0.85, color: '#334155' },
  { type: 'mesa_embalaje', label: 'Mesa de embalaje', icon: '🧰', category: 'Equipos', w: 1.8, d: 0.9, h: 0.9, color: '#a3a3a3' },
  { type: 'bascula', label: 'Báscula de piso', icon: '⚖️', category: 'Equipos', w: 1.5, d: 1.5, h: 0.1, color: '#475569' },
  // --- Anuncios
  { type: 'anuncio_torre', label: 'Torre de anuncio', icon: '🗼', category: 'Anuncios', w: 1.6, d: 0.4, h: 5.0, color: '#111827', text: 'TU ANUNCIO' },
  { type: 'anuncio_torre', label: 'Torre de anuncio alta', icon: '🗼', category: 'Anuncios', w: 2.2, d: 0.5, h: 8.0, color: '#111827', text: 'TU ANUNCIO' },
  { type: 'anuncio_cuadro', label: 'Cuadro LED rectangular', icon: '🖼️', category: 'Anuncios', w: 2.4, d: 0.12, h: 1.4, color: '#111827', elevation: 1.6, text: 'TU ANUNCIO' },
  { type: 'anuncio_cuadro', label: 'Cuadro LED cuadrado', icon: '🖼️', category: 'Anuncios', w: 1.5, d: 0.12, h: 1.5, color: '#111827', elevation: 1.6, text: 'TU ANUNCIO' },
  // --- Señalización
  { type: 'letrero', label: 'Letrero colgante', icon: '🪧', category: 'Señalización', w: 1.8, d: 0.05, h: 0.6, color: '#1d4ed8', elevation: 4.0, text: 'PASILLO A' },
  { type: 'letrero', label: 'Letrero salida', icon: '🚪', category: 'Señalización', w: 1.0, d: 0.05, h: 0.35, color: '#16a34a', elevation: 2.4, text: 'SALIDA' },
  { type: 'letrero_pie', label: 'Letrero de pie', icon: '🪧', category: 'Señalización', w: 0.8, d: 0.08, h: 1.8, color: '#f59e0b', text: 'ANDÉN 1' },
  // --- Zonas
  { type: 'zona', label: 'Zona recepción', icon: '🟦', category: 'Zonas', w: 6, d: 4, h: 0.01, color: '#3b82f6', text: 'RECEPCIÓN' },
  { type: 'zona', label: 'Zona despacho', icon: '🟩', category: 'Zonas', w: 6, d: 4, h: 0.01, color: '#22c55e', text: 'DESPACHO' },
  { type: 'zona', label: 'Zona picking', icon: '🟨', category: 'Zonas', w: 5, d: 3, h: 0.01, color: '#eab308', text: 'PICKING' },
  { type: 'zona', label: 'Zona cuarentena', icon: '🟥', category: 'Zonas', w: 3, d: 3, h: 0.01, color: '#ef4444', text: 'CUARENTENA' },
  { type: 'zona', label: 'Zona devoluciones', icon: '🟪', category: 'Zonas', w: 4, d: 3, h: 0.01, color: '#a855f7', text: 'DEVOLUCIONES' },
  { type: 'zona', label: 'Pasillo peatonal', icon: '🟧', category: 'Zonas', w: 1.2, d: 8, h: 0.01, color: '#f97316', text: 'PEATONAL' },
  // --- Seguridad
  { type: 'extintor', label: 'Extintor', icon: '🧯', category: 'Seguridad', w: 0.25, d: 0.25, h: 0.75, color: '#dc2626' },
  { type: 'cono', label: 'Cono', icon: '🔺', category: 'Seguridad', w: 0.35, d: 0.35, h: 0.7, color: '#f97316' },
  { type: 'bolardo', label: 'Bolardo', icon: '🟡', category: 'Seguridad', w: 0.2, d: 0.2, h: 1.0, color: '#facc15' },
  { type: 'cerco', label: 'Cerco metálico blanco', icon: '🚧', category: 'Seguridad', w: 2.4, d: 0.06, h: 1.8, color: '#f8fafc' },
  { type: 'cerco_malla', label: 'Cerco de malla metálica', icon: '🚧', category: 'Seguridad', w: 2.4, d: 0.06, h: 2.0, color: '#cbd5e1' },
  { type: 'malla', label: 'Malla divisoria', icon: '🚧', category: 'Seguridad', w: 3.0, d: 0.06, h: 2.4, color: '#facc15' },
  { type: 'columna', label: 'Columna', icon: '▮', category: 'Seguridad', w: 0.4, d: 0.4, h: 7.0, color: '#d4d4d4' },
  { type: 'sofa', label: 'Sofá', icon: '🛋️', category: 'Hogar', w: 2.1, d: 0.9, h: 0.85, color: '#6b7a8f' },
  { type: 'sillon', label: 'Sillón', icon: '💺', category: 'Hogar', w: 0.9, d: 0.85, h: 0.85, color: '#a0785a' },
  { type: 'mesa_centro', label: 'Mesa de centro', icon: '▭', category: 'Hogar', w: 1.1, d: 0.6, h: 0.42, color: '#8b5e3c' },
  { type: 'mueble_tv', label: 'Mueble TV', icon: '📺', category: 'Hogar', w: 1.8, d: 0.45, h: 0.5, color: '#3d3d3d' },
  { type: 'estante', label: 'Librero', icon: '📚', category: 'Hogar', w: 1.0, d: 0.35, h: 1.9, color: '#a67c52' },
  { type: 'alfombra', label: 'Alfombra', icon: '🟫', category: 'Hogar', w: 2.0, d: 1.4, h: 0.02, color: '#b45f4d' },
  { type: 'cama', label: 'Cama 2 plazas', icon: '🛏️', category: 'Hogar', w: 1.6, d: 2.0, h: 0.55, color: '#e8e1d5' },
  { type: 'cama', label: 'Cama 1 plaza', icon: '🛏️', category: 'Hogar', w: 1.0, d: 1.95, h: 0.5, color: '#cfe0f0' },
  { type: 'mesa_noche', label: 'Velador', icon: '◻️', category: 'Hogar', w: 0.45, d: 0.4, h: 0.55, color: '#8b5e3c' },
  { type: 'ropero', label: 'Ropero', icon: '🚪', category: 'Hogar', w: 1.6, d: 0.6, h: 2.1, color: '#c8a27a' },
  { type: 'comoda', label: 'Cómoda', icon: '🗄️', category: 'Hogar', w: 1.2, d: 0.5, h: 0.85, color: '#9c6b43' },
  { type: 'mesa', label: 'Mesa comedor', icon: '🍽️', category: 'Hogar', w: 1.8, d: 0.95, h: 0.76, color: '#7a4e2d' },
  { type: 'mesa_redonda', label: 'Mesa redonda', icon: '⚪', category: 'Hogar', w: 1.1, d: 1.1, h: 0.76, color: '#7a4e2d' },
  { type: 'silla', label: 'Silla', icon: '🪑', category: 'Hogar', w: 0.45, d: 0.5, h: 0.9, color: '#5c3d24' },
  { type: 'cocina', label: 'Cocina', icon: '🔥', category: 'Servicios', w: 0.6, d: 0.6, h: 0.9, color: '#d9d9d9' },
  { type: 'refrigerador', label: 'Refrigerador', icon: '🧊', category: 'Servicios', w: 0.75, d: 0.7, h: 1.8, color: '#e5e7eb' },
  { type: 'encimera', label: 'Mueble cocina', icon: '🧱', category: 'Servicios', w: 1.2, d: 0.6, h: 0.9, color: '#f1f1f1' },
  { type: 'lavaplatos', label: 'Lavaplatos', icon: '🚰', category: 'Servicios', w: 1.0, d: 0.6, h: 0.9, color: '#f1f1f1' },
  { type: 'inodoro', label: 'Inodoro', icon: '🚽', category: 'Servicios', w: 0.4, d: 0.7, h: 0.75, color: '#ffffff' },
  { type: 'lavamanos', label: 'Lavamanos', icon: '🪥', category: 'Servicios', w: 0.6, d: 0.45, h: 0.85, color: '#ffffff' },
  { type: 'ducha', label: 'Ducha', icon: '🚿', category: 'Servicios', w: 0.9, d: 0.9, h: 2.0, color: '#dbeafe' },
  { type: 'tina', label: 'Tina', icon: '🛁', category: 'Servicios', w: 1.7, d: 0.75, h: 0.55, color: '#ffffff' },
  { type: 'escritorio', label: 'Escritorio', icon: '🖥️', category: 'Oficina', w: 1.4, d: 0.7, h: 0.75, color: '#d6c4a8' },
  { type: 'silla_oficina', label: 'Silla oficina', icon: '🪑', category: 'Oficina', w: 0.6, d: 0.6, h: 1.1, color: '#222222' },
  { type: 'planta', label: 'Planta', icon: '🪴', category: 'Hogar', w: 0.5, d: 0.5, h: 1.2, color: '#3f8f4a' },
  { type: 'lampara', label: 'Lámpara pie', icon: '💡', category: 'Hogar', w: 0.4, d: 0.4, h: 1.6, color: '#f5deb3' },
  { type: 'escalera', label: 'Escalera', icon: '🪜', category: 'Oficina', w: 1.0, d: 3.2, h: 2.7, color: '#b08968' },
];

export const FLOOR_MATERIALS: { id: FloorMaterial; label: string; color: string }[] = [
  { id: 'madera', label: 'Madera', color: '#c49a6c' },
  { id: 'ceramica', label: 'Cerámica', color: '#e7e2d8' },
  { id: 'alfombra', label: 'Alfombra', color: '#8f9bb3' },
  { id: 'concreto', label: 'Concreto', color: '#a8a29e' },
  { id: 'epoxi', label: 'Epóxico industrial', color: '#9aa5b1' },
  { id: 'marmol', label: 'Mármol', color: '#f2f0ec' },
];

export const ROOM_COLORS = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fbcfe8'];
