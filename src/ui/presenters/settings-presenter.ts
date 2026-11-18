import type { AppServices, ThemePreference, UpdateSettingsInput } from '../../application';
import { errorNotice, type AppState } from '../store/app-state';
import type { Store } from '../store/store';
import type { CommandRunner } from './command-runner';

/** Ajustes: velocidad de locución por defecto y tema. */
export class SettingsPresenter {
  constructor(
    private readonly app: AppServices,
    private readonly store: Store<AppState>,
    private readonly runner: CommandRunner,
  ) {}

  async load(): Promise<void> {
    const settings = await this.app.getSettings.execute();
    if (settings.ok) this.store.update({ settings: settings.value });
    else this.store.update({ notice: errorNotice('No se pudieron cargar tus ajustes.') });
  }

  open(): void {
    this.store.update({ settingsOpen: true, navOpen: false });
  }

  close(): void {
    this.store.update({ settingsOpen: false });
  }

  setDefaultWpm(wpm: number): Promise<boolean> {
    return this.update({ defaultWpm: wpm });
  }

  setTheme(theme: ThemePreference): Promise<boolean> {
    return this.update({ theme });
  }

  /** Usa una velocidad (la de los ajustes o la calibrada) en el guion abierto. */
  async applyWpmToCurrent(wpm: number): Promise<boolean> {
    const current = this.store.get().current;
    if (!current) return false;
    const view = await this.runner.runView(() =>
      this.app.configureScript.execute({ scriptId: current.id, wordsPerMinute: wpm }),
    );
    return view !== null;
  }

  private async update(input: UpdateSettingsInput): Promise<boolean> {
    const result = await this.runner.run(() => this.app.updateSettings.execute(input));
    if (!result.ok) return false;
    this.store.update({ settings: result.value });
    return true;
  }
}
