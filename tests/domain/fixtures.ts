import {
  audioId,
  phraseId,
  Script,
  scriptId,
  SpokenText,
  VideoFormat,
  type Mutation,
  type Result,
} from '../../src/domain';

/** Extrae el valor de un Result o hace fallar el test con el mensaje del dominio. */
export const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`Se esperaba éxito: ${result.error.message}`);
  return result.value;
};

export const apply = (result: Result<Mutation>): Script => unwrap(result).script;

export const eventTypes = (result: Result<Mutation>): readonly string[] =>
  unwrap(result).events.map((event) => event.type);

export const errorCode = (result: Result<unknown>): string | null =>
  result.ok ? null : result.error.code;

export const ids = {
  opening: phraseId('fr_opening'),
  body1: phraseId('fr_body_1'),
  body2: phraseId('fr_body_2'),
  closing: phraseId('fr_closing'),
};

let audioCounter = 0;
export const nextAudioId = (): ReturnType<typeof audioId> =>
  audioId(`au_${String(++audioCounter)}`);

/** Vertical corto con inicio, dos frases de desarrollo y cierre, todas escritas. */
export const shortScript = (format: VideoFormat = VideoFormat.SHORT_VERTICAL): Script => {
  let script = unwrap(Script.create({ id: scriptId('sc_1'), format, now: 1_000 }));
  const add = (
    id: ReturnType<typeof phraseId>,
    section: 'OPENING' | 'BODY' | 'CLOSING',
    text: string,
  ) => {
    script = apply(script.addPhrase(id, section, { text: SpokenText.of(text) }));
  };
  add(ids.opening, 'OPENING', 'Grabé 30 videos con buena luz. Ninguno funcionó.');
  add(ids.body1, 'BODY', 'Cambié la cámara, el micrófono y hasta la edición.');
  add(ids.body2, 'BODY', 'Pero la gente se iba en el primer segundo.');
  add(ids.closing, 'CLOSING', 'Pruébalo en tu próximo video.');
  return script;
};
