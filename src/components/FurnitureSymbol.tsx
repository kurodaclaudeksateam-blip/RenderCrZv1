import type { Furniture } from '../types';

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
    case 'escalera': {
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
