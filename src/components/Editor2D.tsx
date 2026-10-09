import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentLevel, useStore } from '../store';
import { OPENING_PRESETS } from '../catalog';
import {
  add,
  area,
  bounds,
  collides,
  computeWalls,
  dist,
  fmt,
  interiorPoint,
  inwardNormal,
  localToWorld,
  mul,
  nearestEdge,
  norm,
  openingWorld,
  projectOnSegment,
  signedArea,
  sub,
  v,
} from '../geometry';
import {
  addFurniture,
  addOpening,
  addRoom,
  catalogItem,
  deleteSelection,
  duplicateSelection,
  editorView,
  insertVertex,
  nudgeSelection,
  removeVertex,
  rotateSelection,
} from '../actions';
import type { Furniture, Level, Room, Vec2 } from '../types';
import { FurnitureSymbol } from './FurnitureSymbol';

const PX = 50; // píxeles por metro con zoom 1

type Drag =
  | { type: 'pan'; sx: number; sy: number; cam: Cam; moved: boolean }
  | { type: 'furniture'; id: string; off: Vec2; moved: boolean }
  | { type: 'rotate'; id: string; moved: boolean }
  | { type: 'resize'; id: string; side: 'n' | 's' | 'e' | 'w'; moved: boolean }
  | { type: 'vertex'; roomId: string; index: number; moved: boolean }
  | { type: 'room'; id: string; start: Vec2; orig: Vec2[]; furn: { id: string; x: number; y: number }[]; moved: boolean }
  | { type: 'opening'; id: string; moved: boolean }
  | { type: 'rect'; start: Vec2; moved: boolean };

interface Cam {
  x: number;
  y: number;
  z: number;
}

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

