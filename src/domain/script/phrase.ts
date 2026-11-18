import type { AudioId, PhraseId } from '../shared/ids';
import type { Energy, Section, Shot } from './phrase-parts';
import { SpokenText } from './spoken-text';
import { VisualCue } from './visual-cue';

export interface PhraseProps {
  readonly id: PhraseId;
  readonly section: Section;
  /** Lo que se dice, de un tirón. */
  readonly text: SpokenText;
  /** Texto guía mientras la frase está vacía. */
  readonly guide: string;
  /** Plano elegido; `null` = se usa el sugerido por el formato. */
  readonly shot: Shot | null;
  readonly energy: Energy;
  /** Detalle opcional del plano ("B-roll de la cámara nueva"). */
  readonly note: VisualCue;
  /** Última vez que te grabaste diciéndola (si sigue correspondiendo al texto). */
  readonly take: AudioId | null;
}

export type NewPhrase = Partial<Omit<PhraseProps, 'id' | 'section'>>;

/**
 * Frase: lo que dices de un tirón, con su plano y su energía. Es la unidad
 * del guion. Inmutable; cambiar el texto descarta la grabación anterior,
 * porque ya no corresponde a lo escrito.
 */
export class Phrase {
  private constructor(private readonly props: PhraseProps) {}

  static create(id: PhraseId, section: Section, options: NewPhrase = {}): Phrase {
    return new Phrase({
      id,
      section,
      text: options.text ?? SpokenText.EMPTY,
      guide: options.guide ?? '',
      shot: options.shot ?? null,
      energy: options.energy ?? 'NORMAL',
      note: options.note ?? VisualCue.EMPTY,
      take: options.take ?? null,
    });
  }

  static restore(props: PhraseProps): Phrase {
    return new Phrase(props);
  }

  get id(): PhraseId {
    return this.props.id;
  }
  get section(): Section {
    return this.props.section;
  }
  get text(): SpokenText {
    return this.props.text;
  }
  get guide(): string {
    return this.props.guide;
  }
  get shot(): Shot | null {
    return this.props.shot;
  }
  get energy(): Energy {
    return this.props.energy;
  }
  get note(): VisualCue {
    return this.props.note;
  }
  get take(): AudioId | null {
    return this.props.take;
  }

  withText(text: SpokenText): Phrase {
    return text.equals(this.props.text) ? this : new Phrase({ ...this.props, text, take: null });
  }

  with(patch: Partial<Pick<PhraseProps, 'section' | 'shot' | 'energy' | 'note' | 'take'>>): Phrase {
    return new Phrase({ ...this.props, ...patch });
  }
}
