import { useState } from 'react';
import { deleteProject, listProjects, loadProject, newProject, sampleProject, sampleWarehouse, saveProject, storageUsageKB, type ProjectMeta } from '../storage';
import { useStore } from '../store';
import { downloadProject, pickProjectFile } from '../io';
import { bounds, uid } from '../geometry';
import type { Project } from '../types';

function Thumb({ id }: { id: string }) {
  const p = loadProject(id);
  const rooms = p?.levels[0]?.rooms ?? [];
  const pts = rooms.flatMap((r) => r.points);
  if (!pts.length) return <div className="thumb empty">Plano vacío</div>;
  const b = bounds(pts);
  const pad = 0.6;
  return (
    <svg className="thumb" viewBox={`${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`} preserveAspectRatio="xMidYMid meet">
      {rooms.map((r) => (
        <polygon key={r.id} points={r.points.map((q) => `${q.x},${q.y}`).join(' ')} fill={r.floorColor} fillOpacity={0.55} stroke="var(--thumb-line)" strokeWidth={0.12} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export default function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const [list, setList] = useState<ProjectMeta[]>(listProjects);
  const [creating, setCreating] = useState(false);
  const openProject = useStore((s) => s.openProject);
  const notify = useStore((s) => s.notify);
  const refresh = () => setList(listProjects());

  const open = (id: string, screen: 'editor' | 'viewer' = 'editor') => {
    const p = loadProject(id);
    if (p) openProject(p, screen);
    else notify('No se pudo abrir el proyecto');
  };

  const create = (p: Project) => {
    saveProject(p);
    openProject(p);
  };

  const importFile = async () => {
    try {
      const p = await pickProjectFile();
      if (listProjects().some((m) => m.id === p.id)) p.id = uid();
      saveProject(p);
      refresh();
      notify(`📥 "${p.name}" importado`);
    } catch (e) {
      if ((e as Error).message !== 'Sin archivo') notify('⚠️ El archivo no es un proyecto válido');
    }
  };

  return (
    <div className="home">
      <button className="ghost small home-logout" onClick={onLogout} title="Cerrar sesión">
        ⏻ Cerrar sesión
      </button>
      <header className="home-hero">
        <div className="brand">
          <div className="brand-logo">⌂</div>
          <div>
            <h1>
              Render<span>CrZ</span>
            </h1>
            <p>Diseña almacenes y centros logísticos: dibuja naves irregulares, ubica racks, anaqueles, zonas y señalética, define niveles y recórrelos en 3D.</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary big" onClick={() => setCreating(true)}>
            ＋ Nuevo proyecto
          </button>
          <button className="secondary big" onClick={() => create(sampleWarehouse('Centro de distribución (ejemplo)'))}>
            🏭 Almacén de ejemplo
          </button>
          <button className="ghost big" onClick={() => create(sampleProject('Casa de ejemplo'))} title="Ejemplo residencial">
            🏡 Casa
          </button>
          <button className="ghost big" onClick={importFile}>
            📥 Importar
          </button>
        </div>
      </header>

      <section className="projects">
        <div className="projects-head">
          <h2>Mis proyectos</h2>
          <span className="muted small">Guardados en este navegador · {storageUsageKB()} KB usados</span>
        </div>
        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📐</div>
            <p>Todavía no tienes proyectos. Crea uno nuevo o abre el almacén de ejemplo para explorar.</p>
          </div>
        ) : (
          <div className="cards">
            {list.map((m) => (
              <article key={m.id} className="card">
                <button className="card-thumb" onClick={() => open(m.id)} title="Abrir en el editor">
                  <Thumb id={m.id} />
                </button>
                <div className="card-body">
                  <h3 title={m.name}>{m.name}</h3>
                  <p className="muted small">
                    {m.levels} {m.levels === 1 ? 'nivel' : 'niveles'} · {m.rooms} ambientes · {m.furniture} objetos
                  </p>
                  <p className="muted tiny">Editado {new Date(m.updatedAt).toLocaleString()}</p>
                </div>
                <div className="card-actions">
                  <button className="primary small" onClick={() => open(m.id)}>✏️ Editar</button>
                  <button className="secondary small" onClick={() => open(m.id, 'viewer')}>🧊 3D</button>
                  <button
                    className="icon"
                    title="Duplicar"
                    onClick={() => {
                      const p = loadProject(m.id);
                      if (!p) return;
                      saveProject({ ...p, id: uid(), name: `${p.name} (copia)`, updatedAt: Date.now() });
                      refresh();
                    }}
                  >
                    ⧉
                  </button>
                  <button className="icon" title="Exportar JSON" onClick={() => { const p = loadProject(m.id); if (p) downloadProject(p); }}>
                    ⤓
                  </button>
                  <button
                    className="icon danger-text"
                    title="Eliminar"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${m.name}"? Esta acción no se puede deshacer.`)) {
                        deleteProject(m.id);
                        refresh();
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating && <NewProjectDialog onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const [name, setName] = useState('Mi almacén');
  const [levels, setLevels] = useState(1);
  const [height, setHeight] = useState(7);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(newProject(name.trim(), levels, height));
        }}
      >
        <h2>Nuevo proyecto</h2>
        <label className="field">
          <span>Nombre del proyecto</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid2">
          <label className="field">
            <span>¿Cuántos niveles?</span>
            <input type="number" min={1} max={20} value={levels} onChange={(e) => setLevels(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
          </label>
          <label className="field">
            <span>Altura por nivel (m)</span>
            <input type="number" min={2} max={30} step={0.05} value={height} onChange={(e) => setHeight(Number(e.target.value) || 2.6)} />
          </label>
        </div>
        <p className="muted small">Podrás cambiar la cantidad de niveles y sus alturas en cualquier momento.</p>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Crear y empezar a dibujar
          </button>
        </div>
      </form>
    </div>
  );
}
