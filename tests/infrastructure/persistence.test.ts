import { describe, expect, it } from 'vitest';
import {
  fromRecord,
  InvalidDataError,
  LocalStorageSettingsStore,
  migrateToCurrent,
  parseSettings,
  toRecord,
} from '../../src/infrastructure';
import { audioId } from '../../src/domain';
import { apply, ids, shortScript } from '../domain/fixtures';

const validRecord = () => toRecord(apply(shortScript().attachTake(ids.body1, audioId('au_1'))));

const corrupt = (patch: (r: Record<string, unknown>) => void): unknown => {
  const record = structuredClone(validRecord()) as unknown as Record<string, unknown>;
  patch(record);
  return record;
};

/** Guion guardado por la versión anterior de la app (hooks, beats, tonos, idea suelta). */
const v4Record = () => ({
  schemaVersion: 4,
  id: 'viejo',
  title: 'Luz natural',
  narrativeId: 'TENSION_TURN',
  paceId: 'MEDIUM',
  speechRateWpm: 170,
  rawIdea: 'Una idea que dije de corrido',
  readyToShoot: true,
  fullTake: { audioId: 'au_full', answers: ['FRIEND'] },
  selectedHookId: 'hk_2',
  hookVariants: [
    {
      id: 'hk_1',
      archetype: 'CONTRARIAN',
      spokenText: 'Hook A',
      visualCue: '',
      voice: { audioId: null, verified: false },
      lever: null,
      score: null,
      snapshots: [],
    },
    {
      id: 'hk_2',
      archetype: 'OPEN_LOOP',
      spokenText: '¿Y si no es la cámara?',
      visualCue: 'Primer plano',
      voice: { audioId: 'au_hook', verified: true },
      lever: 'OPEN_QUESTION',
      score: null,
      snapshots: [],
    },
  ],
  beats: [
    {
      id: 'bt_2',
      order: 2,
      sectionType: 'CTA',
      spokenText: 'Sígueme',
      visualCue: '',
      tone: 'NATURAL',
      guide: '',
      voice: { audioId: null, verified: false },
      link: 'THEN',
      pauseAfter: 0,
    },
    {
      id: 'bt_1',
      order: 1,
      sectionType: 'RETENTION_BRIDGE',
      spokenText: 'Te cuento',
      visualCue: 'B-roll',
      tone: 'ENERGICO',
      guide: 'Contexto',
      voice: { audioId: 'au_b1', verified: false },
      link: 'BUT',
      pauseAfter: 1,
    },
  ],
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T11:00:00.000Z',
});

describe('Registro de guion (v5)', () => {
  it('ida y vuelta sin pérdida', () => {
    const record = validRecord();
    expect(record.schemaVersion).toBe(5);
    expect(record.formatId).toBe('SHORT_VERTICAL');
    expect(toRecord(fromRecord(structuredClone(record)))).toEqual(record);
  });

  it.each([
    ['formato desconocido', (r: Record<string, unknown>) => (r.formatId = 'PODCAST')],
    ['velocidad inválida', (r: Record<string, unknown>) => (r.wordsPerMinute = 5)],
    ['fecha inválida', (r: Record<string, unknown>) => (r.createdAt = 'ayer')],
    [
      'parte desconocida',
      (r: Record<string, unknown>) => ((r.phrases as Record<string, unknown>[])[0]!.section = 'X'),
    ],
    [
      'plano desconocido',
      (r: Record<string, unknown>) => ((r.phrases as Record<string, unknown>[])[0]!.shot = 'DRONE'),
    ],
    [
      'nota larga',
      (r: Record<string, unknown>) =>
        ((r.phrases as Record<string, unknown>[])[0]!.note = 'x'.repeat(200)),
    ],
    ['versión futura', (r: Record<string, unknown>) => (r.schemaVersion = 99)],
    ['versión sin migración', (r: Record<string, unknown>) => (r.schemaVersion = 0)],
  ])('rechaza registros con %s', (_name, patch) => {
    expect(() => fromRecord(corrupt(patch))).toThrow(InvalidDataError);
  });
});

