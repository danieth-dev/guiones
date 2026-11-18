import { describe, expect, it } from 'vitest';
import { countSpokenWords, spokenWordsForInteger } from '../../src/domain';

describe('countSpokenWords (español hablado)', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['Hola, ¿qué tal?', 3],
    ['«Esto» —dijo— funciona.', 3],
    ['El 90% falla', 5], // el · noventa · por ciento · falla
    ['1.500 vistas', 3], // mil quinientos · vistas
    ['2,5 segundos', 4], // dos coma cinco · segundos
    ['$100', 2], // cien · dólares
    ['🔥 🔥 …', 0],
    ['Tú & yo', 3],
    ['auto-grabación sin miedo', 3],
  ])('"%s" → %i palabras', (text, expected) => {
    expect(countSpokenWords(text)).toBe(expected);
  });
});

describe('spokenWordsForInteger', () => {
  it.each([
    [0, 1],
    [16, 1], // dieciséis
    [29, 1], // veintinueve
    [40, 1], // cuarenta
    [42, 3], // cuarenta y dos
    [100, 1], // cien
    [101, 2], // ciento uno
    [1_000, 1], // mil
    [2_000, 2], // dos mil
    [1_000_000, 2], // un millón
    [2_500_000, 4], // dos millones quinientos mil
    [1_000_001, 3], // un millón uno
  ])('%i se dice con %i palabras', (n, expected) => {
    expect(spokenWordsForInteger(n)).toBe(expected);
  });
});
