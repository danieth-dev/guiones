/** Lo que tardó el usuario en decir un bloque durante un ensayo. */
export interface TimedUnit {
  readonly words: number;
  readonly elapsedMs: number;
}

/** Bloques más cortos que esto son toques de tecla, no lectura: no cuentan. */
const MIN_ELAPSED_MS = 400;

/**
 * Calibración del ritmo: palabras por minuto reales a partir de un ensayo
 * cronometrado. `null` si no hay datos suficientes (menos de 10 palabras).
 */
export const measureWordsPerMinute = (units: readonly TimedUnit[]): number | null => {
  const valid = units.filter((u) => u.words > 0 && u.elapsedMs >= MIN_ELAPSED_MS);
  const words = valid.reduce((sum, u) => sum + u.words, 0);
  const ms = valid.reduce((sum, u) => sum + u.elapsedMs, 0);
  if (words < 10 || ms === 0) return null;
  return Math.round((words / ms) * 60_000);
};
