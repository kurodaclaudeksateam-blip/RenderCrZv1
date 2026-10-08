import { CATALOG, WALL_MATERIALS } from '../catalog';
import { area, cellGrid, perimeter } from '../geometry';
import type { Furniture, Project } from '../types';

const LABELS = new Map(CATALOG.map((c) => [c.type, c.label]));
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Posiciones de pallet de un rack (módulos × filas × niveles + piso). */
function positions(f: Furniture) {
  if (f.type === 'rack_custom') {
    const g = cellGrid(f);
    return g.cols * g.layers;
  }
  if (f.type !== 'rack') return 0;
  const bays = Math.max(1, Math.round(f.w / 2.7));
  const slots = Math.max(1, Math.floor((f.w / bays - 0.08) / 1.25));
  return bays * (f.d > 1.8 ? 2 : 1) * slots * (Math.max(1, Math.round(f.shelves ?? 4)) + 1);
}

/** Tablas del resumen: ambientes y objetos de cada nivel. */
function summarize(project: Project) {
  return project.levels.map((l) => {
    const counts = new Map<string, { n: number; pos: number }>();
    for (const f of l.furniture) {
      const key = LABELS.get(f.type) ?? f.type;
      const c = counts.get(key) ?? { n: 0, pos: 0 };
      counts.set(key, { n: c.n + 1, pos: c.pos + positions(f) });
    }
    return {
      name: l.name,
      height: l.height,
      rooms: l.rooms.map((r) => ({
        name: r.name,
        area: round(area(r.points)),
        perimeter: round(perimeter(r.points)),
        wall: r.hasWalls ? (WALL_MATERIALS.find((m) => m.id === (r.wallMaterial ?? 'liso'))?.label ?? '') : 'Sin paredes',
      })),
      objects: [...counts].map(([label, c]) => ({ label, ...c })).sort((a, b) => b.n - a.n),
      zones: l.furniture.filter((f) => f.type === 'zona').map((f) => ({ name: f.label || f.name, area: round(f.w * f.d) })),
    };
  });
}

type Summary = ReturnType<typeof summarize>;

function toCsv(project: Project, data: Summary) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [['Proyecto', project.name], []];
  for (const l of data) {
    rows.push(['Nivel', l.name, 'Altura (m)', l.height], ['Ambiente', 'Área (m²)', 'Perímetro (m)', 'Paredes']);
    l.rooms.forEach((r) => rows.push([r.name, r.area, r.perimeter, r.wall]));
    rows.push([], ['Objeto', 'Cantidad', 'Posiciones de pallet']);
    l.objects.forEach((o) => rows.push([o.label, o.n, o.pos || '']));
    if (l.zones.length) {
      rows.push([], ['Zona', 'Área (m²)']);
      l.zones.forEach((z) => rows.push([z.name, z.area]));
    }
    rows.push([]);
  }
  // BOM para que Excel lea los acentos
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}

function Tables({ data }: { data: Summary }) {
  return (
    <>
      {data.map((l, i) => (
        <section key={i} className="summary-level">
          <h3>
            {l.name} · {l.height} m de altura
          </h3>
          <table>
            <thead>
              <tr>
                <th>Ambiente</th>
                <th>Área (m²)</th>
                <th>Perímetro (m)</th>
                <th>Paredes</th>
              </tr>
            </thead>
            <tbody>
              {l.rooms.map((r, k) => (
                <tr key={k}>
                  <td>{r.name}</td>
                  <td>{r.area}</td>
                  <td>{r.perimeter}</td>
                  <td>{r.wall}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{round(l.rooms.reduce((n, r) => n + r.area, 0))}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Objeto</th>
                <th>Cantidad</th>
                <th>Posiciones de pallet</th>
              </tr>
            </thead>
            <tbody>
              {l.objects.map((o) => (
                <tr key={o.label}>
                  <td>{o.label}</td>
                  <td>{o.n}</td>
                  <td>{o.pos || ''}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{l.objects.reduce((n, o) => n + o.n, 0)}</td>
                <td>{l.objects.reduce((n, o) => n + o.pos, 0)}</td>
              </tr>
            </tbody>
          </table>
          {l.zones.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Área (m²)</th>
                </tr>
              </thead>
              <tbody>
                {l.zones.map((z, k) => (
                  <tr key={k}>
                    <td>{z.name}</td>
                    <td>{z.area}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}

/** Resumen del almacén: ambientes, objetos, posiciones de pallet y zonas, con salida a Excel e impresión. */
export function SummaryDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const data = summarize(project);

  const downloadCsv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(project, data)], { type: 'text/csv;charset=utf-8' }));
    a.download = `${project.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim() || 'proyecto'}-resumen.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // hoja para imprimir o guardar como PDF: el plano del nivel abierto (con sus cotas) y las tablas
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const css = [...document.styleSheets]
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');
    const plan = document.querySelector('.canvas-area svg')?.outerHTML ?? '';
    const tables = document.querySelector('.summary-body')?.innerHTML ?? '';
    win.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(project.name)} · Resumen</title><style>${css}
      html,body{height:auto;overflow:visible;background:#fff;color:#111;margin:0;padding:18px;font-family:system-ui,sans-serif}
      h1{font-size:20px;margin:0 0 12px}.plan svg{width:100%;height:520px;border:1px solid #ccc;background:#f8fafc}
      .summary-level h3{color:#111;margin:18px 0 6px}.summary-level table{color:#111;border-color:#bbb}.summary-level th{background:#eee;color:#111}
      .summary-level td,.summary-level th{border-color:#ccc}@media print{.plan{break-after:page}}</style></head>
      <body><h1>${esc(project.name)}</h1><div class="plan">${plan}</div><div class="summary-body">${tables}</div></body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>📊 Resumen · {project.name}</h2>
        <div className="summary-body">
          <Tables data={data} />
        </div>
        <div className="row end wrap">
          <button className="secondary" onClick={downloadCsv} title="Archivo CSV que abre Excel">
            ⤓ Descargar para Excel
          </button>
          <button className="secondary" onClick={print} title="Plano del nivel abierto y tablas; desde ahí se guarda como PDF">
            🖨 Imprimir / PDF
          </button>
          <button className="primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
