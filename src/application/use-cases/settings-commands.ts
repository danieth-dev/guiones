import { domainError, err, ok, SpeechRate, type Result } from '../../domain';
import {
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsStore,
  type ThemePreference,
} from '../ports/settings-store';
import type { ScriptWorkspace } from '../services/script-workspace';
import type { AppError } from '../shared/app-error';
import type { UseCase } from '../shared/use-case';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Lee las preferencias (o las de fábrica si nunca se guardaron). */
export class GetSettings implements UseCase<void, Settings> {
  constructor(
    private readonly store: SettingsStore,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(): Promise<Result<Settings, AppError>> {
    return this.workspace.guard(async () => ok((await this.store.load()) ?? DEFAULT_SETTINGS));
  }
}

export type UpdateSettingsInput = Partial<Settings>;

/** Valida y guarda las preferencias (velocidad dentro del rango del dominio). */
export class UpdateSettings implements UseCase<UpdateSettingsInput, Settings> {
  constructor(
    private readonly store: SettingsStore,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: UpdateSettingsInput): Promise<Result<Settings, AppError>> {
    return this.workspace.guard(async () => {
      const current = (await this.store.load()) ?? DEFAULT_SETTINGS;
      const next: Settings = { ...current, ...input };
      const rate = SpeechRate.create(next.defaultWpm);
      if (!rate.ok) return rate;
      if (!THEMES.includes(next.theme)) {
        return err(domainError('INVALID_VALUE', 'Tema desconocido.'));
      }
      await this.store.save(next);
      return ok(next);
    });
  }
}
