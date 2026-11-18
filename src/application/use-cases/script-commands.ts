import {
  err,
  ok,
  phraseId,
  Script,
  scriptId,
  SpeechRate,
  VideoFormat,
  type Result,
} from '../../domain';
import { toScriptSummary, type ScriptSummary, type ScriptView } from '../dto/script-view';
import type { AudioStore } from '../ports/audio-store';
import type { ScriptRepository } from '../ports/script-repository';
import type { Clock, IdGenerator } from '../ports/system';
import { chainChanges, type Step } from '../services/chain-changes';
import type { ScriptWorkspace } from '../services/script-workspace';
import { scriptNotFound, type AppError } from '../shared/app-error';
import type { UseCase } from '../shared/use-case';

export interface CreateScriptInput {
  readonly title?: string;
  /** Por defecto, vertical corto. */
  readonly formatId?: string;
  readonly wordsPerMinute?: number;
  /** Con el esqueleto del formato (inicio, desarrollo, cierre). Por defecto, sí. */
  readonly withSkeleton?: boolean;
}

/** Crea un guion nuevo con el esqueleto de su formato, para no empezar en blanco. */
export class CreateScript implements UseCase<CreateScriptInput, ScriptView> {
  constructor(
    private readonly scripts: ScriptRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: CreateScriptInput): Promise<Result<ScriptView, AppError>> {
    return this.workspace.guard(async () => {
      const format = input.formatId ? VideoFormat.byId(input.formatId) : ok(VideoFormat.DEFAULT);
      if (!format.ok) return format;
      const rate =
        input.wordsPerMinute === undefined
          ? ok(SpeechRate.DEFAULT)
          : SpeechRate.create(input.wordsPerMinute);
      if (!rate.ok) return rate;
      const script = Script.create({
        id: scriptId(this.ids.next('sc')),
        format: format.value,
        rate: rate.value,
        now: this.clock.now(),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...((input.withSkeleton ?? true)
          ? { nextPhraseId: () => phraseId(this.ids.next('fr')) }
          : {}),
      });
      if (!script.ok) return script;
      await this.scripts.save(script.value);
      return ok(this.workspace.view(script.value));
    });
  }
}

export interface ConfigureScriptInput {
  readonly scriptId: string;
  readonly title?: string;
  readonly formatId?: string;
  readonly wordsPerMinute?: number;
}

/** Título, formato de video y velocidad de locución. */
export class ConfigureScript implements UseCase<ConfigureScriptInput, ScriptView> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  execute(input: ConfigureScriptInput): Promise<Result<ScriptView, AppError>> {
    const steps: Step[] = [];
    if (input.title !== undefined) {
      const title = input.title;
      steps.push((s) => s.rename(title));
    }
    if (input.formatId !== undefined) {
      const format = VideoFormat.byId(input.formatId);
      if (!format.ok) return Promise.resolve(format);
      steps.push((s) => s.changeFormat(format.value));
    }
    if (input.wordsPerMinute !== undefined) {
      const rate = SpeechRate.create(input.wordsPerMinute);
      if (!rate.ok) return Promise.resolve(rate);
      steps.push((s) => s.changeRate(rate.value));
    }
    return this.workspace.mutate(input.scriptId, (script) => chainChanges(script, steps));
  }
}

/** Guiones del más reciente al más antiguo. */
export class ListScripts implements UseCase<void, readonly ScriptSummary[]> {
  constructor(
    private readonly scripts: ScriptRepository,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(): Promise<Result<readonly ScriptSummary[], AppError>> {
    return this.workspace.guard(async () => {
      const all = await this.scripts.findAll();
      return ok([...all].sort((a, b) => b.updatedAt - a.updatedAt).map(toScriptSummary));
    });
  }
}

export class GetScript implements UseCase<{ readonly scriptId: string }, ScriptView> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  async execute(input: { readonly scriptId: string }): Promise<Result<ScriptView, AppError>> {
    const script = await this.workspace.load(input.scriptId);
    return script.ok ? ok(this.workspace.view(script.value)) : script;
  }
}

/** Borra el guion y todas sus grabaciones. */
export class DeleteScript implements UseCase<{ readonly scriptId: string }, void> {
  constructor(
    private readonly scripts: ScriptRepository,
    private readonly audio: AudioStore,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: { readonly scriptId: string }): Promise<Result<void, AppError>> {
    return this.workspace.guard(async () => {
      const id = scriptId(input.scriptId);
      if (!(await this.scripts.findById(id))) return err(scriptNotFound());
      await this.scripts.delete(id);
      await this.audio.deleteByOwner(id);
      return ok(undefined);
    });
  }
}
