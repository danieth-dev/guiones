/** API pública del dominio. Las capas externas importan desde aquí. */
export * from './shared/result';
export * from './shared/domain-error';
export * from './shared/ids';
export type { Brand } from './shared/brand';

export * from './script/duration';
export * from './script/speech-rate';
export * from './script/spoken-text';
export * from './script/visual-cue';
export * from './script/phrase-parts';
export * from './script/video-format';
export * from './script/phrase';
export * from './script/script';

export * from './services/word-counter';
export * from './services/beat-splitter';
export * from './services/pace-calibration';
