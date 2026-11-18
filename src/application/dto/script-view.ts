import {
  ENERGY_LABELS,
  SECTION_LABELS,
  SHOT_LABELS,
  type DurationStatus,
  type Energy,
  type FormatId,
  type Orientation,
  type PhraseLength,
  type Script,
  type Section,
  type Shot,
  type VideoFormat,
} from '../../domain';

/**
 * Vistas planas y serializables que la aplicación entrega a la interfaz.
 * La UI nunca recibe entidades del dominio: así no puede saltarse sus reglas.
 */

export interface FormatView {
  readonly id: FormatId;
  readonly label: string;
  readonly orientation: Orientation;
  readonly platforms: string;
  /** "hasta 60 s". */
  readonly durationLabel: string;
  readonly minSeconds: number;
  readonly maxSeconds: number;
}

export interface PhraseView {
  readonly id: string;
  /** 1-based. */
  readonly order: number;
  readonly section: Section;
  readonly sectionLabel: string;
  readonly text: string;
  readonly guide: string;
  /** Plano elegido (o `null`, y se usa el sugerido). */
  readonly shot: Shot | null;
  readonly suggestedShot: Shot;
  /** Etiqueta del plano efectivo (elegido o sugerido). */
  readonly shotLabel: string;
  readonly energy: Energy;
  readonly energyLabel: string;
  readonly note: string;
  readonly words: number;
  readonly seconds: number;
  /** "LONG": suena leída; conviene dividirla. */
  readonly length: PhraseLength;
  /** Grabación de la frase, si existe y corresponde al texto actual. */
  readonly take: string | null;
}

export interface ScriptView {
  readonly id: string;
  readonly title: string;
  readonly format: FormatView;
  readonly wordsPerMinute: number;
  readonly comfortableWords: number;
  readonly phrases: readonly PhraseView[];
  readonly estimatedSec: number;
  readonly durationStatus: DurationStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ScriptSummary {
  readonly id: string;
  readonly title: string;
  readonly formatLabel: string;
  readonly estimatedSec: number;
  readonly updatedAt: number;
}

export const toFormatView = (format: VideoFormat): FormatView => ({
  id: format.id,
  label: format.label,
  orientation: format.orientation,
  platforms: format.platforms,
  durationLabel: format.durationLabel,
  minSeconds: format.minSeconds,
  maxSeconds: format.maxSeconds,
});

export const toScriptView = (script: Script): ScriptView => ({
  id: script.id,
  title: script.title,
  format: toFormatView(script.format),
  wordsPerMinute: script.rate.wordsPerMinute,
  comfortableWords: script.format.comfortableWords,
  phrases: script.phrases.map((phrase, index) => {
    const suggestedShot = script.suggestedShot(phrase);
    return {
      id: phrase.id,
      order: index + 1,
      section: phrase.section,
      sectionLabel: SECTION_LABELS[phrase.section],
      text: phrase.text.value,
      guide: phrase.guide,
      shot: phrase.shot,
      suggestedShot,
      shotLabel: SHOT_LABELS[phrase.shot ?? suggestedShot],
      energy: phrase.energy,
      energyLabel: ENERGY_LABELS[phrase.energy],
      note: phrase.note.value,
      words: phrase.text.wordCount,
      seconds: script.durationOf(phrase).rounded(),
      length: script.lengthOf(phrase),
      take: phrase.take,
    };
  }),
  estimatedSec: script.estimatedDuration().rounded(),
  durationStatus: script.durationStatus(),
  createdAt: script.createdAt,
  updatedAt: script.updatedAt,
});

export const toScriptSummary = (script: Script): ScriptSummary => ({
  id: script.id,
  title: script.title,
  formatLabel: script.format.label,
  estimatedSec: script.estimatedDuration().rounded(),
  updatedAt: script.updatedAt,
});
