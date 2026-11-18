import {
  err,
  ok,
  scriptId,
  type AudioId,
  type Mutation,
  type Result,
  type Script,
} from '../../domain';
import { toScriptView, type ScriptView } from '../dto/script-view';
import type { AudioStore } from '../ports/audio-store';
import type { ScriptRepository } from '../ports/script-repository';
import type { Clock } from '../ports/system';
import { appError, scriptNotFound, type AppError } from '../shared/app-error';

export type ScriptChange = (script: Script) => Result<Mutation> | Result<Mutation, AppError>;

/**
 * Unidad de trabajo compartida por los comandos sobre un guion:
 * cargar → aplicar el cambio del dominio → guardar → borrar audios que ya no se usan.
 * Además traduce cualquier excepción de los adaptadores a `STORAGE_FAILURE`.
 */
export class ScriptWorkspace {
  constructor(
    private readonly scripts: ScriptRepository,
    private readonly audio: AudioStore,
    private readonly clock: Clock,
  ) {}

  view(script: Script): ScriptView {
    return toScriptView(script);
  }

  async load(id: string): Promise<Result<Script, AppError>> {
    return this.guard(async () => {
      const script = await this.scripts.findById(scriptId(id));
      return script ? ok(script) : err(scriptNotFound());
    });
  }

  async mutate(id: string, change: ScriptChange): Promise<Result<ScriptView, AppError>> {
    return this.guard(async () => {
      const loaded = await this.load(id);
      if (!loaded.ok) return loaded;
      const result = change(loaded.value);
      if (!result.ok) return result;
      const { events } = result.value;
      if (events.length === 0) return ok(this.view(loaded.value));

      const script = result.value.script.touched(this.clock.now());
      await this.scripts.save(script);
      await this.discardAudio(
        events.flatMap((event) => (event.type === 'AudioDiscarded' ? [event.audioId] : [])),
      );
      return ok(this.view(script));
    });
  }

  /** Ejecuta código de infraestructura sin dejar escapar excepciones. */
  async guard<T>(work: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>> {
    try {
      return await work();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return err(appError('STORAGE_FAILURE', `No se pudo acceder al almacenamiento: ${detail}`));
    }
  }

  /** Limpieza best-effort: un audio huérfano no debe hacer fallar la edición. */
  private async discardAudio(ids: readonly AudioId[]): Promise<void> {
    await Promise.allSettled(ids.map((id) => this.audio.delete(id)));
  }
}
