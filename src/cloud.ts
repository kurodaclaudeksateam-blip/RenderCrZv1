// Proyectos en Supabase (tabla crz_proyectos). localStorage queda como copia local
// inmediata; aquí se sincroniza con la nube y se obtienen las ligas para compartir.

import { ProjectTooLarge, rpc, sessionToken } from './auth';
import { decodeProject, encodeProject } from './codec';
import { deleteProject, listProjects, loadProject, metaOf, saveProject } from './storage';
import type { Project } from './types';

const CLOUD_KEY = 'rendercrz:cloud';
const SAVE_DELAY = 2000;
/** Límite por proyecto de la tabla crz_proyectos. */
const MAX_BYTES = 600000;

/** Lo que se sabe de cada proyecto ya subido: liga y peso en la nube. */
export interface CloudInfo {
  share: string;
  bytes: number;
}

interface CloudRow {
  id: string;
  nombre: string;
  share_id: string;
  bytes: number;
  cliente_ms: number;
}

function readInfo(): Record<string, CloudInfo> {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeInfo(info: Record<string, CloudInfo>) {
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify(info));
  } catch {
    /* sin acceso */
  }
}

export function cloudInfo(): Record<string, CloudInfo> {
  return readInfo();
}

export function shareUrl(share: string) {
  return `${location.origin}/v/${share}`;
}

async function upload(p: Project): Promise<CloudInfo> {
  const datos = await encodeProject(p);
  if (datos.length > MAX_BYTES) throw new ProjectTooLarge('Proyecto demasiado grande');
  const share = await rpc<string>('crz_guardar_proyecto', {
    p_token: sessionToken(),
    p_id: p.id,
    p_nombre: p.name.trim() || 'Proyecto',
    p_datos: datos,
    p_meta: metaOf(p),
    p_cliente_ms: p.updatedAt,
  });
  const entry = { share, bytes: datos.length };
  writeInfo({ ...readInfo(), [p.id]: entry });
  return entry;
}

const pending = new Map<string, { project: Project; timer: ReturnType<typeof setTimeout> }>();
let onError: (e: unknown) => void = () => {};

export function setCloudErrorHandler(fn: (e: unknown) => void) {
  onError = fn;
}

/** Guarda en este navegador y programa la subida a la nube. */
export function persist(p: Project): boolean {
  if (!saveProject(p)) return false;
  const prev = pending.get(p.id);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pending.delete(p.id);
    upload(p).catch(onError);
  }, SAVE_DELAY);
  pending.set(p.id, { project: p, timer });
  return true;
}

/** Sube de inmediato el proyecto (o su guardado pendiente) y devuelve su liga pública. */
export async function shareProject(p: Project): Promise<string> {
  const queued = pending.get(p.id);
  if (queued) {
    clearTimeout(queued.timer);
    pending.delete(p.id);
  }
  return shareUrl((await upload(queued?.project ?? p)).share);
}

export async function removeProject(id: string) {
  const queued = pending.get(id);
  if (queued) clearTimeout(queued.timer);
  pending.delete(id);
  deleteProject(id);
  const info = readInfo();
  delete info[id];
  writeInfo(info);
  await rpc('crz_eliminar_proyecto', { p_token: sessionToken(), p_id: id });
}

/** Iguala este navegador con la nube: baja lo más reciente y sube lo que falta. */
export async function syncProjects(): Promise<void> {
  // el estado local se toma antes de consultar: lo que se cree mientras tanto no se toca
  const known = readInfo();
  const local = new Map(listProjects().map((m) => [m.id, m]));
  const rows = await rpc<CloudRow[]>('crz_listar_proyectos', { p_token: sessionToken() });
  const info: Record<string, CloudInfo> = {};
  const remote = new Map(rows.map((r) => [r.id, r]));

  for (const r of rows) {
    info[r.id] = { share: r.share_id, bytes: r.bytes };
    const m = local.get(r.id);
    if (!pending.has(r.id) && (!m || r.cliente_ms > m.updatedAt)) {
      const datos = await rpc<string | null>('crz_obtener_proyecto', { p_token: sessionToken(), p_id: r.id });
      if (datos) saveProject(await decodeProject(datos, r.id));
    }
  }
  for (const m of local.values()) {
    const r = remote.get(m.id);
    if (r && r.cliente_ms >= m.updatedAt) continue;
    if (pending.has(m.id)) continue;
    // ya estuvo en la nube y no está: se eliminó desde otro equipo
    if (!r && known[m.id]) {
      deleteProject(m.id);
      continue;
    }
    const p = loadProject(m.id);
    if (p) info[m.id] = await upload(p);
  }
  // se conserva lo subido durante la sincronización
  writeInfo({ ...Object.fromEntries(Object.entries(readInfo()).filter(([id]) => !known[id] && !remote.has(id))), ...info });
}

export interface TrashItem {
  id: string;
  name: string;
  deletedAt: number;
}

/** Proyectos eliminados en los últimos 30 días. */
export async function listTrash(): Promise<TrashItem[]> {
  const rows = await rpc<{ id: string; nombre: string; eliminado_ms: number }[]>('crz_listar_papelera', { p_token: sessionToken() });
  return rows.map((r) => ({ id: r.id, name: r.nombre, deletedAt: Number(r.eliminado_ms) }));
}

export async function restoreProject(id: string) {
  await rpc('crz_restaurar_proyecto', { p_token: sessionToken(), p_id: id });
}

export interface SharedProject {
  name: string;
  project: Project;
  bytes: number;
}

/** Proyecto de una liga pública (sin sesión). */
export async function fetchShared(share: string): Promise<SharedProject | null> {
  const rows = await rpc<{ nombre: string; datos: string }[]>('crz_proyecto_compartido', { p_share: share });
  if (!rows.length) return null;
  return { name: rows[0].nombre, project: await decodeProject(rows[0].datos, share), bytes: rows[0].datos.length };
}
