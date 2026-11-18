import { describe, expect, it } from 'vitest';
import {
  audioId,
  phraseId,
  Script,
  scriptId,
  SpeechRate,
  SpokenText,
  VideoFormat,
  VisualCue,
} from '../../src/domain';
import { apply, errorCode, eventTypes, ids, shortScript, unwrap } from './fixtures';

describe('VideoFormat', () => {
  it('tres formatos con su duración, plataformas y esqueleto', () => {
    expect(VideoFormat.ALL.map((f) => [f.id, f.durationLabel, f.orientation])).toEqual([
      ['SHORT_VERTICAL', 'hasta 60 s', 'VERTICAL'],
      ['MEDIUM_VERTICAL', '1 a 3 min', 'VERTICAL'],
      ['LONG_HORIZONTAL', '3 min o más', 'HORIZONTAL'],
    ]);
    expect(unwrap(VideoFormat.byId('MEDIUM_VERTICAL'))).toBe(VideoFormat.MEDIUM_VERTICAL);
    expect(errorCode(VideoFormat.byId('PODCAST'))).toBe('NOT_FOUND');
    for (const format of VideoFormat.ALL) {
      expect(format.skeleton[0]?.section).toBe('OPENING');
      expect(format.skeleton.at(-1)?.section).toBe('CLOSING');
    }
  });

  it('sugiere planos: de cerca en vertical, alternando explicar y mostrar', () => {
    const short = VideoFormat.SHORT_VERTICAL;
    expect(short.suggestShot('OPENING', 0)).toBe('CLOSE_UP');
    expect(short.suggestShot('BODY', 0)).toBe('MEDIUM');
    expect(short.suggestShot('BODY', 1)).toBe('BROLL');
    expect(VideoFormat.LONG_HORIZONTAL.suggestShot('CLOSING', 0)).toBe('MEDIUM');
  });
});

describe('Script: creación y datos generales', () => {
  it('se crea con el esqueleto de su formato o vacío', () => {
    let n = 0;
    const withSkeleton = unwrap(
      Script.create({
        id: scriptId('s'),
        format: VideoFormat.LONG_HORIZONTAL,
        now: 5,
        nextPhraseId: () => phraseId(`p${String(++n)}`),
      }),
    );
    expect(withSkeleton.phrases).toHaveLength(VideoFormat.LONG_HORIZONTAL.skeleton.length);
    expect(withSkeleton.phrases[0]).toMatchObject({ section: 'OPENING', energy: 'HIGH' });
    expect(withSkeleton.phrases[0]?.guide).toContain('promesa');
    expect(withSkeleton.title).toBe(Script.DEFAULT_TITLE);
    expect(withSkeleton.rate).toBe(SpeechRate.DEFAULT);
    expect(withSkeleton.durationStatus()).toBe('EMPTY');

    const empty = unwrap(
      Script.create({
        id: scriptId('e'),
        format: VideoFormat.DEFAULT,
        now: 1,
        title: '  Hola   mundo ',
      }),
    );
    expect(empty.phrases).toEqual([]);
    expect(empty.title).toBe('Hola mundo');
    expect(
      errorCode(
        Script.create({
          id: scriptId('x'),
          format: VideoFormat.DEFAULT,
          now: 1,
          title: 'x'.repeat(121),
        }),
      ),
    ).toBe('INVALID_VALUE');
  });

  it('renombra, cambia formato y velocidad (sin eventos si no cambia nada)', () => {
    const script = shortScript();
    expect(apply(script.rename('Nuevo')).title).toBe('Nuevo');
    expect(eventTypes(script.rename(script.title))).toEqual([]);
    expect(errorCode(script.rename('x'.repeat(200)))).toBe('INVALID_VALUE');
    expect(apply(script.changeFormat(VideoFormat.MEDIUM_VERTICAL)).format.id).toBe(
      'MEDIUM_VERTICAL',
    );
    expect(eventTypes(script.changeFormat(VideoFormat.SHORT_VERTICAL))).toEqual([]);
    const faster = unwrap(SpeechRate.create(200));
    expect(apply(script.changeRate(faster)).rate.wordsPerMinute).toBe(200);
    expect(eventTypes(script.changeRate(SpeechRate.DEFAULT))).toEqual([]);
    expect(script.touched(99).updatedAt).toBe(99);
  });

  it('estima la duración, el largo de cada frase y el estado frente al formato', () => {
    const script = shortScript();
    expect(script.estimatedDuration().seconds).toBeGreaterThan(5);
    expect(script.durationStatus()).toBe('UNDER');
    const long = apply(
      script.editText(
        ids.body1,
        SpokenText.of(Array.from({ length: 13 }, (_, i) => `palabra${String(i)}`).join(' ')),
      ),
    );
    expect(long.lengthOf(long.phrases[1]!)).toBe('LONG');
    expect(long.lengthOf(long.phrases[0]!)).toBe('OK');
    const many = Array.from({ length: 200 }, () => 'hola').join(' ');
    expect(apply(script.editText(ids.body1, SpokenText.of(many))).durationStatus()).toBe('OVER');
    const fitting = Array.from({ length: 30 }, () => 'hola').join(' ');
    expect(apply(script.editText(ids.body1, SpokenText.of(fitting))).durationStatus()).toBe(
      'IN_RANGE',
    );
  });

  it('el plano efectivo es el elegido o el sugerido por su posición', () => {
    const script = shortScript();
    const [opening, body1, body2] = script.phrases;
    expect(script.suggestedShot(opening!)).toBe('CLOSE_UP');
    expect(script.suggestedShot(body1!)).toBe('MEDIUM');
    expect(script.suggestedShot(body2!)).toBe('BROLL');
  });
});

