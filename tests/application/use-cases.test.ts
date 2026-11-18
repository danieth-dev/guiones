import { describe, expect, it } from 'vitest';
import type { ScriptRepository } from '../../src/application';
import { audioId } from '../../src/domain';
import { InMemoryScriptRepository } from '../../src/infrastructure';
import { createHarness, errorCode, value, voiceBlob } from './harness';

describe('Guiones', () => {
  it('crea con el esqueleto del formato elegido y valida formato y velocidad', async () => {
    const { app } = createHarness();
    const short = value(await app.createScript.execute({}));
    expect(short.format).toMatchObject({ id: 'SHORT_VERTICAL', durationLabel: 'hasta 60 s' });
    expect(short.phrases.map((p) => p.section)).toEqual([
      'OPENING',
      'BODY',
      'BODY',
      'BODY',
      'CLOSING',
    ]);
    expect(short.phrases[0]).toMatchObject({
      shot: 'CLOSE_UP',
      shotLabel: 'Primer plano',
      energy: 'HIGH',
    });
    expect(short.durationStatus).toBe('EMPTY');

    const long = value(
      await app.createScript.execute({
        title: 'Review',
        formatId: 'LONG_HORIZONTAL',
        wordsPerMinute: 150,
      }),
    );
    expect(long).toMatchObject({ title: 'Review', wordsPerMinute: 150 });
    expect(errorCode(await app.createScript.execute({ formatId: 'PODCAST' }))).toBe('NOT_FOUND');
    expect(errorCode(await app.createScript.execute({ wordsPerMinute: 20 }))).toBe('INVALID_VALUE');
  });

  it('configura título, formato y velocidad; lista y borra con sus audios', async () => {
    const { app, audio } = createHarness();
    const first = value(await app.createScript.execute({ title: 'Primero' }));
    const configured = value(
      await app.configureScript.execute({
        scriptId: first.id,
        title: 'Luz',
        formatId: 'MEDIUM_VERTICAL',
        wordsPerMinute: 170,
      }),
    );
    expect(configured).toMatchObject({
      title: 'Luz',
      wordsPerMinute: 170,
      format: { id: 'MEDIUM_VERTICAL' },
    });
    expect(
      errorCode(await app.configureScript.execute({ scriptId: first.id, formatId: 'X' })),
    ).toBe('NOT_FOUND');
    expect(
      errorCode(await app.configureScript.execute({ scriptId: first.id, wordsPerMinute: 1 })),
    ).toBe('INVALID_VALUE');

    const second = value(await app.createScript.execute({ title: 'Segundo' }));
    const list = value(await app.listScripts.execute());
    expect(list.map((s) => s.id)).toEqual([second.id, first.id]);
    expect(list[1]).toMatchObject({ title: 'Luz', formatLabel: 'Vertical medio' });

    const phrase = configured.phrases[0]!;
    value(
      await app.editPhrase.execute({
        scriptId: first.id,
        phraseId: phrase.id,
        text: 'Hola a todos',
      }),
    );
    const recorded = value(
      await app.recordTake.execute({ scriptId: first.id, phraseId: phrase.id, audio: voiceBlob() }),
    );
    const take = recorded.phrases[0]!.take!;
    expect(value(await app.getTake.execute({ audioId: take }))).not.toBeNull();
    // Si fallan los audios, el guion sigue ahí: no queda un borrado a medias.
    const deleteByOwner = audio.deleteByOwner.bind(audio);
    audio.deleteByOwner = () => Promise.reject(new Error('disco lleno'));
    expect(errorCode(await app.deleteScript.execute({ scriptId: first.id }))).toBe(
      'STORAGE_FAILURE',
    );
    expect(value(await app.getScript.execute({ scriptId: first.id })).id).toBe(first.id);
    audio.deleteByOwner = deleteByOwner;
    value(await app.deleteScript.execute({ scriptId: first.id }));
    expect(await audio.load(audioId(take))).toBeNull();
    expect(errorCode(await app.getScript.execute({ scriptId: first.id }))).toBe('NOT_FOUND');
    expect(errorCode(await app.deleteScript.execute({ scriptId: first.id }))).toBe('NOT_FOUND');
  });

  it('traduce fallos del almacenamiento a STORAGE_FAILURE', async () => {
    const broken: ScriptRepository = Object.assign(new InMemoryScriptRepository(), {
      findAll: () => Promise.reject(new Error('disco lleno')),
    });
    const { app } = createHarness({ scripts: broken });
    const result = await app.listScripts.execute();
    expect(errorCode(result)).toBe('STORAGE_FAILURE');
    expect(!result.ok && result.error.message).toContain('disco lleno');
  });
});

