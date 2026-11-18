import type { Settings, SettingsStore, ThemePreference } from '../../application';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Registro crudo → preferencias; `null` si falta o está corrupto (se usan las de fábrica). */
export const parseSettings = (raw: unknown): Settings | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const { defaultWpm, theme } = raw as Record<string, unknown>;
  if (typeof defaultWpm !== 'number' || !Number.isInteger(defaultWpm)) return null;
  if (typeof theme !== 'string' || !THEMES.includes(theme as ThemePreference)) return null;
  return { defaultWpm, theme: theme as ThemePreference };
};

export class InMemorySettingsStore implements SettingsStore {
  private settings: Settings | null = null;

  load(): Promise<Settings | null> {
    return Promise.resolve(this.settings);
  }

  save(settings: Settings): Promise<void> {
    this.settings = settings;
    return Promise.resolve();
  }
}

/**
 * Preferencias en `localStorage` (dos valores pequeños, por dispositivo). Si el
 * navegador lo bloquea, la app sigue con las de fábrica.
 */
export class LocalStorageSettingsStore implements SettingsStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'>,
    private readonly key = 'scriptflow.settings',
  ) {}

  load(): Promise<Settings | null> {
    try {
      const raw = this.storage.getItem(this.key);
      return Promise.resolve(raw === null ? null : parseSettings(JSON.parse(raw)));
    } catch {
      return Promise.resolve(null);
    }
  }

  save(settings: Settings): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(settings));
    return Promise.resolve();
  }
}
