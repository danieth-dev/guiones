import { describe, expect, it } from 'vitest';
import { splitBeatText, SpokenText } from '../../src/domain';
import { unwrap } from './fixtures';

const split = (text: string): [string, string] => {
  const { first, second } = unwrap(splitBeatText(SpokenText.of(text)));
  return [first.value, second.value];
};

describe('splitBeatText', () => {
  it('corta en la pausa natural (coma + conector) y capitaliza el segundo beat', () => {
    expect(split('Esto es clave, pero casi nadie lo aplica bien en sus videos cortos')).toEqual([
      'Esto es clave',
      'Pero casi nadie lo aplica bien en sus videos cortos',
    ]);
  });

  it('reconoce conectores de dos palabras sin importar las tildes', () => {
    expect(split('Lo probé durante un mes así que te cuento lo que pasó')).toEqual([
      'Lo probé durante un mes',
      'Así que te cuento lo que pasó',
    ]);
  });

  it('elige la pausa más cercana al centro', () => {
    expect(split('Uno. Dos tres cuatro. Cinco seis siete ocho nueve diez')).toEqual([
      'Uno. Dos tres cuatro.',
      'Cinco seis siete ocho nueve diez',
    ]);
  });

  it('sin pausas naturales, corta por la mitad', () => {
    expect(split('uno dos tres cuatro')).toEqual(['uno dos', 'Tres cuatro']);
  });

  it('no divide un beat de una sola palabra', () => {
    const result = splitBeatText(SpokenText.of('Hola'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CANNOT_SPLIT');
  });
});
