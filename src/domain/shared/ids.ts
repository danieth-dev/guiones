import type { Brand } from './brand';

export type ScriptId = Brand<string, 'ScriptId'>;
export type PhraseId = Brand<string, 'PhraseId'>;
export type AudioId = Brand<string, 'AudioId'>;

export const scriptId = (value: string): ScriptId => value as ScriptId;
export const phraseId = (value: string): PhraseId => value as PhraseId;
export const audioId = (value: string): AudioId => value as AudioId;
