import { useState } from 'react';
import { useCurrentLevel, useStore } from '../store';
import Editor2D from './Editor2D';
import PropertiesPanel from './PropertiesPanel';
import { ADS_CATEGORY, CATALOG, CATEGORIES, type CatalogItem } from '../catalog';
import { addFurniture, addLevel, copyLevel, setLevelCount } from '../actions';
import { downloadProject } from '../io';
import { ShareDialog } from './ShareDialog';
import type { Tool } from '../types';

const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '➤', label: 'Seleccionar / mover', key: 'V' },
  { id: 'room', icon: '⬠', label: 'Ambiente irregular', key: 'P' },
  { id: 'rect', icon: '▭', label: 'Ambiente rectangular', key: 'B' },
  { id: 'door', icon: '🚪', label: 'Puerta', key: 'D' },
  { id: 'dock', icon: '🚛', label: 'Portón / andén', key: 'G' },
  { id: 'window', icon: '🪟', label: 'Ventana', key: 'W' },
  { id: 'pan', icon: '✋', label: 'Desplazar', key: 'H' },
];

export default function EditorScreen() {
  const project = useStore((s) => s.project)!;
  const tool = useStore((s) => s.tool);
  const dirty = useStore((s) => s.dirty);
  const autosave = useStore((s) => s.autosave);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const selection = useStore((s) => s.selection);
  const { setTool, undo, redo, save, setScreen, closeProject, mutate, notify } = useStore.getState();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const saveNow = () => {
    if (save()) notify(`💾 "${project.name}" guardado en la nube`);
  };

  const exit = () => {
    if (dirty && !autosave && !confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) return;
    if (dirty && autosave) save();
    closeProject();
  };

  return (
    <div className="editor-screen">
      <header className="topbar">
        <button className="ghost" onClick={exit} title="Volver a mis proyectos">
          ← <span className="hide-sm">Proyectos</span>
        </button>
        <div className="brand-mini hide-sm">RenderCrZ</div>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => mutate((p) => void (p.name = e.target.value), false)}
          aria-label="Nombre del proyecto"
        />
        <span className={`save-state ${dirty ? 'dirty' : ''}`}>{dirty ? (autosave ? 'Guardando…' : 'Sin guardar') : 'Guardado ✓'}</span>
        <div className="spacer" />
        <button className="icon" onClick={undo} disabled={!past} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="icon" onClick={redo} disabled={!future} title="Rehacer (Ctrl+Y)">↷</button>
        <button className="ghost hide-sm" onClick={() => downloadProject(project)} title="Exportar como archivo JSON">⤓ Exportar</button>
        <button className="secondary" onClick={saveNow} title="Guardar en este navegador y en la nube">💾 <span className="hide-sm">Guardar</span></button>
        <button className="secondary" onClick={() => { save(); setSharing(true); }} title="Guardar y obtener la liga para compartir">🔗 <span className="hide-sm">Compartir</span></button>
        <button className="primary" onClick={() => { if (autosave) save(); setScreen('viewer'); }}>
          🧊 <span>Vista 3D</span>
        </button>
      </header>

      <div className="editor-body">
        <aside className={`left-panel ${leftOpen ? 'open' : ''}`}>
          <section>
            <h3>Herramientas</h3>
            <div className="tool-grid">
              {TOOLS.map((t) => (
                <button key={t.id} className={`tool ${tool === t.id ? 'active' : ''}`} onClick={() => { setTool(t.id); setLeftOpen(false); }} title={`${t.label} (${t.key})`}>
                  <span className="tool-icon">{t.icon}</span>
                  <span className="tool-label">{t.label}</span>
                </button>
              ))}
            </div>
          </section>
          <LevelsSection />
          <AdsSection onAdd={() => setLeftOpen(false)} />
          <CatalogSection onAdd={() => setLeftOpen(false)} />
        </aside>

        <main className="canvas-area">
          <Editor2D />
          <button className="fab fab-left" onClick={() => setLeftOpen((o) => !o)}>☰ Herramientas</button>
          <button className={`fab fab-right ${selection ? 'has-sel' : ''}`} onClick={() => setRightOpen((o) => !o)}>⚙ Propiedades</button>
        </main>

        <aside className={`right-panel ${rightOpen ? 'open' : ''}`}>
          <PropertiesPanel />
        </aside>
      </div>
      {sharing && <ShareDialog project={project} onClose={() => setSharing(false)} />}
      {(leftOpen || rightOpen) && <div className="scrim" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />}
    </div>
  );
}