export default function Editor2D() {
  const svgRef = useRef<SVGSVGElement>(null);
  const project = useStore((s) => s.project)!;
  const level = useCurrentLevel()!;
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const gridSize = useStore((s) => s.gridSize);
  const snapOn = useStore((s) => s.snap);
  const showGhost = useStore((s) => s.showGhost);
  const { select, mutate, checkpoint, setTool, undo, redo } = useStore.getState();

  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState<Cam>({ x: 120, y: 120, z: 1 });
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [draft, setDraft] = useState<Vec2[]>([]);
  const [rectEnd, setRectEnd] = useState<Vec2 | null>(null);
  const drag = useRef<Drag | null>(null);
  const spaceDown = useRef(false);
  const [, force] = useState(0);

  const scale = PX * cam.z;
  const k = 1 / scale; // metros por píxel

  const levelIndex = project.levels.findIndex((l) => l.id === level.id);
  const below: Level | null = levelIndex > 0 ? project.levels[levelIndex - 1] : null;

  // --- tamaño y vista -------------------------------------------------------
  useEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    editorView.center = { x: (size.w / 2 - cam.x) / scale, y: (size.h / 2 - cam.y) / scale };
  }, [cam, size, scale]);

  const fit = useCallback(() => {
    const pts = level.rooms.flatMap((r) => r.points).concat(level.furniture.map((f) => v(f.x, f.y)));
    if (below && pts.length === 0) pts.push(...below.rooms.flatMap((r) => r.points));
    const el = svgRef.current;
    const w = el?.clientWidth || size.w;
    const h = el?.clientHeight || size.h;
    if (!pts.length) {
      setCam({ x: w / 2 - 5 * PX, y: h / 2 - 4 * PX, z: 1 });
      return;
    }
    const b = bounds(pts);
    const bw = Math.max(2, b.maxX - b.minX);
    const bh = Math.max(2, b.maxY - b.minY);
    const z = Math.min(4, Math.max(0.2, Math.min((w - 120) / (bw * PX), (h - 120) / (bh * PX))));
    setCam({ x: w / 2 - ((b.minX + b.maxX) / 2) * PX * z, y: h / 2 - ((b.minY + b.maxY) / 2) * PX * z, z });
  }, [level, below, size]);

  // encuadrar al abrir o cambiar de nivel
  useEffect(() => {
    requestAnimationFrame(fit);
    setDraft([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  useEffect(() => {
    if (tool !== 'room') setDraft([]);
    if (tool !== 'rect') setRectEnd(null);
  }, [tool]);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    setCam((c) => {
      const z = Math.min(8, Math.max(0.15, c.z * factor));
      const wx = (sx - c.x) / (PX * c.z);
      const wy = (sy - c.y) / (PX * c.z);
      return { x: sx - wx * PX * z, y: sy - wy * PX * z, z };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // --- coordenadas y ajuste -------------------------------------------------
  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return v((clientX - r.left - cam.x) / scale, (clientY - r.top - cam.y) / scale);
  };

  const snapGrid = (p: Vec2): Vec2 => (snapOn ? v(Math.round(p.x / gridSize) * gridSize, Math.round(p.y / gridSize) * gridSize) : p);

  const snapPoint = (p: Vec2, skip?: { roomId: string; index: number }): Vec2 => {
    const tol = 10 * k;
    let best: Vec2 | null = null;
    let bd = tol;
    const sources = [...level.rooms, ...(below && showGhost ? below.rooms : [])];
    for (const r of sources) {
      r.points.forEach((q, i) => {
        if (skip && r.id === skip.roomId && i === skip.index) return;
        const d = dist(p, q);
        if (d < bd) {
          bd = d;
          best = q;
        }
      });
    }
    if (best) return { ...(best as Vec2) };
    return snapGrid(p);
  };

  const angleLock = (from: Vec2, p: Vec2): Vec2 => {
    const d = sub(p, from);
    const L = Math.hypot(d.x, d.y);
    const ang = Math.round(Math.atan2(d.y, d.x) / (Math.PI / 4)) * (Math.PI / 4);
    return snapGrid(add(from, v(Math.cos(ang) * L, Math.sin(ang) * L)));
  };

  // --- muros calculados -----------------------------------------------------
  const walls = useMemo(() => computeWalls(level, project.wallThickness), [level, project.wallThickness]);

  // alcance para atinarle a un muro: 0.6 m o 24 px, lo que sea mayor (con el plano alejado 0.6 m son muy pocos píxeles)
  const wallReach = Math.max(0.6, 24 * k);
  const openingPreset = useStore((st) => st.openingPreset);
  const avoidOverlap = useStore((st) => st.avoidOverlap);
  const openingHover = useMemo(() => {
    if ((tool !== 'door' && tool !== 'dock' && tool !== 'window') || !cursor) return null;
    return nearestEdge(level.rooms.filter((r) => r.hasWalls), cursor, wallReach);
  }, [tool, cursor, level.rooms, wallReach]);

  // --- teclado --------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'Space') {
        spaceDown.current = e.type === 'keydown';
        return;
      }
      if (e.type !== 'keydown') return;
      const key = e.key.toLowerCase();
      if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (ctrl && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (ctrl) return;

      if (tool === 'room' && draft.length) {
        if (e.key === 'Escape') setDraft([]);
        if (e.key === 'Backspace') setDraft((d) => d.slice(0, -1));
        if (e.key === 'Enter' && draft.length >= 3) {
          addRoom(draft);
          setDraft([]);
          setTool('select');
        }
        return;
      }
      if (e.key === 'Escape') {
        select(null);
        setTool('select');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
      const step = e.shiftKey ? 0.5 : gridSize;
      if (e.key.startsWith('Arrow') && selection) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') nudgeSelection(-step, 0);
        if (e.key === 'ArrowRight') nudgeSelection(step, 0);
        if (e.key === 'ArrowUp') nudgeSelection(0, -step);
        if (e.key === 'ArrowDown') nudgeSelection(0, step);
        return;
      }
      if (key === 'r') rotateSelection(e.shiftKey ? -90 : 90);
      if (key === 'q') rotateSelection(-15);
      if (key === 'e') rotateSelection(15);
      if (key === 'v') setTool('select');
      if (key === 'p') setTool('room');
      if (key === 'b') setTool('rect');
      if (key === 'd') setTool('door');
      if (key === 'w') setTool('window');
      if (key === 'g') setTool('dock');
      if (key === 'h') setTool('pan');
      if (key === 'f') fit();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [tool, draft, selection, gridSize, fit, select, setTool, undo, redo]);

  // --- punteros ---------------------------------------------------------------
  const startPan = (e: React.PointerEvent) => {
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, cam, moved: false };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    const raw = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || spaceDown.current || tool === 'pan') return startPan(e);

    const target = (e.target as Element).closest('[data-kind]') as SVGElement | null;
    const kind = target?.dataset.kind;
    const id = target?.dataset.id ?? '';

    if (tool === 'select') {
      if (kind === 'rotate') {
        drag.current = { type: 'rotate', id, moved: false };
      } else if (kind === 'resize') {
        drag.current = { type: 'resize', id, side: target!.dataset.side as 'n' | 's' | 'e' | 'w', moved: false };
      } else if (kind === 'vertex') {
        const index = Number(target!.dataset.index);
        if (e.altKey) removeVertex(id, index);
        else drag.current = { type: 'vertex', roomId: id, index, moved: false };
      } else if (kind === 'furniture') {
        const f = level.furniture.find((x) => x.id === id)!;
        select({ kind: 'furniture', id });
        drag.current = { type: 'furniture', id, off: sub(raw, v(f.x, f.y)), moved: false };
      } else if (kind === 'opening') {
        select({ kind: 'opening', id });
        drag.current = { type: 'opening', id, moved: false };
      } else if (kind === 'room') {
        const r = level.rooms.find((x) => x.id === id)!;
        select({ kind: 'room', id });
        const inside = e.shiftKey
          ? []
          : level.furniture.filter((f) => pointInRoom(v(f.x, f.y), r)).map((f) => ({ id: f.id, x: f.x, y: f.y }));
        drag.current = { type: 'room', id, start: raw, orig: r.points.map((p) => ({ ...p })), furn: inside, moved: false };
      } else {
        select(null);
        startPan(e);
      }
      return;
    }

    if (tool === 'room') {
      let p = snapPoint(raw);
      if (draft.length && e.shiftKey) p = angleLock(draft[draft.length - 1], raw);
      if (draft.length >= 3 && dist(p, draft[0]) < 12 * k) {
        addRoom(draft);
        setDraft([]);
        setTool('select');
        return;
      }
      if (draft.length && dist(p, draft[draft.length - 1]) < 1e-6) return;
      setDraft((d) => [...d, p]);
      return;
    }

    if (tool === 'rect') {
      const p = snapPoint(raw);
      drag.current = { type: 'rect', start: p, moved: false };
      setRectEnd(p);
      return;
    }

    if (tool === 'door' || tool === 'dock' || tool === 'window') {
      // se busca el muro en el punto tocado: en pantallas táctiles no hay cursor previo
      const hit = nearestEdge(level.rooms.filter((r) => r.hasWalls), raw, wallReach);
      if (hit) {
        addOpening(tool === 'window' ? 'window' : 'door', hit.roomId, hit.edge, hit.t, dist(hit.a, hit.b), tool === 'dock');
        return;
      }
      useStore.getState().notify(level.rooms.some((r) => r.hasWalls) ? 'Toca más cerca de una pared para colocarla' : 'Primero dibuja un ambiente con paredes');
    }

    startPan(e);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const raw = toWorld(e.clientX, e.clientY);
    const d = drag.current;
    if (tool === 'room') setCursor(draft.length && e.shiftKey ? angleLock(draft[draft.length - 1], raw) : snapPoint(raw));
    else setCursor(raw);
    if (!d) return;

    if (d.type === 'pan') {
      setCam({ ...d.cam, x: d.cam.x + e.clientX - d.sx, y: d.cam.y + e.clientY - d.sy });
      return;
    }
    if (!d.moved && d.type !== 'rect') checkpoint();
    d.moved = true;

    if (d.type === 'furniture') {
      let p = snapGrid(sub(raw, d.off));
      const cur = level.furniture.find((x) => x.id === d.id);
      // los objetos no se atraviesan: si el lugar está ocupado se desliza por un eje o se queda (Alt lo permite)
      if (cur && avoidOverlap && !e.altKey && !collides(cur, level.furniture)) {
        const free = (q: Vec2) => !collides({ ...cur, x: q.x, y: q.y }, level.furniture);
        if (!free(p)) {
          // avanza hasta tocar al otro objeto y, desde ahí, se desliza por el eje que quede libre
          let lo = 0;
          let hi = 1;
          for (let i = 0; i < 8; i++) {
            const mid = (lo + hi) / 2;
            if (free(v(cur.x + (p.x - cur.x) * mid, cur.y + (p.y - cur.y) * mid))) lo = mid;
            else hi = mid;
          }
          const q = v(cur.x + (p.x - cur.x) * lo, cur.y + (p.y - cur.y) * lo);
          p = free(v(p.x, q.y)) ? v(p.x, q.y) : free(v(q.x, p.y)) ? v(q.x, p.y) : q;
        }
      }
      mutate((_, l) => {
        const f = l.furniture.find((x) => x.id === d.id);
        if (f) {
          f.x = p.x;
          f.y = p.y;
        }
      }, false);
    } else if (d.type === 'resize') {
      const f = level.furniture.find((x) => x.id === d.id);
      if (!f) return;
      // se estira el lado arrastrado y el opuesto se queda en su lugar
      const r = (f.rotation * Math.PI) / 180;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const lx = (raw.x - f.x) * cos + (raw.y - f.y) * sin;
      const ly = -(raw.x - f.x) * sin + (raw.y - f.y) * cos;
      const horizontal = d.side === 'e' || d.side === 'w';
      const sign = d.side === 'e' || d.side === 's' ? 1 : -1;
      const old = horizontal ? f.w : f.d;
      let size = Math.max(0.05, sign * (horizontal ? lx : ly) + old / 2);
      if (snapOn) size = Math.max(gridSize, Math.round(size / gridSize) * gridSize);
      const shift = (sign * (size - old)) / 2;
      const dx = horizontal ? shift * cos : -shift * sin;
      const dy = horizontal ? shift * sin : shift * cos;
      mutate((_, l) => {
        const ff = l.furniture.find((x) => x.id === d.id);
        if (!ff) return;
        if (horizontal) ff.w = size;
        else ff.d = size;
        ff.x += dx;
        ff.y += dy;
      }, false);
    } else if (d.type === 'rotate') {
      const f = level.furniture.find((x) => x.id === d.id);
      if (!f) return;
      let deg = (Math.atan2(raw.y - f.y, raw.x - f.x) * 180) / Math.PI + 90;
      if (!e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((deg % 360) + 360) % 360;
      mutate((_, l) => {
        const ff = l.furniture.find((x) => x.id === d.id);
        if (ff) ff.rotation = deg;
      }, false);
    } else if (d.type === 'vertex') {
      const p = snapPoint(raw, { roomId: d.roomId, index: d.index });
      mutate((_, l) => {
        const r = l.rooms.find((x) => x.id === d.roomId);
        if (r) r.points[d.index] = p;
      }, false);
    } else if (d.type === 'room') {
      const delta = snapOn
        ? v(Math.round((raw.x - d.start.x) / gridSize) * gridSize, Math.round((raw.y - d.start.y) / gridSize) * gridSize)
        : sub(raw, d.start);
      mutate((_, l) => {
        const r = l.rooms.find((x) => x.id === d.id);
        if (r) r.points = d.orig.map((p) => add(p, delta));
        for (const fo of d.furn) {
          const f = l.furniture.find((x) => x.id === fo.id);
          if (f) {
            f.x = fo.x + delta.x;
            f.y = fo.y + delta.y;
          }
        }
      }, false);
    } else if (d.type === 'opening') {
      const o = level.openings.find((x) => x.id === d.id);
      const ow = o && openingWorld(o, level.rooms);
      if (!o || !ow) return;
      const L = dist(ow.a, ow.b);
      const half = o.width / 2 / L;
      const pr = projectOnSegment(raw, ow.a, ow.b);
      let t = pr.t;
      if (snapOn) t = Math.round((t * L) / gridSize) * (gridSize / L);
      t = Math.min(1 - half, Math.max(half, t));
      mutate((_, l) => {
        const oo = l.openings.find((x) => x.id === d.id);
        if (oo) oo.t = t;
      }, false);
    } else if (d.type === 'rect') {
      setRectEnd(snapPoint(raw));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    try {
      svgRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      /* ya liberado */
    }
    if (d?.type === 'rect' && rectEnd) {
      const a = d.start;
      const b = rectEnd;
      if (Math.abs(a.x - b.x) > 0.2 && Math.abs(a.y - b.y) > 0.2) {
        addRoom([v(a.x, a.y), v(b.x, a.y), v(b.x, b.y), v(a.x, b.y)]);
        setTool('select');
      }
      setRectEnd(null);
    }
    force((n) => n + 1);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'room' && draft.length >= 3) {
      // el doble clic agrega dos puntos iguales; se limpian antes de cerrar
      const pts = draft.filter((p, i) => i === 0 || dist(p, draft[i - 1]) > 1e-6);
      addRoom(pts.length >= 3 ? pts : draft);
      setDraft([]);
      setTool('select');
      return;
    }
    const target = (e.target as Element).closest('[data-kind="edge"]') as SVGElement | null;
    if (tool === 'select' && target) {
      const roomId = target.dataset.id!;
      const edge = Number(target.dataset.index);
      const r = level.rooms.find((x) => x.id === roomId);
      if (!r) return;
      const a = r.points[edge];
      const b = r.points[(edge + 1) % r.points.length];
      const pr = projectOnSegment(toWorld(e.clientX, e.clientY), a, b);
      insertVertex(roomId, edge, snapGrid(pr.point));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/x-furniture');
    const item = key ? catalogItem(key) : null;
    if (item) addFurniture(item, snapGrid(toWorld(e.clientX, e.clientY)));
  };

  // --- render ---------------------------------------------------------------
  const view = {
    minX: -cam.x / scale,
    minY: -cam.y / scale,
    maxX: (size.w - cam.x) / scale,
    maxY: (size.h - cam.y) / scale,
  };
  const minorStep = cam.z >= 1.5 ? gridSize : cam.z >= 0.6 ? Math.max(gridSize, 0.5) : 1;
  const majorStep = cam.z >= 0.35 ? 1 : 5;

  const selRoom = selection?.kind === 'room' ? level.rooms.find((r) => r.id === selection.id) : undefined;
  const selFurn = selection?.kind === 'furniture' ? level.furniture.find((f) => f.id === selection.id) : undefined;

  const cursorClass =
    tool === 'pan' || drag.current?.type === 'pan' ? 'cur-grab' : tool === 'select' ? 'cur-default' : 'cur-cross';

  return (
    <div className="editor2d">
      <svg
        ref={svgRef}
        className={`plan ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={onDoubleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="minor" width={minorStep} height={minorStep} patternUnits="userSpaceOnUse">
            <path d={`M ${minorStep} 0 L 0 0 0 ${minorStep}`} fill="none" stroke="var(--grid-minor)" strokeWidth={k} />
          </pattern>
          <pattern id="major" width={majorStep} height={majorStep} patternUnits="userSpaceOnUse">
            <rect width={majorStep} height={majorStep} fill="url(#minor)" />
            <path d={`M ${majorStep} 0 L 0 0 0 ${majorStep}`} fill="none" stroke="var(--grid-major)" strokeWidth={k * 1.2} />
          </pattern>
          <pattern id="hatch" width={0.2} height={0.2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="0.2" stroke="var(--hatch)" strokeWidth={0.06} />
          </pattern>
        </defs>

        <g transform={`translate(${cam.x} ${cam.y}) scale(${scale})`}>
          <rect x={view.minX} y={view.minY} width={view.maxX - view.minX} height={view.maxY - view.minY} fill="url(#major)" />
          {/* ejes de origen */}
          <line x1={view.minX} x2={view.maxX} y1={0} y2={0} stroke="var(--axis)" strokeWidth={k} />
          <line y1={view.minY} y2={view.maxY} x1={0} x2={0} stroke="var(--axis)" strokeWidth={k} />

          {/* nivel inferior como referencia */}
          {below && showGhost && (
            <g pointerEvents="none" opacity={0.55}>
              {below.rooms.map((r) => (
                <polygon key={r.id} points={pts(r.points)} fill="none" stroke="var(--ghost)" strokeWidth={k * 1.5} strokeDasharray={`${6 * k} ${4 * k}`} />
              ))}
            </g>
          )}

          {/* pisos */}
          {level.rooms.map((r) => (
            <polygon
              key={r.id}
              data-kind="room"
              data-id={r.id}
              points={pts(r.points)}
              fill={r.floorColor}
              fillOpacity={selection?.id === r.id ? 0.55 : 0.35}
              stroke={r.hasWalls ? 'none' : 'var(--ink-soft)'}
              strokeWidth={k * 1.5}
              strokeDasharray={r.hasWalls ? undefined : `${5 * k} ${3 * k}`}
              className={tool === 'select' ? 'hit' : ''}
            />
          ))}
          {/* imagen del piso, recortada al contorno del ambiente */}
          {level.rooms
            .filter((r) => r.floorImage)
            .map((r) => {
              const b = bounds(r.points);
              return (
                <g key={`img${r.id}`} pointerEvents="none">
                  <clipPath id={`floor-${r.id}`}>
                    <polygon points={pts(r.points)} />
                  </clipPath>
                  <image href={r.floorImage} x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} preserveAspectRatio="none" clipPath={`url(#floor-${r.id})`} opacity={0.85} />
                </g>
              );
            })}
          {level.rooms.filter((r) => r.floor === 'concreto' && !r.hasWalls).map((r) => (
            <polygon key={`h${r.id}`} points={pts(r.points)} fill="url(#hatch)" pointerEvents="none" />
          ))}

          {/* muros */}
          <g>
            {walls.pieces
              .filter((p) => p.y0 === 0 && !p.glass)
              .map((p, i) => (
                <polygon key={i} data-kind="room" data-id={p.roomId} points={pts(p.quad)} fill={p.fence ? 'none' : 'var(--wall)'} stroke="var(--wall)" strokeWidth={k * (p.fence ? 1.2 : 0.5)} strokeDasharray={p.fence ? `${3 * k} ${2 * k}` : undefined} />
              ))}
          </g>

          {/* vanos */}
          {level.openings.map((o) => {
            const ow = openingWorld(o, level.rooms);
            const room = level.rooms.find((r) => r.id === o.roomId);
            if (!ow || !room) return null;
            const t = project.wallThickness;
            const nIn = inwardNormal(ow.dir, signedArea(room.points) > 0);
            const p0 = add(ow.center, mul(ow.dir, -o.width / 2));
            const p1 = add(ow.center, mul(ow.dir, o.width / 2));
            const selected = selection?.id === o.id;
            // una puerta abre todo el grosor que atraviesa (muros pegados incluidos)
            const dp = walls.doors.find((d) => d.id === o.id);
            const box = dp
              ? [add(dp.a, mul(dp.inward, -dp.depth / 2)), add(dp.b, mul(dp.inward, -dp.depth / 2)), add(dp.b, mul(dp.inward, dp.depth / 2)), add(dp.a, mul(dp.inward, dp.depth / 2))]
              : [p0, p1, add(p1, mul(nIn, t)), add(p0, mul(nIn, t))];
            return (
              <g key={o.id} data-kind="opening" data-id={o.id} className={tool === 'select' ? 'hit' : ''}>
                <polygon points={pts(box)} fill={o.kind === 'window' ? 'var(--glass)' : 'var(--bg-plan)'} stroke={selected ? 'var(--accent)' : 'var(--wall)'} strokeWidth={k * (selected ? 2.5 : 1)} />
                {o.kind === 'window' ? (
                  <line {...seg(add(p0, mul(nIn, t / 2)), add(p1, mul(nIn, t / 2)))} stroke="var(--wall)" strokeWidth={k * 1.2} />
                ) : o.door === 'marco' || o.door === 'arco' ? null : (
                  <>
                    <line {...seg(add(p0, mul(nIn, t)), add(p0, mul(nIn, t + o.width)))} stroke="var(--ink)" strokeWidth={k * 1.5} />
                    <path
                      d={`M ${add(p0, mul(nIn, t + o.width)).x} ${add(p0, mul(nIn, t + o.width)).y} A ${o.width} ${o.width} 0 0 ${nIn.x * ow.dir.y - nIn.y * ow.dir.x > 0 ? 1 : 0} ${add(p1, mul(nIn, t)).x} ${add(p1, mul(nIn, t)).y}`}
                      fill="none"
                      stroke="var(--ink-soft)"
                      strokeWidth={k}
                      strokeDasharray={`${4 * k} ${3 * k}`}
                    />
                  </>
                )}
                {/* área de toque más amplia */}
                <polygon points={pts([add(p0, mul(nIn, -0.15)), add(p1, mul(nIn, -0.15)), add(p1, mul(nIn, t + 0.15)), add(p0, mul(nIn, t + 0.15))])} fill="transparent" />
              </g>
            );
          })}

          {/* etiquetas de ambientes */}
          {level.rooms.map((r) => {
            const c = interiorPoint(r.points);
            return (
              <g key={`l${r.id}`} pointerEvents="none" className="room-label">
                <text x={c.x} y={c.y - 4 * k} fontSize={13 * k} textAnchor="middle" fontWeight={600}>
                  {r.name}
                </text>
                <text x={c.x} y={c.y + 12 * k} fontSize={11 * k} textAnchor="middle" opacity={0.75}>
                  {fmt(area(r.points), 1)} m²
                </text>
              </g>
            );
          })}

          {/* muebles */}
          {[...level.furniture].sort((a, b) => layer(a) - layer(b)).map((f) => (
            <FurnitureItem key={f.id} f={f} k={k} selected={selection?.id === f.id} hit={tool === 'select'} />
          ))}

          {/* cotas y vértices del ambiente seleccionado */}
          {selRoom && <RoomHandles room={selRoom} k={k} />}

          {/* control de giro del mueble seleccionado */}
          {selFurn && tool === 'select' && (
            <g>
              {(() => {
                const h = localToWorld(0, -selFurn.d / 2 - 22 * k, selFurn.x, selFurn.y, selFurn.rotation);
                const base = localToWorld(0, -selFurn.d / 2, selFurn.x, selFurn.y, selFurn.rotation);
                return (
                  <>
                    <line {...seg(base, h)} stroke="var(--accent)" strokeWidth={k * 1.5} />
                    {/* asas para cambiar el largo y el fondo arrastrando */}
                    {(
                      [
                        ['e', selFurn.w / 2, 0],
                        ['w', -selFurn.w / 2, 0],
                        ['s', 0, selFurn.d / 2],
                        ['n', 0, -selFurn.d / 2],
                      ] as const
                    ).map(([side, x, y]) => {
                      const c = localToWorld(x, y, selFurn.x, selFurn.y, selFurn.rotation);
                      return (
                        <rect
                          key={side}
                          data-kind="resize"
                          data-id={selFurn.id}
                          data-side={side}
                          x={c.x - 5 * k}
                          y={c.y - 5 * k}
                          width={10 * k}
                          height={10 * k}
                          rx={2 * k}
                          fill="var(--panel)"
                          stroke="var(--accent)"
                          strokeWidth={k * 2}
                          className="hit grab"
                        >
                          <title>Arrastra para cambiar la medida</title>
                        </rect>
                      );
                    })}
                    <circle data-kind="rotate" data-id={selFurn.id} cx={h.x} cy={h.y} r={7 * k} fill="var(--panel)" stroke="var(--accent)" strokeWidth={k * 2} className="hit grab" />
                    <text x={h.x} y={h.y + 3.5 * k} fontSize={10 * k} textAnchor="middle" pointerEvents="none" fill="var(--accent)">
                      ⟳
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* vista previa de puerta / ventana */}
          {openingHover && (
            <g pointerEvents="none">
              {(() => {
                const L = dist(openingHover.a, openingHover.b);
                const w = Math.min(OPENING_PRESETS.find((p) => p.id === openingPreset)?.width ?? (tool === 'door' ? 0.9 : tool === 'dock' ? 3 : 1.2), L - 0.1);
                const dir = norm(sub(openingHover.b, openingHover.a));
                const half = w / 2 / L;
                const c = add(openingHover.a, mul(sub(openingHover.b, openingHover.a), Math.min(1 - half, Math.max(half, openingHover.t))));
                return <line {...seg(add(c, mul(dir, -w / 2)), add(c, mul(dir, w / 2)))} stroke="var(--accent)" strokeWidth={k * 8} strokeLinecap="round" opacity={0.7} />;
              })()}
            </g>
          )}

          {/* dibujo de polígono en curso */}
          {tool === 'room' && draft.length > 0 && (
            <g pointerEvents="none">
              <polyline points={pts(cursor ? [...draft, cursor] : draft)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={k * 2} />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 7 : 4) * k} fill={i === 0 ? 'var(--accent)' : 'var(--panel)'} stroke="var(--accent)" strokeWidth={k * 1.5} />
              ))}
              {cursor && (
                <DimLabel a={draft[draft.length - 1]} b={cursor} k={k} />
              )}
              {draft.slice(1).map((p, i) => (
                <DimLabel key={i} a={draft[i]} b={p} k={k} />
              ))}
            </g>
          )}
          {tool === 'room' && cursor && (
            <circle cx={cursor.x} cy={cursor.y} r={4 * k} fill="var(--accent)" pointerEvents="none" />
          )}

          {/* rectángulo en curso */}
          {tool === 'rect' && drag.current?.type === 'rect' && rectEnd && (
            <g pointerEvents="none">
              {(() => {
                const a = drag.current.start;
                const b = rectEnd;
                const poly = [v(a.x, a.y), v(b.x, a.y), v(b.x, b.y), v(a.x, b.y)];
                return (
                  <>
                    <polygon points={pts(poly)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={k * 2} />
                    <DimLabel a={poly[0]} b={poly[1]} k={k} />
                    <DimLabel a={poly[1]} b={poly[2]} k={k} />
                  </>
                );
              })()}
            </g>
          )}
        </g>
      </svg>

      <div className="zoom-controls">
        <button title="Acercar" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)}>＋</button>
        <button title="Alejar" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.8)}>－</button>
        <button title="Encuadrar (F)" onClick={fit}>⤢</button>
        <span className="zoom-label">{Math.round(cam.z * 100)}%</span>
      </div>

      <div className="statusbar">
        <span>{hint(tool, draft.length)}</span>
        <span className="mono">{cursor ? `x ${fmt(cursor.x)} m · y ${fmt(cursor.y)} m` : ''}</span>
      </div>
    </div>
  );
}

