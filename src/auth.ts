// Acceso con contraseña única verificada en Supabase (tabla CRZ_acceso, función crz_verificar_acceso).
// La llave publicable es pública por diseño; la tabla no es legible desde la API, solo la función
// de verificación, que responde verdadero o falso.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mhmqgjgfkcrgbtrhmtqw.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_up1bYZnUEh0JxdhfBIRTUQ_FO2jrb4X';

const SESSION_KEY = 'rendercrz:auth';

export function isAuthenticated() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sin acceso */
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crz_verificar_acceso`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_password: password }),
  });
  if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
  const ok = (await res.json()) === true;
  if (ok) {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* sin acceso */
    }
  }
  return ok;
}
