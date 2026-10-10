import type { Furniture } from '../types';
import { cellGrid, cellIndex } from '../geometry';
import { parsePipe, pipeStandLayout } from '../catalog';

/** Símbolo de planta de un mueble, en coordenadas locales centradas (metros). */
export function FurnitureSymbol({ f, k }: { f: Furniture; k: number }) {
  const { w, d, color } = f;
  const x0 = -w / 2;
  const y0 = -d / 2;
  const sw = k * 1.2;
  const line = 'var(--furn-line)';
  const base = (
    <rect x={x0} y={y0} width={w} height={d} rx={Math.min(w, d) * 0.06} fill={color} fillOpacity={0.9} stroke={line} strokeWidth={sw} />
  );

  switch (f.type) {
    case 'rack': {
      const bays = Math.max(1, Math.round(w / 2.7));
      const bw = w / bays;
      const rows = d > 1.8 ? 2 : 1;
      const rd = d / rows;
      const post = Math.min(0.1, bw * 0.1);
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={0.18} stroke={line} strokeWidth={sw} />
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: bays }, (_, b) => {
              const px = x0 + b * bw;
              const py = y0 + r * rd;
              const slots = Math.max(1, Math.floor((bw - post) / 1.25));
              const sw2 = (bw - post * 2) / slots;
              return (
                <g key={`${r}-${b}`}>
                  {!f.empty && Array.from({ length: slots }, (_, s) => (
                    <rect key={s} x={px + post + s * sw2 + 0.05} y={py + 0.08} width={sw2 - 0.1} height={rd - 0.16} fill="#c8a26b" fillOpacity={0.55} stroke={line} strokeWidth={sw * 0.6} />
                  ))}
                </g>
              );
            }),
          )}
          {Array.from({ length: bays + 1 }, (_, b) => {
            const px = Math.min(-x0 - post, x0 + b * bw - post / 2);
            const xx = Math.max(x0, px);
            return Array.from({ length: rows + 1 }, (_, r) => {
              const py = Math.max(y0, Math.min(-y0 - post, y0 + r * rd - post / 2));
              return <rect key={`p${b}-${r}`} x={xx} y={py} width={post} height={post} fill="#1e3a8a" />;
            });
          })}
          {Array.from({ length: rows + 1 }, (_, r) => (
            <line key={`b${r}`} x1={x0} x2={-x0} y1={y0 + r * rd} y2={y0 + r * rd} stroke={color} strokeWidth={sw * 2.5} />
          ))}
        </g>
      );
    }
    case 'rack_custom':
    case 'tarima_custom': {
      // vista en planta: cada posición muestra la caja más alta que tenga
      const g = cellGrid(f);
      const cw = w / g.cols;
      const ch = d / g.rows;
      const isRack = f.type === 'rack_custom';
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={isRack ? 0.18 : 0.75} stroke={line} strokeWidth={sw} />
          {Array.from({ length: g.rows }, (_, r) =>
            Array.from({ length: g.cols }, (_, c) => {
              let top = '';
              for (let l = g.layers - 1; l >= 0 && !top; l--) top = f.cells?.[cellIndex(g, l, r, c)] || '';
              return <rect key={`${r}-${c}`} x={x0 + c * cw + 0.04} y={y0 + r * ch + 0.04} width={cw - 0.08} height={ch - 0.08} fill={top || 'none'} stroke={line} strokeWidth={sw * 0.6} strokeDasharray={top ? undefined : `${2 * k} ${2 * k}`} />;
            }),
          )}
          {isRack && [y0, -y0].map((y) => <line key={y} x1={x0} x2={-x0} y1={y} y2={y} stroke={color} strokeWidth={sw * 2.5} />)}
        </g>
      );
    }
    case 'rampa_curva': {
      const ri = 0.45;
      return (
        <g>
          <path
            d={`M ${-x0} ${-y0} A ${w} ${d} 0 0 0 ${x0} ${y0} L ${x0} ${-y0 - d * ri} A ${w * ri} ${d * ri} 0 0 1 ${x0 + w * ri} ${-y0} Z`}
            fill={color}
            fillOpacity={0.75}
            stroke={line}
            strokeWidth={sw}
          />
          <path d={`M ${x0 + w * 0.72} ${-y0 - d * 0.06} A ${w * 0.72} ${d * 0.72} 0 0 0 ${x0 + w * 0.06} ${-y0 - d * 0.72}`} fill="none" stroke={line} strokeWidth={sw * 1.4} strokeDasharray={`${4 * k} ${3 * k}`} />
          <path d={`M ${x0 + w * 0.06 - 0.22} ${-y0 - d * 0.72 + 0.3} L ${x0 + w * 0.06} ${-y0 - d * 0.72} L ${x0 + w * 0.06 + 0.22} ${-y0 - d * 0.72 + 0.3}`} fill="none" stroke={line} strokeWidth={sw * 1.4} />
        </g>
      );
    }
    case 'anuncio_torre':
    case 'anuncio_cuadro':
    case 'anuncio_poste':
    case 'anuncio_relieve':
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={Math.max(d, 0.1)} fill={color} stroke={line} strokeWidth={sw} />
          {[y0, y0 + Math.max(d, 0.1)].map((y) => (
            <line key={y} x1={x0 + 0.05} x2={-x0 - 0.05} y1={y} y2={y} stroke="#38bdf8" strokeWidth={sw * 2.5} />
          ))}
          {f.type === 'anuncio_poste' && <circle cx={0} cy={y0 + Math.max(d, 0.1) / 2} r={Math.max(0.12, w * 0.05)} fill={line} />}
        </g>
      );
    case 'mueble_tapa':
      return (
        <g>
          {base}
          <rect x={x0 + w * 0.06} y={y0 + d * 0.1} width={w * 0.88} height={d * 0.8} rx={Math.min(w, d) * 0.05} fill="none" stroke={line} strokeWidth={sw} opacity={0.7} />
          <line x1={-w * 0.1} x2={w * 0.1} y1={-y0 - d * 0.04} y2={-y0 - d * 0.04} stroke={line} strokeWidth={sw * 2} />
        </g>
      );
    case 'barandal':
    case 'barrera':
    case 'cerco':
    case 'cerco_malla': {
      const posts = Math.max(1, Math.round(w / 2.4));
      const t = Math.max(d, 0.08);
      return (
        <g>
          <rect x={x0} y={-t / 2} width={w} height={t} fill={color} stroke={line} strokeWidth={sw} strokeDasharray={f.type === 'cerco_malla' ? `${3 * k} ${2 * k}` : undefined} />
          {Array.from({ length: posts + 1 }, (_, i) => (
            <rect key={i} x={x0 + (i * w) / posts - 0.06} y={-0.06} width={0.12} height={0.12} fill={line} />
          ))}
        </g>
      );
    }
    case 'estanteria_metal':
      return (
        <g>
          {base}
          <path d={`M ${x0} ${y0} L ${-x0} ${-y0} M ${-x0} ${y0} L ${x0} ${-y0}`} stroke={line} strokeWidth={sw * 0.8} opacity={0.5} />
          {[x0, -x0 - 0.05].flatMap((x) => [y0, -y0 - 0.05].map((y) => <rect key={`${x}${y}`} x={x} y={y} width={0.05} height={0.05} fill={line} />))}
        </g>
      );
    case 'rack_tubos_v': {
      const bays = Math.max(1, Math.round(f.shelves ?? 4));
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={0.25} stroke={line} strokeWidth={sw * 1.6} />
          {Array.from({ length: bays }, (_, i) => (
            <g key={i}>
              {i > 0 && <line x1={x0 + (w * i) / bays} x2={x0 + (w * i) / bays} y1={y0} y2={-y0} stroke={line} strokeWidth={sw} />}
              {f.cells?.[i] && <circle cx={x0 + (w * (i + 0.5)) / bays} cy={0} r={Math.min(w / bays, d) * 0.28} fill="none" stroke={line} strokeWidth={sw} />}
            </g>
          ))}
        </g>
      );
    }
    case 'base_tubos': {
      // cada pico muestra su tubería: disco lleno si va en tramos, anillo si va en rollo
      const { R, slot, pegs } = pipeStandLayout(f);
      return (
        <g>
          <circle r={R} fill={color} fillOpacity={0.3} stroke={line} strokeWidth={sw * 1.6} />
          {pegs.map((p, i) => {
            const pipe = parsePipe(f.cells?.[i]);
            return (
              <g key={i}>
                {pipe &&
                  (pipe.coil ? (
                    <circle cx={p.x} cy={p.y} r={slot * 0.7} fill="none" stroke={pipe.material.color} strokeWidth={slot * 0.4} />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={slot * 0.62} fill={pipe.material.color} stroke={line} strokeWidth={sw * 0.6} />
                  ))}
                <circle cx={p.x} cy={p.y} r={Math.max(0.012, slot * 0.12)} fill={line} />
              </g>
            );
          })}
        </g>
      );
    }
    case 'rack_tubos':
    case 'cantilever': {
      const cols = Math.max(2, Math.round(w / 1.2) + 1);
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={0.12} stroke={line} strokeWidth={sw} strokeDasharray={`${4 * k} ${3 * k}`} />
          <line x1={x0} x2={-x0} y1={0} y2={0} stroke={color} strokeWidth={0.12} />
          {Array.from({ length: cols }, (_, i) => {
            const x = x0 + 0.08 + (i * (w - 0.16)) / (cols - 1);
            return <line key={i} x1={x} x2={x} y1={y0} y2={-y0} stroke={line} strokeWidth={sw * 2} />;
          })}
        </g>
      );
    }
    case 'pallet':
      return (
        <g>
          {base}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={i} x1={x0 + (w * (i + 0.5)) / 5} x2={x0 + (w * (i + 0.5)) / 5} y1={y0} y2={-y0} stroke={line} strokeWidth={sw} opacity={0.6} />
          ))}
        </g>
      );
    case 'pallet_carga':
    case 'caja_carton':
      return (
        <g>
          {base}
          <line x1={x0} x2={-x0} y1={0} y2={0} stroke="#a16207" strokeWidth={Math.min(0.06, d * 0.12)} opacity={0.8} />
          {f.type === 'pallet_carga' && <path d={`M ${x0} ${y0} L ${-x0} ${-y0} M ${-x0} ${y0} L ${x0} ${-y0}`} stroke={line} strokeWidth={sw * 0.7} opacity={0.4} />}
        </g>
      );
    case 'contenedor':
      return (
        <g>
          {base}
          <rect x={x0 + 0.04} y={y0 + 0.04} width={w - 0.08} height={d - 0.08} rx={0.03} fill="none" stroke={line} strokeWidth={sw} opacity={0.6} />
        </g>
      );
    case 'montacargas': {
      const body = Math.min(d * 0.66, 2.2);
      const fy = y0 + body;
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={body} rx={0.12} fill={color} stroke={line} strokeWidth={sw} />
          <rect x={x0 + 0.15} y={y0 + body * 0.35} width={w - 0.3} height={body * 0.4} fill="none" stroke={line} strokeWidth={sw} />
          <rect x={x0 + 0.05} y={fy} width={w - 0.1} height={0.1} fill="#374151" />
          <rect x={-0.35} y={fy + 0.1} width={0.12} height={-y0 - fy - 0.1} fill="#6b7280" />
          <rect x={0.23} y={fy + 0.1} width={0.12} height={-y0 - fy - 0.1} fill="#6b7280" />
        </g>
      );
    }
    case 'transpaleta': {
      const body = 0.35;
      return (
        <g>
          <circle cx={0} cy={y0 + 0.12} r={0.12} fill="none" stroke={line} strokeWidth={sw * 1.5} />
          <rect x={x0} y={y0 + 0.2} width={w} height={body} rx={0.05} fill={color} stroke={line} strokeWidth={sw} />
          <rect x={x0} y={y0 + 0.2 + body} width={0.16} height={d - 0.2 - body} fill="#6b7280" stroke={line} strokeWidth={sw * 0.6} />
          <rect x={-x0 - 0.16} y={y0 + 0.2 + body} width={0.16} height={d - 0.2 - body} fill="#6b7280" stroke={line} strokeWidth={sw * 0.6} />
        </g>
      );
    }
    case 'banda': {
      const n = Math.max(4, Math.round(w / 0.25));
      return (
        <g>
          {base}
          {Array.from({ length: n - 1 }, (_, i) => (
            <line key={i} x1={x0 + (w * (i + 1)) / n} x2={x0 + (w * (i + 1)) / n} y1={y0 + 0.06} y2={-y0 - 0.06} stroke="#9ca3af" strokeWidth={sw} />
          ))}
          <path d={`M ${-w * 0.15} 0 H ${w * 0.15} M ${w * 0.08} ${-d * 0.18} L ${w * 0.15} 0 L ${w * 0.08} ${d * 0.18}`} stroke="#fbbf24" strokeWidth={sw * 2} fill="none" />
        </g>
      );
    }
    case 'bascula':
      return (
        <g>
          {base}
          <rect x={x0 + 0.1} y={y0 + 0.1} width={w - 0.2} height={d - 0.2} fill="none" stroke={line} strokeWidth={sw} opacity={0.5} />
          <text y={0.08} fontSize={Math.min(w, d) * 0.22} textAnchor="middle" fill="#e2e8f0" pointerEvents="none">kg</text>
        </g>
      );
    case 'malla':
      return (
        <rect x={x0} y={y0} width={w} height={Math.max(d, 0.05)} fill={color} stroke={line} strokeWidth={sw} strokeDasharray={`${3 * k} ${2 * k}`} />
      );
    case 'letrero':
    case 'letrero_pie':
      return (
        <g>
          <rect x={x0} y={y0 - 0.03} width={w} height={Math.max(d, 0.08) + 0.06} rx={0.02} fill={color} stroke={line} strokeWidth={sw} strokeDasharray={f.type === 'letrero' ? `${3 * k} ${2 * k}` : undefined} />
          <text y={y0 - 0.12} fontSize={Math.max(0.22, Math.min(0.5, w / Math.max(4, (f.label ?? '').length) * 1.3))} textAnchor="middle" fill={color} fontWeight={800} pointerEvents="none" stroke="#fff" strokeWidth={0.04} paintOrder="stroke">
            {f.label || f.name}
          </text>
        </g>
      );
    case 'zona': {
      const fs = Math.min(d * 0.28, (w / Math.max(4, (f.label ?? '').length)) * 1.4, 1.4);
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={Math.min(0.1, Math.min(w, d) * 0.04)} strokeDasharray="0.4 0.25" />
          <text y={fs * 0.35} fontSize={fs} textAnchor="middle" fill={color} fontWeight={800} opacity={0.9} pointerEvents="none" letterSpacing={fs * 0.05}>
            {f.label || f.name}
          </text>
        </g>
      );
    }
    case 'extintor':
    case 'bolardo':
      return <circle r={Math.min(w, d) / 2} fill={color} stroke={line} strokeWidth={sw} />;
    case 'cono':
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill="#111827" opacity={0.8} />
          <circle r={Math.min(w, d) * 0.38} fill={color} stroke="#fff" strokeWidth={sw * 2} />
        </g>
      );
    case 'cama': {
      const pw = w > 1.2 ? (w - 0.3) / 2 : w - 0.2;
      return (
        <g>
          {base}
          <rect x={x0} y={y0} width={w} height={0.08} fill={line} opacity={0.6} />
          {w > 1.2 ? (
            <>
              <rect x={x0 + 0.1} y={y0 + 0.15} width={pw} height={0.35} rx={0.08} fill="#fff" stroke={line} strokeWidth={sw} />
              <rect x={x0 + 0.2 + pw} y={y0 + 0.15} width={pw} height={0.35} rx={0.08} fill="#fff" stroke={line} strokeWidth={sw} />
            </>
          ) : (
            <rect x={x0 + 0.1} y={y0 + 0.15} width={pw} height={0.35} rx={0.08} fill="#fff" stroke={line} strokeWidth={sw} />
          )}
          <path d={`M ${x0} ${y0 + 0.65} H ${-x0} M ${x0} ${y0 + 0.65} L ${x0 + w * 0.3} ${y0 + 0.85}`} stroke={line} strokeWidth={sw} fill="none" />
        </g>
      );
    }
    case 'sofa':
    case 'sillon': {
      const back = Math.min(0.22, d * 0.3);
      const arm = Math.min(0.18, w * 0.2);
      return (
        <g>
          {base}
          <rect x={x0} y={y0} width={w} height={back} fill={line} opacity={0.25} />
          <rect x={x0} y={y0} width={arm} height={d} fill={line} opacity={0.2} />
          <rect x={-x0 - arm} y={y0} width={arm} height={d} fill={line} opacity={0.2} />
          {f.type === 'sofa' && <line x1={0} x2={0} y1={y0 + back} y2={-y0} stroke={line} strokeWidth={sw} opacity={0.6} />}
        </g>
      );
    }
    case 'mesa_redonda':
    case 'planta':
      return (
        <g>
          <ellipse rx={w / 2} ry={d / 2} fill={color} fillOpacity={0.9} stroke={line} strokeWidth={sw} />
          {f.type === 'planta' && (
            <>
              <ellipse rx={w / 4} ry={d / 4} fill="none" stroke={line} strokeWidth={sw} opacity={0.6} />
              <path d={`M ${-w / 2} 0 H ${w / 2} M 0 ${-d / 2} V ${d / 2}`} stroke={line} strokeWidth={sw} opacity={0.4} />
            </>
          )}
        </g>
      );
    case 'inodoro':
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d * 0.28} rx={0.03} fill={color} stroke={line} strokeWidth={sw} />
          <ellipse cy={y0 + d * 0.62} rx={w / 2 * 0.9} ry={d * 0.34} fill={color} stroke={line} strokeWidth={sw} />
          <ellipse cy={y0 + d * 0.64} rx={w / 2 * 0.55} ry={d * 0.22} fill="none" stroke={line} strokeWidth={sw} />
        </g>
      );
    case 'lavamanos':
      return (
        <g>
          {base}
          <ellipse cy={d * 0.08} rx={w * 0.32} ry={d * 0.28} fill="none" stroke={line} strokeWidth={sw} />
          <circle cy={y0 + 0.07} r={0.025} fill={line} />
        </g>
      );
    case 'lavaplatos':
      return (
        <g>
          {base}
          <rect x={-w * 0.32} y={y0 + 0.1} width={w * 0.4} height={d - 0.2} rx={0.04} fill="none" stroke={line} strokeWidth={sw} />
          <circle cx={w * 0.25} cy={y0 + 0.12} r={0.03} fill={line} />
        </g>
      );
    case 'tina':
      return (
        <g>
          {base}
          <rect x={x0 + 0.08} y={y0 + 0.08} width={w - 0.16} height={d - 0.16} rx={Math.min(w, d) * 0.3} fill="none" stroke={line} strokeWidth={sw} />
          <circle cx={x0 + 0.25} cy={0} r={0.03} fill={line} />
        </g>
      );
    case 'ducha':
      return (
        <g>
          {base}
          <path d={`M ${x0} ${y0} L ${-x0} ${-y0} M ${-x0} ${y0} L ${x0} ${-y0}`} stroke={line} strokeWidth={sw} opacity={0.6} />
          <circle r={0.05} fill="none" stroke={line} strokeWidth={sw} />
        </g>
      );
    case 'cocina':
      return (
        <g>
          {base}
          {[-1, 1].flatMap((i) =>
            [-1, 1].map((j) => <circle key={`${i}${j}`} cx={(i * w) / 4} cy={(j * d) / 4} r={Math.min(w, d) * 0.16} fill="none" stroke={line} strokeWidth={sw} />),
          )}
        </g>
      );
    case 'escalera':
    case 'escalera_metal': {
      const steps = Math.max(3, Math.round(d / 0.28));
      const st = d / steps;
      return (
        <g>
          {base}
          {Array.from({ length: steps - 1 }, (_, i) => (
            <line key={i} x1={x0} x2={-x0} y1={y0 + st * (i + 1)} y2={y0 + st * (i + 1)} stroke={line} strokeWidth={sw} />
          ))}
          <path d={`M 0 ${-y0 - st / 2} V ${y0 + st} M ${-w * 0.15} ${y0 + st * 1.8} L 0 ${y0 + st} L ${w * 0.15} ${y0 + st * 1.8}`} stroke={line} strokeWidth={sw * 1.4} fill="none" />
        </g>
      );
    }
    case 'alfombra':
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={d} fill={color} fillOpacity={0.55} stroke={line} strokeWidth={sw} />
          <rect x={x0 + 0.08} y={y0 + 0.08} width={w - 0.16} height={d - 0.16} fill="none" stroke={line} strokeWidth={sw} strokeDasharray={`${4 * k} ${3 * k}`} opacity={0.6} />
        </g>
      );
    case 'ropero':
    case 'comoda':
    case 'estante':
      return (
        <g>
          {base}
          <line x1={x0} x2={-x0} y1={-y0 - 0.04} y2={-y0 - 0.04} stroke={line} strokeWidth={sw} />
          {f.type === 'ropero' && <line x1={0} x2={0} y1={y0} y2={-y0} stroke={line} strokeWidth={sw} />}
        </g>
      );
    case 'mesa':
    case 'mesa_centro':
    case 'escritorio':
      return (
        <g>
          {base}
          <rect x={x0 + 0.05} y={y0 + 0.05} width={w - 0.1} height={d - 0.1} rx={0.03} fill="none" stroke={line} strokeWidth={sw} opacity={0.4} />
        </g>
      );
    case 'columna':
      return <rect x={x0} y={y0} width={w} height={d} fill="var(--wall)" stroke={line} strokeWidth={sw} />;
    default:
      return (
        <g>
          {base}
          {/* indicador del frente */}
          <line x1={x0 + w * 0.2} x2={-x0 - w * 0.2} y1={-y0 - Math.min(0.06, d * 0.15)} y2={-y0 - Math.min(0.06, d * 0.15)} stroke={line} strokeWidth={sw * 1.5} />
        </g>
      );
  }
}
