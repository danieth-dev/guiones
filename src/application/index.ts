/** API pública de la capa de aplicación (lo que la UI y la composición importan). */
export * from './app-services';
export * from './dto/script-view';
export type * from './ports/audio-store';
export type * from './ports/document-codec';
export type * from './ports/exporter';
export type * from './ports/media';
export type * from './ports/script-repository';
export * from './ports/settings-store';
export type * from './ports/system';
export * from './services/file-names';
export * from './shared/app-error';
export type * from './shared/use-case';
export type * from './use-cases/export-commands';
export type * from './use-cases/phrase-commands';
export type * from './use-cases/script-commands';
export type * from './use-cases/settings-commands';
export type * from './use-cases/take-commands';
