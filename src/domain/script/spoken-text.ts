import { countSpokenWords } from '../services/word-counter';

/**
 * Texto tal como se dice en voz alta. Normaliza espacios y conoce su
 * conteo de palabras habladas. Puede estar vacío mientras se redacta.
 */
export class SpokenText {
  static readonly EMPTY = new SpokenText('');

  readonly wordCount: number;

  private constructor(readonly value: string) {
    this.wordCount = countSpokenWords(value);
  }

  static of(raw: string): SpokenText {
    const normalized = raw.replace(/\s+/gu, ' ').trim();
    return normalized === '' ? SpokenText.EMPTY : new SpokenText(normalized);
  }

  get isEmpty(): boolean {
    return this.value === '';
  }

  equals(other: SpokenText): boolean {
    return this.value === other.value;
  }
}
