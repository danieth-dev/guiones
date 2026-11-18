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
