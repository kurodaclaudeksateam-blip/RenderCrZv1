import { useEffect, useState } from 'react';
import { listProjects, loadProject, newProject, sampleProject, sampleWarehouse, type ProjectMeta } from '../storage';
import { cloudInfo, persist, removeProject, syncProjects } from '../cloud';
import { SessionExpired } from '../auth';
import { ShareDialog } from './ShareDialog';
import { TrashDialog } from './TrashDialog';
import { useStore } from '../store';
import { downloadProject, pickProjectFile } from '../io';
import { bounds, uid } from '../geometry';
import type { Project } from '../types';

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

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
  const [cloud, setCloud] = useState(cloudInfo);
  const [syncing, setSyncing] = useState(true);
  const [sharing, setSharing] = useState<Project | null>(null);
  const [trash, setTrash] = useState(false);
  const refresh = () => {
    setList(listProjects());
    setCloud(cloudInfo());
  };

  // al entrar se iguala este navegador con la nube
  useEffect(() => {
    let alive = true;
    syncProjects()
      .catch((e) => {
        if (!alive) return;
        if (e instanceof SessionExpired) onLogout();
        else notify('⚠️ Sin conexión con la nube: se muestran los proyectos de este navegador');
      })
      .finally(() => {
        if (!alive) return;
        setSyncing(false);
        refresh();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cloudBytes = Object.values(cloud).reduce((n, c) => n + c.bytes, 0);

  const open = (id: string, screen: 'editor' | 'viewer' = 'editor') => {
    const p = loadProject(id);
    if (p) openProject(p, screen);
    else notify('No se pudo abrir el proyecto');
  };

  const create = (p: Project) => {
    persist(p);
    openProject(p);
  };

  const importFile = async () => {
    try {
      const p = await pickProjectFile();
      if (listProjects().some((m) => m.id === p.id)) p.id = uid();
      persist(p);
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
          <button className="ghost small" onClick={() => setTrash(true)} title="Proyectos eliminados en los últimos 30 días">
            🗑 Papelera
          </button>
          <span className="muted small">{syncing ? 'Sincronizando con la nube…' : `☁️ Guardados en la nube · ${fmtBytes(cloudBytes)} en total`}</span>
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
                  <p className="muted tiny">
                    Editado {new Date(m.updatedAt).toLocaleString()}
                    {cloud[m.id] && ` · ☁️ ${fmtBytes(cloud[m.id].bytes)}`}
                  </p>
                </div>
                <div className="card-actions">
                  <button className="primary small" onClick={() => open(m.id)}>✏️ Editar</button>
                  <button className="secondary small" onClick={() => open(m.id, 'viewer')}>🧊 3D</button>
                  <button className="icon" title="Compartir liga" onClick={() => setSharing(loadProject(m.id))}>
                    🔗
                  </button>
                  <button
                    className="icon"
                    title="Duplicar"
                    onClick={() => {
                      const p = loadProject(m.id);
                      if (!p) return;
                      persist({ ...p, id: uid(), name: `${p.name} (copia)`, updatedAt: Date.now() });
                      refresh();
                    }}
                  >
                    ⧉
                  </button>
                  <button className="icon" title="Exportar JSON" onClick={() => { const p = loadProject(m.id); if (p) downloadProject(p); }}>
                    ⤓
                  </button>
                  <button
                    className="danger small card-delete"
                    title="Eliminar el proyecto de la nube y de este navegador"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${m.name}"? Se va a la papelera, donde puedes restaurarlo durante 30 días; mientras tanto su liga para compartir deja de funcionar.`)) {
                        removeProject(m.id).catch(() => notify('⚠️ No se pudo eliminar de la nube; se quitó solo de este navegador'));
                        refresh();
                      }
                    }}
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {sharing && <ShareDialog project={sharing} onClose={() => { setSharing(null); refresh(); }} />}
      {trash && (
        <TrashDialog
          onClose={() => setTrash(false)}
          onRestored={() => {
            syncProjects().then(refresh).catch(() => notify('⚠️ Restaurado en la nube; vuelve a entrar para verlo aquí'));
          }}
        />
      )}
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
