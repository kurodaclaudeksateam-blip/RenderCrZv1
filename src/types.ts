// Todas las medidas están en metros. El plano usa (x, y) con y hacia abajo;
// en 3D, x → x, y → z.

export interface Vec2 {
  x: number;
  y: number;
}

export type FloorMaterial = 'madera' | 'ceramica' | 'alfombra' | 'concreto' | 'marmol' | 'epoxi';

/** Acabado de los muros; 'malla' y 'cerco' son cercos en vez de muro sólido. */
export type WallMaterial = 'liso' | 'ladrillo' | 'block' | 'concreto' | 'lamina' | 'madera' | 'vidrio' | 'malla' | 'cerco';

/** Tipo de puerta; 'marco' es un vano con marco y 'arco' uno con remate curvo. Sin tipo el vano queda abierto. */
export type DoorStyle = 'madera' | 'vidrio' | 'metal' | 'malla' | 'marco' | 'arco';

/** Ajustes propios de un tramo de pared (un lado del ambiente); lo que falte se toma del ambiente. */
export interface WallSide {
  /** 'none' deja ese lado sin pared */
  material?: WallMaterial | 'none';
  height?: number;
  color?: string;
}

export interface Room {
  id: string;
  name: string;
  points: Vec2[];
  floor: FloorMaterial;
  floorColor: string;
  wallColor: string;
  hasWalls: boolean;
  wallMaterial?: WallMaterial;
  /** altura de las paredes; sin valor llegan al techo (los cercos miden 2 m) */
  wallHeight?: number;
  /** grosor de las paredes; sin valor se usa el del proyecto */
  wallThickness?: number;
  /** imagen que cubre el piso (data URL ya reducida) */
  floorImage?: string;
  /** lado del mosaico en metros; sin valor la imagen se ajusta al ambiente */
  floorTile?: number;
  /** ajustes por tramo, en el orden de las aristas (punto i → punto i+1) */
  sides?: (WallSide | null)[];
}

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: string;
  roomId: string;
  /** índice de la arista del polígono (punto i → punto i+1) */
  edge: number;
  /** posición del centro a lo largo de la arista, 0..1 */
  t: number;
  width: number;
  height: number;
  /** altura del alféizar (solo ventanas) */
  sill: number;
  kind: OpeningKind;
  door?: DoorStyle;
}

export type FurnitureType =
  // almacenaje y logística
  | 'rack'
  | 'estanteria_metal'
  | 'cantilever'
  | 'pallet'
  | 'pallet_carga'
  | 'caja_carton'
  | 'contenedor'
  | 'montacargas'
  | 'transpaleta'
  | 'banda'
  | 'mesa_embalaje'
  | 'bascula'
  | 'malla'
  | 'rampa_curva'
  | 'escalera_vertical'
  | 'escalera_jaula'
  | 'rack_custom'
  | 'rack_tubos'
  | 'rack_tubos_v'
  | 'base_tubos'
  | 'tarima_custom'
  | 'cerco'
  | 'cerco_malla'
  | 'barandal'
  | 'barrera'
  | 'mueble_tapa'
  | 'anuncio_torre'
  | 'anuncio_cuadro'
  | 'anuncio_poste'
  | 'anuncio_relieve'
  | 'escalera_metal'
  // señalización y zonas
  | 'letrero'
  | 'letrero_pie'
  | 'zona'
  | 'extintor'
  | 'cono'
  | 'bolardo'
  // hogar / oficina
  | 'sofa'
  | 'sillon'
  | 'mesa_centro'
  | 'mueble_tv'
  | 'estante'
  | 'alfombra'
  | 'cama'
  | 'mesa_noche'
  | 'ropero'
  | 'comoda'
  | 'mesa'
  | 'mesa_redonda'
  | 'silla'
  | 'cocina'
  | 'refrigerador'
  | 'encimera'
  | 'lavaplatos'
  | 'inodoro'
  | 'lavamanos'
  | 'ducha'
  | 'tina'
  | 'escritorio'
  | 'silla_oficina'
  | 'planta'
  | 'lampara'
  | 'escalera'
  | 'columna'
  | 'caja';

export interface Furniture {
  id: string;
  type: FurnitureType;
  name: string;
  /** centro en el plano */
  x: number;
  y: number;
  /** grados, sentido horario en el plano */
  rotation: number;
  /** ancho (x local), profundidad (y local), alto */
  w: number;
  d: number;
  h: number;
  /** altura sobre el piso */
  elevation: number;
  color: string;
  /** texto para letreros y zonas */
  label?: string;
  /** niveles de carga en racks y estanterías */
  shelves?: number;
  /** racks y anaqueles sin carga (solo la estructura); en el rótulo con profundidad, reverso liso */
  empty?: boolean;
  /** rack y tarima a medida: posiciones a lo ancho y a lo fondo */
  cols?: number;
  rows?: number;
  /** color de la caja de cada posición ('' = vacía); ver cellIndex */
  cells?: string[];
  /** imagen del anuncio (data URL ya reducida); en el rótulo con profundidad ya viene sin fondo */
  image?: string;
  /** muestra un rótulo con el nombre sobre el objeto */
  showName?: boolean;
}

export interface Level {
  id: string;
  name: string;
  /** altura de piso a techo */
  height: number;
  rooms: Room[];
  openings: Opening[];
  furniture: Furniture[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  wallThickness: number;
  levels: Level[];
}

export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'furniture'; id: string }
  | { kind: 'opening'; id: string }
  | null;

export type Tool = 'select' | 'room' | 'rect' | 'door' | 'dock' | 'window' | 'pan';