function hint(tool: string, n: number) {
  switch (tool) {
    case 'room':
      return n === 0
        ? 'Clic para colocar el primer vértice del ambiente irregular'
        : n < 3
          ? 'Sigue agregando vértices · Shift: ángulos de 45° · Retroceso: deshacer punto · Esc: cancelar'
          : 'Clic en el primer punto, doble clic o Enter para cerrar el ambiente';
    case 'rect':
      return 'Arrastra para crear un ambiente rectangular';
    case 'door':
      return 'Clic sobre un muro para colocar una puerta';
    case 'window':
      return 'Clic sobre un muro para colocar una ventana';
    case 'dock':
      return 'Clic sobre un muro para colocar un portón de andén (3 × 3.6 m)';
    case 'pan':
      return 'Arrastra para desplazar el plano · Rueda para zoom';
    default:
      return 'Arrastra muebles y ambientes · Doble clic en una arista: nuevo vértice · Alt+clic en vértice: borrar · R: girar · Supr: eliminar';
  }
}

/** Orden de dibujo: zonas y alfombras debajo, letreros colgantes encima. */
const layer = (f: Furniture) => (f.type === 'zona' ? 0 : f.type === 'alfombra' ? 1 : f.type === 'letrero' ? 3 : 2);
const OWN_LABEL = new Set(['alfombra', 'zona', 'letrero', 'letrero_pie', 'rack', 'malla', 'bascula']);

