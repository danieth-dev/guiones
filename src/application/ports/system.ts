export type IdPrefix = 'sc' | 'fr' | 'au';

/** Genera identificadores únicos ("fr_…"). */
export interface IdGenerator {
  next(prefix: IdPrefix): string;
}

/** Reloj inyectable (milisegundos desde epoch), para tests deterministas. */
export interface Clock {
  now(): number;
}
