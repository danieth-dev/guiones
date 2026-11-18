import { domainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';
import type { Energy, Section, Shot } from './phrase-parts';

export type Orientation = 'VERTICAL' | 'HORIZONTAL';

/** Hueco del esqueleto inicial: qué decir ahí, con qué plano y energía. */
export interface SkeletonSlot {
  readonly section: Section;
  readonly guide: string;
  readonly shot: Shot;
  readonly energy: Energy;
}

/**
 * Cada cuántos segundos conviene cambiar de plano o de energía para que el
 * video no se haga monótono. Orientativo: los videos cortos piden cambios
 * más seguidos.
 */
export interface ChangeEvery {
  readonly shot: number;
  readonly energy: number;
}

export const FORMAT_IDS = ['SHORT_VERTICAL', 'MEDIUM_VERTICAL', 'LONG_HORIZONTAL'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

/**
 * Tipo de video. Decide la duración objetivo, cuántas palabras caben en una
 * frase antes de sonar leída, el plano sugerido y el esqueleto con el que
 * empieza un guion nuevo.
 */
export class VideoFormat {
  private constructor(
    readonly id: FormatId,
    readonly label: string,
    readonly orientation: Orientation,
    /** "Shorts, TikTok, Reels". */
    readonly platforms: string,
    readonly minSeconds: number,
    readonly maxSeconds: number,
    /** Más palabras que esto en una frase empieza a sonar a texto leído. */
    readonly comfortableWords: number,
    readonly changeEvery: ChangeEvery,
    /** La primera frase debe llegar al punto en este tiempo, o la gente se va. */
    readonly openingSeconds: number,
    readonly skeleton: readonly SkeletonSlot[],
  ) {}

  static readonly SHORT_VERTICAL = new VideoFormat(
    'SHORT_VERTICAL',
    'Vertical corto',
    'VERTICAL',
    'Shorts, TikTok, Reels',
    15,
    60,
    12,
    { shot: 8, energy: 15 },
    3,
    [
      {
        section: 'OPENING',
        guide: 'Lo primero que dices: algo que obligue a quedarse',
        shot: 'CLOSE_UP',
        energy: 'HIGH',
      },
      { section: 'BODY', guide: 'El contexto en una frase', shot: 'MEDIUM', energy: 'NORMAL' },
      {
        section: 'BODY',
        guide: 'Lo que pasó o lo que descubriste',
        shot: 'BROLL',
        energy: 'NORMAL',
      },
      {
        section: 'BODY',
        guide: 'La idea clave que se tienen que llevar',
        shot: 'CLOSE_UP',
        energy: 'HIGH',
      },
      {
        section: 'CLOSING',
        guide: 'Qué quieres que haga quien te ve',
        shot: 'CLOSE_UP',
        energy: 'NORMAL',
      },
    ],
  );

  static readonly MEDIUM_VERTICAL = new VideoFormat(
    'MEDIUM_VERTICAL',
    'Vertical medio',
    'VERTICAL',
    'TikTok, Shorts y Reels largos',
    60,
    180,
    16,
    { shot: 15, energy: 30 },
    4,
    [
      {
        section: 'OPENING',
        guide: 'Lo primero que dices: algo que obligue a quedarse',
        shot: 'CLOSE_UP',
        energy: 'HIGH',
      },
      {
        section: 'BODY',
        guide: 'Qué vas a contar y por qué importa',
        shot: 'MEDIUM',
        energy: 'NORMAL',
      },
      { section: 'BODY', guide: 'Primer punto o primer paso', shot: 'MEDIUM', energy: 'NORMAL' },
      { section: 'BODY', guide: 'Segundo punto, con un ejemplo', shot: 'BROLL', energy: 'NORMAL' },
      {
        section: 'BODY',
        guide: 'El giro o lo que nadie te dice',
        shot: 'CLOSE_UP',
        energy: 'HIGH',
      },
      {
        section: 'CLOSING',
        guide: 'Resumen en una frase y qué hacer ahora',
        shot: 'CLOSE_UP',
        energy: 'NORMAL',
      },
    ],
  );

  static readonly LONG_HORIZONTAL = new VideoFormat(
    'LONG_HORIZONTAL',
    'Horizontal largo',
    'HORIZONTAL',
    'YouTube',
    180,
    1200,
    22,
    { shot: 30, energy: 60 },
    8,
    [
      {
        section: 'OPENING',
        guide: 'Lo primero que dices: la promesa del video',
        shot: 'MEDIUM',
        energy: 'HIGH',
      },
      {
        section: 'OPENING',
        guide: 'Por qué deberían ver hasta el final',
        shot: 'CLOSE_UP',
        energy: 'NORMAL',
      },
      {
        section: 'BODY',
        guide: 'Presentación: quién eres y de qué va',
        shot: 'MEDIUM',
        energy: 'NORMAL',
      },
      { section: 'BODY', guide: 'Punto 1', shot: 'MEDIUM', energy: 'NORMAL' },
      {
        section: 'BODY',
        guide: 'Un ejemplo o demostración del punto 1',
        shot: 'BROLL',
        energy: 'NORMAL',
      },
      { section: 'BODY', guide: 'Punto 2', shot: 'MEDIUM', energy: 'NORMAL' },
      { section: 'BODY', guide: 'Punto 3 o el error más común', shot: 'WIDE', energy: 'HIGH' },
      { section: 'CLOSING', guide: 'Resumen y qué hacer ahora', shot: 'MEDIUM', energy: 'NORMAL' },
    ],
  );

  static readonly ALL: readonly VideoFormat[] = [
    VideoFormat.SHORT_VERTICAL,
    VideoFormat.MEDIUM_VERTICAL,
    VideoFormat.LONG_HORIZONTAL,
  ];

  static readonly DEFAULT = VideoFormat.SHORT_VERTICAL;

  static byId(id: string): Result<VideoFormat> {
    const format = VideoFormat.ALL.find((f) => f.id === id);
    return format
      ? ok(format)
      : err(domainError('NOT_FOUND', `Formato de video desconocido: ${id}.`));
  }

  /** "hasta 60 s", "1 a 3 min", "3 min o más". */
  get durationLabel(): string {
    if (this.minSeconds < 60) return `hasta ${String(this.maxSeconds)} s`;
    if (this.maxSeconds <= 180)
      return `${String(this.minSeconds / 60)} a ${String(this.maxSeconds / 60)} min`;
    return `${String(this.minSeconds / 60)} min o más`;
  }

  /**
   * Plano recomendado para una frase según su parte y su posición: en vertical
   * se habla de cerca; el desarrollo alterna explicar y mostrar para no aburrir.
   */
  suggestShot(section: Section, bodyIndex: number): Shot {
    if (section === 'OPENING' || section === 'CLOSING') {
      return this.orientation === 'VERTICAL' ? 'CLOSE_UP' : 'MEDIUM';
    }
    return bodyIndex % 3 === 1 ? 'BROLL' : 'MEDIUM';
  }
}