const pts = (p: Vec2[]) => p.map((q) => `${q.x},${q.y}`).join(' ');
const seg = (a: Vec2, b: Vec2) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

function pointInRoom(p: Vec2, r: Room) {
  let inside = false;
  const P = r.points;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if (P[i].y > p.y !== P[j].y > p.y && p.x < ((P[j].x - P[i].x) * (p.y - P[i].y)) / (P[j].y - P[i].y) + P[i].x) inside = !inside;
  }
  return inside;
}

function DimLabel({ a, b, k, offset = 0 }: { a: Vec2; b: Vec2; k: number; offset?: number }) {
  const L = dist(a, b);
  if (L < 0.05) return null;
  const m = v((a.x + b.x) / 2, (a.y + b.y) / 2);
  const d = norm(sub(b, a));
  const n = v(-d.y, d.x);
  const p = add(m, mul(n, offset));
  let ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${ang})`} pointerEvents="none">
      <rect x={-24 * k} y={-8 * k} width={48 * k} height={16 * k} rx={4 * k} fill="var(--panel)" stroke="var(--accent)" strokeWidth={k} />
      <text y={4 * k} fontSize={11 * k} textAnchor="middle" fill="var(--ink)">
        {fmt(L)} m
      </text>
    </g>
  );
}

function RoomHandles({ room, k }: { room: Room; k: number }) {
  const n = room.points.length;
  const ccw = signedArea(room.points) > 0;
  return (
    <g>
      <polygon points={pts(room.points)} fill="none" stroke="var(--accent)" strokeWidth={k * 2} pointerEvents="none" />
      {room.points.map((a, i) => {
        const b = room.points[(i + 1) % n];
        const out = mul(inwardNormal(norm(sub(b, a)), ccw), -1);
        const m = add(v((a.x + b.x) / 2, (a.y + b.y) / 2), mul(out, 18 * k));
        const L = dist(a, b);
        let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        if (ang > 90 || ang < -90) ang += 180;
        return (
          <g key={`e${i}`}>
            <line data-kind="edge" data-id={room.id} data-index={i} {...seg(a, b)} stroke="transparent" strokeWidth={14 * k} className="hit edge" />
            <g transform={`translate(${m.x} ${m.y}) rotate(${ang})`} pointerEvents="none">
              <rect x={-24 * k} y={-8 * k} width={48 * k} height={16 * k} rx={4 * k} fill="var(--panel)" stroke="var(--accent)" strokeWidth={k} />
              <text y={4 * k} fontSize={11 * k} textAnchor="middle" fill="var(--ink)">
                {fmt(L)} m
              </text>
            </g>
          </g>
        );
      })}
      {room.points.map((p, i) => (
        <circle key={`v${i}`} data-kind="vertex" data-id={room.id} data-index={i} cx={p.x} cy={p.y} r={6 * k} fill="var(--panel)" stroke="var(--accent)" strokeWidth={k * 2} className="hit grab" />
      ))}
    </g>
  );
}

function FurnitureItem({ f, k, selected, hit }: { f: Furniture; k: number; selected: boolean; hit: boolean }) {
  const showLabel = f.showName || (f.w / k > 46 && f.d / k > 22 && !OWN_LABEL.has(f.type));
  return (
    <g transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} data-kind="furniture" data-id={f.id} className={hit ? 'hit grab' : ''}>
      <FurnitureSymbol f={f} k={k} />
      {selected && <rect x={-f.w / 2 - 3 * k} y={-f.d / 2 - 3 * k} width={f.w + 6 * k} height={f.d + 6 * k} fill="none" stroke="var(--accent)" strokeWidth={k * 2} strokeDasharray={`${5 * k} ${3 * k}`} rx={3 * k} />}
      {showLabel && (
        <text y={3.5 * k} fontSize={f.showName ? 10 * k : Math.min(10 * k, f.d * 0.4)} textAnchor="middle" className="furn-label" pointerEvents="none" transform={`rotate(${-f.rotation})`}>
          {f.name}
        </text>
      )}
    </g>
  );
}
