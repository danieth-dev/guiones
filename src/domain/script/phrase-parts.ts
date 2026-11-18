/**
 * Las partes de una frase que el creador elige: en qué parte del video va,
 * con qué plano se graba y con cuánta energía se dice.
 */

/** Parte del video: el inicio engancha, el desarrollo cuenta, el cierre pide algo. */
export const SECTIONS = ['OPENING', 'BODY', 'CLOSING'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Readonly<Record<Section, string>> = {
  OPENING: 'Inicio',
  BODY: 'Desarrollo',
  CLOSING: 'Cierre',
};

export const isSection = (value: string): value is Section =>
  (SECTIONS as readonly string[]).includes(value);

/** Plano de cámara para grabar la frase. */
export const SHOTS = ['CLOSE_UP', 'MEDIUM', 'WIDE', 'BROLL', 'SCREEN', 'TEXT'] as const;
export type Shot = (typeof SHOTS)[number];

export const SHOT_LABELS: Readonly<Record<Shot, string>> = {
  CLOSE_UP: 'Primer plano',
  MEDIUM: 'Plano medio',
  WIDE: 'Plano general',
  BROLL: 'B-roll',
  SCREEN: 'Pantalla',
  TEXT: 'Texto en pantalla',
};

/** Qué es cada plano, en una línea, para quien recién empieza. */
export const SHOT_HINTS: Readonly<Record<Shot, string>> = {
  CLOSE_UP: 'Tu cara de cerca: para enganchar y para lo personal.',
  MEDIUM: 'De la cintura para arriba: para explicar con las manos.',
  WIDE: 'Se ve el lugar completo: para ubicar o cambiar de ritmo.',
  BROLL: 'Imágenes de apoyo mientras hablas: lo que muestras.',
  SCREEN: 'Grabación de pantalla: tutoriales, apps, juegos.',
  TEXT: 'Una frase escrita grande: para remarcar una idea.',
};

export const isShot = (value: string): value is Shot =>
  (SHOTS as readonly string[]).includes(value);

/** Energía con la que se dice: guía la actuación, no cambia el texto. */
export const ENERGIES = ['CALM', 'NORMAL', 'HIGH'] as const;
export type Energy = (typeof ENERGIES)[number];

export const ENERGY_LABELS: Readonly<Record<Energy, string>> = {
  CALM: 'Calma',
  NORMAL: 'Normal',
  HIGH: 'Alta',
};

export const isEnergy = (value: string): value is Energy =>
  (ENERGIES as readonly string[]).includes(value);
