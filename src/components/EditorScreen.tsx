import { useState } from 'react';
import { useCurrentLevel, useStore } from '../store';
import Editor2D from './Editor2D';
import PropertiesPanel from './PropertiesPanel';
import { ADS_CATEGORY, FENCES_CATEGORY, CATALOG, CATEGORIES, OPENING_PRESETS, WALL_MATERIALS, type CatalogItem } from '../catalog';
import { addFurniture, addLevel, copyLevel, needsImage, pickOpening, pickWallMaterial, requestCutout, setLevelCount } from '../actions';
import { downloadProject } from '../io';
import { ShareDialog } from './ShareDialog';
import { NamesDialog } from './NamesDialog';
import { SummaryDialog } from './SummaryDialog';
import { CutoutDialog } from './CutoutDialog';
import type { Tool } from '../types';

const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '➤', label: 'Seleccionar / mover', key: 'V' },
  { id: 'room', icon: '⬠', label: 'Ambiente irregular', key: 'P' },
  { id: 'rect', icon: '▭', label: 'Ambiente rectangular', key: 'B' },
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
  const [naming, setNaming] = useState(false);
  const [summary, setSummary] = useState(false);

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
        <button className="ghost" onClick={() => setNaming(true)} title="Tabla para nombrar racks y objetos y mostrar sus rótulos">🏷 <span className="hide-sm">Nombres</span></button>
        <button className="ghost" onClick={() => setSummary(true)} title="Ambientes, objetos y posiciones de pallet; se exporta a Excel o PDF">📊 <span className="hide-sm">Resumen</span></button>
        <button className="ghost hide-sm" onClick={() => downloadProject(project)} title="Exportar como archivo JSON">⤓ Exportar</button>
        <button className="secondary" onClick={saveNow} title="Guardar en este navegador y en la nube">💾 <span className="hide-sm">Guardar</span></button>
        <button className="secondary" onClick={() => { save(); setSharing(true); }} title="Guardar y obtener la liga para compartir">🔗 <span className="hide-sm">Compartir</span></button>
        <button className="primary" onClick={() => { if (autosave) save(); setScreen('viewer'); }}>
          🧊 <span>Vista 3D</span>
        </button>
      </header>

      <div className="editor-body">
        <aside className={`left-panel ${leftOpen ? 'open' : ''}`}>
          <section className="tools-bar">
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
          <WallsSection />
          <OpeningsSection onPick={() => setLeftOpen(false)} />
          <FencesSection onAdd={() => setLeftOpen(false)} />
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
      {summary && <SummaryDialog project={project} onClose={() => setSummary(false)} />}
      {naming && <NamesDialog onClose={() => setNaming(false)} />}
      {sharing && <ShareDialog project={project} onClose={() => setSharing(false)} />}
      <CutoutDialog />
      {(leftOpen || rightOpen) && <div className="scrim" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />}
    </div>
  );
}

