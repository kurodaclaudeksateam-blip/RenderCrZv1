// Acceso con contraseña única verificada en Supabase (tabla crz_acceso). La función
// crz_iniciar_sesion devuelve un token de sesión que autoriza guardar y leer proyectos.
// La llave publicable es pública por diseño; las tablas crz_* no son legibles desde la API,
// solo a través de funciones.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mhmqgjgfkcrgbtrhmtqw.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_up1bYZnUEh0JxdhfBIRTUQ_FO2jrb4X';

const SESSION_KEY = 'rendercrz:token';

export class SessionExpired extends Error {}
export class ProjectTooLarge extends Error {}

/** Llama a una función de Supabase (PostgREST RPC). */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (res.status === 401 || res.status === 403) throw new SessionExpired('Sesión vencida');
  if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
  // las funciones que no devuelven nada responden 204 sin cuerpo
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function sessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!sessionToken();
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sin acceso */
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const token = await rpc<string | null>('crz_iniciar_sesion', { p_password: password });
  if (!token) return false;
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* sin acceso */
  }
  return true;
}
