import { describe, expect, it } from 'vitest';
import type { ScriptDocument } from '../../src/application';
import { EXAMPLE_SCRIPT_MARKDOWN, MarkdownDocumentCodec } from '../../src/infrastructure';

const codec = new MarkdownDocumentCodec();

const sample: ScriptDocument = {
  title: 'Por qué tu primer video "no" despega',
  formatId: 'SHORT_VERTICAL',
  wordsPerMinute: 172,
  phrases: [
    { section: 'OPENING', shot: 'CLOSE_UP', energy: 'HIGH', note: '', text: 'Grabé 30 videos.' },
    { section: 'BODY', shot: null, energy: 'NORMAL', note: '', text: 'Cambié la cámara.' },
    { section: 'BODY', shot: 'BROLL', energy: 'CALM', note: 'El contador', text: 'Nada.' },
    { section: 'CLOSING', shot: null, energy: 'NORMAL', note: '', text: '' },
  ],
};

const value = <T>(
  result: { ok: true; value: T } | { ok: false; error: { message: string } },
): T => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const errorOf = (text: string): string => {
  const result = codec.parseScript(text);
  return result.ok ? '' : result.error.message;
};

describe('Markdown de guion', () => {
  it('parse(serialize(x)) devuelve el mismo contenido', () => {
    const text = codec.serializeScript(sample);
    expect(text).toContain('titulo: "Por qué tu primer video \\"no\\" despega"');
    expect(text).toContain('formato: vertical corto');
    expect(text).toContain('## Inicio\n\n- [primer plano] [energía: alta] Grabé 30 videos.');
    expect(text).toContain('- [b-roll] [energía: calma] Nada.\n  > El contador');
    expect(value(codec.parseScript(text))).toEqual(sample);
  });

  it('lee un archivo escrito a mano (etiquetas, tildes, alias y líneas que siguen)', () => {
    const doc = value(
      codec.parseScript(
        [
          '# Mi guion',
          '## Hook',
          '- [plano: Primer-Plano] [energia: ALTA] ¿Y si el problema',
          '  no es tu cámara?',
          '## Desarrollo',
          '- Sin etiquetas',
          '## CTA',
          '- [texto] Sígueme',
        ].join('\n'),
      ),
    );
    expect(doc).toMatchObject({
      title: 'Mi guion',
      formatId: 'SHORT_VERTICAL',
      wordsPerMinute: 160,
    });
    expect(doc.phrases).toEqual([
      {
        section: 'OPENING',
        shot: 'CLOSE_UP',
        energy: 'HIGH',
        note: '',
        text: '¿Y si el problema no es tu cámara?',
      },
      { section: 'BODY', shot: null, energy: 'NORMAL', note: '', text: 'Sin etiquetas' },
      { section: 'CLOSING', shot: 'TEXT', energy: 'NORMAL', note: '', text: 'Sígueme' },
    ]);
    expect(value(codec.parseScript('---\nformato: youtube\n---')).formatId).toBe('LONG_HORIZONTAL');
    expect(value(codec.parseScript('')).title).toBe('Guion importado');
  });

  it('el guion de ejemplo es un documento válido', () => {
    const doc = value(codec.parseScript(EXAMPLE_SCRIPT_MARKDOWN));
    expect(doc.phrases.map((p) => p.section)).toEqual([
      'OPENING',
      'BODY',
      'BODY',
      'BODY',
      'CLOSING',
    ]);
  });

  it.each([
    ['---\nformato: x', 'Línea 1: el bloque de metadatos'],
    ['---\nmal escrito\n---', 'Línea 2: metadato mal escrito'],
    ['---\ntitulo: "sin cerrar\n---', 'Línea 2: texto entre comillas'],
    ['---\nscriptflow: codice\n---', 'no un guion'],
    ['---\nformato: podcast\n---', 'formato desconocido'],
    ['---\nppm: rápido\n---', '"ppm" debe ser un número'],
    ['## Notas', 'Línea 1: parte desconocida «Notas»'],
    ['suelto', 'Línea 1: texto fuera de una parte'],
    ['## Desarrollo\nhola', 'Línea 2: cada frase empieza con "- "'],
    ['## Desarrollo\n- [dron] hola', 'Línea 2: plano desconocido'],
    ['## Desarrollo\n- [energía: furiosa] hola', 'energía desconocida'],
    ['## Desarrollo\n- [color: rojo] hola', 'dato desconocido «color»'],
  ])('informa el error con su línea: %j', (text, message) => {
    expect(errorOf(text)).toContain(message);
  });
});