/** Sección plegable del panel; recuerda si quedó abierta. */
function Fold({ id, title, extra, open: initial = false, className = '', children }: { id: string; title: string; extra?: React.ReactNode; open?: boolean; className?: string; children: React.ReactNode }) {
  const key = `rendercrz:pref:fold:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? initial : saved === '1';
    } catch {
      return initial;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(key, open ? '0' : '1');
    } catch {
      /* sin acceso */
    }
  };
  return (
    <section className={`fold ${open ? 'open' : ''} ${className}`}>
      <h3>
        <button type="button" className="fold-head" onClick={toggle} aria-expanded={open}>
          <span className="fold-arrow">▸</span>
          {title}
        </button>
        {open && extra}
      </h3>
      {open && children}
    </section>
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
    <Fold
      id="niveles"
      title="Niveles"
      open
      extra={
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
      }
    >
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
    </Fold>
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
        // el rótulo con profundidad pide primero su imagen
        if (needsImage(c)) requestCutout();
        else addFurniture(c);
        onAdd();
      }}
      title={needsImage(c) ? `${c.label}: adjunta una imagen, se le quita el fondo y queda como objeto con relieve` : `${c.label} — ${c.w}×${c.d} m. Clic para agregar o arrástralo al plano`}
    >
      <span className="ci-icon">{c.icon}</span>
      <span className="ci-label">{c.label}</span>
      <span className="ci-dim">{c.w}×{c.d}</span>
    </button>
  );
}

/** Tipos de pared: se aplican al ambiente seleccionado y a los ambientes que se dibujen después. */
function WallsSection() {
  const current = useStore((s) => s.wallMaterial);
  const level = useCurrentLevel();
  const selection = useStore((s) => s.selection);
  const room = selection?.kind === 'room' ? level?.rooms.find((r) => r.id === selection.id) : undefined;
  const active = room ? (room.wallMaterial ?? 'liso') : current;
  return (
    <Fold id="paredes" title="Tipos de pared">
      <div className="tool-grid">
        {WALL_MATERIALS.map((m) => (
          <button key={m.id} className={`tool ${active === m.id ? 'active' : ''}`} onClick={() => pickWallMaterial(m.id)} title={`Pared de ${m.label.toLowerCase()}`}>
            <span className="wall-swatch" style={{ background: m.color }}>
              {m.icon}
            </span>
            <span className="tool-label">{m.label}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        {room ? `Se aplica a «${room.name}».` : 'Selecciona un ambiente para cambiar sus paredes, o elige un tipo y dibuja: los ambientes nuevos salen con esa pared.'}
      </p>
    </Fold>
  );
}

/** Puertas, marcos, arcos y ventanas: se colocan sobre una pared o cerco y se ajustan a su grosor. */
function OpeningsSection({ onPick }: { onPick: () => void }) {
  const active = useStore((s) => s.openingPreset);
  const level = useCurrentLevel();
  const selection = useStore((s) => s.selection);
  const room = selection?.kind === 'room' ? level?.rooms.find((r) => r.id === selection.id && r.hasWalls) : undefined;
  return (
    <Fold id="puertas" title="Puertas y marcos">
      <div className="tool-grid">
        {OPENING_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`tool ${active === p.id ? 'active' : ''}`}
            onClick={() => {
              pickOpening(p.id);
              onPick();
            }}
            title={`${p.label} — ${p.width}×${p.height} m`}
          >
            <span className="tool-icon">{p.icon}</span>
            <span className="tool-label">{p.label}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        {room
          ? `Se coloca al centro de la pared más larga de «${room.name}»; después arrástrala a su lugar.`
          : 'Elige una y toca la pared o cerco donde va: queda centrada en su grosor y abre el paso. Con un ambiente seleccionado se coloca sola en su pared más larga.'}
      </p>
    </Fold>
  );
}

const CATALOG_ITEMS = CATALOG.map((c, i) => ({ ...c, key: i }));

/** Torres y cuadros LED para rótulos; la imagen se sube en las propiedades del anuncio. */
/** Cercos, barandales y barreras a medida: se estiran arrastrando sus asas o desde sus propiedades. */
function FencesSection({ onAdd }: { onAdd: () => void }) {
  return (
    <Fold id="cercos" title="Cercos, mallas y barandales" className="catalog">
      <div className="catalog-grid">
        {CATALOG_ITEMS.filter((c) => c.category === FENCES_CATEGORY).map((c) => (
          <CatalogButton key={c.key} c={c} onAdd={onAdd} />
        ))}
      </div>
      <p className="muted small">Agrégalo y estíralo a la medida con las asas; el color se cambia en sus propiedades. El techo de malla se sube o baja con su «Elevación».</p>
    </Fold>
  );
}

function AdsSection({ onAdd }: { onAdd: () => void }) {
  return (
    <Fold id="anuncios" title="Anuncios y rótulos" className="catalog">
      <div className="catalog-grid">
        {CATALOG_ITEMS.filter((c) => c.category === ADS_CATEGORY).map((c) => (
          <CatalogButton key={c.key} c={c} onAdd={onAdd} />
        ))}
      </div>
      <p className="muted small">
        Agrega un anuncio y, en sus propiedades, sube la imagen que rellena el letrero. El <b>rótulo con profundidad</b> te pide la imagen al elegirlo, le quita el fondo y la deja como objeto con relieve.
      </p>
    </Fold>
  );
}

function CatalogSection({ onAdd }: { onAdd: () => void }) {
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [q, setQ] = useState('');
  const items = CATALOG_ITEMS.filter((c) => (q ? c.label.toLowerCase().includes(q.toLowerCase()) : c.category === cat));
  return (
    <Fold id="objetos" title="Objetos de almacén" className="catalog" open>
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
    </Fold>
  );
}
