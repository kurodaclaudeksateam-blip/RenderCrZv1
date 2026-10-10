/** Utilidades de azar para las animaciones (cada carga produce una construcción distinta). */
export const rnd = (min: number, max: number) => min + Math.random() * (max - min);
export const rint = (min: number, max: number) => Math.floor(rnd(min, max + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const snap = (n: number, step = 0.5) => Math.round(n / step) * step;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