describe('Script: frases', () => {
  it('agrega, edita detalles y rechaza ids repetidos o desconocidos', () => {
    const script = shortScript();
    const added = apply(script.addPhrase(phraseId('nuevo'), 'BODY', {}, 1));
    expect(added.phrases[1]?.id).toBe('nuevo');
    expect(errorCode(script.addPhrase(ids.body1, 'BODY'))).toBe('INVALID_VALUE');
    const detailed = apply(
      script.updateDetails(ids.body1, {
        shot: 'BROLL',
        energy: 'CALM',
        note: unwrap(VisualCue.create('La cámara')),
      }),
    );
    expect(detailed.findPhrase(ids.body1)).toMatchObject({ shot: 'BROLL', energy: 'CALM' });
    expect(detailed.findPhrase(ids.body1)?.note.value).toBe('La cámara');
    expect(errorCode(script.updateDetails(phraseId('nada'), { energy: 'HIGH' }))).toBe('NOT_FOUND');
    expect(eventTypes(script.editText(ids.body1, script.phrases[1]!.text))).toEqual([]);
  });

  it('una grabación nueva reemplaza la anterior; editar el texto la descarta', () => {
    const first = apply(shortScript().attachTake(ids.body1, audioId('au_a')));
    const second = first.attachTake(ids.body1, audioId('au_b'));
    expect(unwrap(second).events).toEqual([
      { type: 'Changed' },
      { type: 'AudioDiscarded', audioId: 'au_a' },
    ]);
    const edited = apply(second).editText(ids.body1, SpokenText.of('Otra cosa'));
    expect(eventTypes(edited)).toEqual(['Changed', 'AudioDiscarded']);
    expect(apply(edited).findPhrase(ids.body1)?.take).toBeNull();
    // Cambiar el plano no toca la grabación.
    expect(eventTypes(apply(second).updateDetails(ids.body1, { shot: 'WIDE' }))).toEqual([
      'Changed',
    ]);
  });

  it('divide una frase en dos respiraciones conservando plano y energía', () => {
    const script = apply(shortScript().updateDetails(ids.body1, { shot: 'BROLL', energy: 'HIGH' }));
    const withTake = apply(script.attachTake(ids.body1, audioId('au_x')));
    const split = withTake.split(ids.body1, phraseId('mitad'));
    expect(eventTypes(split)).toEqual(['Changed', 'AudioDiscarded']);
    const [, first, second] = apply(split).phrases;
    expect(first?.text.value).toBe('Cambié la cámara');
    expect(second).toMatchObject({ id: 'mitad', shot: 'BROLL', energy: 'HIGH' });
    expect(errorCode(withTake.split(phraseId('nada'), phraseId('x')))).toBe('NOT_FOUND');
    const oneWord = apply(withTake.editText(ids.closing, SpokenText.of('Hola')));
    expect(errorCode(oneWord.split(ids.closing, phraseId('x')))).toBe('CANNOT_SPLIT');
  });

  it('mueve y elimina (borrando su grabación)', () => {
    const script = shortScript();
    expect(apply(script.move(ids.closing, 0)).phrases[0]?.id).toBe(ids.closing);
    expect(eventTypes(script.move(ids.opening, 0))).toEqual([]);
    expect(errorCode(script.move(phraseId('nada'), 1))).toBe('NOT_FOUND');
    const withTake = apply(script.attachTake(ids.body2, audioId('au_r')));
    const removed = withTake.remove(ids.body2);
    expect(eventTypes(removed)).toEqual(['Changed', 'AudioDiscarded']);
    expect(apply(removed).phrases).toHaveLength(3);
    expect(errorCode(script.remove(phraseId('nada')))).toBe('NOT_FOUND');
  });
});

