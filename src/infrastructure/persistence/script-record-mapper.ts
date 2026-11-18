import {
  audioId,
  isEnergy,
  isSection,
  isShot,
  Phrase,
  phraseId,
  Script,
  scriptId,
  SpeechRate,
  SpokenText,
  VideoFormat,
  VisualCue,
  type Result,
} from '../../domain';
import {
  asArray,
  asEnum,
  asNullableString,
  asNumber,
  asObject,
  asString,
  InvalidDataError,
} from '../shared/json-guards';
import { migrateToCurrent } from './migrations';
import { CURRENT_SCHEMA_VERSION, type ScriptRecord } from './script-record';

/** Dominio → registro persistible (objeto plano, clonable por IndexedDB). */
export const toRecord = (script: Script): ScriptRecord => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: script.id,
  title: script.title,
  formatId: script.format.id,
  wordsPerMinute: script.rate.wordsPerMinute,
  phrases: script.phrases.map((phrase) => ({
    id: phrase.id,
    section: phrase.section,
    text: phrase.text.value,
    guide: phrase.guide,
    shot: phrase.shot,
    energy: phrase.energy,
    note: phrase.note.value,
    take: phrase.take,
  })),
  createdAt: new Date(script.createdAt).toISOString(),
  updatedAt: new Date(script.updatedAt).toISOString(),
});

const unwrapDomain = <T>(result: Result<T>, path: string): T => {
  if (!result.ok) throw new InvalidDataError(`${path}: ${result.error.message}`);
  return result.value;
};

const parseDate = (value: unknown, path: string): number => {
  const time = Date.parse(asString(value, path));
  if (Number.isNaN(time)) throw new InvalidDataError(`${path}: fecha inválida.`);
  return time;
};

/** Registro crudo (de cualquier versión conocida) → dominio. Lanza `InvalidDataError`. */
export const fromRecord = (raw: unknown): Script => {
  const record = migrateToCurrent(raw);
  const phrases = asArray(record.phrases, 'phrases').map((item, i) => {
    const path = `phrases[${String(i)}]`;
    const phrase = asObject(item, path);
    const shot = asNullableString(phrase.shot, `${path}.shot`);
    if (shot !== null && !isShot(shot))
      throw new InvalidDataError(`${path}.shot: plano desconocido.`);
    const take = asNullableString(phrase.take, `${path}.take`);
    return Phrase.restore({
      id: phraseId(asString(phrase.id, `${path}.id`)),
      section: asEnum(phrase.section, isSection, `${path}.section`),
      text: SpokenText.of(asString(phrase.text, `${path}.text`)),
      guide: asString(phrase.guide, `${path}.guide`),
      shot,
      energy: asEnum(phrase.energy, isEnergy, `${path}.energy`),
      note: unwrapDomain(VisualCue.create(asString(phrase.note, `${path}.note`)), `${path}.note`),
      take: take === null ? null : audioId(take),
    });
  });
  return Script.restore({
    id: scriptId(asString(record.id, 'id')),
    title: asString(record.title, 'title'),
    format: unwrapDomain(VideoFormat.byId(asString(record.formatId, 'formatId')), 'formatId'),
    rate: unwrapDomain(
      SpeechRate.create(asNumber(record.wordsPerMinute, 'wordsPerMinute')),
      'wordsPerMinute',
    ),
    phrases,
    createdAt: parseDate(record.createdAt, 'createdAt'),
    updatedAt: parseDate(record.updatedAt, 'updatedAt'),
  });
};