describe('Frases', () => {
  it('agrega antes del cierre o después de otra, y edita texto, plano, energía y parte', async () => {
    const { app } = createHarness();
    const script = value(await app.createScript.execute({}));
    const before = script.phrases.length;
    const added = value(await app.addPhrase.execute({ scriptId: script.id, text: 'Nueva' }));
    expect(added.phrases).toHaveLength(before + 1);
    expect(added.phrases.at(-2)?.text).toBe('Nueva');
    expect(added.phrases.at(-1)?.section).toBe('CLOSING');
    const afterFirst = value(
      await app.addPhrase.execute({
        scriptId: script.id,
        afterId: script.phrases[0]!.id,
        section: 'OPENING',
      }),
    );
    expect(afterFirst.phrases[1]?.section).toBe('OPENING');
    expect(errorCode(await app.addPhrase.execute({ scriptId: script.id, section: 'INTRO' }))).toBe(
      'INVALID_VALUE',
    );

    const id = script.phrases[1]!.id;
    const edited = value(
      await app.editPhrase.execute({
        scriptId: script.id,
        phraseId: id,
        text: '  Cambié  todo ',
        shot: 'WIDE',
        energy: 'CALM',
        note: 'Plano del escritorio',
        section: 'BODY',
      }),
    );
    expect(edited.phrases.find((p) => p.id === id)).toMatchObject({
      text: 'Cambié todo',
      shot: 'WIDE',
      shotLabel: 'Plano general',
      energy: 'CALM',
      energyLabel: 'Calma',
      note: 'Plano del escritorio',
      words: 2,
    });
    const reset = value(
      await app.editPhrase.execute({ scriptId: script.id, phraseId: id, shot: null }),
    );
    expect(reset.phrases.find((p) => p.id === id)?.shot).toBeNull();

    const bad = (input: Record<string, string>) =>
      app.editPhrase.execute({ scriptId: script.id, phraseId: id, ...input });
    expect(errorCode(await bad({ section: 'X' }))).toBe('INVALID_VALUE');
    expect(errorCode(await bad({ shot: 'DRONE' }))).toBe('INVALID_VALUE');
    expect(errorCode(await bad({ energy: 'MAX' }))).toBe('INVALID_VALUE');
    expect(errorCode(await bad({ note: 'x'.repeat(200) }))).toBe('INVALID_VALUE');
  });

  it('divide, mueve y elimina', async () => {
    const { app } = createHarness();
    const script = value(await app.createScript.execute({}));
    const id = script.phrases[1]!.id;
    value(
      await app.editPhrase.execute({
        scriptId: script.id,
        phraseId: id,
        text: 'Esto es clave, pero casi nadie lo aplica bien en sus videos cortos',
      }),
    );
    const split = value(await app.splitPhrase.execute({ scriptId: script.id, phraseId: id }));
    expect(split.phrases).toHaveLength(script.phrases.length + 1);
    const moved = value(
      await app.movePhrase.execute({ scriptId: script.id, phraseId: id, toIndex: 0 }),
    );
    expect(moved.phrases[0]?.id).toBe(id);
    const removed = value(await app.removePhrase.execute({ scriptId: script.id, phraseId: id }));
    expect(removed.phrases.some((p) => p.id === id)).toBe(false);
  });
});

describe('Decirlo en voz alta', () => {
  it('no deja audio huérfano si la frase no existe', async () => {
    const { app, audio } = createHarness();
    const script = value(await app.createScript.execute({}));
    expect(
      errorCode(
        await app.recordTake.execute({ scriptId: script.id, phraseId: 'nada', audio: voiceBlob() }),
      ),
    ).toBe('NOT_FOUND');
    expect(await audio.load(audioId('au_7'))).toBeNull();
  });

  it('el ensayo compara tiempos y mide el ritmo real', async () => {
    const { app } = createHarness();
    const script = value(await app.createScript.execute({}));
    const id = script.phrases[0]!.id;
    value(
      await app.editPhrase.execute({
        scriptId: script.id,
        phraseId: id,
        text: 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce',
      }),
    );
    const report = value(
      await app.recordPracticeSession.execute({
        scriptId: script.id,
        phrases: [
          { phraseId: id, elapsedMs: 4_000 },
          { phraseId: 'inexistente', elapsedMs: 1_000 },
        ],
      }),
    );
    expect(report.phrases).toEqual([{ phraseId: id, estimatedSec: 4.5, actualSec: 4 }]);
    expect(report).toMatchObject({
      measuredWpm: 180,
      currentWpm: 160,
      totalActualSec: 4,
      totalEstimatedSec: 4.5,
    });
    expect(
      errorCode(await app.recordPracticeSession.execute({ scriptId: 'nada', phrases: [] })),
    ).toBe('NOT_FOUND');
  });
});

