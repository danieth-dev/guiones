import {
  createAppServices,
  type AppError,
  type AppServices,
  type IdPrefix,
  type ScriptRepository,
} from '../../src/application';
import type { Result } from '../../src/domain';
import {
  InMemoryAudioStore,
  InMemoryScriptRepository,
  InMemorySettingsStore,
  MarkdownDocumentCodec,
  MarkdownExporter,
  TextExporter,
} from '../../src/infrastructure';

/** App completa con adaptadores en memoria, ids secuenciales y reloj determinista. */
export interface Harness {
  readonly app: AppServices;
  readonly scripts: ScriptRepository;
  readonly audio: InMemoryAudioStore;
}

export const createHarness = (overrides: { scripts?: ScriptRepository } = {}): Harness => {
  let counter = 0;
  let time = 1_000;
  const scripts = overrides.scripts ?? new InMemoryScriptRepository();
  const audio = new InMemoryAudioStore();
  const app = createAppServices({
    scripts,
    audio,
    settings: new InMemorySettingsStore(),
    exporters: [new TextExporter(), new MarkdownExporter()],
    documents: new MarkdownDocumentCodec(),
    ids: { next: (prefix: IdPrefix) => `${prefix}_${String(++counter)}` },
    clock: { now: () => (time += 1_000) },
  });
  return { app, scripts, audio };
};

export const value = <T>(result: Result<T, AppError>): T => {
  if (!result.ok) throw new Error(`Se esperaba éxito: ${result.error.message}`);
  return result.value;
};

export const errorCode = <T>(result: Result<T, AppError>): string | null =>
  result.ok ? null : result.error.code;

export const voiceBlob = (label = 'toma'): Blob => new Blob([label], { type: 'audio/webm' });
