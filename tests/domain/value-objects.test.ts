import { describe, expect, it } from 'vitest';
import {
  andThen,
  Duration,
  err,
  isEnergy,
  isFormatId,
  isSection,
  isShot,
  ok,
  SpeechRate,
  SpokenText,
  VisualCue,
} from '../../src/domain';
import { unwrap } from './fixtures';

describe('SpokenText', () => {
  it('normaliza espacios y cuenta palabras habladas', () => {
    const text = SpokenText.of('  Hola   mundo \n cruel ');
    expect(text.value).toBe('Hola mundo cruel');
    expect(text.wordCount).toBe(3);
    expect(text.isEmpty).toBe(false);
  });

  it('el texto vacío es el singleton EMPTY', () => {
    expect(SpokenText.of('   ')).toBe(SpokenText.EMPTY);
    expect(SpokenText.EMPTY.isEmpty).toBe(true);
  });

  it('compara por valor', () => {
    expect(SpokenText.of('a  b').equals(SpokenText.of('a b'))).toBe(true);
  });
});

describe('VisualCue', () => {
  it('acepta indicaciones cortas y normaliza el vacío', () => {
    expect(unwrap(VisualCue.create(' Primer plano ')).value).toBe('Primer plano');
    expect(unwrap(VisualCue.create(''))).toBe(VisualCue.EMPTY);
  });

  it('rechaza indicaciones demasiado largas', () => {
    const result = VisualCue.create('x'.repeat(VisualCue.MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
  });
});

describe('SpeechRate', () => {
  it('convierte palabras en duración', () => {
    expect(SpeechRate.DEFAULT.wordsPerMinute).toBe(160);
    expect(SpeechRate.DEFAULT.durationOf(160).seconds).toBe(60);
    expect(unwrap(SpeechRate.create(150)).durationOf(5).seconds).toBe(2);
  });

  it.each([79, 261, 150.5, Number.NaN])('rechaza %d WPM', (wpm) => {
    expect(SpeechRate.create(wpm).ok).toBe(false);
  });
});

describe('Duration', () => {
  it('nunca es negativa ni inválida', () => {
    expect(Duration.ofSeconds(-3)).toBe(Duration.ZERO);
    expect(Duration.ofSeconds(Number.NaN)).toBe(Duration.ZERO);
  });

  it('suma, compara y redondea a un decimal', () => {
    const total = Duration.ofSeconds(1.26).plus(Duration.ofSeconds(2));
    expect(total.rounded()).toBe(3.3);
    expect(total.isLongerThan(3)).toBe(true);
    expect(total.isLongerThan(4)).toBe(false);
  });
});

describe('guards de enumerados', () => {
  it('reconocen solo valores válidos', () => {
    expect(isSection('OPENING')).toBe(true);
    expect(isSection('HOOK')).toBe(false);
    expect(isShot('BROLL')).toBe(true);
    expect(isShot('DRONE')).toBe(false);
    expect(isEnergy('HIGH')).toBe(true);
    expect(isEnergy('ENERGICO')).toBe(false);
    expect(isFormatId('LONG_HORIZONTAL')).toBe(true);
    expect(isFormatId('SHORT')).toBe(false);
  });
});

describe('Result', () => {
  it('andThen encadena éxitos y propaga el primer error', () => {
    expect(andThen(ok(2), (n) => ok(n * 2))).toEqual(ok(4));
    expect(andThen(err('fallo'), () => ok(1))).toEqual(err('fallo'));
  });
});
