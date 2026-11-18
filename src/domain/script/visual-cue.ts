import { domainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/** Indicación visual breve: ángulo de cámara, acción física o B-roll. */
export class VisualCue {
  static readonly MAX_LENGTH = 160;
  static readonly EMPTY = new VisualCue('');

  private constructor(readonly value: string) {}

  static create(raw: string): Result<VisualCue> {
    const normalized = raw.replace(/\s+/gu, ' ').trim();
    if (normalized.length > VisualCue.MAX_LENGTH) {
      return err(
        domainError(
          'INVALID_VALUE',
          `La indicación visual no puede superar ${VisualCue.MAX_LENGTH} caracteres.`,
        ),
      );
    }
    return ok(normalized === '' ? VisualCue.EMPTY : new VisualCue(normalized));
  }
}