describe('Script: ritmo', () => {
  // 12 palabras a 160 ppm = 4,5 s. Vertical corto: cambiar plano cada 8 s y energía cada 15 s.
  const twelve = SpokenText.of('uno dos tres cuatro cinco seis siete ocho nueve diez once doce');
  const build = (energies: readonly ('NORMAL' | 'HIGH')[], empty = false): Script => {
    let script = unwrap(
      Script.create({ id: scriptId('sc_r'), format: VideoFormat.SHORT_VERTICAL, now: 0 }),
    );
    energies.forEach((energy, i) => {
      if (empty && i === 1) {
        script = apply(script.addPhrase(phraseId('vacia'), 'BODY', { shot: 'WIDE' }));
      }
      script = apply(
        script.addPhrase(phraseId(`p${String(i)}`), 'BODY', {
          text: twelve,
          shot: 'MEDIUM',
          energy,
        }),
      );
    });
    return script;
  };
  const kinds = (script: Script) =>
    Object.fromEntries(
      [...script.rhythmHints()].map(([id, hints]) => [id, hints.map((h) => h.kind)]),
    );

  it('avisa donde llevas demasiado con el mismo plano o la misma energía', () => {
    const script = build(['NORMAL', 'NORMAL', 'NORMAL', 'NORMAL']);
    expect(kinds(script)).toEqual({
      p1: ['SAME_SHOT'],
      p3: ['SAME_SHOT', 'SAME_ENERGY'],
    });
    expect(script.rhythmHints().get(phraseId('p3'))?.[1]?.seconds).toBe(18);
  });

  it('cambiar la energía corta la racha; una frase vacía no la corta', () => {
    expect(kinds(build(['NORMAL', 'NORMAL', 'HIGH', 'NORMAL']))).toEqual({
      p1: ['SAME_SHOT'],
      p3: ['SAME_SHOT'],
    });
    expect(kinds(build(['NORMAL', 'NORMAL'], true))).toEqual({ p1: ['SAME_SHOT'] });
  });

  it('una sola frase larga no es una racha', () => {
    const long = SpokenText.of(Array.from({ length: 40 }, () => 'palabra').join(' '));
    const script = apply(
      unwrap(
        Script.create({ id: scriptId('sc_l'), format: VideoFormat.SHORT_VERTICAL, now: 0 }),
      ).addPhrase(phraseId('larga'), 'BODY', { text: long }),
    );
    expect(script.rhythmHints().size).toBe(0);
  });
});
