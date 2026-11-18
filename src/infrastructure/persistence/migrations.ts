import {
  asArray,
  asNumber,
  asObject,
  asString,
  InvalidDataError,
  type JsonObject,
} from '../shared/json-guards';
import { CURRENT_SCHEMA_VERSION } from './script-record';

/** Transforma un registro de la versión N a la N+1. */
export type Migration = (record: JsonObject) => JsonObject;

/**
 * Migraciones por versión de origen. Para cambiar el esquema:
 * 1) sube CURRENT_SCHEMA_VERSION, 2) agrega aquí `[versiónAnterior]: (r) => …`.
 */
/** v1 → v2: el formato único se reparte en intención narrativa + ritmo. */
const V1_FORMAT_TO_STRATEGY: Readonly<Record<string, { narrativeId: string; paceId: string }>> = {
  SHORT_VERTICAL: { narrativeId: 'PROMISE_DEMO_SYNTHESIS', paceId: 'SHORT' },
  STORYTELLING: { narrativeId: 'TENSION_TURN', paceId: 'MEDIUM' },
  DIRECT_TUTORIAL: { narrativeId: 'PROMISE_DEMO_SYNTHESIS', paceId: 'SHORT' },
};

const migrateV1ToV2: Migration = (record) => {
  const formatId = asString(record.formatId, 'script.formatId');
  const strategy = V1_FORMAT_TO_STRATEGY[formatId];
  if (!strategy) throw new InvalidDataError(`script.formatId: formato desconocido "${formatId}".`);
  const rest = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'formatId'));
  return { ...rest, ...strategy, schemaVersion: 2 };
};

/** Archetype → palanca por defecto (copia congelada: las migraciones no cambian). */
const V2_DEFAULT_LEVER: Readonly<Record<string, string | null>> = {
  CONTRARIAN: 'CONTRAST',
  EXPERIENCE: 'UNEXPECTED_RESULT',
  OPEN_LOOP: 'OPEN_QUESTION',
  CRITICAL_ERROR: 'COMMON_ERROR',
  CUSTOM: null,
};

/** v2 → v3: conectores, pausas, palancas, rúbrica y versiones con valores neutros. */
const migrateV2ToV3: Migration = (record) => ({
  ...record,
  schemaVersion: 3,
  beats: asArray(record.beats, 'script.beats').map((beat, i) => ({
    ...asObject(beat, `script.beats[${i}]`),
    link: 'THEN',
    pauseAfter: 0,
  })),
  hookVariants: asArray(record.hookVariants, 'script.hookVariants').map((raw, i) => {
    const hook = asObject(raw, `script.hookVariants[${i}]`);
    const archetype = asString(hook.archetype, `script.hookVariants[${i}].archetype`);
    return { ...hook, lever: V2_DEFAULT_LEVER[archetype] ?? null, score: null, snapshots: [] };
  }),
});

/** v3 → v4: sin toma completa ni lista de escucha todavía. */
const migrateV3ToV4: Migration = (record) => ({
  ...record,
  schemaVersion: 4,
  fullTake: { audioId: null, answers: [] },
});

/** Paso de ritmo (v4) a formato de video (v5). */
const V4_PACE_TO_FORMAT: Readonly<Record<string, string>> = {
  SHORT: 'SHORT_VERTICAL',
  MEDIUM: 'MEDIUM_VERTICAL',
  LONG: 'LONG_HORIZONTAL',
};

/** Tono (v4) → energía (v5). */
const V4_TONE_TO_ENERGY: Readonly<Record<string, string>> = {
  ENERGICO: 'HIGH',
  PAUSADO: 'CALM',
  CONFIDENCIAL: 'CALM',
};

const voiceTake = (raw: unknown, path: string): string | null => {
  const voice = asObject(raw, path);
  return voice.audioId === null || voice.audioId === undefined
    ? null
    : asString(voice.audioId, `${path}.audioId`);
};