describe('Migraciones', () => {
  it('v4 → v5: el hook elegido es el inicio, los beats son frases y la idea suelta no se pierde', () => {
    const script = fromRecord(v4Record());
    expect(script.format.id).toBe('MEDIUM_VERTICAL');
    expect(script.rate.wordsPerMinute).toBe(170);
    expect(
      script.phrases.map((p) => [p.id, p.section, p.text.value, p.energy, p.note.value, p.take]),
    ).toEqual([
      ['hk_2', 'OPENING', '¿Y si no es la cámara?', 'HIGH', 'Primer plano', 'au_hook'],
      ['bt_1', 'BODY', 'Te cuento', 'HIGH', 'B-roll', 'au_b1'],
      ['viejo_idea', 'BODY', 'Una idea que dije de corrido', 'NORMAL', '', null],
      ['bt_2', 'CLOSING', 'Sígueme', 'NORMAL', '', null],
    ]);
    expect(script.phrases[1]?.guide).toBe('Contexto');
  });

  it('sin hook elegido usa el primero escrito; sin hooks ni idea, solo los beats', () => {
    const noSelection = { ...v4Record(), selectedHookId: null, rawIdea: '' };
    expect(fromRecord(noSelection).phrases[0]?.id).toBe('hk_1');
    const bare = { ...v4Record(), hookVariants: [], rawIdea: '', paceId: 'LONG' };
    const script = fromRecord(bare);
    expect(script.format.id).toBe('LONG_HORIZONTAL');
    expect(script.phrases.map((p) => p.id)).toEqual(['bt_1', 'bt_2']);
    const allBody = { ...v4Record(), hookVariants: [], beats: [v4Record().beats[1]] };
    expect(fromRecord(allBody).phrases.map((p) => p.id)).toEqual(['bt_1', 'viejo_idea']);
    expect(() => fromRecord({ ...v4Record(), paceId: 'PODCAST' })).toThrow(InvalidDataError);
  });

  it('un guion v1 llega hasta v5 encadenando migraciones', () => {
    const { narrativeId: _n, paceId: _p, ...rest } = v4Record();
    const v1 = {
      ...rest,
      schemaVersion: 1,
      formatId: 'STORYTELLING',
      fullTake: undefined,
      hookVariants: rest.hookVariants.map(({ lever: _l, score: _s, snapshots: _x, ...h }) => h),
      beats: rest.beats.map(({ link: _l, pauseAfter: _pa, ...b }) => b),
    };
    const script = fromRecord(v1);
    expect(script.format.id).toBe('MEDIUM_VERTICAL');
    expect(script.phrases).toHaveLength(4);
  });

  it('aplica migraciones encadenadas hasta la versión objetivo', () => {
    const migrations = {
      1: (r: Readonly<Record<string, unknown>>) => ({ ...r, schemaVersion: 2, added: true }),
      2: (r: Readonly<Record<string, unknown>>) => ({ ...r, schemaVersion: 3 }),
    };
    expect(migrateToCurrent({ schemaVersion: 1 }, migrations, 3)).toEqual({
      schemaVersion: 3,
      added: true,
    });
  });
});

describe('Ajustes en localStorage', () => {
  it('ida y vuelta, y datos corruptos vuelven a los de fábrica', async () => {
    const data = new Map<string, string>();
    const store = new LocalStorageSettingsStore({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    });
    expect(await store.load()).toBeNull();
    await store.save({ defaultWpm: 150, theme: 'dark' });
    expect(await store.load()).toEqual({ defaultWpm: 150, theme: 'dark' });
    data.set('scriptflow.settings', '{roto');
    expect(await store.load()).toBeNull();
    expect(parseSettings({ defaultWpm: 1.5, theme: 'dark' })).toBeNull();
    expect(parseSettings({ defaultWpm: 150, theme: 'neon' })).toBeNull();
    expect(parseSettings(null)).toBeNull();
  });
});
