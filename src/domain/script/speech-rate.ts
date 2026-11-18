import { domainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';
import { Duration } from './duration';

/**
 * Velocidad de locución en palabras por minuto.
 * 160 WPM por defecto: el español hablado suele ir más rápido que la referencia
 * de 150 WPM del inglés. Se calibra luego con el cronómetro del teleprompter.
 */
export class SpeechRate {
  static readonly MIN_WPM = 80;
  static readonly MAX_WPM = 260;
  static readonly DEFAULT = new SpeechRate(160);

  private constructor(readonly wordsPerMinute: number) {}

  static create(wordsPerMinute: number): Result<SpeechRate> {
    if (
      !Number.isInteger(wordsPerMinute) ||
      wordsPerMinute < SpeechRate.MIN_WPM ||
      wordsPerMinute > SpeechRate.MAX_WPM
    ) {
      return err(
        domainError(
          'INVALID_VALUE',
          `La velocidad debe ser un entero entre ${SpeechRate.MIN_WPM} y ${SpeechRate.MAX_WPM} palabras por minuto.`,
        ),
      );
    }
    return ok(new SpeechRate(wordsPerMinute));
  }

  durationOf(words: number): Duration {
    return Duration.ofSeconds((words / this.wordsPerMinute) * 60);
  }
}