/**
 * v4 → v5: el guion se simplifica a frases. El hook elegido (o el primero
 * escrito) pasa a ser la frase de inicio; los beats, frases de desarrollo o
 * cierre; el tono, energía; la idea suelta, una frase más antes del cierre.
 * Se descartan las variantes de hook no elegidas, conectores, pausas,
 * puntuaciones, versiones, la toma completa y "listo para grabar".
 */
const migrateV4ToV5: Migration = (record) => {
  const id = asString(record.id, 'script.id');
  const paceId = asString(record.paceId, 'script.paceId');
  const formatId = V4_PACE_TO_FORMAT[paceId];
  if (!formatId) throw new InvalidDataError(`script.paceId: ritmo desconocido "${paceId}".`);

  const hooks = asArray(record.hookVariants, 'script.hookVariants').map((raw, i) =>
    asObject(raw, `script.hookVariants[${String(i)}]`),
  );
  const selectedId = record.selectedHookId;
  const hook =
    hooks.find((h) => h.id === selectedId) ??
    hooks.find((h) => asString(h.spokenText, 'hook.spokenText').trim() !== '');
  const opening = hook
    ? [
        {
          id: asString(hook.id, 'hook.id'),
          section: 'OPENING',
          text: asString(hook.spokenText, 'hook.spokenText'),
          guide: '',
          shot: null,
          energy: 'HIGH',
          note: asString(hook.visualCue, 'hook.visualCue'),
          take: voiceTake(hook.voice, 'hook.voice'),
        },
      ]
    : [];

  const beats = asArray(record.beats, 'script.beats')
    .map((raw, i) => asObject(raw, `script.beats[${String(i)}]`))
    .sort((a, b) => asNumber(a.order, 'beat.order') - asNumber(b.order, 'beat.order'))
    .map((beat, i) => {
      const path = `script.beats[${String(i)}]`;
      return {
        id: asString(beat.id, `${path}.id`),
        section: asString(beat.sectionType, `${path}.sectionType`) === 'CTA' ? 'CLOSING' : 'BODY',
        text: asString(beat.spokenText, `${path}.spokenText`),
        guide: asString(beat.guide, `${path}.guide`),
        shot: null,
        energy: V4_TONE_TO_ENERGY[asString(beat.tone, `${path}.tone`)] ?? 'NORMAL',
        note: asString(beat.visualCue, `${path}.visualCue`),
        take: voiceTake(beat.voice, `${path}.voice`),
      };
    });

  const rawIdea = asString(record.rawIdea, 'script.rawIdea').trim();
  const idea = rawIdea
    ? [
        {
          id: `${id}_idea`,
          section: 'BODY',
          text: rawIdea,
          guide: '',
          shot: null,
          energy: 'NORMAL',
          note: '',
          take: null,
        },
      ]
    : [];
  const closingAt = beats.findIndex((b) => b.section === 'CLOSING');
  const body =
    closingAt < 0
      ? [...beats, ...idea]
      : [...beats.slice(0, closingAt), ...idea, ...beats.slice(closingAt)];

  return {
    schemaVersion: 5,
    id,
    title: asString(record.title, 'script.title'),
    formatId,
    wordsPerMinute: asNumber(record.speechRateWpm, 'script.speechRateWpm'),
    phrases: [...opening, ...body],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
};

/** Lleva un registro crudo (de cualquier versión conocida) a la versión actual. */
export const migrateToCurrent = (
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): JsonObject => {
  let record = asObject(raw, 'script');
  let version = asNumber(record.schemaVersion, 'script.schemaVersion');

  if (version > targetVersion) {
    throw new InvalidDataError(
      `script.schemaVersion: la versión ${version} es más nueva que la que entiende la app (${targetVersion}).`,
    );
  }
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new InvalidDataError(
        `script.schemaVersion: no hay migración desde la versión ${version}.`,
      );
    }
    record = migrate(record);
    version += 1;
  }
  return record;
};
