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

type P = [number, number];

/**
 * Plano irregular aleatorio: una grilla de 2-3 columnas × 2-3 filas donde se quita una celda de
 * esquina (forma en L) y otra esquina se ochava.
 */
export function randomPlan(): P[][] {
  const cols = rint(2, 3);
  const rows = rint(2, 3);
  const xs = [0];
  for (let i = 0; i < cols; i++) xs.push(xs[i] + snap(rnd(3, 5.5)));
  const ys = [0];
  for (let j = 0; j < rows; j++) ys.push(ys[j] + snap(rnd(2.5, 4.5)));

  const corners = shuffle([
    [0, 0],
    [cols - 1, 0],
    [0, rows - 1],
    [cols - 1, rows - 1],
  ]);
  const removed = corners[0];
  const chamfer = Math.random() < 0.85 ? corners[1] : null;

  const rooms: P[][] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (i === removed[0] && j === removed[1]) continue;
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const y0 = ys[j];
      const y1 = ys[j + 1];
      if (chamfer && i === chamfer[0] && j === chamfer[1]) {
        const c = Math.min(x1 - x0, y1 - y0) * 0.5;
        const right = i === cols - 1;
        const bottom = j === rows - 1;
        // se recorta la esquina exterior de la celda
        if (!right && !bottom) rooms.push([[x0 + c, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + c]]);
        else if (right && !bottom) rooms.push([[x0, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1], [x0, y1]]);
        else if (!right && bottom) rooms.push([[x0, y0], [x1, y0], [x1, y1], [x0 + c, y1], [x0, y1 - c]]);
        else rooms.push([[x0, y0], [x1, y0], [x1, y1 - c], [x1 - c, y1], [x0, y1]]);
      } else {
        rooms.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      }
    }
  }
  return rooms;
}