describe('Archivos', () => {
  it('exporta tabla de rodaje y texto; rechaza formatos desconocidos', async () => {
    const { app } = createHarness();
    const script = value(await app.createScript.execute({ title: 'Luz natural' }));
    value(
      await app.editPhrase.execute({
        scriptId: script.id,
        phraseId: script.phrases[0]!.id,
        text: 'Hola | mundo',
      }),
    );
    const md = value(await app.exportScript.execute({ scriptId: script.id, format: 'md' }));
    expect(md.fileName).toBe('luz-natural-rodaje.md');
    expect(md.content).toContain('| 1 | Inicio | Hola \\| mundo | Primer plano | Alta |');
    const txt = value(await app.exportScript.execute({ scriptId: script.id, format: 'txt' }));
    expect(txt.content).toContain('[Inicio · Primer plano · energía alta]\nHola | mundo');
    expect(
      errorCode(await app.exportScript.execute({ scriptId: script.id, format: 'pdf' as 'md' })),
    ).toBe('UNSUPPORTED');
    expect(errorCode(await app.exportScript.execute({ scriptId: 'nada', format: 'md' }))).toBe(
      'NOT_FOUND',
    );
  });

  it('exportar e importar Markdown conserva lo escrito en un guion nuevo', async () => {
    const { app } = createHarness();
    const original = value(
      await app.createScript.execute({ title: 'Luz natural', formatId: 'MEDIUM_VERTICAL' }),
    );
    const id = original.phrases[1]!.id;
    value(
      await app.editPhrase.execute({
        scriptId: original.id,
        phraseId: id,
        text: 'La ventana cambia todo',
        shot: 'BROLL',
        energy: 'CALM',
        note: 'Ventana',
      }),
    );
    const file = value(await app.exportScriptDocument.execute({ scriptId: original.id }));
    expect(file).toMatchObject({ fileName: 'luz-natural.md', mimeType: 'text/markdown' });
    const copy = value(await app.importScriptDocument.execute({ text: file.content }));
    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({ title: 'Luz natural', format: { id: 'MEDIUM_VERTICAL' } });
    expect(copy.phrases[1]).toMatchObject({
      text: 'La ventana cambia todo',
      shot: 'BROLL',
      energy: 'CALM',
      note: 'Ventana',
    });
    expect(copy.phrases.map((p) => p.section)).toEqual(original.phrases.map((p) => p.section));
    expect(errorCode(await app.exportScriptDocument.execute({ scriptId: 'nada' }))).toBe(
      'NOT_FOUND',
    );
  });

  it('rechaza documentos que el dominio no acepta', async () => {
    const { app } = createHarness();
    const bad = async (text: string) => errorCode(await app.importScriptDocument.execute({ text }));
    expect(await bad('---\nformato: podcast\n---')).toBe('INVALID_VALUE');
    expect(await bad('---\nppm: 20\n---')).toBe('INVALID_VALUE');
    expect(await bad(`## Desarrollo\n- hola\n  > ${'y'.repeat(200)}`)).toBe('INVALID_VALUE');
  });
});

describe('Ajustes', () => {
  it('lee los de fábrica, guarda y valida', async () => {
    const { app } = createHarness();
    expect(value(await app.getSettings.execute())).toEqual({ defaultWpm: 160, theme: 'light' });
    expect(value(await app.updateSettings.execute({ defaultWpm: 175 }))).toEqual({
      defaultWpm: 175,
      theme: 'light',
    });
    expect(value(await app.updateSettings.execute({ theme: 'system' })).defaultWpm).toBe(175);
    expect(errorCode(await app.updateSettings.execute({ defaultWpm: 20 }))).toBe('INVALID_VALUE');
    expect(errorCode(await app.updateSettings.execute({ theme: 'neon' as 'light' }))).toBe(
      'INVALID_VALUE',
    );
  });
});
