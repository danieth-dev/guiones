export type ThemePreference = 'light' | 'dark' | 'system';

/** Preferencias de la app (no del guion). */
export interface Settings {
  /** Palabras por minuto para los guiones nuevos. */
  readonly defaultWpm: number;
  readonly theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = { defaultWpm: 160, theme: 'light' };

/** Puerto de preferencias: guardar y leer un único registro. */
export interface SettingsStore {
  load(): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}