function LevelsSection() {
  const project = useStore((s) => s.project)!;
  const level = useCurrentLevel()!;
  const { setLevel, mutate, notify } = useStore.getState();
  const [copyTo, setCopyTo] = useState('new');
  const [copyFull, setCopyFull] = useState(true);
  const badge = (i: number) => (i === 0 ? 'PB' : `N${i + 1}`);
  // si el destino elegido ya no existe o es el nivel actual, se copia a uno nuevo
  const target = project.levels.find((l) => l.id === copyTo && l.id !== level.id);

  const copy = () => {
    if (target && (target.rooms.length || target.furniture.length) && !confirm(`"${target.name}" ya tiene contenido y se reemplazará por la copia de "${level.name}". ¿Continuar?`)) return;
    copyLevel(level.id, target?.id ?? null, copyFull);
    notify(`⧉ "${level.name}" copiado a ${target ? `"${target.name}"` : 'un nivel nuevo'}`);
  };
  const applyCount = (value: string) => {
    const n = Math.max(1, Math.min(20, Math.round(Number(value) || 1)));
    if (n === project.levels.length) return;
    const lost = project.levels.slice(n).filter((l) => l.rooms.length || l.furniture.length);
    if (lost.length && !confirm(`Se eliminarán ${project.levels.length - n} nivel(es) con contenido. ¿Continuar?`)) return;
    setLevelCount(n);
  };

  const removeLevel = (id: string) => {
    if (project.levels.length <= 1) return;
    const l = project.levels.find((x) => x.id === id)!;
    if ((l.rooms.length || l.furniture.length) && !confirm(`¿Eliminar "${l.name}" con todo su contenido?`)) return;
    const idx = project.levels.findIndex((x) => x.id === id);
    mutate((p) => void (p.levels = p.levels.filter((x) => x.id !== id)));
    const next = project.levels[idx === 0 ? 1 : idx - 1];
    setLevel(next.id);
  };

  return (
    <section>
      <h3>
        Niveles
        <label className="inline-field" title="Cantidad de niveles del proyecto">
          <input
            key={project.levels.length}
            type="number"
            min={1}
            max={20}
            defaultValue={project.levels.length}
            onBlur={(e) => applyCount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      </h3>
      <ul className="levels">
        {[...project.levels].reverse().map((l) => {
          const idx = project.levels.indexOf(l);
          return (
            <li key={l.id} className={l.id === level.id ? 'active' : ''} onClick={() => setLevel(l.id)}>
              <span className="level-badge">{idx === 0 ? 'PB' : `N${idx + 1}`}</span>
              <span className="level-name">{l.name}</span>
              <span className="muted small">{l.rooms.length} amb.</span>
              {project.levels.length > 1 && (
                <button className="icon tiny" title="Eliminar nivel" onClick={(e) => { e.stopPropagation(); removeLevel(l.id); }}>✕</button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="row">
        <button className="secondary small" onClick={() => addLevel()}>＋ Nivel vacío</button>
      </div>
      <div className="level-copy">
        <label className="field">
          <span>Copiar “{level.name}” a</span>
          <select value={target ? target.id : 'new'} onChange={(e) => setCopyTo(e.target.value)}>
            <option value="new">＋ Un nivel nuevo</option>
            {project.levels.map((l, i) =>
              l.id === level.id ? null : (
                <option key={l.id} value={l.id}>
                  {badge(i)} · {l.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="inline check">
          <input type="checkbox" checked={copyFull} onChange={(e) => setCopyFull(e.target.checked)} /> Con puertas, ventanas y objetos
        </label>
        <button className="secondary small" onClick={copy} title="Copia el nivel seleccionado al nivel elegido">
          ⧉ Copiar nivel
        </button>
      </div>
    </section>
  );
}

function CatalogButton({ c, onAdd }: { c: CatalogItem & { key: number }; onAdd: () => void }) {
  return (
    <button
      className="catalog-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-furniture', String(c.key));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => {
        addFurniture(c);
        onAdd();
      }}
      title={`${c.label} — ${c.w}×${c.d} m. Clic para agregar o arrástralo al plano`}
    >
      <span className="ci-icon">{c.icon}</span>
      <span className="ci-label">{c.label}</span>
      <span className="ci-dim">{c.w}×{c.d}</span>
    </button>
  );
}

const CATALOG_ITEMS = CATALOG.map((c, i) => ({ ...c, key: i }));

/** Torres y cuadros LED para rótulos; la imagen se sube en las propiedades del anuncio. */
function AdsSection({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="catalog">
      <h3>Anuncios y rótulos</h3>
      <div className="catalog-grid">
        {CATALOG_ITEMS.filter((c) => c.category === ADS_CATEGORY).map((c) => (
          <CatalogButton key={c.key} c={c} onAdd={onAdd} />
        ))}
      </div>
      <p className="muted small">Agrega un anuncio y, en sus propiedades, sube la imagen que rellena el letrero.</p>
    </section>
  );
}

function CatalogSection({ onAdd }: { onAdd: () => void }) {
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [q, setQ] = useState('');
  const items = CATALOG_ITEMS.filter((c) => (q ? c.label.toLowerCase().includes(q.toLowerCase()) : c.category === cat));
  return (
    <section className="catalog">
      <h3>Objetos de almacén</h3>
      <input className="search" placeholder="Buscar rack, letrero, zona…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${c === cat ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="catalog-grid">
        {items.map((c) => (
          <CatalogButton key={c.key} c={c} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
